import os
import time
import json
from dotenv import load_dotenv

load_dotenv('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/.env')
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

sample_10_qa = [
    ("What is the difference between a process and a thread?", "A process is an execution environment with private memory; a thread is a unit of execution within a process that shares memory."),
    ("Explain the ACID properties in database management systems.", "Atomicity means all or nothing. Consistency maintains schema rules. Isolation keeps concurrent transactions independent. Durability ensures committed data survives crashes."),
    ("What is an index in SQL and how does it work?", "An index is a B-tree data structure that speeds up read queries by avoiding full table scans, though it adds write overhead."),
    ("What is the difference between synchronous and asynchronous programming?", "Synchronous blocks execution until a task finishes. Asynchronous allows execution to continue and uses event loops or callbacks for completion."),
    ("Explain RESTful API design principles and HTTP methods.", "REST is stateless and uses standard HTTP methods: GET to read, POST to create, PUT to replace, and DELETE to remove resources."),
    ("What is the difference between TCP and UDP?", "TCP is connection-oriented, reliable, and ordered with handshakes. UDP is connectionless and faster, suited for streaming where dropped packets are acceptable."),
    ("What is garbage collection in programming languages like Java or Python?", "Garbage collection automatically reclaims memory occupied by objects that are no longer referenced by the application."),
    ("Explain how hashing works and what hash collisions are.", "Hashing maps arbitrary data to fixed-size values using a hash function. Collisions occur when two different inputs produce the hash output."),
    ("What is the difference between Git merge and Git rebase?", "Merge creates a new commit joining two histories. Rebase rewrites history by moving the base of a branch on top of another."),
    ("How does HTTPS provide security compared to HTTP?", "HTTPS uses TLS/SSL encryption to secure data in transit, ensuring confidentiality, integrity, and server authentication through certificates.")
]

for model_name in ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
    t0 = time.time()
    qa_text = ""
    for idx, (q, a) in enumerate(sample_10_qa, 1):
        qa_text += f"\n[{idx}] Q: {q}\nA: {a}\n"

    prompt = f"""You are an expert technical interviewer. Evaluate these 10 candidate answers.
Return JSON with key "evaluations" containing an array of 10 objects:
{{
  "evaluations": [
    {{
      "item": 1,
      "technical_score": 8,
      "communication_score": 8,
      "strengths": "Accurate explanation of process memory isolation.",
      "mistakes": "Could mention context switching overhead.",
      "improved_answer": "A process has isolated address space; threads share process memory.",
      "correct_answer": "Processes have independent memory spaces, while threads share heap and code segments.",
      "correct_concepts": ["Memory isolation", "Thread sharing"],
      "missing_concepts": ["IPC overhead"],
      "improvement_suggestions": ["Mention IPC vs shared memory"],
      "key_takeaways": ["Processes isolate, threads share"],
      "follow_up_questions": ["How do threads synchronize?"]
    }}
  ]
}}
Evaluate:
{qa_text}"""

    try:
        resp = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2500,
            response_format={"type": "json_object"}
        )
        elapsed = time.time() - t0
        content = resp.choices[0].message.content
        data = json.loads(content)
        evals = data.get("evaluations", [])
        print(f"\nModel: {model_name}")
        print(f"Time: {elapsed:.2f}s | Evaluations count: {len(evals)}")
        if evals:
            print(f"Sample Item 1: score={evals[0].get('technical_score')}, strengths={evals[0].get('strengths')[:60]}...")
    except Exception as e:
        elapsed = time.time() - t0
        print(f"\nModel: {model_name} FAILED in {elapsed:.2f}s: {e}")
