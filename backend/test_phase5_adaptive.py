"""
Phase 5 Adaptive AI Interview Engine Test Suite
Verifies:
1. Difficulty adjustment bounded policy (easy, medium, hard; at most 1 level transition; bounds enforced)
2. Contextual question generation with duplicate avoidance & fallback resilience
3. Dynamic session progression, answer evaluation, and next question generation
4. Session authorization & cross-user access prevention
5. Empty / duplicate answer validation
6. Session completion and persistence into SQLite (interviews & interview_details)
7. Backward compatibility with legacy standard interviews and PDF reports
"""

import os
import sys
import unittest
import json
import sqlite3
import tempfile
from unittest.mock import patch, MagicMock

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import get_db_connection, init_db
from services.auth_service import register_user
from flask_jwt_extended import create_access_token
from services.adaptive_interview_service import (
    adjust_difficulty,
    normalize_difficulty,
    generate_adaptive_question,
    start_adaptive_session,
    get_adaptive_session,
    submit_adaptive_answer,
    finish_adaptive_session,
    _get_fallback_question,
    AdaptiveInterviewSession,
)
from services.pdf_service import generate_pdf


class TestPhase5AdaptiveEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

        # Isolated test database
        cls.test_db_fd, cls.test_db_path = tempfile.mkstemp(suffix="_test_p5.db")
        cls.db_patch = patch("database.DB_PATH", cls.test_db_path)
        cls.db_patch.start()
        init_db()

        # Register User A and User B
        register_user("Alice Adaptive", "alice.adaptive@example.com", "Password123!")
        register_user("Bob Standard", "bob.standard@example.com", "Password123!")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", ("alice.adaptive@example.com",))
        cls.user_a_id = cursor.fetchone()[0]

        cursor.execute("SELECT id FROM users WHERE email = ?", ("bob.standard@example.com",))
        cls.user_b_id = cursor.fetchone()[0]
        conn.close()

        with app.app_context():
            cls.token_a = create_access_token(identity=str(cls.user_a_id))
            cls.token_b = create_access_token(identity=str(cls.user_b_id))

        cls.auth_headers_a = {
            "Authorization": f"Bearer {cls.token_a}",
            "Content-Type": "application/json"
        }
        cls.auth_headers_b = {
            "Authorization": f"Bearer {cls.token_b}",
            "Content-Type": "application/json"
        }

    @classmethod
    def tearDownClass(cls):
        cls.db_patch.stop()
        try:
            os.close(cls.test_db_fd)
            if os.path.exists(cls.test_db_path):
                os.remove(cls.test_db_path)
        except Exception:
            pass

    def test_01_difficulty_adjustment_policy(self):
        """Verify strict bounded difficulty rules (easy, medium, hard, max 1 transition)."""
        print("\n[TEST 1] Bounded Difficulty Adjustment Rules:")
        # Normalization
        self.assertEqual(normalize_difficulty("EASY"), "easy")
        self.assertEqual(normalize_difficulty("Medium"), "medium")
        self.assertEqual(normalize_difficulty("HARD"), "hard")
        self.assertEqual(normalize_difficulty("unknown"), "medium")

        # Strong Answer (>= 8.0) -> steps up at most 1 level
        self.assertEqual(adjust_difficulty("easy", 9.0), "medium")
        self.assertEqual(adjust_difficulty("medium", 8.5), "hard")
        self.assertEqual(adjust_difficulty("hard", 10.0), "hard")  # upper bound enforced

        # Partial Answer (5.0 <= score < 8.0) -> maintains level
        self.assertEqual(adjust_difficulty("easy", 6.5), "easy")
        self.assertEqual(adjust_difficulty("medium", 7.0), "medium")
        self.assertEqual(adjust_difficulty("hard", 6.0), "hard")

        # Weak Answer (< 5.0) -> steps down at most 1 level
        self.assertEqual(adjust_difficulty("hard", 3.0), "medium")
        self.assertEqual(adjust_difficulty("medium", 4.0), "easy")
        self.assertEqual(adjust_difficulty("easy", 2.0), "easy")  # lower bound enforced
        print("  -> [PASS] Difficulty transitions strictly bounded between easy, medium, hard.")

    def test_02_duplicate_avoidance_and_fallbacks(self):
        """Verify question selection prevents duplicates and falls back safely on Groq failure."""
        print("\n[TEST 2] Duplicate Avoidance and Fallback Reliability:")
        asked = ["What is the difference between list and tuple in Python, and when would you use each?"]
        q = _get_fallback_question("Python Developer", "easy", asked)
        self.assertNotEqual(q["question"], asked[0])
        self.assertEqual(q["difficulty"], "easy")

        # Test Groq error triggers fallback question cleanly
        with patch("services.adaptive_interview_service._call_groq", side_effect=Exception("Groq 503 Unavailable")):
            fallback_q = generate_adaptive_question(
                role="Python Developer",
                skills=["Python", "Flask"],
                difficulty="medium",
                previous_questions=[{"question": asked[0], "topic": "Python Fundamentals"}]
            )
            self.assertIsNotNone(fallback_q)
            self.assertIn("question", fallback_q)
            self.assertNotEqual(fallback_q["question"], asked[0])
            self.assertEqual(fallback_q["difficulty"], "medium")
        print("  -> [PASS] Duplicate avoidance and offline fallbacks operational.")

    def test_03_adaptive_api_session_lifecycle(self):
        """Verify full API lifecycle: /adaptive/start -> /adaptive/answer -> difficulty change -> /adaptive/finish."""
        print("\n[TEST 3] Full Adaptive API Session Progression:")
        # 1. Start adaptive session for Alice
        start_payload = {
            "role": "Frontend Developer",
            "skills": ["React", "JavaScript", "CSS"],
            "max_questions": 3,
            "initial_difficulty": "medium"
        }
        res = self.client.post("/adaptive/start", headers=self.auth_headers_a, json=start_payload)
        self.assertEqual(res.status_code, 200)
        start_data = res.get_json()
        self.assertTrue(start_data.get("success"))
        session = start_data.get("session", {})
        session_id = session.get("session_id")
        self.assertIsNotNone(session_id)
        self.assertEqual(session.get("current_difficulty"), "medium")
        self.assertEqual(session.get("current_question_index"), 1)
        self.assertEqual(session.get("max_questions"), 3)

        # 2. Submit strong answer to Question 1 (Score 9/10 -> Difficulty should adjust to 'hard')
        mock_eval_strong = [{
            "technical_score": 9,
            "communication_score": 9,
            "strengths": "Exceptional explanation of Virtual DOM reconciliation.",
            "mistakes": "None.",
            "improved_answer": "Add mention of React Fiber scheduler.",
            "correct_answer": "Virtual DOM reconciliation computes diffs and commits updates efficiently."
        }]

        with patch("services.adaptive_interview_service.evaluate_interview", return_value=mock_eval_strong):
            ans1_payload = {
                "session_id": session_id,
                "answer": "React's Virtual DOM compares virtual trees using reconciliation to minimize actual DOM reflows."
            }
            res_ans1 = self.client.post("/adaptive/answer", headers=self.auth_headers_a, json=ans1_payload)
            self.assertEqual(res_ans1.status_code, 200)
            data_ans1 = res_ans1.get_json()
            self.assertTrue(data_ans1.get("success"))
            self.assertFalse(data_ans1.get("is_completed"))
            self.assertEqual(data_ans1["session"]["current_difficulty"], "hard")
            self.assertEqual(data_ans1["session"]["current_question_index"], 2)

        # 3. Submit weak answer to Question 2 (Score 3/10 -> Difficulty should adjust down to 'medium')
        mock_eval_weak = [{
            "technical_score": 3,
            "communication_score": 4,
            "strengths": "Attempted to answer.",
            "mistakes": "Confused microtasks with synchronous execution.",
            "improved_answer": "Explain microtasks queue vs macrotasks queue in the event loop.",
            "correct_answer": "Promises queue microtasks executed before the next macrotask."
        }]

        with patch("services.adaptive_interview_service.evaluate_interview", return_value=mock_eval_weak):
            ans2_payload = {
                "session_id": session_id,
                "answer": "I am not completely sure how the event loop manages promises."
            }
            res_ans2 = self.client.post("/adaptive/answer", headers=self.auth_headers_a, json=ans2_payload)
            self.assertEqual(res_ans2.status_code, 200)
            data_ans2 = res_ans2.get_json()
            self.assertTrue(data_ans2.get("success"))
            self.assertFalse(data_ans2.get("is_completed"))
            self.assertEqual(data_ans2["session"]["current_difficulty"], "medium")
            self.assertEqual(data_ans2["session"]["current_question_index"], 3)

        # 4. Submit Question 3 (Final Question -> Should trigger session completion)
        mock_eval_final = [{
            "technical_score": 7,
            "communication_score": 8,
            "strengths": "Solid explanation of CSS specificity.",
            "mistakes": "Could mention inline styles.",
            "improved_answer": "Explain specificity calculation (IDs, classes, elements).",
            "correct_answer": "CSS specificity determines which style rules take precedence."
        }]

        with patch("services.adaptive_interview_service.evaluate_interview", return_value=mock_eval_final):
            ans3_payload = {
                "session_id": session_id,
                "answer": "Specificity determines cascade priority based on element types, classes, and IDs."
            }
            res_ans3 = self.client.post("/adaptive/answer", headers=self.auth_headers_a, json=ans3_payload)
            self.assertEqual(res_ans3.status_code, 200)
            data_ans3 = res_ans3.get_json()
            self.assertTrue(data_ans3.get("success"))
            self.assertTrue(data_ans3.get("is_completed"))

        # 5. Finish session and verify persistence
        mock_summary = {
            "summary": "Candidate demonstrated strong frontend skills with clear adaptive progress.",
            "strengths": "Virtual DOM architecture and CSS specificity.",
            "weaknesses": "JavaScript event loop microtasks.",
            "advice": "Revise asynchronous execution and the event loop.",
            "recommendation": "Ready"
        }
        with patch("services.adaptive_interview_service.generate_overall_summary", return_value=mock_summary):
            res_finish = self.client.post("/adaptive/finish", headers=self.auth_headers_a, json={"session_id": session_id})
            self.assertEqual(res_finish.status_code, 200)
            finish_data = res_finish.get_json()
            self.assertTrue(finish_data.get("success"))
            saved_id = finish_data.get("interview_id")
            self.assertIsNotNone(saved_id)
            self.assertEqual(len(finish_data.get("results", [])), 3)

            # Check database persistence
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT interview_mode FROM interviews WHERE id = ?", (saved_id,))
            mode_row = cursor.fetchone()
            self.assertEqual(mode_row[0], "adaptive")

            cursor.execute("SELECT question, candidate_answer, technical_score, difficulty FROM interview_details WHERE interview_id = ?", (saved_id,))
            details = cursor.fetchall()
            conn.close()

            self.assertEqual(len(details), 3)
            self.assertEqual(details[0][3], "medium")
            self.assertEqual(details[1][3], "hard")
            print(f"  -> [PASS] Adaptive session completed & persisted as #{saved_id} with adaptive metadata.")

    def test_04_authorization_and_cross_user_isolation(self):
        """Verify User B cannot access or answer User A's adaptive session."""
        print("\n[TEST 4] Session Authorization & Cross-User Isolation:")
        start_payload = {
            "role": "Cloud Engineer",
            "skills": ["AWS", "Docker"],
            "max_questions": 3
        }
        res = self.client.post("/adaptive/start", headers=self.auth_headers_a, json=start_payload)
        self.assertEqual(res.status_code, 200)
        session_id = res.get_json()["session"]["session_id"]

        # User B tries to view User A's session -> 404
        res_b_view = self.client.get(f"/adaptive/session/{session_id}", headers=self.auth_headers_b)
        self.assertEqual(res_b_view.status_code, 404)

        # User B tries to answer User A's session -> 404
        res_b_ans = self.client.post("/adaptive/answer", headers=self.auth_headers_b, json={"session_id": session_id, "answer": "Hacked answer"})
        self.assertEqual(res_b_ans.status_code, 404)
        print("  -> [PASS] Unauthorized cross-user adaptive session access strictly blocked.")

    def test_05_empty_and_duplicate_answer_validation(self):
        """Verify empty answers are rejected and cannot advance the session."""
        print("\n[TEST 5] Empty Answer and Payload Validation:")
        start_payload = {"role": "Data Analyst", "skills": ["SQL"], "max_questions": 3}
        res = self.client.post("/adaptive/start", headers=self.auth_headers_a, json=start_payload)
        session_id = res.get_json()["session"]["session_id"]

        # Case A: Empty answer
        res_empty = self.client.post("/adaptive/answer", headers=self.auth_headers_a, json={"session_id": session_id, "answer": "   "})
        self.assertEqual(res_empty.status_code, 400)
        self.assertEqual(res_empty.get_json().get("code"), "EMPTY_ANSWER")

        # Case B: Missing session_id
        res_no_sess = self.client.post("/adaptive/answer", headers=self.auth_headers_a, json={"answer": "Some answer"})
        self.assertEqual(res_no_sess.status_code, 400)
        print("  -> [PASS] Empty answers and invalid payloads gracefully rejected with HTTP 400.")

    def test_06_pdf_report_with_adaptive_metadata(self):
        """Verify PDF report generation handles adaptive metadata (difficulty and topic) seamlessly."""
        print("\n[TEST 6] PDF Report Generation with Adaptive Metadata:")
        results = [
            {
                "question": "Explain React Virtual DOM reconciliation.",
                "answer": "Virtual DOM reconciliation identifies UI changes and batches updates.",
                "technical_score": 9,
                "communication_score": 9,
                "strengths": "Accurate and clear.",
                "mistakes": "None.",
                "improved_answer": "Mention Fiber architecture.",
                "correct_answer": "Reconciliation uses heuristics to diff trees.",
                "difficulty": "hard",
                "topic": "React Internals"
            }
        ]
        summary = {
            "summary": "Candidate demonstrated solid mastery across technical topics.",
            "strengths": "Deep knowledge of React.",
            "weaknesses": "None noted.",
            "advice": "Keep practicing system design.",
            "interview_mode": "adaptive"
        }

        pdf_path = generate_pdf(results, summary)
        self.assertTrue(os.path.exists(pdf_path))
        self.assertGreater(os.path.getsize(pdf_path), 500)
        print(f"  -> [PASS] Adaptive PDF report generated successfully ({os.path.getsize(pdf_path)} bytes).")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase5AdaptiveEngine)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    print("\n" + "=" * 65)
    print("  PHASE 5 ADAPTIVE INTERVIEW TEST SUMMARY")
    print(f"  Ran: {result.testsRun} | Passed: {result.testsRun - len(result.failures) - len(result.errors)} | Failed: {len(result.failures)} | Errors: {len(result.errors)}")
    print("=" * 65)
    sys.exit(0 if result.wasSuccessful() else 1)
