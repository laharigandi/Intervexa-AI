import os
import sys
import time
import json
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

from groq import Groq
from services.answer_verification_service import retrieve_trusted_evidence, extract_technical_claims

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
model = "openai/gpt-oss-20b"

sample_10_qa = [
    ("What is the difference between a process and a thread?", "A process is an independent executing program with its own memory space, while a thread is a lightweight unit of execution within a process that shares memory with other threads in that process. Context switching between threads is faster than between processes."),
    ("Explain the ACID properties in database management systems.", "Atomicity means all or nothing. Consistency maintains schema rules. Isolation keeps concurrent transactions independent. Durability ensures committed data survives crashes."),
    ("What is an index in SQL and how does it work?", "An index is a B-tree data structure that speeds up read queries by avoiding full table scans, though it adds write overhead."),
    ("What is the difference between synchronous and asynchronous programming?", "Synchronous blocks execution until a task finishes. Asynchronous allows execution to continue and uses event loops or callbacks for completion."),
    ("Explain RESTful API design principles and HTTP methods.", "REST is stateless and uses standard HTTP methods: GET to read, POST to create, PUT to replace, and DELETE to remove resources."),
    ("What is the difference between TCP and UDP?", "TCP is connection-oriented, reliable, and ordered with handshakes. UDP is connectionless and faster, suited for streaming where dropped packets are acceptable."),
    ("What is garbage collection in programming languages like Java or Python?", "Garbage collection automatically reclaims memory occupied by objects that are no longer referenced by the application."),
    ("Explain how hashing works and what hash collisions are.", "Hashing maps arbitrary data to fixed-size values using a hash function. Collisions occur when two different inputs produce the same hash output."),
    ("What is the difference between Git merge and Git rebase?", "Merge creates a new commit joining two histories. Rebase rewrites history by moving the base of a branch on top of another."),
    ("How does HTTPS provide security compared to HTTP?", "HTTPS uses TLS/SSL encryption to secure data in transit, ensuring confidentiality, integrity, and server authentication through certificates.")
]

t0 = time.time()

# 1. Retrieve evidence for all 10 in-memory
items_to_verify = []
for idx, (q, a) in enumerate(sample_10_qa, 1):
    ev = retrieve_trusted_evidence(f"{q} {a}", top_k=2)
    claims = extract_technical_claims(a, q)
    ev_context = " | ".join(e["passage"][:120] for e in ev) if ev else "Standard computer science principles."
    items_to_verify.append({
        "item": idx,
        "question": q,
        "answer": a,
        "claims": claims,
        "evidence": ev_context
    })

t_rag = time.time() - t0
print(f"RAG retrieval for 10 items: {t_rag*1000:.2f}ms")

# 2. Single batch verification call
prompt = f"""You are an evidence-based technical fact-checking auditor.
Verify each candidate answer against the documentation evidence provided.

Return JSON in this exact structure:
{{
  "verifications": [
    {{
      "item": 1,
      "correctness_score": 90,
      "verification_status": "Verified Correct",
      "claims": [{{"claim": "Processes have private memory", "status": "Correct", "explanation": "Accurate"}}],
      "incorrect_statements": [],
      "explanation": "Clear explanation.",
      "corrected_answer": "Concise verified model answer."
    }}
  ]
}}

Items to verify:
{json.dumps(items_to_verify, indent=1)}"""

t_llm0 = time.time()
resp = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": prompt}],
    temperature=0.1,
    max_tokens=2200,
    response_format={"type": "json_object"}
)
t_llm = time.time() - t_llm0
content = resp.choices[0].message.content
parsed = json.loads(content)
verifs = parsed.get("verifications", [])
print(f"Batch verification LLM call: {t_llm:.2f}s | Verified items: {len(verifs)}")
if verifs:
    print(f"Sample item 1: score={verifs[0].get('correctness_score')}, status={verifs[0].get('verification_status')}")
    print(f"Sample item 10: score={verifs[-1].get('correctness_score')}, status={verifs[-1].get('verification_status')}")
