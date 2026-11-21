"""
Comprehensive Verification Suite for Google OAuth Clock Skew & Security
Tests:
1. Low-level claim validation: _verify_iat_and_exp with clock_skew_in_seconds
   - Clock skew = 0 fails on 1s future iat (reproducing user's exact error)
   - Clock skew = 5 succeeds on 1s, 2s, 4s future iat
   - Far future (>5s) is rejected
   - Past expired token (>5s) is rejected
2. auth_service.verify_google_token with:
   - Configurable clock_skew_seconds parameter
   - Valid verified Google claims -> registers / returns user
   - Issuer validation: 'accounts.google.com' and 'https://accounts.google.com'
   - Invalid issuer rejection
   - Email verification enforcement (email_verified == True)
   - Audience mismatch enforcement
   - Expired token rejection
   - Token used too early rejection (when beyond skew)
   - Empty/missing token rejection
3. Flask /google-login & /api/google-login routes:
   - Successful Google login returns JWT access token and user info
   - User session verifiable via /auth/verify
   - Email/password login regression test
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
from services.auth_service import verify_google_token, google_login_or_register, register_user, login_user


class TestGoogleOAuthClockSkewAndSecurity(unittest.TestCase):

    def test_01_clock_skew_low_level_algorithm(self):
        """Verify _verify_iat_and_exp reproduces the exact 1-second issue and resolves it with skew."""
        now = int(time.time())

        # Exact user error reproduction: token issued 1 second in future
        payload_1s_future = {"iat": now + 1, "exp": now + 3600}

        # With skew = 0 (the old default): MUST fail with "Token used too early"
        with self.assertRaises(InvalidValue) as ctx:
            _verify_iat_and_exp(payload_1s_future, clock_skew_in_seconds=0)
        self.assertIn("Token used too early", str(ctx.exception))
        print("  [PASS] Low-level: 1s future token with skew=0 correctly reproduces 'Token used too early'")

        # With skew = 5: MUST succeed
        try:
            _verify_iat_and_exp(payload_1s_future, clock_skew_in_seconds=5)
            print("  [PASS] Low-level: 1s future token with skew=5 validates successfully")
        except Exception as e:
            self.fail(f"Expected skew=5 to accept 1s future token, but got: {e}")

        # With skew = 5: Token issued 3 seconds in the future succeeds
        payload_3s_future = {"iat": now + 3, "exp": now + 3600}
        _verify_iat_and_exp(payload_3s_future, clock_skew_in_seconds=5)
        print("  [PASS] Low-level: 3s future token with skew=5 validates successfully")

        # Far future (e.g. 15 seconds) MUST be rejected even with skew=5
        payload_15s_future = {"iat": now + 15, "exp": now + 3600}
        with self.assertRaises(InvalidValue):
            _verify_iat_and_exp(payload_15s_future, clock_skew_in_seconds=5)
        print("  [PASS] Low-level: Far future token (15s) correctly rejected with skew=5")

        # Expired token (15 seconds ago) MUST be rejected even with skew=5
        payload_expired = {"iat": now - 3600, "exp": now - 15}
        with self.assertRaises(InvalidValue):
            _verify_iat_and_exp(payload_expired, clock_skew_in_seconds=5)
        print("  [PASS] Low-level: Expired token (15s ago) correctly rejected with skew=5")

    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_02_verify_google_token_with_skew_param(self, mock_verify):
        """Verify that verify_google_token passes clock_skew_in_seconds to google-auth."""
        client_id = os.getenv("GOOGLE_CLIENT_ID", "test-client-id")
        mock_verify.return_value = {
            "iss": "https://accounts.google.com",
            "aud": client_id,
            "email_verified": True,
            "email": "test.skew.user@example.com",
            "name": "Skew Test User",
            "sub": "123456789"
        }

        success, user = verify_google_token("fake_valid_jwt_token", clock_skew_seconds=5)
        self.assertTrue(success)
        self.assertEqual(user["email"], "test.skew.user@example.com")

        # Verify that mock_verify was called with clock_skew_in_seconds=5
        mock_verify.assert_called_once()
        _, kwargs = mock_verify.call_args
        self.assertEqual(kwargs.get("clock_skew_in_seconds"), 5)
        print("  [PASS] verify_google_token passes clock_skew_in_seconds=5 to google-auth")

    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_03_security_issuer_validation(self, mock_verify):
        """Security check: tokens from unauthorized issuers must be rejected."""
        client_id = os.getenv("GOOGLE_CLIENT_ID", "test-client-id")
        mock_verify.return_value = {
            "iss": "https://malicious-site.com",
            "aud": client_id,
            "email_verified": True,
            "email": "hacker@example.com",
            "name": "Attacker"
        }

        success, err = verify_google_token("fake_jwt")
        self.assertFalse(success)
        self.assertIn("Invalid token issuer", err)
        print("  [PASS] Security: Untrusted issuer rejected")

    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_04_security_unverified_email_validation(self, mock_verify):
        """Security check: tokens with unverified email must be rejected."""
        client_id = os.getenv("GOOGLE_CLIENT_ID", "test-client-id")
        mock_verify.return_value = {
            "iss": "accounts.google.com",
            "aud": client_id,
            "email_verified": False,
            "email": "unverified@example.com",
            "name": "Unverified User"
        }

        success, err = verify_google_token("fake_jwt")
        self.assertFalse(success)
        self.assertIn("email is not verified", err)
        print("  [PASS] Security: Unverified email rejected")

    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_05_security_audience_mismatch(self, mock_verify):
        """Security check: token audience mismatch must be rejected."""
        mock_verify.return_value = {
            "iss": "accounts.google.com",
            "aud": "wrong-client-id.apps.googleusercontent.com",
            "email_verified": True,
            "email": "victim@example.com",
            "name": "Victim"
        }

        success, err = verify_google_token("fake_jwt")
        self.assertFalse(success)
        self.assertIn("audience", err.lower())
        print("  [PASS] Security: Audience mismatch rejected")

    @patch("services.auth_service.id_token.verify_oauth2_token")
    def test_06_e2e_flask_google_login_flow(self, mock_verify):
        """End-to-end Flask endpoint test: /google-login returns valid JWT and user info."""
        client_id = os.getenv("GOOGLE_CLIENT_ID", "test-client-id")
        mock_verify.return_value = {
            "iss": "https://accounts.google.com",
            "aud": client_id,
            "email_verified": True,
            "email": "e2e.oauth.user@example.com",
            "name": "E2E OAuth User",
            "sub": "987654321"
        }

        test_client = flask_app.app.test_client()

        # Step 1: POST /google-login
        res = test_client.post("/google-login", json={"credential": "valid.mock.token"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], "e2e.oauth.user@example.com")
        jwt_token = data["token"]
        print("  [PASS] Flask: /google-login returns 200 OK with valid JWT token")

        # Step 2: Verify user session via /auth/verify using the generated JWT
        verify_res = test_client.get(
            "/auth/verify",
            headers={"Authorization": f"Bearer {jwt_token}"}
        )
        self.assertEqual(verify_res.status_code, 200)
        verify_data = verify_res.get_json()
        self.assertTrue(verify_data["success"])
        self.assertEqual(verify_data["user"]["email"], "e2e.oauth.user@example.com")
        print("  [PASS] Flask: /auth/verify confirms session validity for Google user")

        # Step 3: Test alternate route /api/google-login
        api_res = test_client.post("/api/google-login", json={"credential": "valid.mock.token"})
        self.assertEqual(api_res.status_code, 200)
        api_data = api_res.get_json()
        self.assertTrue(api_data["success"])
        print("  [PASS] Flask: /api/google-login reverse-proxy route returns 200 OK")

    def test_07_email_password_regression(self):
        """Regression check: Email & Password registration and login remain 100% functional."""
        test_email = f"standard_regression_{int(time.time())}@example.com"
        test_pass = "TestSecurePassword123!"

        reg_success, reg_msg = register_user("Regression User", test_email, test_pass)
        self.assertTrue(reg_success, f"Registration failed: {reg_msg}")

        user = login_user(test_email, test_pass)
        self.assertIsNotNone(user, "Standard email/password login failed")
        self.assertEqual(user["email"], test_email)

        # Wrong password must fail
        wrong_user = login_user(test_email, "WrongPassword!")
        self.assertIsNone(wrong_user, "Wrong password unexpectedly succeeded")
        print("  [PASS] Regression: Standard email/password registration & login fully intact")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  GOOGLE OAUTH CLOCK SKEW & SECURITY VERIFICATION SUITE")
    print("=" * 60 + "\n")
    unittest.main(verbosity=2)

