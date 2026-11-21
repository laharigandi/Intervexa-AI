import os
import sys
import io
import json

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import DB_PATH, get_db_connection
from services.auth_service import verify_google_token
from services.groq_service import generate_questions, _build_fallback_questions
import app as flask_app


def run_tests():
    print("=" * 60)
    print("      PHASE 1 SECURITY & CORE STABILITY TEST SUITE")
    print("=" * 60)
    
    passed = 0
    total = 0

    # -------------------------------------------------------------
    # Test 1: Database Path Consistency
    # -------------------------------------------------------------
    total += 1
    print("\n[TEST 1] Database Path & Connection Integrity:")
    print(f"  Absolute DB Path: {DB_PATH}")
    assert os.path.isabs(DB_PATH), "DB_PATH must be an absolute path"
    assert os.path.exists(DB_PATH), f"DB file must exist at {DB_PATH}"

    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT count(*) FROM users;")
    user_count = c.fetchone()[0]
    c.execute("SELECT count(*) FROM interviews;")
    interview_count = c.fetchone()[0]
    conn.close()

    print(f"  Existing Users Preserved      : {user_count} records")
    print(f"  Existing Interviews Preserved : {interview_count} records")
    assert user_count >= 1, "Existing users must be preserved"
    print("  -> [PASS] Database is centralized and existing data intact.")
    passed += 1

    # -------------------------------------------------------------
    # Test 2: Google OAuth Security (Server-side Token Verification)
    # -------------------------------------------------------------
    total += 1
    print("\n[TEST 2] Google OAuth Server-side Token Verification:")
    client = flask_app.app.test_client()

    # Case A: Missing token
    res = client.post("/google-login", json={})
    assert res.status_code == 400, f"Expected 400 for empty body, got {res.status_code}"
    print("  Case 2A: Empty body rejected with HTTP 400 [PASS]")

    # Case B: Client attempts to send spoofed name and email without credential
    res = client.post("/google-login", json={"name": "Attacker", "email": "admin@domain.com"})
    assert res.status_code == 400, f"Expected 400 for unverified email injection, got {res.status_code}"
    print("  Case 2B: Spoofed email injection rejected with HTTP 400 [PASS]")

    # Case C: Client sends invalid/fake JWT credential
    res = client.post("/google-login", json={"credential": "fake.invalid.jwt_token"})
    assert res.status_code == 401, f"Expected 401 for invalid token, got {res.status_code}"
    print("  Case 2C: Invalid/forged Google token rejected with HTTP 401 [PASS]")
    print("  -> [PASS] Google OAuth endpoint requires valid verified credential.")
    passed += 1

    # -------------------------------------------------------------
    # Test 3: Resume Upload Security & Validation
    # -------------------------------------------------------------
    total += 1
    print("\n[TEST 3] Resume Upload Validation & Security:")

    # Case A: Non-PDF extension rejected
    res = client.post(
        "/upload_resume",
        data={"resume": (io.BytesIO(b"malicious code"), "exploit.exe")},
        content_type="multipart/form-data"
    )
    assert res.status_code == 400, f"Expected 400 for .exe file, got {res.status_code}"
    assert "PDF" in res.get_json().get("error", ""), "Error message should mention PDF requirement"
    print("  Case 3A: Non-PDF file (.exe) rejected [PASS]")

    # Case B: Disguised file (.pdf extension but invalid header)
    res = client.post(
        "/upload_resume",
        data={"resume": (io.BytesIO(b"Hello this is not a real PDF"), "fake.pdf")},
        content_type="multipart/form-data"
    )
    assert res.status_code == 400, f"Expected 400 for fake PDF, got {res.status_code}"
    print("  Case 3B: Disguised non-PDF file rejected by header validation [PASS]")

    # Case C: Empty PDF file (0 bytes)
    res = client.post(
        "/upload_resume",
        data={"resume": (io.BytesIO(b""), "empty.pdf")},
        content_type="multipart/form-data"
    )
    assert res.status_code == 400, f"Expected 400 for empty PDF, got {res.status_code}"
    print("  Case 3C: Empty (0 bytes) file rejected [PASS]")

    # Case D: Valid test resume
    valid_pdf_path = os.path.join(backend_dir, "uploads", "test_resume.pdf")
    if os.path.exists(valid_pdf_path):
        with open(valid_pdf_path, "rb") as f:
            pdf_bytes = f.read()
        res = client.post(
            "/upload_resume",
            data={"resume": (io.BytesIO(pdf_bytes), "test_resume.pdf")},
            content_type="multipart/form-data"
        )
        assert res.status_code == 200, f"Expected 200 for valid PDF, got {res.status_code}: {res.data}"
        json_data = res.get_json()
        assert json_data.get("success") is True
        assert len(json_data.get("skills", [])) > 0
        assert "analysis" in json_data
        print(f"  Case 3D: Valid PDF uploaded & parsed successfully (Skills: {len(json_data['skills'])}) [PASS]")
    else:
        print("  Case 3D: uploads/test_resume.pdf not found, skipping case 3D")

    print("  -> [PASS] Resume upload security & validation verified.")
    passed += 1

    # -------------------------------------------------------------
    # Test 4: Question Generation Structured Format
    # -------------------------------------------------------------
    total += 1
    print("\n[TEST 4] Structured Question Generation & Validation:")

    # Case A: Fallback generator sanity check
    fallbacks = _build_fallback_questions("Python Developer", ["Python", "Flask"])
    assert isinstance(fallbacks, list), "Fallback questions must be a list"
    assert len(fallbacks) == 10, f"Expected 10 questions, got {len(fallbacks)}"
    for q in fallbacks:
        assert isinstance(q, str) and len(q) > 10, "Each question must be a descriptive string"
    print("  Case 4A: Fallback question generator produces 10 validated questions [PASS]")

    # Case B: Endpoint validation
    res = client.post("/generate_questions", json={})
    assert res.status_code == 400, "Should reject empty role"
    print("  Case 4B: Role requirement enforced [PASS]")

    # Case C: Live question generation
    print("  Case 4C: Requesting structured questions via Groq API...")
    res = client.post(
        "/generate_questions",
        json={"role": "AI/ML Engineer", "skills": ["Python", "Machine Learning"], "resume_text": "Experience in ML"}
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
    data = res.get_json()
    assert data.get("success") is True
    questions = data.get("questions")
    assert isinstance(questions, list), f"Expected list of questions, got {type(questions)}"
    assert len(questions) >= 5, f"Expected at least 5 questions, got {len(questions)}"
    for i, q in enumerate(questions, 1):
        assert isinstance(q, str) and len(q) > 5, f"Question {i} must be valid string"
    print(f"  Case 4C: Successfully generated {len(questions)} structured questions [PASS]")
    print(f"    Sample Q1: \"{questions[0]}\"")
    print(f"    Sample Q2: \"{questions[1]}\"")

    print("  -> [PASS] Question generation returns structured, normalized JSON.")
    passed += 1

    print("\n" + "=" * 60)
    print(f"  ALL PHASE 1 TESTS PASSED: {passed}/{total}")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
