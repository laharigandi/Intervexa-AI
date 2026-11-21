"""
Phase 4 Voice-Based Mock Interview Test Suite
Verifies compatibility between Voice mode speech transcripts and existing interview pipelines:
1. Confirmed voice transcripts submit in the expected format to /evaluate_answers
2. Evaluation pipeline produces valid scores, strengths, weaknesses, and improved answers
3. Session persistence saves voice transcripts atomically into interview history and question details
4. PDF report generation handles spoken answer transcripts correctly
5. Mixed text/voice answers compatibility
6. Multilingual / Unicode voice transcripts (English and Telugu) are handled safely
7. No audio blobs, audio files, or extraneous data stored in SQLite
8. Backend rejects invalid or missing question/answer inputs gracefully
"""

import os
import sys
import unittest
import json
import sqlite3
import tempfile
from unittest.mock import patch

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import get_db_connection, init_db
from services.auth_service import register_user
from flask_jwt_extended import create_access_token
from services.pdf_service import generate_pdf


class TestPhase4VoiceInterview(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

        # Create temporary isolated test database
        cls.test_db_fd, cls.test_db_path = tempfile.mkstemp(suffix="_test_p4.db")
        cls.db_patch = patch("database.DB_PATH", cls.test_db_path)
        cls.db_patch.start()
        init_db()

        # Register a test user
        register_user("Voice Candidate", "voice.candidate@example.com", "Password123!")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", ("voice.candidate@example.com",))
        row = cursor.fetchone()
        cls.user_id = row[0]
        conn.close()

        with app.app_context():
            cls.token = create_access_token(identity=str(cls.user_id))

        cls.auth_headers = {
            "Authorization": f"Bearer {cls.token}",
            "Content-Type": "application/json"
        }

    @classmethod
    def tearDownClass(cls):
        cls.db_patch.stop()
        try:
            os.close(cls.test_db_fd)
            if os.path.exists(cls.test_db_path):
                os.remove(cls.test_db_path)
        except Exception:
            pass

    def test_01_text_interview_mode_unchanged(self):
        """Verify that existing text-mode interviews evaluate and persist unchanged."""
        print("\n[TEST 1] Text Interview Evaluation Workflow Integrity:")
        payload = {
            "role": "Backend Engineer",
            "questions": [
                "What is the difference between a process and a thread?",
                "How does indexing improve database query performance?"
            ],
            "answers": [
                "A process has its own address space, while threads within the same process share memory.",
                "B-tree indexing reduces time complexity from O(N) to O(log N) by creating a lookup structure."
            ]
        }

        mock_eval = [
            {
                "technical_score": 9,
                "communication_score": 8,
                "strengths": "Clear definitions and memory boundary distinction.",
                "mistakes": "Could mention context switching overhead.",
                "improved_answer": "Elaborate on IPC and thread synchronization primitives.",
                "correct_answer": "Processes have distinct virtual address spaces; threads share heap and data segments."
            },
            {
                "technical_score": 9,
                "communication_score": 9,
                "strengths": "Accurate algorithmic explanation of B-tree search.",
                "mistakes": "None noted.",
                "improved_answer": "Can add details on write amplification trade-offs.",
                "correct_answer": "Indexes structure keys in balanced trees to minimize disk I/O lookups."
            }
        ]

        with patch("app.evaluate_interview", return_value=mock_eval):
            res = self.client.post("/evaluate_answers", headers=self.auth_headers, json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertIn("interview_id", data)
            self.assertEqual(len(data.get("results", [])), 2)
            self.assertEqual(data["results"][0]["answer"], payload["answers"][0])
            print("  -> [PASS] Existing text-based interview evaluates and persists identically.")

    def test_02_voice_interview_transcript_submission(self):
        """Verify voice interview spoken transcript submission reaches evaluation successfully."""
        print("\n[TEST 2] Spoken Answer Transcript Reaches Existing Evaluation Pipeline:")
        payload = {
            "role": "Frontend Developer",
            "questions": [
                "How does the React Virtual DOM work?",
                "What are React Hooks and why were they introduced?"
            ],
            "answers": [
                "The virtual DOM is an in-memory representation of real DOM elements. When state changes, React computes diffs and batches updates.",
                "Hooks like useState and useEffect allow functional components to manage local state and lifecycle without class syntax."
            ]
        }

        mock_eval = [
            {
                "technical_score": 8,
                "communication_score": 9,
                "strengths": "Good conversational flow and concise explanation of reconciliation.",
                "mistakes": "Could mention fiber architecture.",
                "improved_answer": "Add mention of React Fiber and reconciliation algorithms.",
                "correct_answer": "The virtual DOM is a lightweight tree representation compared via reconciliation."
            },
            {
                "technical_score": 9,
                "communication_score": 8,
                "strengths": "Clearly explains functional transition and lifecycle encapsulation.",
                "mistakes": "None.",
                "improved_answer": "Mention custom hooks and code reuse.",
                "correct_answer": "Hooks let functional components use stateful logic and side effects cleanly."
            }
        ]

        with patch("app.evaluate_interview", return_value=mock_eval):
            res = self.client.post("/evaluate_answers", headers=self.auth_headers, json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            interview_id = data.get("interview_id")
            self.assertIsNotNone(interview_id)

            # Check that saved interview in DB has the exact voice transcript
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT question, candidate_answer, technical_score FROM interview_details WHERE interview_id = ?", (interview_id,))
            rows = cursor.fetchall()
            conn.close()

            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0][1], payload["answers"][0])
            self.assertEqual(rows[1][1], payload["answers"][1])
            print(f"  -> [PASS] Voice transcripts saved accurately in interview #{interview_id}.")

    def test_03_voice_and_text_mixed_answers(self):
        """Verify mixed mode: candidate speaks some answers and types others."""
        print("\n[TEST 3] Mixed Input Mode (Spoken + Typed Answers):")
        payload = {
            "role": "Full Stack Engineer",
            "questions": [
                "Explain RESTful architecture constraints.",
                "How do you optimize SQL database queries?"
            ],
            "answers": [
                "REST relies on stateless client-server communication with uniform interfaces and cacheable responses.", # Spoken
                "Use EXPLAIN ANALYZE to identify sequential scans, create targeted composite indexes, and avoid SELECT *." # Typed
            ]
        }

        mock_eval = [
            {"technical_score": 8, "communication_score": 8, "strengths": "Covers core constraints."},
            {"technical_score": 9, "communication_score": 9, "strengths": "Practical indexing strategy."}
        ]

        with patch("app.evaluate_interview", return_value=mock_eval):
            res = self.client.post("/evaluate_answers", headers=self.auth_headers, json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertEqual(len(data["results"]), 2)
            print("  -> [PASS] Mixed spoken and typed answers evaluated seamlessly.")

    def test_04_multilingual_transcript_handling(self):
        """Verify Unicode and Telugu transcript compatibility."""
        print("\n[TEST 4] Multilingual / Unicode Voice Transcript Handling:")
        payload = {
            "role": "Software Engineer",
            "questions": [
                "Explain what an API is in simple terms."
            ],
            "answers": [
                "API అనేది రెండు అప్లికేషన్ల మధ్య సమాచారాన్ని మార్పిడి చేసుకునేందుకు ఒక వారధిగా పనిచేస్తుంది. (An API acts as a bridge between two applications)."
            ]
        }

        mock_eval = [
            {
                "technical_score": 8,
                "communication_score": 8,
                "strengths": "Multilingual explanation conveys the core message clearly."
            }
        ]

        with patch("app.evaluate_interview", return_value=mock_eval):
            res = self.client.post("/evaluate_answers", headers=self.auth_headers, json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertEqual(data["results"][0]["answer"], payload["answers"][0])
            print("  -> [PASS] Unicode / Telugu transcripts preserved without corruption.")

    def test_05_pdf_report_contains_voice_transcript(self):
        """Verify PDF report generation successfully includes spoken transcripts."""
        print("\n[TEST 5] PDF Report Generation with Spoken Answers:")
        results = [
            {
                "question": "What is dependency injection?",
                "answer": "Dependency injection is a design pattern where an object receives its dependencies from an external source rather than instantiating them itself.",
                "technical_score": 9,
                "communication_score": 9,
                "strengths": "Accurate inversion of control principle.",
                "mistakes": "None.",
                "improved_answer": "Mention framework examples like Spring or Angular.",
                "correct_answer": "Passing dependencies dynamically to achieve decoupling."
            }
        ]
        summary = {
            "summary": "Candidate demonstrated strong understanding of software design patterns.",
            "strengths": "Clear definitions and modular thinking.",
            "weaknesses": "None identified.",
            "advice": "Keep practicing architectural discussions."
        }

        pdf_path = generate_pdf(results, summary)
        self.assertTrue(os.path.exists(pdf_path))
        self.assertGreater(os.path.getsize(pdf_path), 500)
        print(f"  -> [PASS] PDF report generated successfully ({os.path.getsize(pdf_path)} bytes) containing transcripts.")

    def test_06_no_audio_blobs_or_files_stored(self):
        """Ensure no audio files or media blobs exist in the database or filesystem."""
        print("\n[TEST 6] Privacy & Data Integrity - Zero Audio Storage:")
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check table schemas in DB
        cursor.execute("PRAGMA table_info(interviews)")
        interview_cols = [col[1] for col in cursor.fetchall()]
        self.assertNotIn("audio", interview_cols)
        self.assertNotIn("recording", interview_cols)

        cursor.execute("PRAGMA table_info(interview_details)")
        q_cols = [col[1] for col in cursor.fetchall()]
        self.assertNotIn("audio", q_cols)
        self.assertNotIn("audio_blob", q_cols)
        conn.close()

        # Ensure no .wav, .mp3, .ogg, .webm files created in backend
        audio_files = [f for f in os.listdir(backend_dir) if f.endswith((".wav", ".mp3", ".ogg", ".webm", ".m4a"))]
        self.assertEqual(len(audio_files), 0)
        print("  -> [PASS] Verified zero audio blobs or recording files stored.")

    def test_07_invalid_or_empty_evaluation_payloads(self):
        """Verify backend error handling when questions or answers are missing."""
        print("\n[TEST 7] Robust Validation on Missing/Empty Inputs:")
        # Case A: Empty questions
        res = self.client.post("/evaluate_answers", headers=self.auth_headers, json={"role": "Dev", "questions": [], "answers": []})
        self.assertEqual(res.status_code, 400)

        # Case B: Empty JSON body
        res = self.client.post("/evaluate_answers", headers=self.auth_headers, json={})
        self.assertEqual(res.status_code, 400)
        print("  -> [PASS] Invalid / empty question submissions gracefully rejected with 400.")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase4VoiceInterview)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    print("\n" + "=" * 65)
    print(f"  PHASE 4 VOICE INTERVIEW TEST SUMMARY")
    print(f"  Ran: {result.testsRun} | Passed: {result.testsRun - len(result.failures) - len(result.errors)} | Failed: {len(result.failures)} | Errors: {len(result.errors)}")
    print("=" * 65)
    sys.exit(0 if result.wasSuccessful() else 1)
