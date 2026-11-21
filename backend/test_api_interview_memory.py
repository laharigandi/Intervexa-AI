import os
import sys
import unittest
import json

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import init_db, get_db_connection
from flask_jwt_extended import create_access_token


class TestInterviewMemoryAPI(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

        # Re-initialize DB
        init_db()

        # Seed test user
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE email = 'memory_test_user@example.com'")
        cur.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                    ("Memory Candidate", "memory_test_user@example.com", "testpass"))
        self.user_id = cur.lastrowid
        conn.commit()
        conn.close()

        with app.app_context():
            self.token = create_access_token(identity=str(self.user_id))

        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def tearDown(self):
        # Cleanup
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM interview_memory WHERE user_id = ?", (self.user_id,))
        cur.execute("DELETE FROM candidate_skill_progress WHERE user_id = ?", (self.user_id,))
        cur.execute("DELETE FROM topic_performance_history WHERE user_id = ?", (self.user_id,))
        cur.execute("DELETE FROM personalized_question_history WHERE user_id = ?", (self.user_id,))
        cur.execute("DELETE FROM interviews WHERE user_id = ?", (self.user_id,))
        cur.execute("DELETE FROM users WHERE id = ?", (self.user_id,))
        conn.commit()
        conn.close()

    def test_overview_unauthenticated(self):
        """Unauthenticated request to memory endpoint should return 401."""
        res = self.client.get("/api/interview-memory/overview")
        self.assertEqual(res.status_code, 401)

    def test_overview_new_user(self):
        """New user overview should show no memory and 0 interviews."""
        res = self.client.get("/api/interview-memory/overview", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertFalse(data["overview"]["has_memory"])
        self.assertEqual(data["overview"]["total_interviews"], 0)

    def test_update_and_query_memory_endpoints(self):
        """Simulate interview completion update, then test all query endpoints."""
        payload = {
            "role": "Python Developer",
            "interview_mode": "standard",
            "results": [
                {
                    "question": "Explain database normalization (1NF, 2NF, 3NF).",
                    "answer": "Incomplete answer.",
                    "technical_score": 4.5,
                    "mistakes": "Could not define 2NF and 3NF difference",
                    "missing_concepts": ["transitive dependencies", "atomic columns"],
                    "improvement_suggestions": ["Review normalization rules"],
                    "topic": "SQL & Database Design",
                },
                {
                    "question": "What is Python list comprehension vs generator expression?",
                    "answer": "Generators evaluate lazily and save memory.",
                    "technical_score": 9.0,
                    "mistakes": "",
                    "topic": "Python Fundamentals",
                }
            ],
            "overall_summary": {
                "summary": "Good Python foundations, database normalization needs study.",
                "recommendation": "Practice SQL relational design.",
            }
        }

        # 1. Update memory
        res = self.client.post("/api/interview-memory/update", headers=self.headers, json=payload)
        self.assertEqual(res.status_code, 200)
        up_data = res.get_json()
        self.assertTrue(up_data["success"])

        # 2. Test overview
        res = self.client.get("/api/interview-memory/overview", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        ov = res.get_json()["overview"]
        self.assertTrue(ov["has_memory"])
        self.assertEqual(ov["total_interviews"], 1)
        self.assertEqual(ov["weak_topics_count"], 1)  # SQL at 45%
        self.assertEqual(ov["strong_topics_count"], 1)  # Python at 90%

        # 3. Test weak areas
        res = self.client.get("/api/interview-memory/weak-areas", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        weak = res.get_json()["weak_areas"]
        self.assertEqual(len(weak), 1)
        self.assertEqual(weak[0]["topic"], "SQL & Database Design")
        self.assertEqual(weak[0]["latest_score"], 45.0)

        # 4. Test strong areas
        res = self.client.get("/api/interview-memory/strong-areas", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        strong = res.get_json()["strong_areas"]
        self.assertEqual(len(strong), 1)
        self.assertEqual(strong[0]["topic"], "Python Fundamentals")
        self.assertEqual(strong[0]["latest_score"], 90.0)

        # 5. Test progress endpoint
        res = self.client.get("/api/interview-memory/progress", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        prog_data = res.get_json()
        self.assertTrue(prog_data["success"])
        self.assertEqual(len(prog_data["progress"]), 2)

        # 6. Test recommendations endpoint (50% weak, 30% role, 20% advanced)
        res = self.client.get("/api/interview-memory/recommendations?role=Python%20Developer", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        rec_data = res.get_json()["recommendations"]
        self.assertIn("recommended_topics", rec_data)
        self.assertEqual(rec_data["distribution"]["weak_areas_pct"], 50)
        self.assertEqual(rec_data["distribution"]["target_role_pct"], 30)
        self.assertEqual(rec_data["distribution"]["advanced_new_pct"], 20)

        # First recommendation must be the weak area
        self.assertEqual(rec_data["recommended_topics"][0]["topic"], "SQL & Database Design")

        # 7. Test personalized follow-up question generation endpoint
        q_payload = {
            "role": "Python Developer",
            "skills": ["Python", "SQL"],
            "difficulty": "medium",
        }
        res = self.client.post("/api/interview-memory/personalized-questions", headers=self.headers, json=q_payload)
        self.assertEqual(res.status_code, 200)
        q_data = res.get_json()
        self.assertTrue(q_data["success"])
        self.assertIn("question", q_data["question"])

        # 8. Test memory reset endpoint
        res = self.client.post("/api/interview-memory/reset", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        reset_data = res.get_json()
        self.assertTrue(reset_data["success"])

        # Verify overview is cleared
        res = self.client.get("/api/interview-memory/overview", headers=self.headers)
        self.assertEqual(res.get_json()["overview"]["topics_remembered"], 0)


if __name__ == "__main__":
    unittest.main()

