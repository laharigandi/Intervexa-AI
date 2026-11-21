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

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
model = "openai/gpt-oss-20b"

sample_10_qa = [
    ("What is the difference between a process and a thread?", "A process is an execution environment with private memory space, while a thread is a lightweight unit of execution within a process that shares memory with sibling threads."),
    ("Explain the ACID properties in database management systems.", "Atomicity ensures all-or-nothing execution, Consistency preserves schema invariants, Isolation keeps transactions independent, and Durability ensures committed updates survive crashes."),
    ("What is an index in SQL and how does it work?", "An index is a B-tree data structure that speeds up SELECT queries by avoiding full table scans, with slight write overhead on INSERT and UPDATE."),
    ("What is the difference between synchronous and asynchronous programming?", "Synchronous execution blocks subsequent tasks until completion, whereas asynchronous execution uses event loops and non-blocking I/O to handle other tasks concurrently."),
    ("Explain RESTful API design principles and HTTP methods.", "REST is stateless and uses standard HTTP methods: GET to retrieve data, POST to create resources, PUT to replace resources, and DELETE to remove resources."),
    ("What is the difference between TCP and UDP?", "TCP is connection-oriented, reliable, and ordered via 3-way handshakes. UDP is connectionless and lightweight, ideal for live video where minor packet loss is acceptable."),
    ("What is garbage collection in programming languages like Java or Python?", "Garbage collection automatically reclaims unreferenced heap memory to prevent memory leaks and dangling pointers."),
    ("Explain how hashing works and what hash collisions are.", "Hashing maps arbitrary input keys to fixed-size integers via a hash function. Collisions occur when distinct keys map to the exact same hash bucket."),
    ("What is the difference between Git merge and Git rebase?", "Git merge creates a merge commit preserving parallel branch history. Git rebase moves commits to the tip of another branch, maintaining a linear history."),
    ("How does HTTPS provide security compared to HTTP?", "HTTPS uses TLS encryption to ensure confidentiality, data integrity, and server authentication via digital certificates.")
]

chunks = [sample_10_qa[:5], sample_10_qa[5:]]
all_evals = []

t0 = time.time()
for chunk_idx, chunk in enumerate(chunks, 1):
    qa_text = ""
    for idx, (q, a) in enumerate(chunk, 1):
        qa_text += f"\n[Item {idx}]\nQ: {q}\nA: {a}\n"

    prompt = f"""You are an expert technical interviewer.
Evaluate each candidate answer against its question.
Return a JSON object with key "evaluations" containing an array of exactly {len(chunk)} evaluation objects:
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
      "improvement_suggestions": ["suggestion1"],
      "key_takeaways": ["takeaway1"],
      "follow_up_questions": ["question1"]
    }}
  ]
}}

Items to evaluate:
{qa_text}"""

    tc0 = time.time()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=1800,
        response_format={"type": "json_object"}
    )
    tc = time.time() - tc0
    data = json.loads(resp.choices[0].message.content)
    evs = data.get("evaluations", [])
    print(f"Chunk {chunk_idx} (5 items): {tc:.2f}s | Returned count: {len(evs)} / 5")
    all_evals.extend(evs)

total_time = time.time() - t0
print(f"\nTotal evaluation time for all 10 items: {total_time:.2f}s | Total evaluations: {len(all_evals)} / 10")
