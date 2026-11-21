import unittest
import sqlite3
import json
import os
import sys

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from database import get_db_connection, init_db
from services.skill_performance_service import (
    calculate_user_skill_performance,
    map_question_to_skills,
    normalize_role_name,
    ROLE_SKILLS,
    SKILL_DESCRIPTIONS,
)
from services.history_service import save_interview
import app as flask_app_module


class TestSkillPerformanceSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.conn = get_db_connection()
        cls.conn.row_factory = sqlite3.Row

    @classmethod
    def tearDownClass(cls):
        # Cleanup test interviews and users (IDs 999901 through 999920)
        cursor = cls.conn.cursor()
        cursor.execute("""
            DELETE FROM interview_details
            WHERE interview_id IN (
                SELECT id FROM interviews WHERE user_id BETWEEN 999901 AND 999920
            )
        """)
        cursor.execute("DELETE FROM interviews WHERE user_id BETWEEN 999901 AND 999920")
        cursor.execute("DELETE FROM users WHERE id BETWEEN 999901 AND 999920")
        cls.conn.commit()
        cls.conn.close()

    def _create_test_user(self, user_id, name, email):
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM interview_details WHERE interview_id IN (SELECT id FROM interviews WHERE user_id = ?)", (user_id,))
        cursor.execute("DELETE FROM interviews WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        cursor.execute(
            "INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)",
            (user_id, name, email, "hashed_pw")
        )
        self.conn.commit()

    def _create_interview(self, user_id, role, avg_score, questions_data, status="completed"):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO interviews (user_id, role, avg_score, status, interview_mode, interview_type)
            VALUES (?, ?, ?, ?, 'standard', 'Standard')
            """,
            (user_id, role, avg_score, status)
        )
        inv_id = cursor.lastrowid
        for q in questions_data:
            cursor.execute(
                """
                INSERT INTO interview_details (
                    interview_id, question, candidate_answer, technical_score,
                    communication_score, topic, assesses_skill, strengths, mistakes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    inv_id,
                    q.get("question", "Test question"),
                    q.get("answer", "Test answer"),
                    q.get("technical_score"),
                    q.get("communication_score", 7.0),
                    q.get("topic", ""),
                    q.get("assesses_skill", ""),
                    q.get("strengths", "Good attempt"),
                    q.get("mistakes", "Minor gap"),
                )
            )
        self.conn.commit()
        return inv_id

    # -------------------------------------------------------------------------
    # 1. User with no completed interviews
    # -------------------------------------------------------------------------
    def test_01_user_with_no_completed_interviews(self):
        uid = 999901
        self._create_test_user(uid, "User No Interviews", "user999901@test.com")
        res = calculate_user_skill_performance(uid, target_role="Full Stack Developer")

        self.assertTrue(res["success"])
        self.assertFalse(res["has_evaluations"])
        self.assertEqual(res["evaluated_count"], 0)
        self.assertIsNone(res["average_skill_score"])

        for skill_item in res["skills"]:
            self.assertEqual(skill_item["status"], "not_evaluated")
            self.assertEqual(skill_item["status_label"], "Not Evaluated")
            self.assertIsNone(skill_item["score_pct"])
            self.assertEqual(skill_item["score_display"], "Not evaluated yet")
            self.assertEqual(skill_item["progress_width"], 0)
            self.assertFalse(skill_item["is_evaluated"])
            # Never return a false 0% for unrated skills
            self.assertNotEqual(skill_item["score_display"], "0%")

    # -------------------------------------------------------------------------
    # 2. User with one completed interview
    # -------------------------------------------------------------------------
    def test_02_user_with_one_completed_interview(self):
        uid = 999902
        self._create_test_user(uid, "User Single Interview", "user999902@test.com")
        questions = [
            {"question": "Explain React hooks and useEffect dependency arrays.", "technical_score": 8.0, "topic": "React"},
            {"question": "How do database indexes improve query execution in SQL?", "technical_score": 7.0, "topic": "SQL"},
        ]
        self._create_interview(uid, "Frontend Developer", 7.5, questions)

        res = calculate_user_skill_performance(uid, target_role="Frontend Developer")
        self.assertTrue(res["success"])
        self.assertTrue(res["has_evaluations"])
        self.assertGreater(res["evaluated_count"], 0)

        # Single evaluated question for React -> status should be insufficient_data
        react_skill = next((s for s in res["skills"] if s["skill"] == "React"), None)
        self.assertIsNotNone(react_skill)
        self.assertEqual(react_skill["status"], "insufficient_data")
        self.assertEqual(react_skill["count"], 1)
        self.assertEqual(react_skill["score_pct"], 80.0)
        self.assertEqual(react_skill["score_display"], "80%")

        # Unrated skills must show not_evaluated
        css_skill = next((s for s in res["skills"] if s["skill"] == "CSS"), None)
        self.assertIsNotNone(css_skill)
        self.assertEqual(css_skill["status"], "not_evaluated")
        self.assertEqual(css_skill["score_display"], "Not evaluated yet")

    # -------------------------------------------------------------------------
    # 3. User with multiple completed interviews
    # -------------------------------------------------------------------------
    def test_03_user_with_multiple_completed_interviews(self):
        uid = 999903
        self._create_test_user(uid, "User Multiple Interviews", "user999903@test.com")
        self._create_interview(uid, "Backend Developer", 8.0, [
            {"question": "Explain Python generators and yield.", "technical_score": 8.0, "topic": "Python"},
            {"question": "What is an index in SQL?", "technical_score": 8.0, "topic": "SQL"},
        ])
        self._create_interview(uid, "Backend Developer", 9.0, [
            {"question": "How does the Python GIL impact multithreading?", "technical_score": 9.0, "topic": "Python"},
            {"question": "Explain SQL transactions and ACID.", "technical_score": 8.0, "topic": "SQL"},
        ])

        res = calculate_user_skill_performance(uid, target_role="Backend Developer")
        python_skill = next((s for s in res["skills"] if s["skill"] == "Python"), None)
        self.assertIsNotNone(python_skill)
        self.assertEqual(python_skill["count"], 2)
        # (8 + 9) / 20 * 100 = 85.0%
        self.assertEqual(python_skill["score_pct"], 85.0)
        self.assertEqual(python_skill["status"], "strong")
        self.assertEqual(python_skill["status_label"], "Strong Area")

    # -------------------------------------------------------------------------
    # 4. User with different scores for the same skill (Verification of exact formula)
    # -------------------------------------------------------------------------
    def test_04_different_scores_same_skill_formula(self):
        uid = 999904
        self._create_test_user(uid, "Formula Test User", "user999904@test.com")
        # Prompt example: 8/10, 6/10, 9/10 -> (8 + 6 + 9) / 30 * 100 = 76.67%
        questions = [
            {"question": "Python list comprehension and memory usage", "technical_score": 8.0, "topic": "Python"},
            {"question": "Python decorator implementation", "technical_score": 6.0, "topic": "Python"},
            {"question": "Python asyncio event loop mechanics", "technical_score": 9.0, "topic": "Python"},
        ]
        self._create_interview(uid, "Python Developer", 7.7, questions)

        res = calculate_user_skill_performance(uid, target_role="Python Developer")
        py_skill = next((s for s in res["skills"] if s["skill"] == "Python"), None)
        self.assertIsNotNone(py_skill)
        self.assertEqual(py_skill["count"], 3)
        self.assertAlmostEqual(py_skill["score_pct"], 76.7, places=1)
        self.assertEqual(py_skill["percentage"], 77)
        self.assertEqual(py_skill["status"], "strong")
        self.assertFalse(py_skill["needs_improvement"])

    # -------------------------------------------------------------------------
    # 5. User with different target roles
    # -------------------------------------------------------------------------
    def test_05_different_target_roles(self):
        uid = 999905
        self._create_test_user(uid, "Role Test User", "user999905@test.com")

        # Test all 12 roles return their distinct canonical skills
        for role_title, expected_skills in ROLE_SKILLS.items():
            res = calculate_user_skill_performance(uid, target_role=role_title)
            returned_skills = [s["skill"] for s in res["skills"]]
            self.assertEqual(returned_skills, expected_skills)
            self.assertEqual(res["target_role"], normalize_role_name(role_title))

    # -------------------------------------------------------------------------
    # 6. Interview with missing evaluation fields
    # -------------------------------------------------------------------------
    def test_06_missing_evaluation_fields(self):
        uid = 999906
        self._create_test_user(uid, "Missing Fields User", "user999906@test.com")
        questions = [
            # Missing topic and assesses_skill, question clearly mentions React
            {"question": "How does React useState trigger reconciliation?", "technical_score": 7.0, "topic": None, "assesses_skill": None},
            # Missing topic and assesses_skill, question clearly mentions SQL
            {"question": "Explain SQL joins and indexes.", "technical_score": 5.0, "topic": "", "assesses_skill": ""},
        ]
        self._create_interview(uid, "Full Stack Developer", 6.0, questions)

        res = calculate_user_skill_performance(uid, target_role="Full Stack Developer")
        self.assertTrue(res["success"])

        react_skill = next((s for s in res["skills"] if s["skill"] == "React"), None)
        self.assertIsNotNone(react_skill)
        self.assertEqual(react_skill["count"], 1)
        self.assertEqual(react_skill["score_pct"], 70.0)

        sql_skill = next((s for s in res["skills"] if s["skill"] == "SQL"), None)
        self.assertIsNotNone(sql_skill)
        self.assertEqual(sql_skill["count"], 1)
        self.assertEqual(sql_skill["score_pct"], 50.0)

    # -------------------------------------------------------------------------
    # 7. Fallback evaluation handling
    # -------------------------------------------------------------------------
    def test_07_fallback_evaluation_handling(self):
        uid = 999907
        self._create_test_user(uid, "Fallback Test User", "user999907@test.com")
        from services.groq_service import _build_fallback_questions
        fallback_qs = _build_fallback_questions("Java Developer", ["Core Java", "OOP", "Collections"])
        questions = [
            {"question": q, "technical_score": 6.0, "topic": "Core Java"}
            for q in fallback_qs[:3]
        ]
        self._create_interview(uid, "Java Developer", 6.0, questions)

        res = calculate_user_skill_performance(uid, target_role="Java Developer")
        self.assertTrue(res["success"])
        java_skill = next((s for s in res["skills"] if s["skill"] == "Core Java"), None)
        self.assertIsNotNone(java_skill)
        self.assertEqual(java_skill["count"], 3)
        self.assertEqual(java_skill["score_pct"], 60.0)
        self.assertEqual(java_skill["status"], "needs_improvement")
        self.assertEqual(java_skill["status_label"], "Needs Focus")

    # -------------------------------------------------------------------------
    # 8. Incomplete interview (in_progress or null score)
    # -------------------------------------------------------------------------
    def test_08_incomplete_interview_handling(self):
        uid = 999908
        self._create_test_user(uid, "Incomplete User", "user999908@test.com")
        # Incomplete session: status = 'in_progress' and avg_score = None
        self._create_interview(uid, "Frontend Developer", None, [
            {"question": "Explain React Virtual DOM", "technical_score": 0.0, "topic": "React"}
        ], status="in_progress")

        res = calculate_user_skill_performance(uid, target_role="Frontend Developer")
        # Incomplete interview must be completely ignored
        self.assertFalse(res["has_evaluations"])
        react_skill = next((s for s in res["skills"] if s["skill"] == "React"), None)
        self.assertIsNotNone(react_skill)
        self.assertEqual(react_skill["status"], "not_evaluated")
        self.assertEqual(react_skill["score_display"], "Not evaluated yet")

    # -------------------------------------------------------------------------
    # 9. Multiple users with separate skill histories
    # -------------------------------------------------------------------------
    def test_09_multiple_users_isolated_skill_histories(self):
        uid_a = 999909
        uid_b = 999910
        self._create_test_user(uid_a, "Candidate High Score", "user999909@test.com")
        self._create_test_user(uid_b, "Candidate Low Score", "user999910@test.com")

        # User A receives 9.0 on Python
        self._create_interview(uid_a, "Python Developer", 9.0, [
            {"question": "Python async generators", "technical_score": 9.0, "topic": "Python"},
            {"question": "Python memory models", "technical_score": 9.0, "topic": "Python"},
        ])
        # User B receives 3.0 on Python
        self._create_interview(uid_b, "Python Developer", 3.0, [
            {"question": "Python basic syntax", "technical_score": 3.0, "topic": "Python"},
            {"question": "Python loops", "technical_score": 3.0, "topic": "Python"},
        ])

        res_a = calculate_user_skill_performance(uid_a, target_role="Python Developer")
        res_b = calculate_user_skill_performance(uid_b, target_role="Python Developer")

        py_a = next((s for s in res_a["skills"] if s["skill"] == "Python"), None)
        py_b = next((s for s in res_b["skills"] if s["skill"] == "Python"), None)

        self.assertEqual(py_a["score_pct"], 90.0)
        self.assertEqual(py_a["status"], "strong")

        self.assertEqual(py_b["score_pct"], 30.0)
        self.assertEqual(py_b["status"], "needs_improvement")

    # -------------------------------------------------------------------------
    # 10. Existing historical interview records
    # -------------------------------------------------------------------------
    def test_10_existing_historical_interview_records(self):
        # Test on historical user 8954 and user 1
        res_8954 = calculate_user_skill_performance(8954, target_role="Frontend Developer")
        self.assertTrue(res_8954["success"])
        self.assertEqual(res_8954["target_role"], "Frontend Developer")
        self.assertEqual(len(res_8954["skills"]), 7)

        # Confirm non-evaluated skills show "Not evaluated yet" (NOT 0%)
        css_skill = next((s for s in res_8954["skills"] if s["skill"] == "CSS"), None)
        self.assertIsNotNone(css_skill)
        self.assertEqual(css_skill["status"], "not_evaluated")
        self.assertEqual(css_skill["score_display"], "Not evaluated yet")

        # Test on user 1
        res_user1 = calculate_user_skill_performance(1, target_role="Full Stack Developer")
        self.assertTrue(res_user1["success"])
        self.assertEqual(res_user1["target_role"], "Full Stack Developer")
        self.assertEqual(len(res_user1["skills"]), 7)

    # -------------------------------------------------------------------------
    # 11. Dashboard endpoint API integration test
    # -------------------------------------------------------------------------
    def test_11_dashboard_api_endpoint_payload(self):
        client = flask_app_module.app.test_client()
        with flask_app_module.app.app_context():
            from flask_jwt_extended import create_access_token
            token = create_access_token(identity="8954")

        resp = client.get("/dashboard?role=Frontend%20Developer", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()

        self.assertIn("skill_performance", data)
        self.assertIn("target_role", data)
        self.assertEqual(data["target_role"], "Frontend Developer")

        sp = data["skill_performance"]
        self.assertTrue(sp["success"])
        self.assertEqual(sp["target_role"], "Frontend Developer")
        self.assertEqual(len(sp["skills"]), 7)

        # Assert no false 0% string for unrated skills
        for s in sp["skills"]:
            if s["status"] == "not_evaluated":
                self.assertEqual(s["score_display"], "Not evaluated yet")
                self.assertIsNone(s["percentage"])


if __name__ == "__main__":
    unittest.main()
