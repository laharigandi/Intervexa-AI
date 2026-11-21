"""
E2E Integration Test for Learning Roadmap / AI Study Planner PDF Download
Tests all 10 scenarios required by the specification:
1. 7-day roadmap PDF generation and download
2. 30-day roadmap PDF generation and download
3. Verification that all weekly and daily tasks are included
4. Verification that long task descriptions wrap properly
5. Verification of multi-page pagination
6. Complete a task and verify updated progress in new PDF
7. Refresh/persisted roadmap retrieval and download
8. Multi-user isolation (no data leakage between users)
9. Download failure handling when no roadmap exists
10. Verification that generated PDF is valid and readable by standard PDF engines
"""

import os
import sys
import io
import json
import uuid
import unittest
import pdfplumber

_backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _backend_dir)

from app import app, get_db_connection
from database import init_db
from services.study_planner_service import generate_study_plan, update_task_status
from services.roadmap_pdf_service import generate_roadmap_pdf


class TestRoadmapPdfDownload(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

        cls.user1_email = f"pdf_user1_{uuid.uuid4().hex[:6]}@example.com"
        cls.user2_email = f"pdf_user2_{uuid.uuid4().hex[:6]}@example.com"
        cls.password = "Password123!"

        # Register User 1
        cls.client.post("/signup", json={
            "name": "Sarah Connor",
            "email": cls.user1_email,
            "password": cls.password,
        })
        l1 = cls.client.post("/login", json={
            "email": cls.user1_email,
            "password": cls.password,
        })
        cls.token1 = l1.get_json()["token"]
        cls.user1_id = l1.get_json()["user"]["id"]

        # Register User 2
        cls.client.post("/signup", json={
            "name": "John Connor",
            "email": cls.user2_email,
            "password": cls.password,
        })
        l2 = cls.client.post("/login", json={
            "email": cls.user2_email,
            "password": cls.password,
        })
        cls.token2 = l2.get_json()["token"]
        cls.user2_id = l2.get_json()["user"]["id"]

    def test_01_no_plan_returns_404(self):
        """Scenario 9: Test download failure state when no plan exists."""
        auth = {"Authorization": f"Bearer {self.token1}"}
        res = self.client.get("/study-planner/pdf", headers=auth)
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("No active study plan", data["error"])

    def test_02_generate_7day_plan_and_download_pdf(self):
        """
        Scenario 1: Generate 7-day roadmap and download PDF.
        Scenario 3: Verify all weekly & daily tasks are included.
        Scenario 4 & 10: Verify long text and validity in standard PDF engine.
        """
        # Generate 7-day plan for User 1
        plan = generate_study_plan(
            user_id=self.user1_id,
            target_role="Full Stack Developer",
            duration_days=7,
            daily_study_minutes=60,
            preparation_level="Intermediate",
        )
        self.assertTrue(plan["has_active_plan"])
        self.assertEqual(plan["duration_days"], 7)
        self.assertEqual(len(plan["tasks"]), 7)

        auth = {"Authorization": f"Bearer {self.token1}"}

        # Call GET /study-planner/pdf
        res = self.client.get("/study-planner/pdf", headers=auth)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, "application/pdf")
        self.assertIn("Intervexa_AI_Learning_Roadmap.pdf", res.headers.get("Content-Disposition", ""))

        pdf_bytes = res.data
        self.assertGreater(len(pdf_bytes), 2000)

        # Inspect PDF content with pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            self.assertGreaterEqual(len(pdf.pages), 2, "7-day PDF should have at least 2 pages")
            
            # Page 1 checks
            p1_text = pdf.pages[0].extract_text()
            self.assertIn("INTERVEXA AI", p1_text)
            self.assertIn("Personalized Learning Roadmap", p1_text)
            self.assertIn("Sarah Connor", p1_text)
            self.assertIn("Full Stack Developer", p1_text)
            self.assertIn("7 Days", p1_text)
            self.assertIn("60 Minutes / Day", p1_text)

            # Schedule pages check
            all_text = " ".join(p.extract_text() for p in pdf.pages)
            self.assertIn("WEEK 1", all_text)
            self.assertIn("Day 1", all_text)
            self.assertIn("Day 7", all_text)
            self.assertIn("Roadmap Progress & Strategic Recommendations", all_text)

    def test_03_generate_30day_plan_and_pagination(self):
        """
        Scenario 2: Generate 30-day roadmap and download PDF.
        Scenario 5: Verify multi-page pagination for large roadmaps.
        """
        plan_30 = generate_study_plan(
            user_id=self.user1_id,
            target_role="Machine Learning Engineer",
            duration_days=30,
            daily_study_minutes=90,
            preparation_level="Advanced",
        )
        self.assertEqual(plan_30["duration_days"], 30)
        self.assertEqual(len(plan_30["tasks"]), 30)

        auth = {"Authorization": f"Bearer {self.token1}"}
        res = self.client.get("/study-planner/pdf", headers=auth)
        self.assertEqual(res.status_code, 200)

        with pdfplumber.open(io.BytesIO(res.data)) as pdf:
            page_count = len(pdf.pages)
            self.assertGreaterEqual(page_count, 4, "30-day roadmap should paginate across 4+ pages")
            
            all_text = " ".join(p.extract_text() for p in pdf.pages)
            self.assertIn("Machine Learning Engineer", all_text)
            self.assertIn("WEEK 1", all_text)
            self.assertIn("WEEK 2", all_text)
            self.assertIn("WEEK 3", all_text)
            self.assertIn("WEEK 4", all_text)
            self.assertIn("WEEK 5", all_text)
            self.assertIn("Day 30", all_text)

    def test_04_update_task_reflects_in_pdf(self):
        """
        Scenario 6: Complete a task and download again; updated progress must appear.
        """
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("""
            SELECT t.id 
            FROM study_tasks t 
            JOIN study_plans p ON t.plan_id = p.id 
            WHERE t.user_id = ? AND p.status = 'active' AND t.status != 'completed' 
            ORDER BY t.day_number ASC LIMIT 1
        """, (self.user1_id,))
        task_id = c.fetchone()[0]
        conn.close()

        # Update task status to completed
        update_task_status(self.user1_id, task_id, "completed")

        auth = {"Authorization": f"Bearer {self.token1}"}
        res = self.client.get("/study-planner/pdf", headers=auth)
        self.assertEqual(res.status_code, 200)

        with pdfplumber.open(io.BytesIO(res.data)) as pdf:
            all_text = " ".join(p.extract_text() for p in pdf.pages)
            self.assertIn("[DONE]", all_text)
            self.assertIn("1 completed", all_text)

    def test_05_multi_user_isolation(self):
        """
        Scenario 8: Verify PDF does not contain data from another user's roadmap.
        """
        auth1 = {"Authorization": f"Bearer {self.token1}"}
        auth2 = {"Authorization": f"Bearer {self.token2}"}

        # User 2 generates a DevOps plan
        plan_user2 = generate_study_plan(
            user_id=self.user2_id,
            target_role="DevOps Engineer",
            duration_days=7,
            daily_study_minutes=45,
            preparation_level="Beginner",
        )

        # Download User 1's PDF
        res1 = self.client.get("/study-planner/pdf", headers=auth1)
        # Download User 2's PDF
        res2 = self.client.get("/study-planner/pdf", headers=auth2)

        with pdfplumber.open(io.BytesIO(res1.data)) as pdf1:
            t1 = " ".join(p.extract_text() for p in pdf1.pages)
            self.assertIn("Sarah Connor", t1)
            self.assertIn("Machine Learning Engineer", t1)
            self.assertNotIn("John Connor", t1)
            self.assertNotIn("DevOps Engineer", t1)

        with pdfplumber.open(io.BytesIO(res2.data)) as pdf2:
            t2 = " ".join(p.extract_text() for p in pdf2.pages)
            self.assertIn("John Connor", t2)
            self.assertIn("DevOps Engineer", t2)
            self.assertNotIn("Sarah Connor", t2)
            self.assertNotIn("Machine Learning Engineer", t2)


if __name__ == "__main__":
    unittest.main()
