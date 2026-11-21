import os
import sys
import time
import json
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

from services.answer_verification_service import (
    retrieve_trusted_evidence,
    extract_technical_claims,
    _deterministic_fallback_verification,
)
from services.groq_service import _call_groq, _extract_json, _safe_print
from concurrent.futures import ThreadPoolExecutor

sample_results = [
    {"question": "What is the difference between a process and a thread?", "answer": "A process has isolated memory, while threads share the process's memory space.", "topic": "operating systems"},
    {"question": "Explain ACID properties.", "answer": "Atomicity, Consistency, Isolation, and Durability ensure reliable transactions.", "topic": "databases"},
    {"question": "What is an index in SQL?", "answer": "An index is a B-tree structure that speeds up query lookups.", "topic": "sql"},
    {"question": "What is HTTP GET vs POST?", "answer": "GET is safe and idempotent; POST creates resources.", "topic": "rest"},
    {"question": "Skipped question", "answer": "", "topic": "general"},
]

def batch_verify(results):
    t0 = time.time()
    verified_answers = [None] * len(results)
    items_to_verify = []

    # 1. Separate answered vs empty
    for idx, item in enumerate(results):
        q = item.get("question", "")
        a = item.get("answer", "") or item.get("candidate_answer", "")
        top = item.get("topic")

        if not a or len(a.strip()) < 5:
            verified_answers[idx] = {
                "correctness_score": 0,
                "verification_status": "No Answer Provided",
                "claims": [],
                "incorrect_statements": ["No substantial answer was provided to verify."],
                "explanation": "Candidate skipped or left the answer blank.",
                "corrected_answer": "Provide a complete technical explanation covering fundamental principles.",
                "evidence": [],
                "confidence": 1.0,
                "has_hallucinations": False,
            }
        else:
            ev = retrieve_trusted_evidence(f"{q} {a}", topic=top, top_k=2)
            claims = extract_technical_claims(a, q)
            items_to_verify.append((idx, q, a, top, ev, claims))

    if not items_to_verify:
        return verified_answers

    # 2. Batch verification via LLM in chunks of at most 5
    batch_size = 5
    chunks = [items_to_verify[i:i + batch_size] for i in range(0, len(items_to_verify), batch_size)]

    def _verify_chunk(chunk_idx, chunk):
        prompt_items = []
        for orig_idx, q, a, top, ev, claims in chunk:
            ev_text = " | ".join(e["passage"][:140] for e in ev) if ev else "Official computer science principles."
            prompt_items.append({
                "item_id": orig_idx,
                "question": q,
                "answer": a,
                "claims": claims,
                "evidence": ev_text
            })

        prompt = f"""You are an evidence-based technical fact-checking auditor.
Verify each candidate answer against the documentation evidence provided.

Return JSON in this format:
{{
  "verifications": [
    {{
      "item_id": 0,
      "correctness_score": 85,
      "verification_status": "Verified Correct",
      "claims": [{{"claim": "Processes have isolated memory", "status": "Correct", "explanation": "Accurate"}}],
      "incorrect_statements": [],
      "explanation": "Clear explanation.",
      "corrected_answer": "Concise verified model answer."
    }}
  ]
}}

Items to verify:
{json.dumps(prompt_items, indent=1)}"""

        messages = [{"role": "user", "content": prompt}]
        try:
            raw_resp = _call_groq(messages, json_mode=True, max_tokens=1500, temperature=0.1, context=f"batch_verify_{chunk_idx}")
            parsed = _extract_json(raw_resp)
            v_list = []
            if isinstance(parsed, dict) and "verifications" in parsed and isinstance(parsed["verifications"], list):
                v_list = parsed["verifications"]
            elif isinstance(parsed, list):
                v_list = parsed
            
            # Map by item_id or position
            chunk_results = []
            v_by_id = {v.get("item_id"): v for v in v_list if isinstance(v, dict) and "item_id" in v}
            for c_i, (orig_idx, q, a, top, ev, claims) in enumerate(chunk):
                item_v = v_by_id.get(orig_idx) or (v_list[c_i] if c_i < len(v_list) and isinstance(v_list[c_i], dict) else None)
                if item_v and "correctness_score" in item_v:
                    score = max(0, min(100, int(float(item_v.get("correctness_score", 70)))))
                    inc = item_v.get("incorrect_statements") or []
                    has_h = len(inc) > 0 or score < 60
                    st = item_v.get("verification_status") or ("Verified Correct" if score >= 85 and not inc else ("Verified with Issues" if score >= 60 else "Significant Inaccuracies Detected"))
                    chunk_results.append((orig_idx, {
                        "correctness_score": score,
                        "verification_status": st,
                        "claims": item_v.get("claims") or [],
                        "incorrect_statements": inc,
                        "explanation": item_v.get("explanation", "Evaluated against documentation."),
                        "corrected_answer": item_v.get("corrected_answer") or (ev[0]["passage"][:200] if ev else ""),
                        "evidence": ev,
                        "confidence": ev[0].get("confidence", 0.85) if ev else 0.75,
                        "has_hallucinations": has_h,
                    }))
                else:
                    # Fallback for this single item
                    chunk_results.append((orig_idx, _deterministic_fallback_verification(q, a, ev, claims)))
            return chunk_results
        except Exception as e:
            _safe_print(f"[BATCH VERIFY ERROR]: {e}")
            return [(orig_idx, _deterministic_fallback_verification(q, a, ev, claims)) for orig_idx, q, a, top, ev, claims in chunk]

    if len(chunks) == 1:
        res = _verify_chunk(0, chunks[0])
        for orig_idx, v_dict in res:
            verified_answers[orig_idx] = v_dict
    else:
        with ThreadPoolExecutor(max_workers=min(2, len(chunks))) as executor:
            futures = [executor.submit(_verify_chunk, idx, c) for idx, c in enumerate(chunks)]
            for future in futures:
                res = future.result()
                for orig_idx, v_dict in res:
                    verified_answers[orig_idx] = v_dict

    elapsed = time.time() - t0
    print(f"Total batch verification time: {elapsed:.2f}s for {len(results)} items")
    return verified_answers

out = batch_verify(sample_results)
for i, v in enumerate(out):
    print(f"Item {i+1}: score={v.get('correctness_score')}, status={v.get('verification_status')}, claims={len(v.get('claims', []))}")
