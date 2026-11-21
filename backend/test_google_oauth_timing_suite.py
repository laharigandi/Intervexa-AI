"""
Comprehensive 14-Scenario Security and Regression Test Suite for Google OAuth Timing & Authentication
"""
import os
import sys
import time
import unittest
from unittest.mock import patch, MagicMock

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from google.auth.jwt import _verify_iat_and_exp
from google.auth.exceptions import InvalidValue
import app as flask_app
from services.auth_service import (
    verify_google_token,
    google_login_or_register,
    register_user,
    login_user,
    get_db_connection
)


class TestGoogleOAuthTimingAndSecuritySuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client_id = os.getenv("GOOGLE_CLIENT_ID", "278233411201-arvmbcd2r1p6kbg67d63fb56pk89dc84.apps.googleusercontent.com")
        cls.test_client = flask_app.app.test_client()

    # 1. Valid Google token simulation
    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_01_valid_google_token_simulation(self, mock_verify):
        mock_verify.return_value = {
            "iss": "https://accounts.google.com",
            "aud": self.client_id,
            "email_verified": True,
            "email": "valid_user_01@example.com",
            "name": "Valid User",
            "sub": "sub_valid_01"
        }
        success, user = verify_google_token("valid_mock_jwt_token")
        self.assertTrue(success)
        self.assertEqual(user["email"], "valid_user_01@example.com")
        self.assertEqual(user["name"], "Valid User")

    # 2. Expired Google token (must be rejected)
    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_02_expired_google_token_rejected(self, mock_verify):
        mock_verify.side_effect = ValueError("Token expired, 1700000000 < 1700000010")
        success, err = verify_google_token("expired_jwt_token")
        self.assertFalse(success)
        self.assertIn("expired", err.lower())

    # 3. Invalid signature (must be rejected)
    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_03_invalid_signature_rejected(self, mock_verify):
        mock_verify.side_effect = ValueError("Invalid token signature")
        success, err = verify_google_token("forged_jwt_token")
        self.assertFalse(success)
        self.assertIn("Invalid or expired Google credential", err)

    # 4. Incorrect audience (aud != GOOGLE_CLIENT_ID, must be rejected)
    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_04_incorrect_audience_rejected(self, mock_verify):
        mock_verify.return_value = {
            "iss": "https://accounts.google.com",
            "aud": "attacker-client-id.apps.googleusercontent.com",
            "email_verified": True,
            "email": "hacker@example.com",
            "name": "Attacker"
        }
        success, err = verify_google_token("wrong_aud_jwt")
        self.assertFalse(success)
        self.assertIn("audience", err.lower())

    # 5. Incorrect issuer (iss != accounts.google.com, must be rejected)
    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_05_incorrect_issuer_rejected(self, mock_verify):
        mock_verify.return_value = {
            "iss": "https://malicious-issuer.com",
            "aud": self.client_id,
            "email_verified": True,
            "email": "evil@example.com",
            "name": "Evil"
        }
        success, err = verify_google_token("wrong_iss_jwt")
        self.assertFalse(success)
        self.assertIn("Invalid token issuer", err)

    # 6. Missing or empty token
    def test_06_missing_or_empty_token(self):
        success, err = verify_google_token("")
        self.assertFalse(success)
        self.assertIn("missing or empty", err)

        success2, err2 = verify_google_token(None)
        self.assertFalse(success2)
        self.assertIn("missing or empty", err2)

        success3, err3 = verify_google_token("   ")
        self.assertFalse(success3)
        self.assertIn("missing or empty", err3)

    # 7. Malformed JWT token
    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_07_malformed_jwt_token(self, mock_verify):
        mock_verify.side_effect = ValueError("Wrong number of segments in token: invalid.jwt")
        success, err = verify_google_token("invalid.jwt")
        self.assertFalse(success)
        self.assertIn("Invalid or expired Google credential", err)

    # 8. Token with slight future iat (within 60s clock skew tolerance, must PASS)
    def test_08_token_with_slight_future_iat_passes(self):
        now = int(time.time())
        # iat 5 seconds into the future
        payload_5s = {"iat": now + 5, "exp": now + 3600}
        # With default 60s clock skew tolerance, must validate cleanly
        try:
            _verify_iat_and_exp(payload_5s, clock_skew_in_seconds=60)
        except Exception as e:
            self.fail(f"Token with 5s future iat should pass with 60s skew: {e}")

        # iat 45 seconds into future
        payload_45s = {"iat": now + 45, "exp": now + 3600}
        try:
            _verify_iat_and_exp(payload_45s, clock_skew_in_seconds=60)
        except Exception as e:
            self.fail(f"Token with 45s future iat should pass with 60s skew: {e}")

    # 9. Token with far future iat (> 300s, must be REJECTED)
    def test_09_token_with_far_future_iat_rejected(self):
        now = int(time.time())
        # iat 350 seconds into the future (> 300s max clock skew)
        payload_far_future = {"iat": now + 350, "exp": now + 3600}
        with self.assertRaises(InvalidValue) as ctx:
            _verify_iat_and_exp(payload_far_future, clock_skew_in_seconds=60)
        self.assertIn("Token used too early", str(ctx.exception))

    # 10. Google user registration (new user inserted into users table)
    def test_10_google_user_registration(self):
        unique_email = f"google_new_{int(time.time())}@example.com"
        user = google_login_or_register("New Google User", unique_email)
        self.assertIsNotNone(user)
        self.assertEqual(user["email"], unique_email)
        self.assertEqual(user["name"], "New Google User")
        self.assertTrue(isinstance(user["id"], int))

    # 11. Existing Google user login (existing user fetched without duplicate rows)
    def test_11_existing_google_user_login(self):
        unique_email = f"google_repeat_{int(time.time())}@example.com"
        user1 = google_login_or_register("Repeat User", unique_email)
        user2 = google_login_or_register("Repeat User", unique_email)
        self.assertEqual(user1["id"], user2["id"])
        self.assertEqual(user1["email"], user2["email"])

        # Confirm only 1 entry in SQLite
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE email = ?", (unique_email,))
        count = cursor.fetchone()[0]
        conn.close()
        self.assertEqual(count, 1)

    # 12. Database connection failure handling
    @patch("services.auth_service.get_db_connection")
    def test_12_database_connection_failure_handling(self, mock_db):
        mock_db.side_effect = Exception("SQLite disk I/O failure")
        with self.assertRaises(Exception):
            google_login_or_register("Crash User", "crash@example.com")

    # 13. Standard email/password login
    def test_13_standard_email_password_login(self):
        email = f"standard_{int(time.time())}@example.com"
        password = "SecurePassword123!"
        reg_ok, _ = register_user("Standard User", email, password)
        self.assertTrue(reg_ok)

        user = login_user(email, password)
        self.assertIsNotNone(user)
        self.assertEqual(user["email"], email)

        wrong_user = login_user(email, "WrongPass")
        self.assertIsNone(wrong_user)

    # 14. Standard email/password registration duplicate rejection
    def test_14_standard_registration_duplicate_rejection(self):
        email = f"dupe_{int(time.time())}@example.com"
        password = "SecurePassword123!"
        ok1, msg1 = register_user("Dupe User", email, password)
        self.assertTrue(ok1)

        ok2, msg2 = register_user("Dupe User", email, password)
        self.assertFalse(ok2)
        self.assertIn("already exists", msg2.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
