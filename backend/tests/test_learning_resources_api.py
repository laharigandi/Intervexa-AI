import unittest
import json
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app

class LearningResourcesApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()

    def test_post_api_learning(self):
        """Test POST /api/learning returns curated resources list and topics"""
        payload = {
            "role": "Full Stack Developer",
            "weak_skills": ["System Design", "SQL Optimization", "React Hooks & State"]
        }
        res = self.client.post(
            "/api/learning",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("role"), "Full Stack Developer")
        
        # Verify resources structure
        resources = data.get("resources", [])
        self.assertGreater(len(resources), 0)
        for r in resources:
            self.assertIn("id", r)
            self.assertIn("title", r)
            self.assertIn("description", r)
            self.assertIn("topic", r)
            self.assertIn("type", r)
            self.assertIn("provider", r)
            self.assertIn("url", r)
            self.assertTrue(r["url"].startswith("http"))
            self.assertIn(r["type"], ["Video", "Documentation", "Tutorial", "Course", "Practice"])

    def test_post_learning_legacy_route(self):
        """Test POST /learning returns 200 with matching structure"""
        payload = {
            "role": "Frontend Developer",
            "weak_skills": ["React Hooks & State"]
        }
        res = self.client.post(
            "/learning",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertGreater(len(data.get("resources", [])), 0)

    def test_get_curated_learning_resources_endpoint(self):
        """Test GET /api/learning/resources returns curated resource library"""
        res = self.client.get("/api/learning/resources?role=Backend Developer&topics=Microservices,REST APIs")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertGreater(len(data.get("resources", [])), 0)

if __name__ == "__main__":
    unittest.main()

