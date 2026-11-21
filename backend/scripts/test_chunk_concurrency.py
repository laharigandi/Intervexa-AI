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
from concurrent.futures import ThreadPoolExecutor

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
model = "qwen/qwen3.8-27b"

sample_10_qa = [
    ("What is the difference between a process and a thread?", "A process has isolated memory; a thread shares memory within a process."),
    ("Explain the ACID properties in database management systems.", "Atomicity, Consistency, Isolation, and Durability ensure reliable transactions."),
    ("What is an index in SQL and how does it work?", "An index is a B-tree structure that speeds up query lookups with slight write overhead."),
    ("What is the difference between synchronous and asynchronous programming?", "Synchronous blocks execution until complete. Asynchronous uses event loops to continue execution."),
    ("Explain RESTful API design principles and HTTP methods.", "REST is stateless and uses standard HTTP methods: GET, POST, PUT, DELETE."),
    ("What is the difference between TCP and UDP?", "TCP is reliable and connection-oriented. UDP is connectionless and faster."),
    ("What is garbage collection in programming languages like Java or Python?", "Garbage collection automatically reclaims unreferenced heap memory."),
    ("Explain how hashing works and what hash collisions are.", "Hashing maps inputs to fixed keys. Collisions occur when two distinct inputs yield the same key."),
    ("What is the difference between Git merge and Git rebase?", "Merge creates a merge commit preserving parallel history. Rebase linearizes commit history."),
    ("How does HTTPS provide security compared to HTTP?", "HTTPS uses TLS encryption to ensure confidentiality, integrity, and server authentication.")
]

# Chunks of 3, 3, 4
batch_size = 3
chunks = [sample_10_qa[i:i + batch_size] for i in range(0, len(sample_10_qa), batch_size)]

def eval_chunk(chunk_idx, chunk):
    qa_text = ""
    for idx, (q, a) in enumerate(chunk, 1):
        qa_text += f"\n[{idx}] Question: {q}\nCandidate Answer: {a}\n"

    prompt = f"""You are an expert technical interviewer. Evaluate these {len(chunk)} candidate answers.
Return a JSON object with key "evaluations" containing exactly {len(chunk)} objects:
{{
  "evaluations": [
    {{
      "item": 1,
      "technical_score": 8,
      "communication_score": 8,
      "strengths": "1 concise sentence.",
      "mistakes": "1 concise sentence.",
      "improved_answer": "1-2 concise sentences.",
      "correct_answer": "1-2 concise sentences.",
      "correct_concepts": ["concept1"],
      "missing_concepts": ["concept2"],
      "improvement_suggestions": ["tip1"],
      "key_takeaways": ["takeaway1"],
      "follow_up_questions": ["followup1"]
    }}
  ]
}}
Items:
{qa_text}"""

    t0 = time.time()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=900,
        response_format={"type": "json_object"}
    )
    t1 = time.time()
    content = resp.choices[0].message.content
    parsed = json.loads(content)
    items = parsed if isinstance(parsed, list) else list(parsed.values())[0] if isinstance(list(parsed.values())[0], list) else [parsed]
    print(f"Chunk {chunk_idx}: {t1-t0:.2f}s | Returned: {len(items)} / {len(chunk)}")
    return items

t_all0 = time.time()
with ThreadPoolExecutor(max_workers=3) as executor:
    futures = [executor.submit(eval_chunk, i, c) for i, c in enumerate(chunks)]
    all_results = [f.result() for f in futures]
t_all = time.time() - t_all0

total_items = sum(len(r) for r in all_results)
print(f"\nALL 10 ANSWERS EVALUATED IN: {t_all:.2f} seconds! Total items: {total_items}")
