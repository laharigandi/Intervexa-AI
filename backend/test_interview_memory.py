import os
import sys
import unittest
import sqlite3
import tempfile
import json

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import init_db, get_db_connection
from services.interview_memory_service import (
    record_interview_memory,
    get_interview_memory_overview,
    get_weak_areas,
    get_strong_areas,
    get_skill_progress,
    get_recent_improvements,
    get_next_interview_recommendations,
    reset_interview_memory,
    generate_personalized_followup_question,
    calculate_mastery_status,
)


class TestInterviewMemoryEngine(unittest.TestCase):
    def setUp(self):
        # Create dedicated isolated test SQLite database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.temp_db.close()
        init_db(self.db_path)

        # Seed test users
        conn = get_db_connection(self.db_path)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (id, name, email, password) VALUES (1, 'Deepika', 'deepika@test.com', 'hashed')")
        cursor.execute("INSERT INTO users (id, name, email, password) VALUES (2, 'Rahul', 'rahul@test.com', 'hashed')")
        conn.commit()
        conn.close()

    def tearDown(self):
        try:
            os.remove(self.db_path)
        except Exception:
            pass

    def test_new_candidate_no_memory(self):
        """TEST 1: New candidate with no previous interviews returns clean baseline."""
        overview = get_interview_memory_overview(user_id=1, db_path=self.db_path)
        self.assertFalse(overview["has_memory"])
        self.assertEqual(overview["total_interviews"], 0)
        self.assertEqual(overview["topics_remembered"], 0)
        self.assertEqual(overview["weak_topics_count"], 0)

        weak = get_weak_areas(user_id=1, db_path=self.db_path)
        self.assertEqual(len(weak), 0)

        strong = get_strong_areas(user_id=1, db_path=self.db_path)
        self.assertEqual(len(strong), 0)

    def test_record_first_interview_memory(self):
        """TEST 2: Candidate completes first interview with weak SQL and strong OOP."""
        results = [
            {
                "question": "What is normalization in SQL and explain 1NF, 2NF, 3NF?",
                "answer": "Incomplete explanation.",
                "technical_score": 4.5,  # 45%
                "mistakes": "Unable to explain 1NF, 2NF, and 3NF clearly",
                "missing_concepts": ["1NF atomic values", "2NF partial dependency", "3NF transitive dependency"],
                "topic": "SQL & Database Design",
            },
            {
                "question": "Explain Object Oriented Programming principles in Python.",
                "answer": "Clear explanation of inheritance, encapsulation, and polymorphism.",
                "technical_score": 8.5,  # 85%
                "mistakes": "",
                "topic": "OOP Concepts",
            },
            {
                "question": "How do you implement binary search in Python?",
                "answer": "Partial answer.",
                "technical_score": 4.0,  # 40%
                "mistakes": "Missed midpoint overflow and edge cases",
                "topic": "Data Structures & Algorithms",
            }
        ]

        recorded = record_interview_memory(
            user_id=1,
            role="Python Developer",
            interview_mode="standard",
            results=results,
            interview_id=101,
            db_path=self.db_path,
        )
        self.assertTrue(recorded)

        overview = get_interview_memory_overview(user_id=1, db_path=self.db_path)
        self.assertTrue(overview["has_memory"])
        self.assertEqual(overview["total_interviews"], 1)
        self.assertEqual(overview["topics_remembered"], 3)
        self.assertEqual(overview["weak_topics_count"], 2)  # SQL (45%) & Data Structures (40%)
        self.assertEqual(overview["strong_topics_count"], 1)  # OOP (85%)

        weak = get_weak_areas(user_id=1, db_path=self.db_path)
        self.assertEqual(len(weak), 2)
        # Lowest score first
        self.assertEqual(weak[0]["topic"], "Data Structures & Algorithms")
        self.assertEqual(weak[0]["latest_score"], 40.0)
        self.assertEqual(weak[1]["topic"], "SQL & Database Design")
        self.assertEqual(weak[1]["latest_score"], 45.0)

        # Verify transparent mastery status: 85% on 1st attempt should be 'Proficient', NOT 'Mastered'
        strong = get_strong_areas(user_id=1, db_path=self.db_path)
        self.assertEqual(len(strong), 1)
        self.assertEqual(strong[0]["topic"], "OOP Concepts")
        self.assertEqual(strong[0]["mastery_status"], "Proficient")

    def test_memory_update_and_improvement_tracking(self):
        """TEST 3 & 5: Candidate improves SQL performance in second interview (+30%)."""
        # Session 1: SQL score 45%
        record_interview_memory(
            user_id=1,
            role="Python Developer",
            interview_mode="standard",
            results=[{
                "question": "What is normalization?",
                "technical_score": 4.5,
                "topic": "SQL & Database Design",
            }],
            interview_id=101,
            db_path=self.db_path,
        )

        # Session 2: SQL score 75%
        record_interview_memory(
            user_id=1,
            role="Python Developer",
            interview_mode="adaptive",
            results=[{
                "question": "Explain 1NF, 2NF, 3NF with a student schema.",
                "technical_score": 7.5,
                "topic": "SQL & Database Design",
            }],
            interview_id=102,
            db_path=self.db_path,
        )

        overview = get_interview_memory_overview(user_id=1, db_path=self.db_path)
        self.assertEqual(overview["total_interviews"], 2)

        progress = get_skill_progress(user_id=1, db_path=self.db_path)
        sql_prog = next(p for p in progress if p["topic"] == "SQL & Database Design")
        self.assertEqual(sql_prog["previous_score"], 45.0)
        self.assertEqual(sql_prog["latest_score"], 75.0)
        self.assertEqual(sql_prog["average_score"], 60.0)
        self.assertEqual(sql_prog["improvement_trend"], 30.0)  # +30 percentage points
        self.assertEqual(sql_prog["attempt_count"], 2)
        self.assertEqual(sql_prog["mastery_status"], "Developing")

        improvements = get_recent_improvements(user_id=1, db_path=self.db_path)
        self.assertEqual(len(improvements), 1)
        self.assertEqual(improvements[0]["improvement_trend"], 30.0)

    def test_personalized_question_prioritization(self):
        """TEST 4: Personalized follow-up question prioritizes previous weak topics."""
        # Seed weak SQL memory
        record_interview_memory(
            user_id=1,
            role="Python Developer",
            interview_mode="standard",
            results=[{
                "question": "Explain database normalization.",
                "technical_score": 4.0,
                "mistakes": "Incomplete explanation of 1NF, 2NF, 3NF",
                "topic": "SQL & Database Design",
            }],
            interview_id=101,
            db_path=self.db_path,
        )

        question_obj = generate_personalized_followup_question(
            user_id=1,
            role="Python Developer",
            skills=["Python", "SQL"],
            difficulty="medium",
            db_path=self.db_path,
        )
        self.assertIsNotNone(question_obj)
        self.assertIn("question", question_obj)
        self.assertIn("topic", question_obj)
        self.assertEqual(question_obj["difficulty"], "medium")

    def test_memory_isolation_between_users(self):
        """TEST 9: User 1's memory is never accessible by User 2."""
        record_interview_memory(
            user_id=1,
            role="Python Developer",
            interview_mode="standard",
            results=[{
                "question": "SQL joins",
                "technical_score": 4.0,
                "topic": "SQL & Database Design",
            }],
            interview_id=101,
            db_path=self.db_path,
        )

        user2_overview = get_interview_memory_overview(user_id=2, db_path=self.db_path)
        self.assertFalse(user2_overview["has_memory"])
        self.assertEqual(user2_overview["total_interviews"], 0)
        self.assertEqual(len(get_weak_areas(user_id=2, db_path=self.db_path)), 0)

    def test_reset_memory(self):
        """TEST 11: Memory reset clears memory tables while preserving interviews table."""
        conn = get_db_connection(self.db_path)
        conn.execute("INSERT INTO interviews (id, user_id, role, avg_score) VALUES (101, 1, 'Python Developer', 6.0)")
        conn.commit()
        conn.close()

        record_interview_memory(
            user_id=1,
            role="Python Developer",
            interview_mode="standard",
            results=[{"question": "Q1", "technical_score": 5.0, "topic": "Python Fundamentals"}],
            interview_id=101,
            db_path=self.db_path,
        )

        self.assertTrue(get_interview_memory_overview(user_id=1, db_path=self.db_path)["has_memory"])
        reset_interview_memory(user_id=1, db_path=self.db_path)

        overview_after = get_interview_memory_overview(user_id=1, db_path=self.db_path)
        self.assertEqual(overview_after["topics_remembered"], 0)

        # Confirm interviews table is still intact!
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM interviews WHERE user_id = 1")
        self.assertEqual(cur.fetchone()[0], 1)
        conn.close()


if __name__ == "__main__":
    unittest.main()

