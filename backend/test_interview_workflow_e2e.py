import sys
import os

sys.path.insert(0, os.path.abspath("Smart-Interview-Coach/backend"))
from app import app
from database import get_db_connection

def run_tests():
    client = app.test_client()
    print("==================================================")
    print("INTERVEXA AI - INTERVIEW EVALUATION WORKFLOW TESTS")
    print("==================================================")

    # 1. Test /api/generate_questions
    print("\n[TEST 1] Testing /api/generate_questions...")
    q_res = client.post("/api/generate_questions", json={
        "role": "Frontend Developer",
        "skills": ["React", "JavaScript", "CSS"],
        "personality": "technical"
    })
    assert q_res.status_code == 200, f"Expected 200, got {q_res.status_code}: {q_res.get_data(as_text=True)}"
    q_data = q_res.get_json()
    assert q_data.get("success") is True, "Question generation should be successful"
    questions = q_data.get("questions", [])
    print(f"Generated {len(questions)} questions.")
    assert len(questions) == 10, f"Expected exactly 10 questions, got {len(questions)}"
    print(">>> [TEST 1 PASSED]: Exactly 10 questions generated.")

    # 2. Test /api/evaluate_answers (Standard Interview)
    print("\n[TEST 2] Testing /api/evaluate_answers (10 questions, 10 answers)...")
    answers = [
        f"Answer {i}: In React and modern web development, this is handled through component state and optimized lifecycle methods."
        for i in range(1, 11)
    ]
    eval_res = client.post("/api/evaluate_answers", json={
        "role": "Frontend Developer",
        "questions": questions,
        "answers": answers,
        "personality": "technical",
        "interview_mode": "text",
        "interview_type": "Standard",
        "duration_minutes": 15.0
    })
    assert eval_res.status_code == 200, f"Expected 200, got {eval_res.status_code}: {eval_res.get_data(as_text=True)}"
    eval_data = eval_res.get_json()
    assert eval_data.get("success") is True, "Evaluation should succeed"
    results = eval_data.get("results", [])
    assert len(results) == 10, f"Expected 10 evaluation results, got {len(results)}"
    saved_id = eval_data.get("interview_id")
    assert saved_id is not None, "Interview ID must be returned and saved in database"
    summary = eval_data.get("summary", {})
    assert "summary" in summary or "recommendation" in summary, "Summary should be populated"
    print(f"Standard evaluation succeeded. Saved Interview ID #{saved_id}. Results: {len(results)}.")
    print(">>> [TEST 2 PASSED]: 10 answers evaluated and persisted.")

    # 3. Test /api/interview_results/<saved_id>
    print(f"\n[TEST 3] Testing /api/interview_results/{saved_id} for Results page refresh...")
    res_get = client.get(f"/api/interview_results/{saved_id}")
    assert res_get.status_code == 200, f"Expected 200, got {res_get.status_code}: {res_get.get_data(as_text=True)}"
    res_get_data = res_get.get_json()
    assert res_get_data.get("success") is True, "Results retrieval should succeed"
    retrieved_results = res_get_data.get("results", [])
    assert len(retrieved_results) == 10, f"Expected 10 retrieved results, got {len(retrieved_results)}"
    for idx, r in enumerate(retrieved_results):
        assert r.get("question"), f"Question missing for item {idx}"
        assert r.get("technical_score") is not None, f"Score missing for item {idx}"
    print(f"Retrieved interview #{saved_id} with {len(retrieved_results)} questions.")
    print(">>> [TEST 3 PASSED]: Interview results retrieved successfully for page refresh.")

    # 4. Test Adaptive Interview: Start -> Answer 10 Qs -> Finish
    print("\n[TEST 4] Testing Adaptive Interview complete cycle (Start -> Answer 10 Qs -> Finish)...")
    adapt_start = client.post("/api/adaptive/start", json={
        "role": "Python Backend Engineer",
        "skills": ["Python", "Flask", "PostgreSQL"],
        "max_questions": 10,
        "personality": "technical"
    })
    assert adapt_start.status_code == 200, f"Start failed: {adapt_start.status_code}"
    session_id = adapt_start.get_json()["session"]["session_id"]
    print(f"Adaptive session created: {session_id}")

    for q_num in range(1, 11):
        ans_res = client.post("/api/adaptive/answer", json={
            "session_id": session_id,
            "answer": f"Answer {q_num}: In Python, backend services scale horizontally using WSGI/ASGI workers and connection pools."
        })
        assert ans_res.status_code == 200, f"Answer {q_num} failed: {ans_res.get_data(as_text=True)}"
        ans_data = ans_res.get_json()
        if q_num == 10:
            assert ans_data.get("is_completed") is True, "Question 10 must complete session"
            print("Question 10 correctly marked session as completed.")

    finish_res = client.post("/api/adaptive/finish", json={"session_id": session_id})
    assert finish_res.status_code == 200, f"Finish failed: {finish_res.get_data(as_text=True)}"
    finish_data = finish_res.get_json()
    assert finish_data.get("success") is True, "Adaptive finish must succeed"
    adapt_results = finish_data.get("results", [])
    assert len(adapt_results) == 10, f"Expected 10 adaptive results, got {len(adapt_results)}"
    adapt_interview_id = finish_data.get("interview_id")
    assert adapt_interview_id is not None, "Adaptive interview ID must be saved"
    print(f"Adaptive interview completed and saved with ID #{adapt_interview_id}. Total results: {len(adapt_results)}")
    print(">>> [TEST 4 PASSED]: Adaptive interview complete 10-question evaluation verified.")

    # 5. Test Adaptive Interview Results Retrieval
    print(f"\n[TEST 5] Testing /api/interview_results/{adapt_interview_id} for Adaptive Interview...")
    adapt_get = client.get(f"/api/interview_results/{adapt_interview_id}")
    assert adapt_get.status_code == 200
    adapt_get_data = adapt_get.get_json()
    assert adapt_get_data.get("success") is True
    assert len(adapt_get_data.get("results", [])) == 10
    print(">>> [TEST 5 PASSED]: Adaptive interview results retrieved successfully.")

    # 6. Verify SQLite Database Records
    print("\n[TEST 6] Verifying SQLite database persistence...")
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, role, avg_score, interview_mode FROM interviews WHERE id IN (?, ?)", (saved_id, adapt_interview_id))
    rows = c.fetchall()
    assert len(rows) == 2, f"Expected 2 interviews in database, found {len(rows)}"
    for r in rows:
        interview_id = r[0] if isinstance(r, tuple) else r["id"]
        mode = r[3] if isinstance(r, tuple) else r["interview_mode"]
        c.execute("SELECT count(*) FROM interview_details WHERE interview_id = ?", (interview_id,))
        detail_count = c.fetchone()[0]
        assert detail_count == 10, f"Expected 10 details for interview #{interview_id}, found {detail_count}"
        print(f"Database verification: Interview #{interview_id} ({mode}) has {detail_count} question records.")
    conn.close()
    print(">>> [TEST 6 PASSED]: Database records completely verified in SQLite.")

    print("\n==================================================")
    print("ALL 6 TESTS PASSED SUCCESSFULLY! WORKFLOW IS ROBUST.")
    print("==================================================")

if __name__ == "__main__":
    run_tests()

