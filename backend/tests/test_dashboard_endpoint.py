"""
Test Suite for Dashboard API endpoint logic, data calculation, and empty states.
Runs in-memory or with the SQLite database without requiring live LLM calls.
"""
import unittest
import sqlite3
import json
import uuid
import os
import sys

_test_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.abspath(os.path.join(_test_dir, ".."))
sys.path.insert(0, _backend_dir)

from app import app, get_db_connection
from database import init_db

class TestDashboardEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

    def test_new_user_empty_dashboard(self):
        """Newly registered user with no data should return total=0, average=None, best=None, readiness=0, has_active_resume=False"""
        email = f"empty_{uuid.uuid4().hex[:6]}@example.com"
        reg = self.client.post("/signup", json={
            "name": "New Candidate",
            "email": email,
            "password": "Password123!"
        })
        self.assertEqual(reg.status_code, 200)
        token = reg.get_json()["token"]

        dash = self.client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(dash.status_code, 200)
        data = dash.get_json()

        self.assertEqual(data["total"], 0)
        self.assertIsNone(data["average"])
        self.assertIsNone(data["best"])
        self.assertEqual(data["readiness_score"], 0)
        self.assertFalse(data["has_active_resume"])
        self.assertIsNone(data["active_resume"])
        self.assertEqual(len(data["score_trends"]), 0)
        self.assertEqual(len(data["topic_breakdown"]), 0)

    def test_user_with_active_resume_and_interviews(self):
        """User with active resume and evaluated interviews receives accurate computed metrics."""
        email = f"active_{uuid.uuid4().hex[:6]}@example.com"
        reg = self.client.post("/signup", json={
            "name": "Active User",
            "email": email,
            "password": "Password123!"
        })
        self.assertEqual(reg.status_code, 200)
        token = reg.get_json()["token"]
        user_id = reg.get_json()["user"]["id"]

        # Directly insert an active resume and 2 completed interviews
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO resumes (user_id, filename, extracted_text, skills, analysis, jd_match, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (
            user_id,
            "Candidate_Resume.pdf",
            "Experienced Python developer with React and SQL skills.",
            json.dumps(["Python", "React", "SQL"]),
            json.dumps({"ats_score": 85, "missing_skills": ["Docker", "Kubernetes"]}),
            json.dumps({"match_score": 82, "role": "Senior Full Stack Engineer", "missing_skills": ["Docker"]})
        ))

        # Insert 1 completed interview (score 7.5, comm 8.0)
        cursor.execute("""
            INSERT INTO interviews (user_id, role, avg_score, communication_score, interview_mode, interview_type, status, created_at)
            VALUES (?, 'Senior Full Stack Engineer', 7.5, 8.0, 'standard', 'Standard', 'completed', '2026-11-10 10:00:00')
        """, (user_id,))
        inv1_id = cursor.lastrowid

        # Insert 1 in-progress interview (should be excluded!)
        cursor.execute("""
            INSERT INTO interviews (user_id, role, avg_score, communication_score, interview_mode, interview_type, status, created_at)
            VALUES (?, 'Senior Full Stack Engineer', NULL, NULL, 'standard', 'Standard', 'in_progress', '2026-11-11 10:00:00')
        """, (user_id,))

        # Insert 1 more completed interview (score 8.5, comm 9.0)
        cursor.execute("""
            INSERT INTO interviews (user_id, role, avg_score, communication_score, interview_mode, interview_type, status, created_at)
            VALUES (?, 'Senior Full Stack Engineer', 8.5, 9.0, 'adaptive', 'Adaptive', 'completed', '2026-11-12 10:00:00')
        """, (user_id,))
        inv2_id = cursor.lastrowid

        # Insert topic breakdown details
        cursor.execute("""
            INSERT INTO interview_details (interview_id, question, candidate_answer, technical_score, communication_score, topic)
            VALUES (?, 'What is closure in Python?', 'A closure retains enclosing scope.', 8.0, 8.5, 'Python Scope')
        """, (inv1_id,))
        cursor.execute("""
            INSERT INTO interview_details (interview_id, question, candidate_answer, technical_score, communication_score, topic)
            VALUES (?, 'Explain database indexing.', 'B-trees index rows for log(N) lookups.', 9.0, 9.0, 'SQL & Indexing')
        """, (inv2_id,))

        conn.commit()
        conn.close()

        dash = self.client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(dash.status_code, 200)
        data = dash.get_json()

        # Completed interviews count must be exactly 2 (in_progress excluded!)
        self.assertEqual(data["total"], 2)
        # Average of 7.5 and 8.5 = 8.0
        self.assertEqual(data["average"], 8.0)
        # Best is 8.5
        self.assertEqual(data["best"], 8.5)
        # Readiness: tech_pct=80, comm_pct=85 (avg_comm=8.5) -> 80*0.6 + 85*0.4 = 48 + 34 = 82
        self.assertEqual(data["readiness_score"], 82)
        # Active resume
        self.assertTrue(data["has_active_resume"])
        self.assertEqual(data["active_resume"]["filename"], "Candidate_Resume.pdf")
        self.assertEqual(data["active_resume"]["ats_score"], 85)
        # Score trends length = 2 (in chronological order)
        self.assertEqual(len(data["score_trends"]), 2)
        self.assertEqual(data["score_trends"][0]["id"], inv1_id)
        self.assertEqual(data["score_trends"][1]["id"], inv2_id)
        # Topic breakdown
        self.assertGreaterEqual(len(data["topic_breakdown"]), 2)

if __name__ == "__main__":
    unittest.main()
