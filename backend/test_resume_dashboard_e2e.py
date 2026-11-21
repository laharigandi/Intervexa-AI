"""
E2E Test Suite for Resume-Specific Dashboard Results and Stale Data Clearing
Tests all 10 scenarios required by the specification.
"""
import os
import sys
import json
import sqlite3
import uuid
import io
import unittest

# Ensure path
_test_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _test_dir)

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from app import app, get_db_connection
from database import init_db


def create_test_pdf(text_content):
    """Generate a valid PDF in memory with custom resume text."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    y = 750
    for line in text_content.split("\n"):
        c.drawString(72, y, line)
        y -= 20
        if y < 72:
            c.showPage()
            y = 750
    c.save()
    buffer.seek(0)
    return buffer


class TestResumeSpecificDashboard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

        # Create two distinct test users
        cls.user1_email = f"user1_{uuid.uuid4().hex[:6]}@example.com"
        cls.user2_email = f"user2_{uuid.uuid4().hex[:6]}@example.com"
        cls.password = "Password123!"

        # Register User 1
        cls.client.post("/signup", json={
            "name": "User One",
            "email": cls.user1_email,
            "password": cls.password,
        })
        l1 = cls.client.post("/login", json={
            "email": cls.user1_email,
            "password": cls.password,
        })
        cls.token1 = l1.get_json().get("token")

        # Register User 2
        cls.client.post("/signup", json={
            "name": "User Two",
            "email": cls.user2_email,
            "password": cls.password,
        })
        l2 = cls.client.post("/login", json={
            "email": cls.user2_email,
            "password": cls.password,
        })
        cls.token2 = l2.get_json().get("token")

    def test_scenario_01_and_02_and_03_lifecycle(self):
        """
        Scenario 1: Upload Resume A -> Display Resume A.
        Scenario 2: Remove Resume A -> Clear Resume A immediately.
        Scenario 3: Refresh Dashboard with no resume -> No old results.
        """
        auth_header1 = {"Authorization": f"Bearer {self.token1}"}

        # Initially, User 1 has no active resume
        res0 = self.client.get("/resume/active", headers=auth_header1)
        self.assertEqual(res0.status_code, 200)
        data0 = res0.get_json()
        self.assertFalse(data0["has_active_resume"])
        self.assertIsNone(data0["resume"])

        # Create PDF for Resume A (Senior React & Python Developer)
        resume_a_text = (
            "Alice Smith - Senior Full Stack Developer\n"
            "Skills: React, Python, Flask, TypeScript, Docker, SQL, AWS\n"
            "Experience: 6 years building high scale web apps.\n"
            "Education: BS Computer Science"
        )
        pdf_a = create_test_pdf(resume_a_text)

        # Upload Resume A
        upload_res = self.client.post(
            "/upload_resume",
            headers=auth_header1,
            data={"resume": (pdf_a, "Resume_Alice_FullStack.pdf")},
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 200)
        upload_data = upload_res.get_json()
        self.assertTrue(upload_data["success"])
        self.assertIn("resume_id", upload_data)
        self.assertEqual(upload_data["filename"], "Resume_Alice_FullStack.pdf")
        self.assertIn("React", upload_data["skills"])
        resume_a_id = upload_data["resume_id"]
        resume_a_ats = upload_data["analysis"]["ats_score"]

        # Verify Scenario 1: Active resume endpoint returns Resume A
        active_res = self.client.get("/resume/active", headers=auth_header1)
        self.assertEqual(active_res.status_code, 200)
        act_data = active_res.get_json()
        self.assertTrue(act_data["has_active_resume"])
        self.assertEqual(act_data["resume"]["resume_id"], resume_a_id)
        self.assertEqual(act_data["resume"]["filename"], "Resume_Alice_FullStack.pdf")
        self.assertEqual(act_data["resume"]["analysis"]["ats_score"], resume_a_ats)

        # Verify Scenario 1 in Dashboard endpoint
        dash_res = self.client.get("/dashboard", headers=auth_header1)
        self.assertEqual(dash_res.status_code, 200)
        dash_data = dash_res.get_json()
        self.assertTrue(dash_data["has_active_resume"])
        self.assertIsNotNone(dash_data["active_resume"])
        self.assertEqual(dash_data["active_resume"]["resume_id"], resume_a_id)
        self.assertEqual(dash_data["active_resume"]["ats_score"], resume_a_ats)

        # Scenario 2: Remove Resume A
        del_res = self.client.delete("/resume/active", headers=auth_header1)
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.get_json()["success"])

        # Scenario 3: Refresh Dashboard with no resume -> Clean state, no stale data
        res_after_del = self.client.get("/resume/active", headers=auth_header1)
        self.assertEqual(res_after_del.status_code, 200)
        self.assertFalse(res_after_del.get_json()["has_active_resume"])
        self.assertIsNone(res_after_del.get_json()["resume"])

        dash_after_del = self.client.get("/dashboard", headers=auth_header1)
        self.assertEqual(dash_after_del.status_code, 200)
        d_after = dash_after_del.get_json()
        self.assertFalse(d_after["has_active_resume"])
        self.assertIsNone(d_after["active_resume"])

        # Scenario 10: Check readiness overview has resume_match_score = None when no resume
        readiness_res = self.client.get("/api/readiness/overview", headers=auth_header1)
        self.assertEqual(readiness_res.status_code, 200)
        self.assertIsNone(readiness_res.get_json().get("resume_match_score"))

    def test_scenario_04_05_06_replace_and_no_mixing(self):
        """
        Scenario 4: Upload Resume B -> Display only Resume B.
        Scenario 5: Compare Resume A and Resume B -> No mixing.
        Scenario 6: Remove Resume B -> Clear Resume B.
        """
        auth_header1 = {"Authorization": f"Bearer {self.token1}"}

        # First, upload Resume A
        pdf_a = create_test_pdf(
            "Resume A\nAlice Smith\nSkills: Python, Django, PostgreSQL\nExperience: Backend Dev"
        )
        res_a = self.client.post(
            "/upload_resume",
            headers=auth_header1,
            data={"resume": (pdf_a, "Alice_Resume_A.pdf")},
            content_type="multipart/form-data"
        ).get_json()
        resume_a_id = res_a["resume_id"]
        resume_a_skills = res_a["skills"]

        # Now, upload Resume B (Completely different role: Data Analyst)
        pdf_b = create_test_pdf(
            "Resume B\nBob Jones - Data Scientist & ML Engineer\n"
            "Skills: PyTorch, TensorFlow, Pandas, Scikit-Learn, R, Tableau\n"
            "Experience: Machine Learning Researcher"
        )
        res_b = self.client.post(
            "/upload_resume",
            headers=auth_header1,
            data={"resume": (pdf_b, "Bob_Resume_B.pdf")},
            content_type="multipart/form-data"
        ).get_json()
        resume_b_id = res_b["resume_id"]
        resume_b_skills = res_b["skills"]

        # Check unique IDs
        self.assertNotEqual(resume_a_id, resume_b_id)

        # Scenario 4 & 5: Check active resume is strictly B, not A, with no skill leakage
        active_res = self.client.get("/resume/active", headers=auth_header1).get_json()
        self.assertTrue(active_res["has_active_resume"])
        self.assertEqual(active_res["resume"]["resume_id"], resume_b_id)
        self.assertEqual(active_res["resume"]["filename"], "Bob_Resume_B.pdf")

        # In DB, verify only Resume B is is_active = 1, and Resume A is is_active = 0
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT id, is_active FROM resumes WHERE id IN (?, ?)", (resume_a_id, resume_b_id))
        rows = {r[0]: r[1] for r in c.fetchall()}
        conn.close()

        self.assertEqual(rows[resume_a_id], 0, "Resume A must be deactivated")
        self.assertEqual(rows[resume_b_id], 1, "Resume B must be active")

        # Dashboard check
        dash = self.client.get("/dashboard", headers=auth_header1).get_json()
        self.assertTrue(dash["has_active_resume"])
        self.assertEqual(dash["active_resume"]["resume_id"], resume_b_id)
        self.assertEqual(dash["active_resume"]["filename"], "Bob_Resume_B.pdf")

        # Scenario 6: Remove Resume B
        self.client.delete("/resume/active", headers=auth_header1)
        active_res2 = self.client.get("/resume/active", headers=auth_header1).get_json()
        self.assertFalse(active_res2["has_active_resume"])
        self.assertIsNone(active_res2["resume"])

    def test_scenario_07_logout_login_persistence(self):
        """
        Scenario 7: Upload resume -> re-login with new token -> Active resume is preserved.
        """
        auth1 = {"Authorization": f"Bearer {self.token1}"}
        pdf = create_test_pdf("Session Persistence Test\nSkills: Java, Spring Boot, Microservices")
        res = self.client.post(
            "/upload_resume",
            headers=auth1,
            data={"resume": (pdf, "Java_Developer.pdf")},
            content_type="multipart/form-data"
        ).get_json()
        uploaded_id = res["resume_id"]

        # User logs in again to acquire fresh JWT
        login_res = self.client.post("/login", json={
            "email": self.user1_email,
            "password": self.password,
        }).get_json()
        new_token = login_res.get("token")
        new_auth = {"Authorization": f"Bearer {new_token}"}

        # Active resume must still be returned
        active = self.client.get("/resume/active", headers=new_auth).get_json()
        self.assertTrue(active["has_active_resume"])
        self.assertEqual(active["resume"]["resume_id"], uploaded_id)
        self.assertEqual(active["resume"]["filename"], "Java_Developer.pdf")

    def test_scenario_08_multi_user_isolation(self):
        """
        Scenario 8: Multi-user test -> User 1's resume is never visible to User 2.
        When User 1 deletes their resume, User 2's resume remains unaffected.
        """
        auth1 = {"Authorization": f"Bearer {self.token1}"}
        auth2 = {"Authorization": f"Bearer {self.token2}"}

        # Upload for User 2
        pdf2 = create_test_pdf("User 2 Resume\nSkills: Go, Kubernetes, Cloud Native")
        res2 = self.client.post(
            "/upload_resume",
            headers=auth2,
            data={"resume": (pdf2, "User2_Golang.pdf")},
            content_type="multipart/form-data"
        ).get_json()
        user2_res_id = res2["resume_id"]

        # Check User 1 sees User 1's active resume (from previous test), NOT User 2's
        act1 = self.client.get("/resume/active", headers=auth1).get_json()
        self.assertEqual(act1["resume"]["filename"], "Java_Developer.pdf")
        self.assertNotEqual(act1["resume"]["resume_id"], user2_res_id)

        # Check User 2 sees strictly User 2's resume
        act2 = self.client.get("/resume/active", headers=auth2).get_json()
        self.assertEqual(act2["resume"]["filename"], "User2_Golang.pdf")
        self.assertEqual(act2["resume"]["resume_id"], user2_res_id)

        # Delete User 1's resume
        self.client.delete("/resume/active", headers=auth1)

        # User 1 is now empty
        act1_after = self.client.get("/resume/active", headers=auth1).get_json()
        self.assertFalse(act1_after["has_active_resume"])

        # User 2 MUST STILL HAVE their active resume unaffected
        act2_after = self.client.get("/resume/active", headers=auth2).get_json()
        self.assertTrue(act2_after["has_active_resume"])
        self.assertEqual(act2_after["resume"]["resume_id"], user2_res_id)
        self.assertEqual(act2_after["resume"]["filename"], "User2_Golang.pdf")


if __name__ == "__main__":
    unittest.main()
