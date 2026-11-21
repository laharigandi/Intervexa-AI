import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import init_db, get_db_connection
from services.interviewer_personality_service import get_available_personalities, get_personality_config
from services.answer_verification_service import (
    verify_interview_answer,
    verify_interview_session,
    extract_technical_claims,
    retrieve_trusted_evidence,
    TRUSTED_SOURCE_REGISTRY,
)
from services.communication_service import (
    analyze_speaking_coach_metrics,
    aggregate_session_speaking_metrics,
    evaluate_speaking_pace,
)
from services.history_service import save_interview, get_interview_detail

print("[TEST 1] Testing Database Init...")
init_db()
print("Database initialized successfully.")

print("\n[TEST 2] Testing Interviewer Personalities...")
personalities = get_available_personalities()
print(f"Total personalities defined: {len(personalities)}")
for p in personalities:
    print(f" - {p['id']}: {p['name']} ({p.get('badge', p.get('tagline'))})")
assert len(personalities) >= 6, "Expected 6 personalities (5 modes + panel)"

print("\n[TEST 3] Testing Speaking Coach Metrics...")
sample_transcript = "Well, um, basically in Python lists are mutable, but tuples are, you know, immutable. Actually, tuples cannot be changed."
spk_res = analyze_speaking_coach_metrics(
    transcript=sample_transcript,
    duration_seconds=12.0,
    pause_count=2,
    pause_duration=4.5,
)
print("Speaking coach result:")
print(f" - WPM: {spk_res['wpm']} ({spk_res['pace_category']})")
print(f" - Filler count: {spk_res['filler_count']} ({spk_res['filler_words']['counts']})")
print(f" - Long pauses: {spk_res['long_pauses']['count']}")
print(f" - Clarity score: {spk_res['clarity_score']}")
assert spk_res["filler_count"] >= 3, "Expected filler words detected"
assert spk_res["pace_category"] in ["Slow", "Moderate", "Fast", "Very Fast"]

print("\n[TEST 4] Testing Answer Verification & Hallucination Detection...")
# Test a statement with known correct facts
v1 = verify_interview_answer(
    question="What is the difference between Python list and tuple?",
    candidate_answer="In Python, a list is mutable and can be modified in place, whereas a tuple is immutable and cannot be altered after creation.",
    expected_answer="Lists are mutable sequences while tuples are immutable sequences in Python.",
)
print("V1 Correct Answer Status:", v1["verification_status"], "Score:", v1["correctness_score"])
assert "Correct" in v1["verification_status"], f"Expected Correct status, got {v1['verification_status']}"
assert len(v1.get("evidence", [])) > 0, "Expected evidence from Python documentation"

# Test a hallucinated / incorrect statement
v2 = verify_interview_answer(
    question="Can you modify a Python tuple after creation?",
    candidate_answer="Yes, Python tuples are mutable and you can append items directly to a tuple using tuple.append() or tuple.push().",
    expected_answer="No, tuples are strictly immutable in Python and do not possess append or push methods.",
)
print("V2 Incorrect Answer Status:", v2["verification_status"], "Score:", v2["correctness_score"])
print("V2 Flagged Incorrect Statements:", v2.get("incorrect_statements"))
assert v2["correctness_score"] < 80, "Expected lower score for hallucination"
assert len(v2.get("incorrect_statements", [])) > 0

print("\n[TEST 5] Testing Session History with new fields...")
test_results = [
    {
        "question": "Explain Python list vs tuple.",
        "answer": "Lists are mutable, tuples are immutable.",
        "technical_score": 9.0,
        "communication_score": 8.0,
        "strengths": "Accurate distinction.",
        "mistakes": "None",
        "improved_answer": "Lists are mutable sequences...",
        "correct_answer": "Lists are mutable, tuples immutable.",
        "verification_result": v1,
        "speaking_metrics": spk_res,
        "communication_feedback": {"overall_score": 85, "pace_display": "110 WPM (Moderate)"},
    }
]
test_summary = {
    "summary": "Solid technical performance with clear distinctions.",
    "recommendation": "Ready for technical interviews.",
    "strengths": "Strong core fundamentals.",
    "weaknesses": "None noted.",
    "advice": "Keep practicing system design.",
    "interviewer_personality": "senior_engineer",
    "speaking_metrics": spk_res,
    "verification_summary": {
        "average_correctness_score": 95.0,
        "total_verified": 1,
        "total_hallucinations_detected": 0,
        "summary_text": "All technical claims were verified against official Python documentation.",
    },
}

test_id = save_interview(
    user_id=1,
    role="Python Developer",
    avg_score=9.0,
    summary=test_summary["summary"],
    results=test_results,
    overall_summary=test_summary,
    interview_mode="standard",
    interviewer_personality="senior_engineer",
    speaking_metrics=spk_res,
    verification_summary=test_summary["verification_summary"],
    answer_verifications=[v1],
)
print(f"Saved test interview #{test_id}")

detail = get_interview_detail(test_id, user_id=1)
assert detail is not None, "Interview detail could not be retrieved"
print(f"Retrieved interview #{test_id}:")
print(f" - Personality: {detail.get('interviewer_personality')}")
print(f" - Verification Summary: {bool(detail.get('verification_summary'))}")
print(f" - Answer Verifications count: {len(detail.get('answer_verifications', []))}")
print(f" - Speaking Metrics: {bool(detail.get('speaking_metrics'))}")

assert detail.get("interviewer_personality") == "senior_engineer"
assert len(detail.get("answer_verifications", [])) >= 1
print("\n>>> ALL ADVANCED AI BACKEND TESTS PASSED SUCCESSFULLY! <<<")
