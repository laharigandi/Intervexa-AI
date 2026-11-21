import os
import time
import json
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/.env')
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
model = "qwen/qwen3.8-27b"

sample_10_qa = [
    ("What is the difference between a process and a thread?", "A process is an execution environment with private memory; a thread is a unit of execution within a process that shares memory."),
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

# Strategy 1: Single combined evaluation call for 10 answers
def test_single_combined_10():
    t0 = time.time()
    qa_text = ""
    for idx, (q, a) in enumerate(sample_10_qa, 1):
        qa_text += f"\n[Item {idx}]\nQ: {q}\nA: {a}\n"

    prompt = f"""You are an expert technical interviewer. Evaluate these 10 candidate answers.
Return a JSON array of exactly 10 evaluation objects corresponding to Items 1 through 10.
Schema per object:
{{
  "item": 1,
  "technical_score": 8,
  "communication_score": 8,
  "strengths": "1 concise sentence on what was well explained.",
  "mistakes": "1 concise sentence on missing details.",
  "improved_answer": "1-2 sentence refined answer.",
  "correct_answer": "1-2 sentence ideal answer.",
  "correct_concepts": ["concept1", "concept2"],
  "missing_concepts": ["concept3"],
  "improvement_suggestions": ["tip1"],
  "key_takeaways": ["takeaway1"],
  "follow_up_questions": ["followup1"]
}}

Items to evaluate:
{qa_text}
"""
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=3500,
        response_format={"type": "json_object"}
    )
    elapsed = time.time() - t0
    content = resp.choices[0].message.content
    parsed = json.loads(content)
    items = parsed if isinstance(parsed, list) else list(parsed.values())[0] if isinstance(list(parsed.values())[0], list) else []
    print(f"Strategy 1 (1 combined call for 10 Qs): Time = {elapsed:.2f}s, Parsed items = {len(items)}")

# Strategy 2: Two parallel batches of 5
def test_parallel_batches_5():
    t0 = time.time()
    def eval_chunk(chunk, chunk_id):
        qa_text = ""
        for idx, (q, a) in enumerate(chunk, 1):
            qa_text += f"\n[Item {idx}]\nQ: {q}\nA: {a}\n"
        prompt = f"""You are an expert technical interviewer. Evaluate these {len(chunk)} candidate answers.
Return a JSON array of exactly {len(chunk)} evaluation objects.
Schema per object:
{{
  "technical_score": 8,
  "communication_score": 8,
  "strengths": "1 concise sentence on what was well explained.",
  "mistakes": "1 concise sentence on missing details.",
  "improved_answer": "1-2 sentence refined answer.",
  "correct_answer": "1-2 sentence ideal answer.",
  "correct_concepts": ["concept1"],
  "missing_concepts": ["concept2"],
  "improvement_suggestions": ["tip1"],
  "key_takeaways": ["takeaway1"],
  "follow_up_questions": ["followup1"]
}}
Items:
{qa_text}"""
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        return json.loads(r.choices[0].message.content)

    c1 = sample_10_qa[:5]
    c2 = sample_10_qa[5:]
    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(eval_chunk, c1, 1)
        f2 = executor.submit(eval_chunk, c2, 2)
        r1 = f1.result()
        r2 = f2.result()
    elapsed = time.time() - t0
    print(f"Strategy 2 (2 parallel batches of 5): Time = {elapsed:.2f}s")

print("Running benchmarks...")
test_single_combined_10()
test_parallel_batches_5()
