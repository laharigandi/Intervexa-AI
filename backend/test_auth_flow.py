import os
import sys
import json
import sqlite3

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app, get_db_connection

def test_full_auth_flow():
    app.config["TESTING"] = True
    client = app.test_client()

    print("\n--- [Test 1] Unauthenticated /dashboard access ---")
    res = client.get("/dashboard")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("PASS: Unauthenticated access to /dashboard is blocked with 401.")

    print("\n--- [Test 2] Unauthenticated /auth/verify access ---")
    res = client.get("/auth/verify")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("PASS: Unauthenticated access to /auth/verify is blocked with 401.")

    print("\n--- [Test 3] Invalid token verification ---")
    res = client.get("/auth/verify", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("PASS: Invalid token rejected with 401.")

    print("\n--- [Test 4] User Registration (/signup) ---")
    test_email = f"auth_test_{os.urandom(4).hex()}@example.com"
    test_password = "SecurePassword123!"
    test_name = "Auth Test User"

    res = client.post("/signup", json={
        "name": test_name,
        "email": test_email,
        "password": test_password
    })
    assert res.status_code in (200, 201), f"Signup failed: {res.get_json()}"
    signup_data = res.get_json()
    assert "token" in signup_data, "Token missing in signup response"
    assert "user" in signup_data, "User object missing in signup response"
    assert signup_data["user"]["email"] == test_email
    token = signup_data["token"]
    print(f"PASS: User successfully registered, received JWT token and user info (id: {signup_data['user'].get('id')}).")

    print("\n--- [Test 5] Verify token of newly registered user via /auth/verify ---")
    res = client.get("/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, f"Token verify failed: {res.get_json()}"
    verify_data = res.get_json()
    assert verify_data.get("success") is True
    assert verify_data["user"]["email"] == test_email
    print("PASS: /auth/verify confirms valid session and returns authenticated user.")

    print("\n--- [Test 6] Access /dashboard with valid token ---")
    res = client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, f"Dashboard access failed: {res.get_json()}"
    dash_data = res.get_json()
    assert "total" in dash_data
    print("PASS: Authenticated user can access /dashboard.")

    print("\n--- [Test 7] Login with wrong credentials ---")
    res = client.post("/login", json={
        "email": test_email,
        "password": "WrongPassword999!"
    })
    assert res.status_code in (400, 401), f"Expected failure for wrong password, got {res.status_code}"
    print("PASS: Login with incorrect password correctly rejected.")

    print("\n--- [Test 8] Login with correct credentials ---")
    res = client.post("/login", json={
        "email": test_email,
        "password": test_password
    })
    assert res.status_code == 200, f"Login failed: {res.get_json()}"
    login_data = res.get_json()
    assert "token" in login_data
    assert login_data["user"]["email"] == test_email
    new_token = login_data["token"]
    print("PASS: Login with valid credentials successfully returns fresh JWT and user object.")

    print("\n--- [Test 9] Token for deleted/nonexistent user ---")
    # Generate token for nonexistent user_id 9999999
    from flask_jwt_extended import create_access_token
    with app.app_context():
        ghost_token = create_access_token(identity="9999999")
    res = client.get("/auth/verify", headers={"Authorization": f"Bearer {ghost_token}"})
    assert res.status_code == 401, f"Expected 401 for ghost user, got {res.status_code}"
    res2 = client.get("/dashboard", headers={"Authorization": f"Bearer {ghost_token}"})
    assert res2.status_code == 401, f"Expected 401 on /dashboard for ghost user, got {res2.status_code}"
    print("PASS: Stale or deleted user tokens are rejected with 401 on both /auth/verify and /dashboard.")

    print("\n==========================================")
    print("ALL 9 AUTHENTICATION FLOW TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test_full_auth_flow()
