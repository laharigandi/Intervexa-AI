import os
import sys
import time
import json

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

from app import app
from flask_jwt_extended import create_access_token

test_10_questions = [
    "What is the difference between a process and a thread?",
    "Explain the ACID properties in database management systems.",
    "What is an index in SQL and how does it work?",
    "What is the difference between synchronous and asynchronous programming?",
    "Explain RESTful API design principles and HTTP methods.",
    "What is the difference between TCP and UDP?",
    "What is garbage collection in programming languages like Java or Python?",
    "Explain how hashing works and what hash collisions are.",
    "What is the difference between Git merge and Git rebase?",
    "How does HTTPS provide security compared to HTTP?"
]

test_10_answers = [
    "A process is an execution environment with private memory space, while a thread is a lightweight unit of execution within a process that shares memory with sibling threads.",
    "Atomicity ensures all-or-nothing execution, Consistency preserves schema invariants, Isolation keeps transactions independent, and Durability ensures committed updates survive crashes.",
    "An index is a B-tree data structure that speeds up SELECT queries by avoiding full table scans, with slight write overhead on INSERT and UPDATE.",
    "Synchronous execution blocks subsequent tasks until completion, whereas asynchronous execution uses event loops and non-blocking I/O to handle other tasks concurrently.",
    "REST is stateless and uses standard HTTP methods: GET to retrieve data, POST to create resources, PUT to replace resources, and DELETE to remove resources.",
    "TCP is connection-oriented, reliable, and ordered via 3-way handshakes. UDP is connectionless and lightweight, ideal for live video where minor packet loss is acceptable.",
    "Garbage collection automatically reclaims unreferenced heap memory to prevent memory leaks and dangling pointers.",
    "Hashing maps arbitrary input keys to fixed-size integers via a hash function. Collisions occur when distinct keys map to the exact same hash bucket.",
    "Git merge creates a merge commit preserving parallel branch history. Git rebase moves commits to the tip of another branch, maintaining a linear history.",
    "HTTPS uses TLS encryption to ensure confidentiality, data integrity, and server authentication via digital certificates."
]

print("=" * 60)
print("BENCHMARKING COMPLETE 10-QUESTION INTERVIEW EVALUATION PIPELINE")
print("=" * 60)

with app.app_context():
    token = create_access_token(identity="1")

with app.test_client() as client:
    t0 = time.time()
    payload = {
        "role": "Full Stack Developer",
        "questions": test_10_questions,
        "answers": test_10_answers,
        "personality": "technical",
        "interview_mode": "text",
        "interview_type": "Standard",
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("\nSending 10-question evaluation request...")
    response = client.post("/evaluate_answers", headers=headers, json=payload)
    elapsed = time.time() - t0
    
    print(f"\nResponse status code: {response.status_code}")
    print(f"Total end-to-end execution time: {elapsed:.2f} seconds!")
    
    data = response.get_json() or {}
    results = data.get("results", [])
    summary = data.get("summary", {})
    verifications = data.get("answer_verifications", [])
    timings = data.get("evaluation_timings", {})
    
    print(f"Success: {data.get('success')}")
    print(f"Total answers evaluated: {len(results)} / 10")
    print(f"Total verifications generated: {len(verifications)}")
    print(f"Summary recommendation: {summary.get('recommendation')}")
    print(f"Average technical score: {summary.get('technical_score') or (sum(r.get('technical_score',0) for r in results)/len(results) if results else 0):.1f}")
    print(f"Communication score: {summary.get('communication_score')}")
    print(f"Server-reported timings: {timings}")

    # Test idempotency (repeat exact submission)
    print("\nTesting idempotency on duplicate submission...")
    t_dup0 = time.time()
    dup_resp = client.post("/evaluate_answers", headers=headers, json=payload)
    t_dup = time.time() - t_dup0
    print(f"Duplicate submission response time: {t_dup*1000:.2f}ms (Status: {dup_resp.status_code})")
