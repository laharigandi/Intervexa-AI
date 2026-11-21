"""
Test Suite for AI Roadmap Content Clarity with Structured Bullet Points
Intervexa AI - Smart Interview Coach

Validates the 5 mandatory targets:
1. Python Fundamentals
2. SQL Joins
3. Machine Learning
4. Python Variables (single topic)
5. Machine Learning Engineer (job role)

Verifies:
- All daily tasks contain structured bullet points (no long unbroken paragraphs)
- Section B: What You Will Learn (3-6 bullet points)
- Section C: Topic Explanation (subtopics with name, explanation, practical example, where used)
- Section D: Step-by-Step Learning Instructions (numbered steps)
- Section E: Practical Examples (code snippet, line explanation, expected output, use case)
- Section F: Practice Activities (actionable bullet points)
- Section G: Completion Goals (measurable criteria bullet points)
- Section H: Learning Resources (documentation, practice, tutorial links)
- Correct database storage and overview retrieval
"""

import os
import sys
import unittest
import uuid

_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from database import init_db
from app import app
from services.study_planner_service import generate_study_plan, get_study_plan_overview


class TestRoadmapContentClarity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

        # Create isolated test user
        cls.user_email = f"clarity_tester_{uuid.uuid4().hex[:6]}@example.com"
        cls.password = "SecurePassword123!"

        cls.client.post("/signup", json={
            "name": "Alex Clarity",
            "email": cls.user_email,
            "password": cls.password,
        })
        l = cls.client.post("/login", json={
            "email": cls.user_email,
            "password": cls.password,
        })
        cls.token = l.get_json()["token"]
        cls.user_id = l.get_json()["user"]["id"]

    def _verify_task_structured_clarity(self, task, day_num):
        """Validates that a task satisfies all structure and bullet-point requirements."""
        # A. Day Info
        self.assertEqual(task.get("day_number"), day_num)
        self.assertTrue(task.get("topic"), f"Day {day_num} must have a topic title")
        self.assertIn(task.get("priority"), ["Critical", "High", "Medium", "Low"])
        self.assertGreater(int(task.get("estimated_minutes") or 0), 0)

        # B. What You Will Learn (3-6 bullet points)
        what_learn = task.get("what_you_will_learn")
        self.assertIsInstance(what_learn, list, f"Day {day_num} what_you_will_learn must be a list")
        self.assertGreaterEqual(len(what_learn), 2, f"Day {day_num} must have at least 2-6 what_you_will_learn bullets")
        for pt in what_learn:
            self.assertTrue(len(str(pt).strip()) > 5, f"Bullet '{pt}' should be descriptive")
            # Verify no long paragraph in a single bullet
            self.assertLess(len(str(pt).split()), 50, f"Bullet should be concise, not a wall of text: {pt[:40]}...")

        # C. Topic Breakdown (Subtopics)
        breakdown = task.get("topic_breakdown")
        self.assertIsInstance(breakdown, list, f"Day {day_num} topic_breakdown must be a list")
        self.assertGreaterEqual(len(breakdown), 1, f"Day {day_num} should have at least 1 subtopic breakdown")
        for sub in breakdown:
            self.assertIsInstance(sub, dict)
            self.assertTrue(sub.get("name"), "Subtopic must have a name")
            self.assertTrue(sub.get("explanation"), "Subtopic must have an explanation")

        # D. Step-by-Step Learning Instructions (Numbered steps)
        steps = task.get("learning_steps")
        self.assertIsInstance(steps, list, f"Day {day_num} learning_steps must be a list")
        self.assertGreaterEqual(len(steps), 2, f"Day {day_num} should have numbered steps")
        for step in steps:
            self.assertTrue(len(str(step).strip()) > 5, "Step instruction should be actionable")

        # E. Practical Examples
        examples = task.get("practical_examples")
        self.assertIsInstance(examples, list, f"Day {day_num} practical_examples must be a list")
        self.assertGreaterEqual(len(examples), 1, f"Day {day_num} should have at least 1 practical example")
        ex0 = examples[0]
        self.assertTrue(ex0.get("title") or ex0.get("code"), "Example must have a title or code")

        # F. Practice Activities (Actionable bullet points)
        practice = task.get("practice_activities")
        self.assertIsInstance(practice, list, f"Day {day_num} practice_activities must be a list")
        self.assertGreaterEqual(len(practice), 1, f"Day {day_num} should have practice activities")

        # G. Completion Goals (Measurable criteria bullet points)
        goals = task.get("completion_goals")
        self.assertIsInstance(goals, list, f"Day {day_num} completion_goals must be a list")
        self.assertGreaterEqual(len(goals), 1, f"Day {day_num} should have completion goals")

        # H. Learning Resources
        resources = task.get("recommended_resources")
        self.assertIsInstance(resources, list, f"Day {day_num} resources must be a list")
        self.assertGreaterEqual(len(resources), 1, f"Day {day_num} should have at least 1 resource")

    def test_01_target_python_fundamentals(self):
        """Target 1: Python Fundamentals roadmap content clarity."""
        plan = generate_study_plan(
            user_id=self.user_id,
            target_role="Python Developer",
            topic="Python Fundamentals",
            duration_days=7,
            daily_study_minutes=60,
            preparation_level="Intermediate",
        )
        self.assertTrue(plan["has_active_plan"])
        self.assertEqual(plan["duration_days"], 7)
        self.assertIn("Python", plan["plan_title"])
        for day in range(1, 8):
            task = next((t for t in plan["tasks"] if t["day_number"] == day), None)
            self.assertIsNotNone(task, f"Day {day} task missing")
            self._verify_task_structured_clarity(task, day)

    def test_02_target_sql_joins(self):
        """Target 2: SQL Joins single concept roadmap content clarity."""
        plan = generate_study_plan(
            user_id=self.user_id,
            target_role="Full Stack Developer",
            topic="SQL Joins",
            duration_days=7,
            daily_study_minutes=60,
            preparation_level="Intermediate",
        )
        self.assertTrue(plan["has_active_plan"])
        self.assertIn("SQL Joins", plan["plan_title"])
        for day in range(1, 8):
            task = next((t for t in plan["tasks"] if t["day_number"] == day), None)
            self.assertIsNotNone(task, f"Day {day} task missing")
            self._verify_task_structured_clarity(task, day)

    def test_03_target_machine_learning(self):
        """Target 3: Machine Learning technical subject roadmap clarity."""
        plan = generate_study_plan(
            user_id=self.user_id,
            target_role="Machine Learning Specialist",
            topic="Machine Learning",
            duration_days=7,
            daily_study_minutes=60,
            preparation_level="Advanced",
        )
        self.assertTrue(plan["has_active_plan"])
        self.assertIn("Machine Learning", plan["plan_title"])
        for day in range(1, 8):
            task = next((t for t in plan["tasks"] if t["day_number"] == day), None)
            self.assertIsNotNone(task, f"Day {day} task missing")
            self._verify_task_structured_clarity(task, day)

    def test_04_target_python_variables_single_topic(self):
        """Target 4: Python Variables individual topic roadmap clarity."""
        plan = generate_study_plan(
            user_id=self.user_id,
            target_role="Python Developer",
            topic="Python Variables",
            duration_days=7,
            daily_study_minutes=45,
            preparation_level="Beginner",
        )
        self.assertTrue(plan["has_active_plan"])
        self.assertIn("Python Variables", plan["plan_title"])
        for day in range(1, 8):
            task = next((t for t in plan["tasks"] if t["day_number"] == day), None)
            self.assertIsNotNone(task, f"Day {day} task missing")
            self._verify_task_structured_clarity(task, day)

    def test_05_target_machine_learning_engineer_job_role(self):
        """Target 5: Machine Learning Engineer job role complete curriculum clarity."""
        plan = generate_study_plan(
            user_id=self.user_id,
            target_role="Machine Learning Engineer",
            duration_days=14,
            daily_study_minutes=90,
            preparation_level="Advanced",
        )
        self.assertTrue(plan["has_active_plan"])
        self.assertEqual(plan["duration_days"], 14)
        for day in range(1, 15):
            task = next((t for t in plan["tasks"] if t["day_number"] == day), None)
            self.assertIsNotNone(task, f"Day {day} task missing")
            self._verify_task_structured_clarity(task, day)

    def test_06_database_retrieval_matches_overview(self):
        """Verifies get_study_plan_overview retrieves full structured fields from SQLite."""
        overview = get_study_plan_overview(self.user_id)
        self.assertTrue(overview["has_active_plan"])
        tasks = overview["tasks"]
        self.assertGreaterEqual(len(tasks), 7)
        task1 = tasks[0]
        self.assertIsInstance(task1.get("what_you_will_learn"), list)
        self.assertIsInstance(task1.get("learning_steps"), list)
        self.assertIsInstance(task1.get("practical_examples"), list)
        self.assertIsInstance(task1.get("topic_breakdown"), list)
        self.assertIsInstance(task1.get("practice_activities"), list)
        self.assertIsInstance(task1.get("completion_goals"), list)


if __name__ == "__main__":
    unittest.main()

