"""
Unit and Integration Tests for AI Interview Readiness Prediction & Skill Gap Radar
"""
import os
import sys
import unittest
from datetime import datetime

# Set backend directory in path
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
    get_readiness_category,
)
from services.interview_memory_service import record_interview_memory


class TestReadinessEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()
        cls.user_email = f"readiness_user_{int(datetime.now().timestamp())}@test.com"
        cls.empty_user_email = f"empty_user_{int(datetime.now().timestamp())}@test.com"

        # Register User with data
        res = cls.client.post("/signup", json={
            "name": "Readiness Candidate",
            "email": cls.user_email,
            "password": "Password123!"
        })
        login_res = cls.client.post("/login", json={
            "email": cls.user_email,
            "password": "Password123!"
        })
        data = login_res.get_json()
        cls.token = data.get("access_token") or data.get("token")
        cls.user_id = data.get("user", {}).get("id")

        # Register Empty User (0 interviews)
        res_empty = cls.client.post("/signup", json={
            "name": "New Candidate",
            "email": cls.empty_user_email,
            "password": "Password123!"
        })
        login_empty = cls.client.post("/login", json={
            "email": cls.empty_user_email,
            "password": "Password123!"
        })
        data_empty = login_empty.get_json()
        cls.empty_token = data_empty.get("access_token") or data_empty.get("token")
        cls.empty_user_id = data_empty.get("user", {}).get("id")

    def test_01_insufficient_data_empty_user(self):
        """New candidate with 0 interviews must receive honest Insufficient Data category."""
        res = calculate_readiness_score(user_id=self.empty_user_id)
        self.assertFalse(res["has_sufficient_data"])
        self.assertIsNone(res["overall_score"])
        self.assertEqual(res["readiness_category"], "Insufficient Data")
        self.assertEqual(res["total_completed_interviews"], 0)

        # API endpoint check
        headers = {"Authorization": f"Bearer {self.empty_token}"}
        api_res = self.client.get("/api/readiness/overview", headers=headers)
        self.assertEqual(api_res.status_code, 200)
        json_data = api_res.get_json()["readiness"]
        self.assertFalse(json_data["has_sufficient_data"])

    def test_02_readiness_calculation_and_normalization(self):
        """Candidate with completed interview gets normalized scores and redistributed weights."""
        headers = {"Authorization": f"Bearer {self.token}"}
        eval_payload = {
            "role": "Python Developer",
            "questions": [
                "Explain the GIL in Python.",
                "How do you optimize an SQL query using indexes?",
                "Design a rate limiter for a REST API."
            ],
            "answers": [
                "The Global Interpreter Lock allows only one native thread to execute Python bytecode at once.",
                "Indexes speed up reads using B-Tree lookups, but add overhead to writes. Use EXPLAIN ANALYZE.",
                "Use a token bucket or sliding window log algorithm with Redis for distributed atomic counters."
            ]
        }
        sub_res = self.client.post("/evaluate_answers", json=eval_payload, headers=headers)
        self.assertEqual(sub_res.status_code, 200)

        # Calculate readiness without resume match (missing metric should be redistributed, not 0)
        res = calculate_readiness_score(user_id=self.user_id, role="Python Developer")
        self.assertTrue(res["has_sufficient_data"])
        self.assertIsNotNone(res["overall_score"])
        self.assertGreater(res["overall_score"], 0)
        self.assertLessEqual(res["overall_score"], 100)

        breakdown = res["metrics_breakdown"]
        self.assertIn("technical_knowledge", breakdown)
        self.assertIn("communication_skills", breakdown)
        self.assertIn("problem_solving", breakdown)
        self.assertIn("role_specific_skills", breakdown)
        self.assertIn("interview_consistency", breakdown)

        # Check resume match missing status
        self.assertEqual(breakdown["resume_job_match"]["weight"], 0.0)
        self.assertEqual(breakdown["resume_job_match"]["status"], "Pending Upload / Scan")

        print(f"  -> Overall Readiness Score: {res['overall_score']} ({res['readiness_category']})")

    def test_03_skill_gaps_and_radar_dataset(self):
        """Verify role-specific radar dataset with current vs target proficiency."""
        gaps = analyze_skill_gaps(user_id=self.user_id, role="Python Developer")
        self.assertIn("radar_data", gaps)
        self.assertGreaterEqual(len(gaps["radar_data"]), 5)

        for item in gaps["radar_data"]:
            self.assertIn("skill", item)
            self.assertIn("current", item)
            self.assertIn("target", item)
            self.assertIn("gap", item)
            self.assertEqual(item["gap"], round(max(0.0, item["target"] - item["current"]), 1))

        # API check
        headers = {"Authorization": f"Bearer {self.token}"}
        api_res = self.client.get("/api/readiness/skill-gaps?role=Python+Developer", headers=headers)
        self.assertEqual(api_res.status_code, 200)
        api_data = api_res.get_json()["skill_gaps"]
        self.assertEqual(len(api_data["radar_data"]), len(gaps["radar_data"]))
        print(f"  -> Radar Dimensions: {[x['skill'] for x in gaps['radar_data']]}")

    def test_04_actionable_recommendations(self):
        """Verify prioritized recommendations with actionable tips and suggested tracks."""
        recs = generate_readiness_recommendations(user_id=self.user_id, role="Python Developer")
        self.assertIsInstance(recs, list)
        self.assertGreaterEqual(len(recs), 1)

        for r in recs:
            self.assertIn("skill", r)
            self.assertIn("priority", r)
            self.assertIn(r["priority"], ["High", "Medium", "Low"])
            self.assertIn("action_plan", r)
            self.assertIn("suggested_track", r)

        # API check
        headers = {"Authorization": f"Bearer {self.token}"}
        api_res = self.client.get("/api/readiness/recommendations", headers=headers)
        self.assertEqual(api_res.status_code, 200)
        api_recs = api_res.get_json()["recommendations"]
        self.assertGreaterEqual(len(api_recs), 1)
        print(f"  -> Top Recommendation: {recs[0]['skill']} (Priority: {recs[0]['priority']})")

    def test_05_snapshot_recording_and_history(self):
        """Verify snapshot persistence, idempotency, and history tracking."""
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM interviews WHERE user_id = ? ORDER BY id DESC LIMIT 1", (self.user_id,))
        row = cur.fetchone()
        real_inv_id = row[0] if row else None
        conn.close()

        snap_id = record_readiness_snapshot(user_id=self.user_id, interview_id=real_inv_id, role="Python Developer")
        self.assertIsNotNone(snap_id)

        # Retrying same interview_id should update, not create duplicate
        snap_id_2 = record_readiness_snapshot(user_id=self.user_id, interview_id=real_inv_id, role="Python Developer")
        self.assertEqual(snap_id, snap_id_2)

        # Check history
        history = get_readiness_history(user_id=self.user_id)
        self.assertGreaterEqual(len(history), 1)
        self.assertEqual(history[-1]["id"], snap_id)

        # API check
        headers = {"Authorization": f"Bearer {self.token}"}
        api_res = self.client.get("/api/readiness/history", headers=headers)
        self.assertEqual(api_res.status_code, 200)
        self.assertGreaterEqual(len(api_res.get_json()["history"]), 1)
        print(f"  -> Readiness History Snapshots Count: {len(history)}")


if __name__ == "__main__":
    unittest.main()
