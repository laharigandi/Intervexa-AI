"""
Test suite for Skill Recommendation Accuracy & Relevance Filtering in Intervexa AI.

Verifies:
1. Accurate Skill Matching: Direct exact match for Python, Java, React, SQL, and Machine Learning.
2. Non-contamination: Zero cross-technology pollution (e.g., Python search returns 0 Java/React/SQL;
   Java search returns 0 JavaScript/Python).
3. Difficulty Level Differentiation: Correctly classifies Beginner, Intermediate, and Advanced resources.
4. Resource Quality: Authentic providers and verified URLs (no fake course names or Google search URLs).
5. Unsupported / Unknown Skills: Returns empty list (enabling 'No relevant resources found for this skill' UI state).
"""

import unittest
import json
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from services.learning_resources_service import (
    get_curated_learning_resources,
    resolve_canonical_skill,
    CURATED_RESOURCE_CATALOG,
)


class SkillRecommendationAccuracyTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()

    # ──────────────────────────────────────────────────────────────────────────
    # 1. PYTHON VERIFICATION
    # ──────────────────────────────────────────────────────────────────────────
    def test_python_recommendations(self):
        """Verifies Python returns 100% Python resources and no unrelated technologies."""
        res = get_curated_learning_resources("Python Developer", ["Python"])
        self.assertTrue(res["success"])
        resources = res["resources"]
        self.assertGreater(len(resources), 0, "Python search should return resources")

        levels_found = set()
        for r in resources:
            title_desc_tags = (
                r["title"].lower() + " " + r["description"].lower() + " " + " ".join(r.get("tags", []))
            )
            # Ensure it is Python-related
            self.assertTrue(
                "python" in title_desc_tags or r["topic"].lower() == "python",
                f"Resource {r['id']} ({r['title']}) is not Python-related"
            )
            # Ensure no unrelated technologies are mixed in
            self.assertNotIn("spring boot", title_desc_tags)
            self.assertNotIn("react hooks", title_desc_tags)
            self.assertNotIn("sql optimization", title_desc_tags)
            self.assertNotIn("system design primer", title_desc_tags)

            # Ensure authentic URL (not a google search)
            self.assertNotIn("google.com/search", r["url"])
            self.assertTrue(r["url"].startswith("http"))
            levels_found.add(r.get("level"))

        # Verify level diversity exists
        self.assertIn("Beginner", levels_found)
        self.assertIn("Intermediate", levels_found)
        self.assertIn("Advanced", levels_found)

    # ──────────────────────────────────────────────────────────────────────────
    # 2. JAVA VERIFICATION (Strict separation from JavaScript)
    # ──────────────────────────────────────────────────────────────────────────
    def test_java_recommendations(self):
        """Verifies Java returns only Java resources and NEVER JavaScript or Python."""
        res = get_curated_learning_resources("Java Developer", ["Java"])
        self.assertTrue(res["success"])
        resources = res["resources"]
        self.assertGreater(len(resources), 0, "Java search should return resources")

        for r in resources:
            title_desc_tags = (
                r["title"].lower() + " " + r["description"].lower() + " " + " ".join(r.get("tags", []))
            )
            self.assertEqual(r["topic"].lower(), "java")
            # Must NOT match JavaScript or Python
            self.assertNotIn("javascript", title_desc_tags)
            self.assertNotIn("python", title_desc_tags)
            self.assertNotIn("react", title_desc_tags)
            self.assertNotIn("google.com/search", r["url"])

    # ──────────────────────────────────────────────────────────────────────────
    # 3. REACT VERIFICATION
    # ──────────────────────────────────────────────────────────────────────────
    def test_react_recommendations(self):
        """Verifies React returns only React/Frontend resources and no Python or Java."""
        res = get_curated_learning_resources("Frontend Developer", ["React"])
        self.assertTrue(res["success"])
        resources = res["resources"]
        self.assertGreater(len(resources), 0, "React search should return resources")

        for r in resources:
            title_desc_tags = (
                r["title"].lower() + " " + r["description"].lower() + " " + " ".join(r.get("tags", []))
            )
            self.assertEqual(r["topic"].lower(), "react")
            self.assertNotIn("python", title_desc_tags)
            self.assertNotIn("spring boot", title_desc_tags)
            self.assertNotIn("google.com/search", r["url"])

    # ──────────────────────────────────────────────────────────────────────────
    # 4. SQL VERIFICATION
    # ──────────────────────────────────────────────────────────────────────────
    def test_sql_recommendations(self):
        """Verifies SQL returns database and query optimization resources."""
        res = get_curated_learning_resources("Data Analyst", ["SQL"])
        self.assertTrue(res["success"])
        resources = res["resources"]
        self.assertGreater(len(resources), 0, "SQL search should return resources")

        for r in resources:
            title_desc_tags = (
                r["title"].lower() + " " + r["description"].lower() + " " + " ".join(r.get("tags", []))
            )
            self.assertEqual(r["topic"].lower(), "sql")
            self.assertNotIn("react", title_desc_tags)
            self.assertNotIn("google.com/search", r["url"])

    # ──────────────────────────────────────────────────────────────────────────
    # 5. MACHINE LEARNING VERIFICATION
    # ──────────────────────────────────────────────────────────────────────────
    def test_machine_learning_recommendations(self):
        """Verifies Machine Learning returns ML/AI resources."""
        res = get_curated_learning_resources("Machine Learning Engineer", ["Machine Learning"])
        self.assertTrue(res["success"])
        resources = res["resources"]
        self.assertGreater(len(resources), 0, "ML search should return resources")

        for r in resources:
            title_desc_tags = (
                r["title"].lower() + " " + r["description"].lower() + " " + " ".join(r.get("tags", []))
            )
            self.assertEqual(r["topic"].lower(), "machine learning")
            self.assertNotIn("spring boot", title_desc_tags)
            self.assertNotIn("google.com/search", r["url"])

    # ──────────────────────────────────────────────────────────────────────────
    # 6. UNSUPPORTED / UNKNOWN SKILL (No fake links, returns empty)
    # ──────────────────────────────────────────────────────────────────────────
    def test_unsupported_skill_returns_empty(self):
        """Verifies unknown skills return 0 resources and NO fake Google URLs."""
        res = get_curated_learning_resources("Software Engineer", ["ObscureProprietaryLanguageXYZ123"])
        self.assertTrue(res["success"])
        self.assertEqual(len(res["resources"]), 0, "Unknown skill must return 0 resources")
        summary = res["topics"][0]
        self.assertEqual(summary["total_matched"], 0)

    # ──────────────────────────────────────────────────────────────────────────
    # 7. WORD BOUNDARY DISCRIMINATION
    # ──────────────────────────────────────────────────────────────────────────
    def test_strict_word_boundary_matching(self):
        """Ensures 'java' does not match 'javascript' and vice versa."""
        self.assertEqual(resolve_canonical_skill("Java"), "java")
        self.assertEqual(resolve_canonical_skill("Core Java"), "java")
        self.assertEqual(resolve_canonical_skill("JavaScript"), "javascript")
        self.assertEqual(resolve_canonical_skill("Modern JS"), "javascript")
        self.assertNotEqual(resolve_canonical_skill("JavaScript"), "java")

    # ──────────────────────────────────────────────────────────────────────────
    # 8. DIFFICULTY LEVEL FILTERING
    # ──────────────────────────────────────────────────────────────────────────
    def test_level_filtering(self):
        """Verifies level parameter filters resources to Beginner only."""
        res_beginner = get_curated_learning_resources("Python Developer", ["Python"], level="Beginner")
        self.assertGreater(len(res_beginner["resources"]), 0)
        for r in res_beginner["resources"]:
            self.assertEqual(r.get("level"), "Beginner")

        res_advanced = get_curated_learning_resources("Python Developer", ["Python"], level="Advanced")
        self.assertGreater(len(res_advanced["resources"]), 0)
        for r in res_advanced["resources"]:
            self.assertEqual(r.get("level"), "Advanced")

    # ──────────────────────────────────────────────────────────────────────────
    # 9. API ENDPOINT VALIDATION (POST /api/learning)
    # ──────────────────────────────────────────────────────────────────────────
    def test_api_learning_post_endpoint(self):
        """Tests POST /api/learning returns accurate recommendations for Python."""
        payload = {
            "role": "Python Developer",
            "skills": ["Python"]
        }
        res = self.client.post("/api/learning", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertGreater(len(data["resources"]), 0)
        for r in data["resources"]:
            self.assertEqual(r["topic"].lower(), "python")

    # ──────────────────────────────────────────────────────────────────────────
    # 10. API GET ENDPOINT WITH SINGLE SKILL
    # ──────────────────────────────────────────────────────────────────────────
    def test_api_learning_get_single_skill(self):
        """Tests GET /api/learning/resources?skill=Java returns Java resources."""
        res = self.client.get("/api/learning/resources?skill=Java")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertGreater(len(data["resources"]), 0)
        for r in data["resources"]:
            self.assertEqual(r["topic"].lower(), "java")


if __name__ == "__main__":
    unittest.main()
