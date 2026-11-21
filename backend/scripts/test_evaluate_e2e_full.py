import os
import sys
import time
import json
from dotenv import load_dotenv

load_dotenv('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/.env')
sys.path.insert(0, 'd:/Smart-Interview-Coach/Smart-Interview-Coach/backend')

from app import app
from database import get_db_connection

def run_tests():
    print("==================================================================")
    print("STARTING COMPLETE END-TO-END AI EVALUATION INTEGRATION TEST SUITE")
    print("==================================================================")
    client = app.test_client()

    # 1. Prepare 10 questions with diverse answer types (Phase 3 requirements)
    questions = [
        "Explain Python's Global Interpreter Lock (GIL) and its impact on multi-threaded programs.",
        "What is the difference between a process and a thread?",
        "What protocol is connection-oriented and guarantees ordered packet delivery?",
        "How does indexing work in relational databases like PostgreSQL?",
        "What are SOLID principles in Object-Oriented Design?",
        "Describe how hash tables handle collisions.",
        "What is the difference between SQL and NoSQL databases?",
        "How does JavaScript event loop handle asynchronous tasks?",
        "Explain ACID properties in database management systems.",
        "What is Docker and how does containerization differ from virtualization?"
    ]

    answers = [
        "The GIL is a mutex that protects access to Python objects, preventing multiple threads from executing Python bytecodes simultaneously. It limits CPU-bound multi-threading, while I/O operations release the GIL.",
        "yjgnbnb", # gibberish - should NOT crash, should get 0 score
        "TCP", # one-word valid - should get high score
        "yes", # one-word invalid - should get 0 score
        "", # empty - should get 0 score and skipped feedback
        "skipped", # explicit skip - should get 0 score
        "I like cooking pasta with tomato sauce on weekends.", # completely irrelevant - should get 0 score
        "It uses an event loop with a single-threaded call stack, microtask queue for promises, and macrotask queue for timers.", # partially correct
        "Atomicity, Consistency, Isolation, and Durability ensure reliable transaction processing even in failure scenarios.", # technically correct
        "Docker uses OS-level virtualization with cgroups and namespaces rather than hypervisors, making containers much lighter than VMs." # detailed
    ]

    payload = {
        "role": "Full Stack Developer",
        "questions": questions,
        "answers": answers,
        "personality": "technical",
        "interview_mode": "text",
        "interview_type": "Standard",
        "duration_minutes": 15.0
    }

    print("\n--- TEST 1: POST /evaluate_answers (10 Questions, Mixed Answer Types) ---")
    t0 = time.time()
    response = client.post("/evaluate_answers", json=payload)
    dur = time.time() - t0

    print(f"Status Code: {response.status_code}")
    print(f"Elapsed Time: {dur:.2f}s")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.get_json()}"

    data = response.get_json()
    assert data.get("success") is True, f"Expected success=True, got {data}"
    results = data.get("results", [])
    print(f"Results Count: {len(results)}/10")
    assert len(results) == 10, f"Expected 10 results, got {len(results)}"

    summary = data.get("summary", {})
    assert isinstance(summary, dict), "Summary must be a dict"
    print(f"Summary Recommendation: {summary.get('recommendation')}")
    print(f"Summary Overview: {summary.get('summary')[:80]}...")

    interview_id = data.get("interview_id")
    print(f"Saved Interview ID: {interview_id}")
    assert interview_id is not None, "interview_id must be returned"

    # Verify each specific answer type
    print("\n--- TEST 2: Verify Answer Type Evaluation Accuracy ---")
    
    # Q1: Detailed GIL (should be high score)
    assert results[0]["technical_score"] >= 7, f"Expected Q1 >= 7, got {results[0]['technical_score']}"
    print(f"PASS Q1 (Detailed): score={results[0]['technical_score']}/10")

    # Q2: Gibberish 'yjgnbnb' (must be 0, no crash)
    assert results[1]["technical_score"] == 0, f"Expected Q2 == 0, got {results[1]['technical_score']}"
    assert results[1]["communication_score"] == 0
    print(f"PASS Q2 (Gibberish 'yjgnbnb'): score=0/10, mistakes={results[1]['mistakes'][:40]}...")

    # Q3: One-word valid 'TCP' (must be high score, not marked wrong)
    assert results[2]["technical_score"] >= 8, f"Expected Q3 >= 8, got {results[2]['technical_score']}"
    print(f"PASS Q3 (One-word 'TCP'): score={results[2]['technical_score']}/10")

    # Q4: One-word invalid 'yes' (must be 0)
    assert results[3]["technical_score"] == 0, f"Expected Q4 == 0, got {results[3]['technical_score']}"
    print(f"PASS Q4 (One-word 'yes'): score=0/10")

    # Q5: Empty (must be 0)
    assert results[4]["technical_score"] == 0, f"Expected Q5 == 0, got {results[4]['technical_score']}"
    print(f"PASS Q5 (Empty): score=0/10")

    # Q6: Explicit skip 'skipped' (must be 0)
    assert results[5]["technical_score"] == 0, f"Expected Q6 == 0, got {results[5]['technical_score']}"
    print(f"PASS Q6 (Skip): score=0/10")

    # Q7: Irrelevant 'pasta' (must be 0)
    assert results[6]["technical_score"] == 0, f"Expected Q7 == 0, got {results[6]['technical_score']}"
    print(f"PASS Q7 (Irrelevant): score=0/10")

    # Q8: Partially correct (moderate score)
    assert results[7]["technical_score"] >= 5, f"Expected Q8 >= 5, got {results[7]['technical_score']}"
    print(f"PASS Q8 (Partially correct): score={results[7]['technical_score']}/10")

    # Q9: Technically correct (high score)
    assert results[8]["technical_score"] >= 8, f"Expected Q9 >= 8, got {results[8]['technical_score']}"
    print(f"PASS Q9 (Technically correct): score={results[8]['technical_score']}/10")

    # Q10: Detailed (high score)
    assert results[9]["technical_score"] >= 8, f"Expected Q10 >= 8, got {results[9]['technical_score']}"
    print(f"PASS Q10 (Detailed): score={results[9]['technical_score']}/10")

    # 3. Test Database Persistence
    print("\n--- TEST 3: Database Persistence Verification ---")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, role, avg_score, status FROM interviews WHERE id = ?", (interview_id,))
    row = cursor.fetchone()
    assert row is not None, f"Interview {interview_id} not found in database!"
    print(f"DB interviews row: id={row[0]}, role={row[1]}, avg_score={row[2]}, status={row[3]}")

    cursor.execute("SELECT COUNT(*) FROM interview_details WHERE interview_id = ?", (interview_id,))
    cnt = cursor.fetchone()[0]
    assert cnt == 10, f"Expected 10 details in DB, got {cnt}"
    print(f"PASS: Found all {cnt} questions persisted in interview_details table.")
    conn.close()

    # 4. Test Results Retrieval Endpoint (Refresh Simulation)
    print("\n--- TEST 4: GET /interview_results/<id> (Page Refresh Survival) ---")
    get_resp = client.get(f"/interview_results/{interview_id}")
    assert get_resp.status_code == 200, f"Expected 200 from results endpoint, got {get_resp.status_code}"
    get_data = get_resp.get_json()
    assert get_data.get("success") is True
    assert len(get_data.get("results", [])) == 10
    print(f"PASS: Results endpoint successfully returned 10 questions for interview #{interview_id}.")

    # 5. Test Idempotency / Retry Submission
    print("\n--- TEST 5: Duplicate Submission / Retry Handling ---")
    t_dup_start = time.time()
    dup_resp = client.post("/evaluate_answers", json=payload)
    t_dup_dur = time.time() - t_dup_start
    assert dup_resp.status_code == 200
    dup_data = dup_resp.get_json()
    assert dup_data.get("success") is True
    assert dup_data.get("interview_id") == interview_id, f"Expected same interview_id on retry, got {dup_data.get('interview_id')}"
    print(f"PASS: Idempotency returned cached results in {t_dup_dur:.4f}s with identical interview_id #{dup_data.get('interview_id')}.")

    print("\n==================================================================")
    print("ALL END-TO-END TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
