"""
End-to-End Verification Test Suite: Exactly 10 Interview Questions
Verifies Standard Interview and Adaptive AI Interview both conduct exactly 10 questions.
"""
import sys
import os
import json
import unittest
from unittest.mock import patch

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from services.groq_service import generate_questions, _build_fallback_questions
from services.adaptive_interview_service import (
    start_adaptive_session,
    submit_adaptive_answer,
    finish_adaptive_session,
    get_adaptive_session,
    DEFAULT_MAX_QUESTIONS,
    AdaptiveInterviewSession,
)

class TestTenQuestionsSuite(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.testing = True
        self.client = self.app.test_client()

    def test_fallback_pool_lengths(self):
        """Verify fallback generator guarantees at least 10 questions for various roles."""
        roles_to_test = [
            "Frontend Developer",
            "Backend Developer",
            "Full Stack Developer",
            "Python Developer",
            "QA / Automation Engineer",
            "Machine Learning Engineer",
            "Data Analyst",
            "General Software Engineer",
        ]
        for role in roles_to_test:
            questions = _build_fallback_questions(role, ["Core Tech", "System Design"])
            self.assertGreaterEqual(
                len(questions),
                10,
                f"Fallback for role '{role}' returned fewer than 10 questions ({len(questions)})",
            )
            # Ensure no duplicates in the first 10
            unique_ten = set(questions[:10])
            self.assertEqual(len(unique_ten), 10, f"Fallback for '{role}' contains duplicate questions in top 10")

    def test_groq_service_generate_questions_guarantees_ten(self):
        """Verify generate_questions in groq_service guarantees exactly 10 questions."""
        roles = ["Frontend Developer", "Python Developer", "Full Stack Developer"]
        for role in roles:
            questions = generate_questions(
                role=role,
                skills=["React", "TypeScript", "Node.js"],
                personality="professional",
            )
            self.assertEqual(
                len(questions),
                10,
                f"generate_questions returned {len(questions)} questions instead of 10 for {role}",
            )
            # Verify each is a non-empty string and unique
            cleaned = [q.strip() for q in questions if q and q.strip()]
            self.assertEqual(len(cleaned), 10, f"Found empty questions in output for {role}")
            self.assertEqual(len(set(cleaned)), 10, f"Found duplicates in generated questions for {role}")

    def test_api_generate_questions_endpoint_returns_ten(self):
        """Verify POST /generate_questions endpoint returns exactly 10 questions."""
        payload = {
            "role": "Frontend Developer",
            "skills": ["React", "JavaScript", "CSS"],
            "experience_level": "Mid Level",
            "interview_type": "technical",
            "interviewer_personality": "professional",
        }
        res = self.client.post("/generate_questions", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"), "API returned success=False")
        questions = data.get("questions", [])
        self.assertEqual(
            len(questions),
            10,
            f"Endpoint returned {len(questions)} questions instead of 10",
        )
        for i, q in enumerate(questions):
            self.assertIsInstance(q, str)
            self.assertTrue(len(q.strip()) > 5, f"Question {i+1} is too short or empty: '{q}'")

    def test_adaptive_service_default_max_questions_is_ten(self):
        """Verify DEFAULT_MAX_QUESTIONS in adaptive_interview_service is 10."""
        self.assertEqual(DEFAULT_MAX_QUESTIONS, 10)

    @patch("services.adaptive_interview_service.evaluate_interview")
    @patch("services.adaptive_interview_service.generate_adaptive_question")
    @patch("services.answer_verification_service.verify_interview_session")
    def test_adaptive_interview_full_ten_question_lifecycle(self, mock_verify, mock_gen_q, mock_eval):
        """Verify Adaptive AI Interview conducts exactly 10 questions step-by-step to completion."""
        mock_verify.return_value = {"summary": {}, "verifications": []}
        # Mock rapid AI question generation & evaluation to test state-machine & limits deterministically
        def side_effect_gen(role, skills, **kwargs):
            prev_qs = kwargs.get("previous_questions", [])
            idx = len(prev_qs) + 1
            return {
                "question": f"Adaptive Question {idx}: Explain advanced architectural principles for {role}.",
                "topic": f"Topic {idx}",
                "difficulty": kwargs.get("difficulty", "medium"),
                "assesses_skill": "Architecture",
                "reason": f"Progression to question {idx}",
            }
        mock_gen_q.side_effect = side_effect_gen

        mock_eval.return_value = [{
            "technical_score": 8.0,
            "communication_score": 8.0,
            "strengths": "Strong structural reasoning",
            "mistakes": "Could include edge-case analysis",
            "improved_answer": "Model answer",
            "correct_answer": "Standard answer",
            "correct_concepts": ["modularity", "scalability"],
            "missing_concepts": [],
            "improvement_suggestions": [],
            "key_takeaways": [],
            "follow_up_questions": [],
        }]

        # Step 1: Start adaptive session via API
        start_payload = {
            "role": "Full Stack Engineer",
            "skills": ["React", "Node.js", "Python", "SQL"],
            "max_questions": 10,
            "initial_difficulty": "medium",
        }
        start_res = self.client.post("/adaptive/start", json=start_payload)
        self.assertEqual(start_res.status_code, 200)
        start_data = start_res.get_json()
        self.assertTrue(start_data.get("success"))
        session = start_data.get("session")
        session_id = session.get("session_id")

        self.assertIsNotNone(session_id)
        self.assertEqual(session.get("max_questions"), 10)
        self.assertEqual(session.get("current_question_index"), 1)
        self.assertFalse(session.get("is_completed"))
        self.assertTrue(len(session.get("current_question", "")) > 5)

        # Step 2: Answer questions 1 through 9
        for q_num in range(1, 10):
            answer_payload = {
                "session_id": session_id,
                "answer": f"Candidate answer for Question {q_num} explaining system architecture, caching, and database indexing.",
            }
            ans_res = self.client.post("/adaptive/answer", json=answer_payload)
            self.assertEqual(ans_res.status_code, 200, f"Failed at question {q_num}")
            ans_data = ans_res.get_json()
            self.assertTrue(ans_data.get("success"), f"Answer {q_num} returned success=False")

            sess = ans_data.get("session", {})
            self.assertFalse(
                ans_data.get("is_completed"),
                f"Session prematurely completed after question {q_num}! Expected to continue to 10.",
            )
            self.assertEqual(
                sess.get("current_question_index"),
                q_num + 1,
                f"Expected next question index {q_num + 1}, got {sess.get('current_question_index')}",
            )
            next_q = sess.get("current_question")
            self.assertTrue(
                next_q and len(next_q) > 5,
                f"Next question {q_num + 1} is empty",
            )

        # Step 3: Answer question 10 (the 10th and final question)
        final_answer_payload = {
            "session_id": session_id,
            "answer": "Candidate answer for final Question 10 explaining microservices, event-driven design, and observability.",
        }
        final_ans_res = self.client.post("/adaptive/answer", json=final_answer_payload)
        self.assertEqual(final_ans_res.status_code, 200)
        final_ans_data = final_ans_res.get_json()
        self.assertTrue(final_ans_data.get("success"))
        self.assertTrue(
            final_ans_data.get("is_completed"),
            "Session did NOT complete after exactly 10 questions!",
        )

        # Step 4: Finish session and verify compilation of all 10 responses
        with patch("services.groq_service._call_groq") as mock_groq_call:
            mock_groq_call.return_value = json.dumps({
                "overall_score": 8.0,
                "technical_score": 8.0,
                "summary": "Outstanding performance across all 10 technical domains.",
                "strengths": ["Clean architecture", "Comprehensive answers"],
                "areas_for_improvement": ["Deepen edge case analysis"],
            })
            finish_res = self.client.post("/adaptive/finish", json={"session_id": session_id})
            self.assertEqual(finish_res.status_code, 200)
            finish_data = finish_res.get_json()
            self.assertTrue(finish_data.get("success"))
            results = finish_data.get("results", [])
            self.assertEqual(len(results), 10, f"Expected 10 results in finish report, got {len(results)}")

    @patch("services.groq_service._call_groq")
    @patch("services.answer_verification_service.verify_interview_session")
    def test_standard_interview_evaluate_ten_answers(self, mock_verify, mock_groq):
        """Verify /evaluate_answers endpoint accepts and scores all 10 questions and answers."""
        mock_verify.return_value = {"summary": {}, "verifications": []}
        mock_groq.return_value = json.dumps([{
            "technical_score": 8,
            "communication_score": 8,
            "strengths": "Solid explanation.",
            "mistakes": "Minor omission.",
            "improved_answer": "Detailed answer.",
            "correct_answer": "Complete answer.",
        }] * 10)

        ten_questions = [f"Technical Question #{i}: Explain core patterns in software development." for i in range(1, 11)]
        ten_answers = [f"Technical Answer #{i}: I use scalable architectures, unit testing, and design patterns." for i in range(1, 11)]

        payload = {
            "role": "Backend Developer",
            "questions": ten_questions,
            "answers": ten_answers,
        }
        res = self.client.post("/evaluate_answers", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("summary", data)
        self.assertIn("results", data)
        self.assertEqual(len(data.get("results", [])), 10)

if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestTenQuestionsSuite)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
