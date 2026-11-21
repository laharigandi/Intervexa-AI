import os
import sys
import unittest
import json
import sqlite3

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from database import init_db, get_db_connection
from app import app
from services.communication_service import (
    detect_filler_words,
    evaluate_answer_structure,
    evaluate_clarity_and_conciseness,
    evaluate_speaking_pace,
    compute_communication_score,
    analyze_single_answer_communication,
    generate_overall_communication_summary,
    is_behavioral_question,
)
from services.history_service import (
    save_interview,
    get_interview_detail,
    get_user_history,
)
from services.pdf_service import generate_pdf


class TestCommunicationAndSpeakingFeedback(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_db = os.path.join(BASE_DIR, "test_communication_feedback.db")
        if os.path.exists(cls.test_db):
            os.remove(cls.test_db)
        init_db(cls.test_db)

        # Seed test user
        conn = get_db_connection(cls.test_db)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users(name, email, password) VALUES (?, ?, ?)", ("Alice Mentor", "alice@example.com", "hashpass"))
        cls.user_alice_id = cursor.lastrowid
        cursor.execute("INSERT INTO users(name, email, password) VALUES (?, ?, ?)", ("Bob Student", "bob@example.com", "hashpass2"))
        cls.user_bob_id = cursor.lastrowid
        conn.commit()
        conn.close()

        cls.client = app.test_client()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.test_db):
            try:
                os.remove(cls.test_db)
            except Exception:
                pass

    # =========================================================================
    # 1. FILLER WORD DETECTION TESTS
    # =========================================================================
    def test_01_filler_word_detection(self):
        text = "Um, basically React hooks like useState, you know, allow functional components to actually manage state."
        result = detect_filler_words(text)

        self.assertEqual(result["counts"]["um"], 1)
        self.assertEqual(result["counts"]["basically"], 1)
        self.assertEqual(result["counts"]["you know"], 1)
        self.assertEqual(result["counts"]["actually"], 1)
        # "like useState" must NOT be counted as a filler word
        self.assertEqual(result["counts"]["like"], 0)
        self.assertEqual(result["total_fillers"], 4)
        self.assertTrue(result["is_estimate"])
        self.assertGreater(result["density_percent"], 0)
        self.assertGreaterEqual(len(result["tips"]), 1)

    def test_02_filler_words_contextual_like(self):
        # Legitimate uses: "sounds like", "would like", "like to"
        legit_text = "It looks like a solid design and I would like to implement caching like Redis."
        res_legit = detect_filler_words(legit_text)
        self.assertEqual(res_legit["counts"]["like"], 0)

        # Filler use: hesitation with comma
        filler_text = "We built the API and, like, it handled high traffic."
        res_filler = detect_filler_words(filler_text)
        self.assertGreaterEqual(res_filler["counts"]["like"], 1)

    # =========================================================================
    # 2. EMPTY AND INVALID TRANSCRIPTS
    # =========================================================================
    def test_03_empty_and_short_transcripts(self):
        empty_res = analyze_single_answer_communication("What is SQL?", "")
        self.assertEqual(empty_res["communication_score"], 0)
        self.assertEqual(empty_res["communication_rating"], "No Attempt / Incomplete")
        self.assertEqual(empty_res["word_count"], 0)

        short_res = analyze_single_answer_communication("What is SQL?", "Yes")
        self.assertEqual(short_res["communication_score"], 0)
        self.assertEqual(short_res["word_count"], 1)

        none_res = analyze_single_answer_communication("What is SQL?", None)
        self.assertEqual(none_res["communication_score"], 0)

    # =========================================================================
    # 3. SPEAKING PACE ESTIMATION
    # =========================================================================
    def test_04_speaking_pace_unavailable_without_timing(self):
        # When timing is unavailable (None or <= 0), pace must be omitted, not fabricated
        pace_none = evaluate_speaking_pace(120, None)
        self.assertIsNone(pace_none["wpm"])
        self.assertEqual(pace_none["status"], "unavailable")
        self.assertEqual(pace_none["display"], "Speaking pace unavailable")
        self.assertFalse(pace_none["is_measured"])

        pace_zero = evaluate_speaking_pace(120, 0)
        self.assertIsNone(pace_zero["wpm"])
        self.assertEqual(pace_zero["display"], "Speaking pace unavailable")

    def test_05_speaking_pace_measured_with_valid_duration(self):
        # 140 words in 60 seconds = 140 WPM (Ideal)
        pace_optimal = evaluate_speaking_pace(140, 60.0)
        self.assertEqual(pace_optimal["wpm"], 140)
        self.assertEqual(pace_optimal["status"], "optimal")
        self.assertTrue(pace_optimal["is_measured"])
        self.assertIn("140 WPM", pace_optimal["display"])

        # 200 words in 60 seconds = 200 WPM (Fast)
        pace_fast = evaluate_speaking_pace(200, 60.0)
        self.assertEqual(pace_fast["status"], "fast")

        # 80 words in 60 seconds = 80 WPM (Slow/Deliberate)
        pace_slow = evaluate_speaking_pace(80, 60.0)
        self.assertEqual(pace_slow["status"], "slow")

    # =========================================================================
    # 4. ANSWER STRUCTURE & STAR FORMAT
    # =========================================================================
    def test_06_technical_structure_does_not_force_star(self):
        tech_q = "Explain database indexing and B-Tree structures."
        tech_ans = "Database indexing improves query search performance. Specifically, B-Trees balance read and write operations in O(log n) time. For example, creating a composite index on user_id and created_at reduces full table scans. In summary, indexes trade disk space and write overhead for fast lookups."
        struct = evaluate_answer_structure(tech_q, tech_ans)

        self.assertTrue(struct["has_opening"])
        self.assertTrue(struct["has_explanation"])
        self.assertTrue(struct["has_example"])
        self.assertTrue(struct["has_conclusion"])
        # Technical question must NOT enforce STAR format
        self.assertIsNone(struct["star_format"])
        self.assertGreaterEqual(struct["score"], 20)

    def test_07_behavioral_structure_evaluates_star(self):
        behav_q = "Tell me about a time you faced a difficult conflict within your engineering team."
        behav_ans = "During my internship, our team had a conflict regarding whether to use REST or GraphQL. My role was backend lead, and my task was to ensure API performance and developer velocity. I organized a benchmarking sprint where we tested latency under load. As a result, the team aligned on REST with selective caching, delivering the project 2 weeks ahead of schedule."
        struct = evaluate_answer_structure(behav_q, behav_ans)

        self.assertIsNotNone(struct["star_format"])
        self.assertTrue(struct["star_format"]["is_applicable"])
        self.assertTrue(struct["star_format"]["situation"])
        self.assertTrue(struct["star_format"]["task"])
        self.assertTrue(struct["star_format"]["action"])
        self.assertTrue(struct["star_format"]["result"])
        self.assertEqual(struct["star_format"]["star_score"], "4/4 components present")

    # =========================================================================
    # 5. COMMUNICATION SCORING RUBRIC (100-POINT STANDARD)
    # =========================================================================
    def test_08_scoring_rubric_100_points(self):
        score_data = compute_communication_score(
            structure_score=24,
            clarity_score=23,
            filler_density=0.0,
            word_count=75,
            candidate_answer="A complete articulate response."
        )

        self.assertEqual(score_data["total_score"], 97)
        self.assertEqual(score_data["rubric_breakdown"]["structure"], 24)
        self.assertEqual(score_data["rubric_breakdown"]["clarity"], 23)
        self.assertEqual(score_data["rubric_breakdown"]["conciseness"], 25)
        self.assertEqual(score_data["rubric_breakdown"]["fluency"], 25)
        self.assertEqual(score_data["rating"], "Excellent Professional Communication")

    # =========================================================================
    # 6. DATABASE PERSISTENCE & RETRIEVAL
    # =========================================================================
    def test_09_database_save_and_retrieve_feedback(self):
        q = "What is the difference between synchronous and asynchronous code?"
        a = "Synchronous code executes sequentially blocking subsequent tasks. In contrast, asynchronous code leverages the event loop to execute non-blocking operations. For example, fetching an API asynchronously allows the UI to stay responsive. In summary, async code maximizes concurrency."
        
        fb = analyze_single_answer_communication(q, a, duration_seconds=22.0)
        overall_fb = generate_overall_communication_summary([fb])

        item = {
            "question": q,
            "answer": a,
            "technical_score": 9,
            "communication_score": 9,
            "strengths": "Clear explanation of event loop.",
            "mistakes": "None.",
            "improved_answer": a,
            "correct_answer": a,
            "communication_feedback": fb,
        }

        interview_id = save_interview(
            user_id=self.user_alice_id,
            role="Full Stack Developer",
            avg_score=9.0,
            summary="Strong interview performance.",
            results=[item],
            overall_summary={"summary": "Great session", "communication_feedback": overall_fb},
            db_path=self.test_db,
            communication_score=overall_fb["overall_score"],
            communication_feedback=overall_fb,
        )

        detail = get_interview_detail(interview_id, user_id=self.user_alice_id, db_path=self.test_db)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["interview"]["role"], "Full Stack Developer")
        self.assertEqual(detail["interview"]["communication_score"], overall_fb["overall_score"])
        
        # Verify question-level feedback deserialized as structured dict
        q_retrieved = detail["questions"][0]
        self.assertIsInstance(q_retrieved["communication_feedback"], dict)
        self.assertEqual(q_retrieved["communication_feedback"]["communication_score"], fb["communication_score"])
        self.assertEqual(q_retrieved["communication_feedback"]["speaking_pace"]["wpm"], fb["speaking_pace"]["wpm"])

        # Authorization: Bob cannot access Alice's interview
        bob_detail = get_interview_detail(interview_id, user_id=self.user_bob_id, db_path=self.test_db)
        self.assertIsNone(bob_detail)

    # =========================================================================
    # 7. BACKWARD COMPATIBILITY WITH LEGACY RECORDS
    # =========================================================================
    def test_10_legacy_interview_without_comm_feedback_loads_cleanly(self):
        # Insert legacy row directly without communication_feedback
        conn = get_db_connection(self.test_db)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO interviews(user_id, role, avg_score, summary) VALUES (?, ?, ?, ?)",
            (self.user_alice_id, "DevOps Engineer", 8.0, "Legacy test session")
        )
        legacy_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO interview_details(interview_id, question, candidate_answer, technical_score, communication_score) VALUES (?, ?, ?, ?, ?)",
            (legacy_id, "What is Docker?", "Docker is a containerization tool.", 8.0, 7.0)
        )
        conn.commit()
        conn.close()

        detail = get_interview_detail(legacy_id, user_id=self.user_alice_id, db_path=self.test_db)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["interview"]["role"], "DevOps Engineer")
        self.assertIsNone(detail["interview"]["communication_score"])
        self.assertIsNone(detail["questions"][0]["communication_feedback"])

    # =========================================================================
    # 8. PDF REPORT GENERATION INTEGRATION
    # =========================================================================
    def test_11_pdf_report_with_communication_feedback(self):
        q = "How does HTTPS establish a secure TLS handshake?"
        a = "HTTPS initiates a TLS handshake starting with Client Hello. The server responds with its TLS certificate and public key. For example, symmetric session keys are negotiated via ECDHE. In conclusion, HTTPS protects data in transit with confidentiality and integrity."
        fb = analyze_single_answer_communication(q, a, duration_seconds=20.0)
        overall_fb = generate_overall_communication_summary([fb])

        item = {
            "question": q,
            "answer": a,
            "technical_score": 9,
            "communication_score": 9,
            "strengths": "Solid handshake description.",
            "mistakes": "Could mention ALPN.",
            "improved_answer": a,
            "correct_answer": a,
            "communication_feedback": fb,
        }

        summary = {
            "summary": "Overall solid performance.",
            "strengths": "Strong network concepts.",
            "weaknesses": "None.",
            "advice": "Keep practicing system design.",
            "communication_feedback": overall_fb,
        }

        pdf_path = generate_pdf([item], summary)
        self.assertTrue(os.path.exists(pdf_path))
        self.assertGreater(os.path.getsize(pdf_path), 500)


if __name__ == "__main__":
    unittest.main()
