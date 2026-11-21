"""
End-to-End Test Suite for Daily Quiz Preparation System
Intervexa AI - Smart Interview Coach
"""

import os
import sys
import json
import unittest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import init_db, get_db_connection
from services.daily_quiz_service import (
    generate_daily_quiz_questions,
    get_or_generate_daily_quiz,
    submit_daily_quiz,
    get_daily_quizzes_overview,
    _get_previous_quiz_questions
)


class TestDailyQuizSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        conn = get_db_connection()
        cursor = conn.cursor()

        # Create test user
        cursor.execute("INSERT OR IGNORE INTO users (id, name, email, password) VALUES (9999, 'Quiz Tester', 'quiztest@example.com', 'hashed_pw')")

        # Create test study plan
        cursor.execute("""
            INSERT OR REPLACE INTO study_plans (id, user_id, target_role, duration_days, daily_study_minutes, preparation_level, start_date, end_date, status)
            VALUES (9999, 9999, 'Full Stack Developer', 7, 60, 'Intermediate', CURRENT_DATE, DATE(CURRENT_DATE, '+7 days'), 'active')
        """)

        # Create study tasks for 3 days
        tasks_data = [
            (9991, 9999, 9999, 1, "React & Frontend Architecture", "Intermediate", "pending"),
            (9992, 9999, 9999, 2, "SQL & Database Design", "Intermediate", "pending"),
            (9993, 9999, 9999, 3, "REST APIs & Web Services", "Intermediate", "pending"),
        ]
        for t in tasks_data:
            cursor.execute("""
                INSERT OR REPLACE INTO study_tasks (id, plan_id, user_id, day_number, topic, difficulty, status, task_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
            """, t)

        # Clear existing test quizzes
        cursor.execute("DELETE FROM daily_quizzes WHERE user_id = 9999")
        cursor.execute("DELETE FROM learning_activities WHERE user_id = 9999")
        conn.commit()
        conn.close()

    def test_01_smart_quiz_generation(self):
        """Test dynamic question generation matching specific daily learning topic"""
        questions = generate_daily_quiz_questions(
            topic="React & Frontend Architecture",
            role="Full Stack Developer",
            difficulty="Intermediate",
            day_number=1
        )
        self.assertGreaterEqual(len(questions), 5)
        for q in questions:
            self.assertIn("id", q)
            self.assertIn("question", q)
            self.assertIn("options", q)
            self.assertEqual(len(q["options"]), 4)
            self.assertIn(q["correct_answer"], ["A", "B", "C", "D"])
            self.assertTrue(len(q["explanation"]) > 5)

    def test_02_anti_repetition_logic(self):
        """Test that questions from previous days are logged and excluded"""
        conn = get_db_connection()
        cursor = conn.cursor()
        sample_q = json.dumps([{"id": 1, "question": "What is the React virtual DOM?"}])
        cursor.execute("""
            INSERT OR REPLACE INTO daily_quizzes (user_id, plan_id, day_number, topic, questions_json, status)
            VALUES (9999, 9999, 1, 'React', ?, 'completed')
        """, (sample_q,))
        conn.commit()
        conn.close()

        prev_q = _get_previous_quiz_questions(user_id=9999, plan_id=9999, current_day=2)
        self.assertIn("What is the React virtual DOM?", prev_q)

    def test_03_get_or_generate_daily_quiz(self):
        """Test API service retrieval and initialization of daily quiz"""
        res = get_or_generate_daily_quiz(user_id=9999, plan_id=9999, day_number=2)
        self.assertTrue(res["success"])
        self.assertEqual(res["day_number"], 2)
        self.assertEqual(res["topic"], "SQL & Database Design")
        self.assertEqual(res["status"], "pending")
        self.assertFalse(res["is_completed"])
        self.assertEqual(len(res["questions"]), 5)

    def test_04_submit_quiz_and_score_calculation(self):
        """Test answer submission, score calculation, and review generation"""
        # Fetch Day 2 quiz questions
        quiz = get_or_generate_daily_quiz(user_id=9999, plan_id=9999, day_number=2)
        questions = quiz["questions"]
        self.assertEqual(len(questions), 5)

        # Submit: 4 correct answers, 1 wrong answer (Question 5)
        answers = {}
        for q in questions[:4]:
            answers[str(q["id"])] = q["correct_answer"]
        # Intentionally wrong for last question
        wrong_opt = "C" if questions[4]["correct_answer"] != "C" else "D"
        answers[str(questions[4]["id"])] = wrong_opt

        submit_res = submit_daily_quiz(
            user_id=9999,
            plan_id=9999,
            day_number=2,
            user_answers=answers
        )

        self.assertTrue(submit_res["success"])
        self.assertEqual(submit_res["total_questions"], 5)
        self.assertEqual(submit_res["correct_answers"], 4)
        self.assertEqual(submit_res["wrong_answers"], 1)
        self.assertEqual(submit_res["percentage"], 80.0)
        self.assertTrue(submit_res["passed"])
        self.assertEqual(len(submit_res["review"]), 5)

        # Verify explanation is present for questions
        for item in submit_res["review"]:
            self.assertTrue(len(item["explanation"]) > 0)

        # Check question 5 review is marked incorrect
        q5_review = submit_res["review"][4]
        self.assertFalse(q5_review["is_correct"])

    def test_05_database_persistence_and_progress_update(self):
        """Test database records in daily_quizzes, learning_activities, and study_tasks"""
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify daily_quizzes record
        cursor.execute("SELECT status, score_pct, correct_answers, wrong_answers FROM daily_quizzes WHERE user_id = 9999 AND day_number = 2")
        q_row = cursor.fetchone()
        self.assertIsNotNone(q_row)
        self.assertEqual(q_row[0], "completed")
        self.assertEqual(q_row[1], 80.0)
        self.assertEqual(q_row[2], 4)
        self.assertEqual(q_row[3], 1)

        # Verify learning_activities logged
        cursor.execute("SELECT activity_type, practice_score FROM learning_activities WHERE user_id = 9999 AND activity_type = 'daily_quiz'")
        act_row = cursor.fetchone()
        self.assertIsNotNone(act_row)
        self.assertEqual(act_row[1], 80.0)

        # Verify study_tasks automatically marked completed since score >= 60%
        cursor.execute("SELECT status FROM study_tasks WHERE id = 9992")
        task_row = cursor.fetchone()
        self.assertIsNotNone(task_row)
        self.assertEqual(task_row[0], "completed")

        conn.close()

    def test_06_review_previous_quiz_results(self):
        """Test that completed quizzes can be retrieved for historical review"""
        res = get_or_generate_daily_quiz(user_id=9999, plan_id=9999, day_number=2)
        self.assertTrue(res["success"])
        self.assertTrue(res["is_completed"])
        self.assertEqual(res["status"], "completed")
        self.assertEqual(res["score_pct"], 80.0)
        self.assertEqual(len(res["review"]), 5)

    def test_07_daily_quizzes_overview(self):
        """Test comprehensive daily schedule overview with Completed vs Pending status"""
        ov = get_daily_quizzes_overview(user_id=9999, plan_id=9999)
        self.assertTrue(ov["success"])
        self.assertTrue(ov["has_active_plan"])
        self.assertEqual(ov["completed_quizzes_count"], 2) # Day 1 and Day 2 completed
        self.assertGreater(ov["pending_quizzes_count"], 0)
        self.assertGreaterEqual(ov["average_quiz_score"], 0.0)

        quizzes = ov["quizzes"]
        day2_info = next((q for q in quizzes if q["day_number"] == 2), None)
        self.assertIsNotNone(day2_info)
        self.assertEqual(day2_info["quiz_status"], "completed")
        self.assertEqual(day2_info["score_pct"], 80.0)

        day3_info = next((q for q in quizzes if q["day_number"] == 3), None)
        self.assertIsNotNone(day3_info)
        self.assertEqual(day3_info["quiz_status"], "pending")


if __name__ == "__main__":
    unittest.main()
