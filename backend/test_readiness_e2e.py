"""
Comprehensive End-to-End Verification Suite for
AI Interview Readiness Prediction & Skill Gap Radar
Intervexa AI - Smart Interview Coach
"""
import os
import sys
import unittest
from datetime import datetime

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from database import init_db, get_db_connection
from app import app
from services.readiness_service import (
    calculate_readiness_score,
    analyze_skill_gaps,
    generate_readiness_recommendations,
    record_readiness_snapshot,
    get_readiness_history,
)


class TestReadinessE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()
        timestamp = int(datetime.now().timestamp())
        cls.candidate_a_email = f"candidate_a_{timestamp}@intervexa.ai"
        cls.candidate_b_email = f"candidate_b_{timestamp}@intervexa.ai"

        # Register Candidate A
        cls.client.post("/signup", json={
            "name": "Candidate A",
            "email": cls.candidate_a_email,
            "password": "Password123!"
        })
        log_a = cls.client.post("/login", json={"email": cls.candidate_a_email, "password": "Password123!"})
        data_a = log_a.get_json()
        cls.token_a = data_a.get("access_token") or data_a.get("token")
        cls.user_a_id = data_a.get("user", {}).get("id")

        # Register Candidate B
        cls.client.post("/signup", json={
            "name": "Candidate B",
            "email": cls.candidate_b_email,
            "password": "Password123!"
        })
        log_b = cls.client.post("/login", json={"email": cls.candidate_b_email, "password": "Password123!"})
        data_b = log_b.get_json()
        cls.token_b = data_b.get("access_token") or data_b.get("token")
        cls.user_b_id = data_b.get("user", {}).get("id")

    # =========================================================================
    # SCENARIO 1: New user with no completed interviews
    # =========================================================================
    def test_01_new_user_insufficient_data(self):
        headers_b = {"Authorization": f"Bearer {self.token_b}"}
        res = self.client.get("/api/readiness/overview", headers=headers_b)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["readiness"]
        self.assertFalse(data["has_sufficient_data"])
        self.assertIsNone(data["overall_score"])
        self.assertEqual(data["readiness_category"], "Insufficient Data")
        self.assertEqual(data["total_completed_interviews"], 0)
        self.assertIn("Complete at least one mock interview", data["category_description"])

    # =========================================================================
    # SCENARIO 2 & 6: User with 1 completed interview & WITHOUT a resume
    # =========================================================================
    def test_02_user_with_one_interview_no_resume(self):
        headers_a = {"Authorization": f"Bearer {self.token_a}"}

        # Submit Interview 1
        eval_payload = {
            "role": "Python Developer",
            "questions": [
                "Explain the difference between mutable and immutable types in Python.",
                "How do you design a relational database schema for user profiles?",
            ],
            "answers": [
                "Mutable types like lists and dicts can be altered in-place. Immutable types like tuples and strings cannot.",
                "Create a users table with a primary key id, and a profiles table with a foreign key referencing users(id).",
            ]
        }
        sub_res = self.client.post("/evaluate_answers", json=eval_payload, headers=headers_a)
        self.assertEqual(sub_res.status_code, 200)

        # Query readiness overview without resume match
        res = self.client.get("/api/readiness/overview?role=Python+Developer", headers=headers_a)
        self.assertEqual(res.status_code, 200)
        r_data = res.get_json()["readiness"]

        self.assertTrue(r_data["has_sufficient_data"])
        self.assertIsNotNone(r_data["overall_score"])
        self.assertGreater(r_data["overall_score"], 0)
        self.assertLessEqual(r_data["overall_score"], 100)

        # Verify missing resume match is NOT treated as 0% but weight is redistributed
        breakdown = r_data["metrics_breakdown"]
        self.assertEqual(breakdown["resume_job_match"]["weight"], 0.0)
        self.assertEqual(breakdown["resume_job_match"]["status"], "Pending Upload / Scan")
        self.assertIn(r_data["readiness_category"], ["Needs Improvement", "Beginner", "Developing", "Interview Ready", "Highly Prepared"])

    # =========================================================================
    # SCENARIO 4 & 5: Selected target role & WITH a resume/JD match score
    # =========================================================================
    def test_03_readiness_with_resume_match_score(self):
        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        res = self.client.get("/api/readiness/overview?role=Python+Developer&resume_match_score=85", headers=headers_a)
        self.assertEqual(res.status_code, 200)
        r_data = res.get_json()["readiness"]

        breakdown = r_data["metrics_breakdown"]
        self.assertEqual(breakdown["resume_job_match"]["score"], 85.0)
        self.assertEqual(breakdown["resume_job_match"]["weight"], 0.10)
        self.assertEqual(breakdown["resume_job_match"]["status"], "Available")

    # =========================================================================
    # SCENARIO 3 & 8: User with multiple completed interviews (Improving/Declining)
    # =========================================================================
    def test_04_multiple_interviews_and_improvement_tracking(self):
        headers_a = {"Authorization": f"Bearer {self.token_a}"}

        # Submit Interview 2 with high performance
        eval_payload_2 = {
            "role": "Python Developer",
            "questions": [
                "Explain metaclasses in Python and provide a realistic production use case.",
                "How do database indexes improve search performance and what are the trade-offs?"
            ],
            "answers": [
                "Metaclasses are classes of classes that define how classes are constructed. In production, Django ORM uses metaclasses to map model attributes to database columns.",
                "Indexes use B-trees to provide O(log N) lookup instead of O(N) table scans. The trade-off is additional storage and slower INSERT/UPDATE performance."
            ]
        }
        sub_res_2 = self.client.post("/evaluate_answers", json=eval_payload_2, headers=headers_a)
        self.assertEqual(sub_res_2.status_code, 200)

        # Check readiness overview now compares with previous snapshot
        res = self.client.get("/api/readiness/overview?role=Python+Developer", headers=headers_a)
        self.assertEqual(res.status_code, 200)
        r_data = res.get_json()["readiness"]

        self.assertEqual(r_data["total_completed_interviews"], 2)
        self.assertIsNotNone(r_data["previous_score"])
        self.assertIsInstance(r_data["score_improvement"], float)

        # Check history endpoint
        hist_res = self.client.get("/api/readiness/history", headers=headers_a)
        self.assertEqual(hist_res.status_code, 200)
        history = hist_res.get_json()["history"]
        self.assertGreaterEqual(len(history), 2)

    # =========================================================================
    # SCENARIO 7: Skill Gap Analysis & Radar Data
    # =========================================================================
    def test_05_skill_gap_radar_and_classification(self):
        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        res = self.client.get("/api/readiness/skill-gaps?role=Python+Developer", headers=headers_a)
        self.assertEqual(res.status_code, 200)
        gaps_data = res.get_json()["skill_gaps"]

        self.assertIn("radar_data", gaps_data)
        self.assertGreaterEqual(len(gaps_data["radar_data"]), 5)

        for item in gaps_data["radar_data"]:
            self.assertIn("skill", item)
            self.assertIn("current", item)
            self.assertIn("target", item)
            self.assertIn("gap", item)
            self.assertEqual(item["gap"], round(max(0.0, item["target"] - item["current"]), 1))

        # Check groupings exist
        self.assertIn("strong_skills", gaps_data)
        self.assertIn("skills_requiring_improvement", gaps_data)
        self.assertIn("critical_gaps", gaps_data)
        self.assertIn("missing_skills", gaps_data)

    # =========================================================================
    # SCENARIO 9: Actionable Recommendations
    # =========================================================================
    def test_06_actionable_recommendations(self):
        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        res = self.client.get("/api/readiness/recommendations?role=Python+Developer", headers=headers_a)
        self.assertEqual(res.status_code, 200)
        recs = res.get_json()["recommendations"]
        self.assertIsInstance(recs, list)
        self.assertGreaterEqual(len(recs), 1)

        for r in recs:
            self.assertIn("skill", r)
            self.assertIn("priority", r)
            self.assertIn("action_plan", r)
            self.assertIn("suggested_track", r)

    # =========================================================================
    # SCENARIO 10: Cross-User Isolation
    # =========================================================================
    def test_07_cross_user_isolation(self):
        headers_b = {"Authorization": f"Bearer {self.token_b}"}
        # Candidate B should see empty data, never Candidate A's readiness or gaps
        res_ov = self.client.get("/api/readiness/overview", headers=headers_b)
        self.assertEqual(res_ov.status_code, 200)
        self.assertFalse(res_ov.get_json()["readiness"]["has_sufficient_data"])

        res_hist = self.client.get("/api/readiness/history", headers=headers_b)
        self.assertEqual(res_hist.status_code, 200)
        self.assertEqual(len(res_hist.get_json()["history"]), 0)


if __name__ == "__main__":
    unittest.main()

