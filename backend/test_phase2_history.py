import os
import sys
import tempfile
import sqlite3
import json
import unittest
from unittest.mock import patch

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import DB_PATH, get_db_connection, init_db
from services.history_service import (
    save_interview,
    get_interview_detail,
    get_user_history,
)
import app as flask_app


class Phase2HistoryTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        flask_app.app.config["TESTING"] = True
        cls.client = flask_app.app.test_client()

    # -------------------------------------------------------------------------
    # TEST 1: Database Migration Preserves Existing Users and Interviews
    # -------------------------------------------------------------------------
    def test_01_migration_preserves_existing_data(self):
        print("\n[TEST 1] Verifying Migration Preserves Existing Users and Interviews:")
        self.assertTrue(os.path.exists(DB_PATH), f"Database must exist at {DB_PATH}")

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check existing users and interviews
        cursor.execute("SELECT count(*) FROM users")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT count(*) FROM interviews")
        interview_count = cursor.fetchone()[0]

        print(f"  Existing Users Count: {user_count} (Must be >= 12)")
        print(f"  Existing Interviews Count: {interview_count} (Must be >= 4)")
        self.assertGreaterEqual(user_count, 12, "Existing users must be preserved")
        self.assertGreaterEqual(interview_count, 4, "Existing interviews must be preserved")

        # Verify interview_details table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='interview_details'")
        self.assertIsNotNone(cursor.fetchone(), "interview_details table must exist")

        # Verify interview_details schema columns
        cursor.execute("PRAGMA table_info(interview_details)")
        detail_cols = {row[1] for row in cursor.fetchall()}
        required_detail_cols = {
            "id", "interview_id", "question", "candidate_answer",
            "technical_score", "communication_score", "strengths",
            "mistakes", "improved_answer", "ideal_answer", "created_at"
        }
        self.assertTrue(required_detail_cols.issubset(detail_cols), f"Missing detail cols: {required_detail_cols - detail_cols}")

        # Verify interviews table extended columns
        cursor.execute("PRAGMA table_info(interviews)")
        interview_cols = {row[1] for row in cursor.fetchall()}
        required_interview_cols = {"id", "user_id", "role", "avg_score", "summary", "created_at", "recommendation", "strengths", "weaknesses", "advice"}
        self.assertTrue(required_interview_cols.issubset(interview_cols), f"Missing interview cols: {required_interview_cols - interview_cols}")

        conn.close()

        # Verify migration is idempotent
        init_db()
        conn2 = get_db_connection()
        c2 = conn2.cursor()
        c2.execute("SELECT count(*) FROM users")
        self.assertEqual(c2.fetchone()[0], user_count, "User count must not change on re-init")
        c2.execute("SELECT count(*) FROM interviews")
        self.assertEqual(c2.fetchone()[0], interview_count, "Interview count must not change on re-init")
        conn2.close()

        print("  -> [PASS] Database migration is idempotent and existing data intact.")

    # -------------------------------------------------------------------------
    # Helper to create an isolated temporary test database
    # -------------------------------------------------------------------------
    def _create_temp_db(self):
        fd, temp_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        init_db(temp_path)
        return temp_path

    # -------------------------------------------------------------------------
    # TEST 2: Newly Evaluated Interview Stores Overall Record & Question Details
    # -------------------------------------------------------------------------
    def test_02_persists_interview_and_question_details_atomically(self):
        print("\n[TEST 2] Verifying Persistence of Interview Summary and Question Details:")
        temp_db = self._create_temp_db()
        try:
            # Seed a test user
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("Alice", "alice@example.com", "hash123"))
            user_id = c.lastrowid
            conn.commit()
            conn.close()

            test_results = [
                {
                    "question": "Explain polymorphism in Object-Oriented Programming.",
                    "candidate_answer": "Polymorphism lets objects of different classes be treated through a common interface.",
                    "technical_score": 9,
                    "communication_score": 8,
                    "strengths": "Accurate definition and clear distinction.",
                    "mistakes": "Could mention method overriding vs overloading.",
                    "improved_answer": "Polymorphism enables one interface with multiple implementations, both compile-time and runtime.",
                    "ideal_answer": "Polymorphism allows objects to take multiple forms through inheritance, interfaces, and dynamic dispatch."
                },
                {
                    "question": "What is an index in SQL?",
                    "candidate_answer": "An index speeds up SELECT queries like a book index.",
                    "technical_score": 8,
                    "communication_score": 7,
                    "strengths": "Good real-world analogy.",
                    "mistakes": "Did not specify B-tree or write performance overhead.",
                    "improved_answer": "An index is a B-Tree structure improving read efficiency at the cost of slower writes.",
                    "ideal_answer": "A database index creates sorted pointer lookups (B-Tree/Hash) reducing table scans."
                }
            ]

            overall_summary = {
                "summary": "Alice demonstrated strong fundamental understanding across core software concepts.",
                "recommendation": "Ready",
                "strengths": "Concise explanations with accurate analogies.",
                "weaknesses": "Could provide deeper architectural mechanics.",
                "advice": "Review system indexing internals and concurrency."
            }

            interview_id = save_interview(
                user_id=user_id,
                role="Backend Engineer",
                avg_score=8.5,
                summary=overall_summary["summary"],
                results=test_results,
                overall_summary=overall_summary,
                db_path=temp_db
            )

            self.assertIsInstance(interview_id, int)
            self.assertGreater(interview_id, 0)

            # Verify in database
            conn = get_db_connection(temp_db)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()

            c.execute("SELECT * FROM interviews WHERE id = ?", (interview_id,))
            saved_interview = dict(c.fetchone())
            self.assertEqual(saved_interview["role"], "Backend Engineer")
            self.assertEqual(saved_interview["avg_score"], 8.5)
            self.assertEqual(saved_interview["recommendation"], "Ready")
            self.assertEqual(saved_interview["strengths"], overall_summary["strengths"])

            c.execute("SELECT * FROM interview_details WHERE interview_id = ? ORDER BY id ASC", (interview_id,))
            saved_details = [dict(r) for r in c.fetchall()]
            conn.close()

            self.assertEqual(len(saved_details), 2)
            self.assertEqual(saved_details[0]["question"], test_results[0]["question"])
            self.assertEqual(saved_details[0]["candidate_answer"], test_results[0]["candidate_answer"])
            self.assertEqual(saved_details[0]["technical_score"], 9.0)
            self.assertEqual(saved_details[0]["ideal_answer"], test_results[0]["ideal_answer"])
            self.assertEqual(saved_details[1]["technical_score"], 8.0)

            print(f"  Saved interview #{interview_id} with {len(saved_details)} question breakdown rows [PASS]")
            print("  -> [PASS] Interview summary and question details persisted atomically.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # TEST 3: User Can Retrieve Their Own Interview Details (GET /history/<id>)
    # -------------------------------------------------------------------------
    def test_03_user_can_retrieve_own_interview_details(self):
        print("\n[TEST 3] User Retrieval of Own Interview Details:")
        from flask_jwt_extended import create_access_token

        temp_db = self._create_temp_db()
        try:
            # Seed user
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("Bob", "bob@example.com", "hash123"))
            bob_id = c.lastrowid
            conn.commit()
            conn.close()

            # Seed interview
            test_results = [
                {
                    "question": "What is REST?",
                    "candidate_answer": "Representational State Transfer architectural style.",
                    "technical_score": 8,
                    "communication_score": 8,
                    "strengths": "Accurate definition.",
                    "mistakes": "Could mention statelessness.",
                    "improved_answer": "REST is a stateless client-server architecture using standard HTTP methods.",
                    "ideal_answer": "REST is a stateless architectural style using HTTP verbs, URIs, and standard media types."
                }
            ]
            overall_summary = {"summary": "Good REST knowledge.", "recommendation": "Almost Ready"}

            interview_id = save_interview(
                user_id=bob_id,
                role="Fullstack Developer",
                avg_score=8.0,
                summary="Good REST knowledge.",
                results=test_results,
                overall_summary=overall_summary,
                db_path=temp_db
            )

            # Generate JWT for Bob
            with flask_app.app.app_context():
                bob_token = create_access_token(identity=str(bob_id))

            # Patch get_db_connection in flask_app to point to temp_db
            with patch("services.history_service.get_db_connection", side_effect=lambda db_path=None: get_db_connection(temp_db)):
                res = self.client.get(
                    f"/history/{interview_id}",
                    headers={"Authorization": f"Bearer {bob_token}"}
                )

            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertEqual(data["interview"]["id"], interview_id)
            self.assertEqual(data["interview"]["role"], "Fullstack Developer")
            self.assertEqual(data["interview"]["recommendation"], "Almost Ready")
            self.assertEqual(len(data["questions"]), 1)
            self.assertEqual(data["questions"][0]["question"], "What is REST?")
            self.assertEqual(data["questions"][0]["candidate_answer"], "Representational State Transfer architectural style.")
            self.assertEqual(data["questions"][0]["answer"], "Representational State Transfer architectural style.")
            self.assertEqual(data["questions"][0]["ideal_answer"], test_results[0]["ideal_answer"])

            print(f"  Bob successfully fetched interview #{interview_id} with full question details [PASS]")
            print("  -> [PASS] Secure interview detail retrieval verified.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # TEST 4: User Cannot Retrieve Another User's Interview Details (Authorization)
    # -------------------------------------------------------------------------
    def test_04_user_cannot_retrieve_another_users_interview(self):
        print("\n[TEST 4] Authorization & Privacy - Cross-User Access Prevention:")
        from flask_jwt_extended import create_access_token

        temp_db = self._create_temp_db()
        try:
            # Seed User A and User B
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("UserA", "usera@example.com", "hash123"))
            user_a_id = c.lastrowid
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("UserB", "userb@example.com", "hash123"))
            user_b_id = c.lastrowid
            conn.commit()
            conn.close()

            # Create private interview for User A
            interview_id = save_interview(
                user_id=user_a_id,
                role="DevOps Engineer",
                avg_score=7.0,
                summary="Private interview data for User A.",
                results=[{"question": "Secret question?", "candidate_answer": "Secret answer"}],
                overall_summary={"summary": "Private summary"},
                db_path=temp_db
            )

            # Generate JWT for User B (Attacker)
            with flask_app.app.app_context():
                user_b_token = create_access_token(identity=str(user_b_id))

            with patch("services.history_service.get_db_connection", side_effect=lambda db_path=None: get_db_connection(temp_db)):
                # Case 4A: User B tries to access User A's interview
                res = self.client.get(
                    f"/history/{interview_id}",
                    headers={"Authorization": f"Bearer {user_b_token}"}
                )

                # Must return 404 Not Found (not 200, and not leaking private info)
                self.assertEqual(res.status_code, 404)
                data = res.get_json()
                self.assertFalse(data.get("success"))
                self.assertNotIn("interview", data)
                self.assertNotIn("questions", data)
                self.assertNotIn("Secret question?", json.dumps(data))
                print("  Case 4A: Unauthorized user request returns 404 without data leak [PASS]")

                # Case 4B: Completely nonexistent interview ID
                res_nonexistent = self.client.get(
                    "/history/999999",
                    headers={"Authorization": f"Bearer {user_b_token}"}
                )
                self.assertEqual(res_nonexistent.status_code, 404)
                print("  Case 4B: Nonexistent interview ID returns 404 [PASS]")

            print("  -> [PASS] Cross-user access rejected with HTTP 404.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # TEST 5: Invalid or Missing JWT Tokens are Rejected
    # -------------------------------------------------------------------------
    def test_05_unauthenticated_requests_rejected(self):
        print("\n[TEST 5] Rejection of Missing or Invalid JWT Tokens:")
        # Case 5A: Missing Authorization header on GET /history/<id>
        res = self.client.get("/history/1")
        self.assertEqual(res.status_code, 401, f"Expected 401 for missing token, got {res.status_code}")
        print("  Case 5A: Missing token on /history/<id> returns HTTP 401 [PASS]")

        # Case 5B: Malformed / forged token on GET /history/<id>
        res = self.client.get("/history/1", headers={"Authorization": "Bearer forged.invalid.token"})
        self.assertEqual(res.status_code, 401, f"Expected 401 for invalid token, got {res.status_code}")
        print("  Case 5B: Malformed token on /history/<id> returns HTTP 401 [PASS]")

        # Case 5C: Missing token on GET /history
        res = self.client.get("/history")
        self.assertEqual(res.status_code, 401)
        print("  Case 5C: Missing token on GET /history returns HTTP 401 [PASS]")

        # Case 5D: Missing token on GET /dashboard
        res = self.client.get("/dashboard")
        self.assertEqual(res.status_code, 401)
        print("  Case 5D: Missing token on GET /dashboard returns HTTP 401 [PASS]")

        print("  -> [PASS] JWT authentication strictly enforced on all history and metrics endpoints.")

    # -------------------------------------------------------------------------
    # TEST 6: Interviews Created Before Migration Still Appear in History & Details
    # -------------------------------------------------------------------------
    def test_06_legacy_interviews_handled_gracefully(self):
        print("\n[TEST 6] Backward Compatibility with Legacy Phase 1 Interviews:")
        from flask_jwt_extended import create_access_token

        temp_db = self._create_temp_db()
        try:
            # Seed a user and an old legacy interview (no interview_details rows)
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("Charlie", "charlie@example.com", "hash123"))
            charlie_id = c.lastrowid
            c.execute(
                "INSERT INTO interviews (user_id, role, avg_score, summary) VALUES (?, ?, ?, ?)",
                (charlie_id, "Legacy Role", 6.5, "Legacy interview summary from Phase 1.")
            )
            legacy_id = c.lastrowid
            conn.commit()
            conn.close()

            with flask_app.app.app_context():
                charlie_token = create_access_token(identity=str(charlie_id))

            with patch("services.history_service.get_db_connection", side_effect=lambda db_path=None: get_db_connection(temp_db)), \
                 patch("database.get_db_connection", side_effect=lambda db_path=None: get_db_connection(temp_db)):

                # Check /history list
                res_list = self.client.get("/history", headers={"Authorization": f"Bearer {charlie_token}"})
                self.assertEqual(res_list.status_code, 200)
                history_list = res_list.get_json()
                self.assertEqual(len(history_list), 1)
                self.assertEqual(history_list[0]["role"], "Legacy Role")
                print("  Legacy interview correctly listed in GET /history [PASS]")

                # Check /history/<legacy_id>
                res_detail = self.client.get(f"/history/{legacy_id}", headers={"Authorization": f"Bearer {charlie_token}"})
                self.assertEqual(res_detail.status_code, 200)
                detail_data = res_detail.get_json()
                self.assertTrue(detail_data.get("success"))
                self.assertEqual(detail_data["interview"]["role"], "Legacy Role")
                self.assertEqual(detail_data["questions"], [], "Legacy interview must have empty questions list without crashing")
                print("  Legacy interview detail returned with empty questions array [PASS]")

            print("  -> [PASS] Pre-migration records remain accessible without error.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # TEST 7: Missing Optional Feedback Fields Handled Safely
    # -------------------------------------------------------------------------
    def test_07_missing_optional_fields_do_not_crash(self):
        print("\n[TEST 7] Handling Missing or Optional Evaluation Fields Gracefully:")
        temp_db = self._create_temp_db()
        try:
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("Diana", "diana@example.com", "hash123"))
            diana_id = c.lastrowid
            conn.commit()
            conn.close()

            # Save interview where optional fields are missing or None
            minimal_results = [
                {
                    "question": "What is an event loop?",
                    # candidate_answer omitted or None
                    "technical_score": None,
                    # strengths, mistakes, improved_answer, ideal_answer omitted
                }
            ]

            interview_id = save_interview(
                user_id=diana_id,
                role="Node.js Developer",
                avg_score=0.0,
                summary=None,
                results=minimal_results,
                overall_summary=None,
                db_path=temp_db
            )

            detail = get_interview_detail(interview_id=interview_id, user_id=diana_id, db_path=temp_db)
            self.assertIsNotNone(detail)
            self.assertEqual(len(detail["questions"]), 1)
            q = detail["questions"][0]
            self.assertEqual(q["question"], "What is an event loop?")
            self.assertEqual(q["candidate_answer"], "")
            self.assertEqual(q["technical_score"], 0.0)
            self.assertEqual(q["strengths"], "")
            self.assertEqual(q["mistakes"], "")
            self.assertEqual(q["improved_answer"], "")
            self.assertEqual(q["ideal_answer"], "")

            print("  Saved and retrieved record with omitted fields safely [PASS]")
            print("  -> [PASS] Optional evaluation fields handled robustly.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # TEST 8: Database Write Failures Handled Without False Success Reporting
    # -------------------------------------------------------------------------
    def test_08_database_write_failures_handled(self):
        print("\n[TEST 8] Transaction Rollback and Error Handling on DB Failure:")
        from flask_jwt_extended import create_access_token

        temp_db = self._create_temp_db()
        try:
            # 8A: Foreign Key violation in save_interview
            # Trying to save an interview for a non-existent user_id (99999) with foreign keys ON
            with self.assertRaises(Exception):
                save_interview(
                    user_id=99999,
                    role="Test",
                    avg_score=5.0,
                    summary="Test",
                    results=[{"question": "Q1", "candidate_answer": "A1"}],
                    db_path=temp_db
                )

            # Ensure nothing was saved
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("SELECT count(*) FROM interviews WHERE user_id = 99999")
            self.assertEqual(c.fetchone()[0], 0, "No interview should be saved on FK violation")
            c.execute("SELECT count(*) FROM interview_details")
            self.assertEqual(c.fetchone()[0], 0, "No details should be saved on FK violation")
            conn.close()
            print("  Case 8A: Transaction rolled back completely on FK error [PASS]")

            # 8B: /evaluate_answers handles database failure without reporting false success
            with flask_app.app.app_context():
                test_token = create_access_token(identity="1")

            mock_eval_results = [
                {
                    "question": "What is Python?",
                    "answer": "A high level programming language",
                    "technical_score": 8,
                    "communication_score": 8,
                    "strengths": "Clear definition",
                    "mistakes": "None",
                    "improved_answer": "Python is an interpreted, high-level, general-purpose language.",
                    "correct_answer": "Python is a dynamic, high-level programming language."
                }
            ]

            # When save_interview raises an OperationalError
            with patch("app.save_interview", side_effect=sqlite3.OperationalError("Simulated disk error")):
                with patch("app.evaluate_interview", return_value=mock_eval_results):
                    res = self.client.post(
                        "/evaluate_answers",
                        json={
                            "role": "Python Developer",
                            "questions": ["What is Python?"],
                            "answers": ["A high level programming language"]
                        },
                        headers={"Authorization": f"Bearer {test_token}"}
                    )

            self.assertEqual(res.status_code, 200)
            res_data = res.get_json()
            # Must NOT report false success for interview_id
            self.assertIsNone(res_data.get("interview_id"), "interview_id must NOT be returned when persistence fails")
            self.assertTrue(res_data.get("success"), "Evaluation results still returned to user")
            self.assertEqual(len(res_data.get("results", [])), 1)
            print("  Case 8B: Database failure handled without false success or loss of evaluation [PASS]")
            print("  -> [PASS] Database failures handled safely.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # TEST 9: Existing Dashboard and History Endpoints Function Correctly
    # -------------------------------------------------------------------------
    def test_09_existing_dashboard_and_history_work(self):
        print("\n[TEST 9] Existing Dashboard Metrics and History Endpoints Verification:")
        from flask_jwt_extended import create_access_token

        temp_db = self._create_temp_db()
        try:
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("Edward", "edward@example.com", "hash123"))
            edward_id = c.lastrowid
            conn.commit()
            conn.close()

            # Save two interviews for Edward
            save_interview(
                user_id=edward_id,
                role="Frontend Dev",
                avg_score=7.0,
                summary="First interview.",
                db_path=temp_db
            )
            save_interview(
                user_id=edward_id,
                role="React Dev",
                avg_score=9.0,
                summary="Second interview.",
                db_path=temp_db
            )

            with flask_app.app.app_context():
                edward_token = create_access_token(identity=str(edward_id))

            with patch("app.get_db_connection", side_effect=lambda: get_db_connection(temp_db)), \
                 patch("services.history_service.get_db_connection", side_effect=lambda db_path=None: get_db_connection(temp_db)):
                # Verify GET /history
                res_hist = self.client.get("/history", headers={"Authorization": f"Bearer {edward_token}"})
                self.assertEqual(res_hist.status_code, 200)
                hist_data = res_hist.get_json()
                self.assertEqual(len(hist_data), 2)
                self.assertEqual(hist_data[0]["role"], "React Dev")
                self.assertEqual(hist_data[1]["role"], "Frontend Dev")
                print("  GET /history returned user's 2 interviews newest-first [PASS]")

                # Verify GET /dashboard
                res_dash = self.client.get("/dashboard", headers={"Authorization": f"Bearer {edward_token}"})
                self.assertEqual(res_dash.status_code, 200)
                dash_data = res_dash.get_json()
                self.assertEqual(dash_data["total"], 2)
                self.assertEqual(dash_data["average"], 8.0)
                self.assertEqual(dash_data["best"], 9.0)
                print(f"  GET /dashboard returned metrics (total: 2, avg: 8.0, best: 9.0) [PASS]")

            print("  -> [PASS] Existing dashboard and history endpoints work seamlessly.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    # -------------------------------------------------------------------------
    # TEST 10: Endpoint returns saved interview_id on successful persistence
    # -------------------------------------------------------------------------
    def test_10_evaluate_answers_returns_saved_interview_id(self):
        print("\n[TEST 10] /evaluate_answers Returns Saved interview_id on Persistence Success:")
        from flask_jwt_extended import create_access_token

        temp_db = self._create_temp_db()
        try:
            conn = get_db_connection(temp_db)
            c = conn.cursor()
            c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ("Fiona", "fiona@example.com", "hash123"))
            fiona_id = c.lastrowid
            conn.commit()
            conn.close()

            with flask_app.app.app_context():
                fiona_token = create_access_token(identity=str(fiona_id))

            mock_eval_results = [
                {
                    "question": "What is Docker?",
                    "answer": "A containerization platform",
                    "technical_score": 9,
                    "communication_score": 8,
                    "strengths": "Direct and accurate",
                    "mistakes": "None",
                    "improved_answer": "Docker provides OS-level virtualization to deliver software in containers.",
                    "correct_answer": "Docker is an open platform for developing, shipping, and running applications in containers."
                }
            ]

            with patch("services.history_service.get_db_connection", side_effect=lambda db_path=None: get_db_connection(temp_db)):
                with patch("app.evaluate_interview", return_value=mock_eval_results):
                    res = self.client.post(
                        "/evaluate_answers",
                        json={
                            "role": "Cloud Engineer",
                            "questions": ["What is Docker?"],
                            "answers": ["A containerization platform"]
                        },
                        headers={"Authorization": f"Bearer {fiona_token}"}
                    )

            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertIn("interview_id", data)
            self.assertIsInstance(data["interview_id"], int)
            self.assertGreater(data["interview_id"], 0)
            print(f"  Persistence returned saved interview_id #{data['interview_id']} [PASS]")
            print("  -> [PASS] /evaluate_answers returns interview_id on persistence success.")

        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)


def run_tests():
    print("=" * 65)
    print("      PHASE 2 DETAILED HISTORY & SESSION REVIEW TEST SUITE")
    print("=" * 65)

    suite = unittest.TestLoader().loadTestsFromTestCase(Phase2HistoryTestSuite)
    runner = unittest.TextTestRunner(verbosity=1)
    result = runner.run(suite)

    print("\n" + "=" * 65)
    print(f"  TOTAL TESTS RUN: {result.testsRun}")
    print(f"  PASSED         : {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"  FAILURES       : {len(result.failures)}")
    print(f"  ERRORS         : {len(result.errors)}")
    print("=" * 65)

    return len(result.failures) == 0 and len(result.errors) == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
