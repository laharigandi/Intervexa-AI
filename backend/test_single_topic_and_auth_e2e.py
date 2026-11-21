"""
End-to-End Test Suite for:
1. Single Topic Roadmap Generation (Python, SQL, React, etc.)
2. Beginner vs Advanced Level Handling
3. Roadmap Persistence, Refresh, Task Completion, and PDF Generation
4. Authentication Flow (Registration, Login, Token Generation, Protected /dashboard)
"""

import os
import sys
import unittest
import json
import io
import uuid
import pdfplumber

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import get_db_connection, init_db
from services.study_planner_service import generate_study_plan, get_study_plan_overview, update_task_status
from services.auth_service import register_user, login_user


class TestSingleTopicAndAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

        # Create unique test users
        cls.suffix = uuid.uuid4().hex[:6]
        cls.user_email = f"learner_{cls.suffix}@example.com"
        cls.password = "securepass123"
        cls.user_name = "Alex Developer"

        # Register user
        register_user(cls.user_name, cls.user_email, cls.password)
        user_dict = login_user(cls.user_email, cls.password)
        cls.user_id = user_dict["id"]

        # Log in via API to get JWT token
        res = cls.client.post("/login", json={"email": cls.user_email, "password": cls.password})
        data = res.get_json()
        cls.token = data["token"]
        cls.auth_headers = {"Authorization": f"Bearer {cls.token}"}

    def test_01_single_topic_python_generation(self):
        """Scenario 1: Generate a roadmap for a single topic (Python) without resume or interview history."""
        res = self.client.post(
            "/study-planner/generate",
            headers=self.auth_headers,
            json={
                "topic": "Python",
                "duration_days": 7,
                "daily_study_minutes": 60,
                "preparation_level": "Intermediate",
            }
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        plan = data["plan"]

        self.assertTrue(plan["has_active_plan"])
        self.assertEqual(plan["duration_days"], 7)
        self.assertEqual(len(plan["tasks"]), 7)
        self.assertEqual(plan["requested_topic"], "Python")

        # Verify task schema completeness
        t1 = plan["tasks"][0]
        self.assertIn("topic", t1)
        self.assertIn("subtopics", t1)
        self.assertIn("description", t1)
        self.assertIn("learning_objective", t1)
        self.assertIn("explanation", t1)
        self.assertIn("recommended_practice", t1)
        self.assertIn("completion_criteria", t1)
        self.assertIn("recommended_resources", t1)

        # Verify focus is Python
        all_topics_text = " ".join([t["topic"] for t in plan["tasks"]]).lower()
        self.assertIn("python", all_topics_text)

    def test_02_single_topic_sql_generation(self):
        """Scenario 2: Generate a roadmap for a single topic (SQL) with 14 days duration."""
        res = self.client.post(
            "/study-planner/generate",
            headers=self.auth_headers,
            json={
                "topic": "SQL",
                "duration_days": 14,
                "daily_study_minutes": 60,
                "preparation_level": "Intermediate",
            }
        )
        self.assertEqual(res.status_code, 200)
        plan = res.get_json()["plan"]
        self.assertEqual(plan["duration_days"], 14)
        self.assertEqual(plan["requested_topic"], "SQL")
        self.assertEqual(len(plan["tasks"]), 14)

        all_text = " ".join([t["topic"] for t in plan["tasks"]]).lower()
        self.assertIn("sql", all_text)

    def test_03_levels_beginner_and_advanced(self):
        """Scenario 3 & 4: Beginner and Advanced level single topic roadmaps."""
        # Beginner React
        res_beg = self.client.post(
            "/study-planner/generate",
            headers=self.auth_headers,
            json={
                "topic": "React",
                "duration_days": 7,
                "preparation_level": "Beginner",
            }
        )
        self.assertEqual(res_beg.status_code, 200)
        plan_beg = res_beg.get_json()["plan"]
        self.assertEqual(plan_beg["preparation_level"], "Beginner")

        # Advanced Machine Learning
        res_adv = self.client.post(
            "/study-planner/generate",
            headers=self.auth_headers,
            json={
                "topic": "Machine Learning",
                "duration_days": 7,
                "preparation_level": "Advanced",
            }
        )
        self.assertEqual(res_adv.status_code, 200)
        plan_adv = res_adv.get_json()["plan"]
        self.assertEqual(plan_adv["preparation_level"], "Advanced")

    def test_04_save_refresh_reopen_and_task_completion(self):
        """Scenario 8 & 9: Save in SQLite, refresh/reopen, and verify task completion."""
        # Fetch overview (simulating page reload)
        res = self.client.get("/study-planner/overview", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]
        self.assertTrue(data["has_active_plan"])
        self.assertEqual(data["requested_topic"], "Machine Learning")

        task_id = data["tasks"][0]["id"]
        self.assertEqual(data["completed_tasks"], 0)

        # Update task status to completed
        update_res = self.client.patch(
            f"/study-planner/tasks/{task_id}",
            headers=self.auth_headers,
            json={"status": "completed"}
        )
        self.assertEqual(update_res.status_code, 200)

        # Re-fetch and check completion
        res_after = self.client.get("/study-planner/overview", headers=self.auth_headers)
        data_after = res_after.get_json()["data"]
        self.assertEqual(data_after["completed_tasks"], 1)
        self.assertGreater(data_after["completion_rate_pct"], 0.0)

    def test_05_download_pdf_for_single_topic(self):
        """Scenario 10: Download the generated single-topic roadmap as a professional PDF."""
        res = self.client.get("/study-planner/pdf", headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, "application/pdf")
        self.assertIn("Intervexa_AI_Learning_Roadmap.pdf", res.headers.get("Content-Disposition", ""))

        pdf_bytes = res.data
        self.assertGreater(len(pdf_bytes), 2000)

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            all_text = " ".join(p.extract_text() for p in pdf.pages)
            self.assertIn("Machine Learning", all_text)
            self.assertIn("Personalized Learning Roadmap", all_text)

    def test_06_authentication_flow_and_protection(self):
        """
        Authentication Tests:
        - Registration returns user & token
        - Protected route /dashboard rejects unauthenticated requests (401)
        - Protected route accepts valid token (200)
        """
        # 1. Register a new account via /signup
        new_email = f"newuser_{uuid.uuid4().hex[:6]}@example.com"
        signup_res = self.client.post("/signup", json={
            "name": "Jordan Smith",
            "email": new_email,
            "password": "mypassword123"
        })
        self.assertEqual(signup_res.status_code, 200)
        signup_data = signup_res.get_json()
        self.assertTrue(signup_data["success"])
        self.assertIn("token", signup_data)
        self.assertIn("user", signup_data)
        self.assertEqual(signup_data["user"]["email"], new_email)

        # 2. Access /dashboard without auth -> MUST fail with 401
        dash_unauth = self.client.get("/dashboard")
        self.assertEqual(dash_unauth.status_code, 401)

        # 3. Access /dashboard with invalid token -> MUST fail with 401
        dash_invalid = self.client.get("/dashboard", headers={"Authorization": "Bearer invalid.fake.token"})
        self.assertEqual(dash_invalid.status_code, 401)

        # 4. Access /dashboard with fresh token from signup -> MUST succeed with 200
        new_token = signup_data["token"]
        dash_auth = self.client.get("/dashboard", headers={"Authorization": f"Bearer {new_token}"})
        self.assertEqual(dash_auth.status_code, 200)
        dash_data = dash_auth.get_json()
        self.assertTrue(dash_data.get("success", True))

    def test_07_validation_empty_topic_and_role(self):
        """Validation: Must fail with 400 if neither topic nor role is provided."""
        res = self.client.post(
            "/study-planner/generate",
            headers=self.auth_headers,
            json={"topic": "", "target_role": ""}
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("Topic is required", data["error"])


if __name__ == "__main__":
    unittest.main()

