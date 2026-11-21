"""
Comprehensive End-to-End Functional Verification Script
for Intervexa AI - AI Interview Memory & Personalized Follow-up Engine
"""
import os
import sys
import json
import sqlite3
import unittest
from datetime import datetime

# Set backend directory in path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from database import init_db, get_db_connection
from app import app
from services.interview_memory_service import (
    record_interview_memory,
    get_interview_memory_overview,
    get_weak_areas,
    get_strong_areas,
    get_skill_progress,
    get_recent_improvements,
    get_next_interview_recommendations,
    generate_personalized_followup_question,
    reset_interview_memory,
)


class TestE2EInterviewMemoryEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()
        cls.user_a_email = f"user_a_{int(datetime.now().timestamp())}@test.com"
        cls.user_b_email = f"user_b_{int(datetime.now().timestamp())}@test.com"

        # Register & Login User A
        res_a = cls.client.post("/signup", json={
            "name": "Deepika User A",
            "email": cls.user_a_email,
            "password": "Password123!"
        })
        assert res_a.status_code in [200, 201], f"Signup A failed: {res_a.data}"
        login_a = cls.client.post("/login", json={
            "email": cls.user_a_email,
            "password": "Password123!"
        })
        assert login_a.status_code == 200, f"Login A failed: {login_a.data}"
        data_a = login_a.get_json()
        cls.token_a = data_a.get("access_token") or data_a.get("token")
        cls.user_a_id = data_a.get("user", {}).get("id")

        # Register & Login User B
        res_b = cls.client.post("/signup", json={
            "name": "Rahul User B",
            "email": cls.user_b_email,
            "password": "Password123!"
        })
        assert res_b.status_code in [200, 201], f"Signup B failed: {res_b.data}"
        login_b = cls.client.post("/login", json={
            "email": cls.user_b_email,
            "password": "Password123!"
        })
        assert login_b.status_code == 200, f"Login B failed: {login_b.data}"
        data_b = login_b.get_json()
        cls.token_b = data_b.get("access_token") or data_b.get("token")
        cls.user_b_id = data_b.get("user", {}).get("id")

        print(f"\n[SETUP] Test User A ID: {cls.user_a_id}, Test User B ID: {cls.user_b_id}")

    # =========================================================================
    # 1. VERIFY MEMORY CREATION
    # =========================================================================
    def test_01_verify_memory_creation(self):
        print("\n--- [TEST 1] VERIFY MEMORY CREATION ---")
        # Submit a real interview with weak SQL and good Python
        headers = {"Authorization": f"Bearer {self.token_a}"}
        eval_payload = {
            "role": "Python Full Stack Developer",
            "questions": [
                "Explain the difference between deep copy and shallow copy in Python.",
                "What is normalization in SQL and explain 1NF, 2NF, 3NF?",
                "What is the difference between INNER JOIN and LEFT JOIN in SQL?"
            ],
            "answers": [
                "A shallow copy copies references of nested objects, while a deep copy recursively duplicates all nested objects.",
                "Normalization is organizing data. I do not remember 1NF, 2NF, and 3NF rules.",
                "Inner join joins tables. Left join is something on the left."
            ],
            "durations": [45, 30, 25]
        }

        res = self.client.post("/evaluate_answers", json=eval_payload, headers=headers)
        self.assertEqual(res.status_code, 200, f"Evaluate answers failed: {res.data}")
        eval_data = res.get_json()
        self.assertIn("results", eval_data)
        self.assertEqual(len(eval_data["results"]), 3)

        # Verify SQLite Database records
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Check interviews table
        cur.execute("SELECT * FROM interviews WHERE user_id = ? ORDER BY id DESC LIMIT 1", (self.user_a_id,))
        inv_row = cur.fetchone()
        self.assertIsNotNone(inv_row, "Interview row not inserted into SQLite 'interviews'")
        interview_id = inv_row["id"]
        print(f"  -> SQLite Interview ID: {interview_id}, Avg Score: {inv_row['avg_score']}")

        # Check interview_memory table
        cur.execute("SELECT * FROM interview_memory WHERE user_id = ?", (self.user_a_id,))
        mem_row = cur.fetchone()
        self.assertIsNotNone(mem_row, "Memory summary row not inserted into SQLite 'interview_memory'")
        self.assertGreaterEqual(mem_row["total_completed_interviews"], 1)
        print(f"  -> SQLite Completed Interviews Count: {mem_row['total_completed_interviews']}")

        # Check candidate_skill_progress
        cur.execute("SELECT topic, latest_score, mastery_status FROM candidate_skill_progress WHERE user_id = ?", (self.user_a_id,))
        progress_rows = cur.fetchall()
        self.assertGreaterEqual(len(progress_rows), 1, "Skill progress rows not created")
        for r in progress_rows:
            print(f"  -> Skill Recorded: Topic='{r['topic']}', Score={r['latest_score']}%, Status='{r['mastery_status']}'")

        # Check topic_performance_history
        cur.execute("SELECT topic, score, identified_mistakes FROM topic_performance_history WHERE user_id = ?", (self.user_a_id,))
        history_rows = cur.fetchall()
        self.assertGreaterEqual(len(history_rows), 1, "Topic performance history not recorded")
        print(f"  -> History Entries Created: {len(history_rows)} topic evaluations logged.")

        conn.close()

    # =========================================================================
    # 2. VERIFY PERSONALIZED FOLLOW-UP QUESTION GENERATION
    # =========================================================================
    def test_02_verify_personalized_followup(self):
        print("\n--- [TEST 2] VERIFY PERSONALIZED FOLLOW-UP QUESTION ---")
        headers = {"Authorization": f"Bearer {self.token_a}"}

        # Request personalized follow-up question
        payload = {
            "role": "Python Full Stack Developer",
            "skills": ["Python", "SQL", "REST APIs"],
            "difficulty": "medium",
            "previous_questions": [
                "Explain the difference between deep copy and shallow copy in Python."
            ]
        }

        res = self.client.post("/api/interview-memory/personalized-questions", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200, f"Personalized question request failed: {res.data}")
        data = res.get_json()
        self.assertTrue(data.get("success"))
        q_obj = data.get("question")
        self.assertIsNotNone(q_obj)

        print(f"  -> Generated Question: '{q_obj.get('question')}'")
        print(f"  -> Topic Target: '{q_obj.get('topic')}'")
        print(f"  -> Question Type: '{q_obj.get('question_type')}'")
        print(f"  -> Reason: '{q_obj.get('reason')}'")
        print(f"  -> Memory Ref: '{q_obj.get('memory_reference')}'")

        self.assertIn("question", q_obj)
        self.assertTrue(len(q_obj["question"]) > 10)
        self.assertIn("topic", q_obj)

    # =========================================================================
    # 3. VERIFY SCORE IMPROVEMENT TRACKING
    # =========================================================================
    def test_03_verify_score_improvement(self):
        print("\n--- [TEST 3] VERIFY SCORE IMPROVEMENT (+35% DELTA) ---")
        # Step A: Explicitly set previous SQL score to 40%
        record_interview_memory(
            user_id=self.user_a_id,
            role="Python Developer",
            interview_mode="standard",
            results=[{
                "topic": "SQL Joins",
                "technical_score": 4,  # 40%
                "communication_score": 5,
                "strengths": "Understands joins connect tables.",
                "mistakes": "Could not explain difference between inner and outer joins.",
                "missing_concepts": ["ON clause", "Outer joins"],
                "improvement_suggestions": ["Practice multi-table joins."]
            }]
        )

        # Step B: Record subsequent high performance (8/10 = 80%, improvement: +40%)
        record_interview_memory(
            user_id=self.user_a_id,
            role="Python Developer",
            interview_mode="standard",
            results=[{
                "topic": "SQL Joins",
                "technical_score": 8,  # 80%
                "communication_score": 8,
                "strengths": "Thorough explanation of inner, left, and full outer joins.",
                "mistakes": "Minor syntax clarification on cross joins.",
                "missing_concepts": [],
                "improvement_suggestions": ["Optimize query index usage."]
            }]
        )

        # Verify database calculation
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM candidate_skill_progress WHERE user_id = ? AND topic = 'SQL Joins'", (self.user_a_id,))
        sql_prog = cur.fetchone()
        self.assertIsNotNone(sql_prog)

        prev_score = sql_prog["previous_score"]
        latest_score = sql_prog["latest_score"]
        delta = latest_score - prev_score

        print(f"  -> SQLite SQL Joins: Previous={prev_score}%, Latest={latest_score}%, Delta=+{delta}%")
        self.assertGreater(delta, 0, "Score delta must be positive after improvement")
        self.assertEqual(latest_score, 80)
        self.assertEqual(prev_score, 40)
        conn.close()

        # Check API response
        headers = {"Authorization": f"Bearer {self.token_a}"}
        res = self.client.get("/api/interview-memory/progress", headers=headers)
        self.assertEqual(res.status_code, 200)
        p_data = res.get_json()
        improvements = p_data.get("improvements", [])
        found_sql = any(imp["topic"] == "SQL Joins" and imp["improvement_trend"] > 0 for imp in improvements)
        self.assertTrue(found_sql, "SQL Joins improvement not found in /api/interview-memory/progress")
        print(f"  -> API Improvements confirmed: {improvements}")

    # =========================================================================
    # 4. VERIFY FRESH INTERVIEW (IGNORING MEMORY)
    # =========================================================================
    def test_04_verify_fresh_interview(self):
        print("\n--- [TEST 4] VERIFY FRESH INTERVIEW (NO PERSONALIZATION) ---")
        headers = {"Authorization": f"Bearer {self.token_a}"}

        # Start adaptive interview with personalized = False
        res = self.client.post("/adaptive/start", json={
            "role": "Frontend Developer",
            "skills": ["React", "JavaScript", "CSS"],
            "max_questions": 3,
            "personalized": False
        }, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        session = data.get("session")
        self.assertFalse(session.get("is_personalized", False), "Fresh interview must have is_personalized = False")
        print(f"  -> Fresh Adaptive Session Started. First question: '{session['current_question']}'")

    # =========================================================================
    # 5. VERIFY DASHBOARD & EMPTY STATE
    # =========================================================================
    def test_05_verify_dashboard_and_empty_state(self):
        print("\n--- [TEST 5] VERIFY DASHBOARD METRICS & NEW USER EMPTY STATE ---")
        # Check User A (with data)
        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        res_overview = self.client.get("/api/interview-memory/overview", headers=headers_a)
        self.assertEqual(res_overview.status_code, 200)
        ov_data = res_overview.get_json()["overview"]
        print(f"  -> User A Memory Overview: {ov_data}")
        self.assertGreaterEqual(ov_data["total_interviews"], 1)
        self.assertGreaterEqual(ov_data["topics_remembered"], 1)

        # Check User B (New User with 0 interviews)
        headers_b = {"Authorization": f"Bearer {self.token_b}"}
        res_overview_b = self.client.get("/api/interview-memory/overview", headers=headers_b)
        self.assertEqual(res_overview_b.status_code, 200)
        ov_data_b = res_overview_b.get_json()["overview"]
        print(f"  -> User B (Empty State) Overview: {ov_data_b}")
        self.assertEqual(ov_data_b["total_interviews"], 0)
        self.assertEqual(ov_data_b["topics_remembered"], 0)
        self.assertEqual(ov_data_b["weak_topics_count"], 0)
        self.assertEqual(ov_data_b["strong_topics_count"], 0)

        # Verify weak and strong endpoints
        res_weak = self.client.get("/api/interview-memory/weak-areas", headers=headers_a)
        self.assertEqual(res_weak.status_code, 200)
        res_strong = self.client.get("/api/interview-memory/strong-areas", headers=headers_a)
        self.assertEqual(res_strong.status_code, 200)

        # Verify recommendations endpoint
        res_rec = self.client.get("/api/interview-memory/recommendations", headers=headers_a)
        self.assertEqual(res_rec.status_code, 200)
        rec_data = res_rec.get_json()["recommendations"]
        print(f"  -> Recommendations Distribution: {rec_data.get('distribution')}")
        self.assertIn("distribution", rec_data)

    # =========================================================================
    # 6. VERIFY PERSISTENCE, CROSS-USER ISOLATION & MEMORY RESET
    # =========================================================================
    def test_06_verify_persistence_and_isolation(self):
        print("\n--- [TEST 6] VERIFY PERSISTENCE & CROSS-USER ISOLATION ---")
        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        headers_b = {"Authorization": f"Bearer {self.token_b}"}

        # Confirm User B cannot view User A's weak areas
        res_b_weak = self.client.get("/api/interview-memory/weak-areas", headers=headers_b)
        self.assertEqual(res_b_weak.status_code, 200)
        self.assertEqual(len(res_b_weak.get_json()["weak_areas"]), 0, "User B must not see User A's weak areas")
        print("  -> User isolation confirmed: User B weak areas list is isolated and empty.")

        # Test Reset Memory for User A
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as c FROM interviews WHERE user_id = ?", (self.user_a_id,))
        count_before = cur.fetchone()["c"]
        conn.close()

        res_reset = self.client.post("/api/interview-memory/reset", headers=headers_a)
        self.assertEqual(res_reset.status_code, 200)
        self.assertTrue(res_reset.get_json()["success"])
        print("  -> User A Memory Reset executed successfully.")

        # Confirm memory tables cleared for User A
        res_ov_after = self.client.get("/api/interview-memory/overview", headers=headers_a)
        ov_after = res_ov_after.get_json()["overview"]
        self.assertEqual(ov_after["topics_remembered"], 0)

        # Confirm interviews table is STILL INTACT (history preserved)
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as c FROM interviews WHERE user_id = ?", (self.user_a_id,))
        count_after = cur.fetchone()["c"]
        conn.close()

        self.assertEqual(count_before, count_after, "Resetting memory MUST NOT delete interview history!")
        print(f"  -> Interview History preserved: {count_after} interviews remain in database.")

    # =========================================================================
    # 7. VERIFY BOTH INTERVIEW MODES (STANDARD & ADAPTIVE LIFECYCLES)
    # =========================================================================
    def test_07_verify_both_interview_modes(self):
        print("\n--- [TEST 7] VERIFY BOTH INTERVIEW MODES ---")
        headers = {"Authorization": f"Bearer {self.token_a}"}

        # 1. Standard mode submission with durations
        std_payload = {
            "role": "Data Analyst",
            "questions": ["Explain standard deviation and variance."],
            "answers": ["Variance is the average of squared differences from the mean, and standard deviation is its square root."],
            "durations": [42]
        }
        res_std = self.client.post("/evaluate_answers", json=std_payload, headers=headers)
        self.assertEqual(res_std.status_code, 200)
        self.assertIn("results", res_std.get_json())
        print("  -> Standard Interview Mode verified.")

        # 2. Adaptive mode start -> answer -> finish lifecycle
        res_start = self.client.post("/adaptive/start", json={
            "role": "Data Analyst",
            "skills": ["SQL", "Statistics", "Python"],
            "max_questions": 2,
            "personalized": True
        }, headers=headers)
        self.assertEqual(res_start.status_code, 200)
        s_data = res_start.get_json()["session"]
        s_id = s_data["session_id"]

        # Submit answer to question 1
        res_ans = self.client.post("/adaptive/answer", json={
            "session_id": s_id,
            "answer": "A left join preserves all records from the left table and matches records from the right table.",
            "duration": 35
        }, headers=headers)
        self.assertEqual(res_ans.status_code, 200)
        ans_data = res_ans.get_json()
        self.assertIn("evaluation", ans_data)

        # Finish adaptive session
        res_fin = self.client.post("/adaptive/finish", json={"session_id": s_id}, headers=headers)
        self.assertEqual(res_fin.status_code, 200)
        fin_data = res_fin.get_json()
        self.assertTrue(fin_data.get("success"))
        print(f"  -> Adaptive Interview Mode completed. Final avg: {fin_data.get('final_average')}/10")

    # =========================================================================
    # 8. VERIFY GROQ INTEGRATION & FALLBACK RELIABILITY
    # =========================================================================
    def test_08_verify_groq_and_fallback(self):
        print("\n--- [TEST 8] VERIFY GROQ INTEGRATION & ERROR FALLBACK ---")
        # Direct call to generate_personalized_followup_question
        q_real = generate_personalized_followup_question(
            user_id=self.user_a_id,
            role="Backend Engineer",
            skills=["Python", "FastAPI", "PostgreSQL"],
            difficulty="medium",
            previous_questions=["What is FastAPI dependency injection?"]
        )
        self.assertIsInstance(q_real, dict)
        self.assertIn("question", q_real)
        self.assertIn("topic", q_real)
        print(f"  -> Real AI / Service Question: '{q_real['question']}' (Topic: {q_real['topic']})")

        # Test deterministic offline fallback when Groq unavailable
        from services.adaptive_interview_service import _get_fallback_question
        fallback_q = _get_fallback_question("DevOps Engineer", "hard", [])
        self.assertIn("question", fallback_q)
        self.assertEqual(fallback_q["difficulty"], "hard")
        print(f"  -> Fallback Question Verified: '{fallback_q['question']}'")


if __name__ == "__main__":
    unittest.main()
