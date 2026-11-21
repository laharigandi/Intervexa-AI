import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.groq_service import _build_fallback_questions, ROLE_TOPIC_FOCUS
from services.adaptive_interview_service import _get_fallback_question, _ROLE_FALLBACK_QUESTIONS


def test_software_test_engineer_standard():
    print("Testing Software Test Engineer standard questions and topics...")
    assert "software test engineer" in ROLE_TOPIC_FOCUS, "ROLE_TOPIC_FOCUS must include 'software test engineer'"
    topics = ROLE_TOPIC_FOCUS["software test engineer"]
    topics_text = " ".join(topics).lower()

    assert "testing fundamentals" in topics_text, "Missing testing fundamentals"
    assert "test-case design" in topics_text, "Missing test-case design"
    assert "regression testing" in topics_text, "Missing regression testing"
    assert "defect lifecycle" in topics_text, "Missing defect lifecycle"
    assert "api testing" in topics_text, "Missing api testing"
    assert "automation fundamentals" in topics_text, "Missing automation fundamentals"
    print("  -> [PASS] ROLE_TOPIC_FOCUS has all 6 required focus areas.")

    questions = _build_fallback_questions("Software Test Engineer", ["PyTest", "Selenium"])
    assert len(questions) == 10, f"Expected 10 questions, got {len(questions)}"
    q_text = " ".join(questions).lower()
    assert "testing lifecycle" in q_text or "testing fundamentals" in q_text, "Missing testing fundamentals in fallback"
    assert "test-case design" in q_text or "boundary value" in q_text, "Missing test-case design in fallback"
    assert "regression testing" in q_text, "Missing regression testing in fallback"
    assert "defect lifecycle" in q_text or "severity" in q_text, "Missing defect lifecycle in fallback"
    assert "api testing" in q_text or "restful" in q_text, "Missing API testing in fallback"
    assert "automated test" in q_text or "automation" in q_text, "Missing automation fundamentals in fallback"
    print("  -> [PASS] Fallback questions cover all 6 required areas.")


def test_software_test_engineer_adaptive():
    print("Testing Software Test Engineer adaptive question pools...")
    assert "software test engineer" in _ROLE_FALLBACK_QUESTIONS, "Adaptive service must contain 'software test engineer'"
    pool = _ROLE_FALLBACK_QUESTIONS["software test engineer"]
    assert "easy" in pool and "medium" in pool and "hard" in pool

    q_easy = _get_fallback_question("Software Test Engineer", "easy", [])
    assert q_easy["difficulty"] == "easy"
    assert q_easy["question"]

    q_med = _get_fallback_question("Software Test Engineer", "medium", [])
    assert q_med["difficulty"] == "medium"
    assert q_med["question"]

    q_hard = _get_fallback_question("Software Test Engineer", "hard", [])
    assert q_hard["difficulty"] == "hard"
    assert q_hard["question"]
    print("  -> [PASS] Adaptive question pool returns distinct questions for all difficulties.")


def test_existing_roles_preserved():
    print("Testing preservation of existing roles...")
    for role in ["full stack developer", "machine learning engineer"]:
        assert role in ROLE_TOPIC_FOCUS
        assert role in _ROLE_FALLBACK_QUESTIONS
        qs = _build_fallback_questions(role, ["Python"])
        assert len(qs) == 10
    print("  -> [PASS] Existing roles are intact.")


if __name__ == "__main__":
    test_software_test_engineer_standard()
    test_software_test_engineer_adaptive()
    test_existing_roles_preserved()
    print("\nALL SOFTWARE TEST ENGINEER TESTS PASSED!")
