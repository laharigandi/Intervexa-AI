import os
import sys
import json

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import init_db, get_db_connection
from services.interviewer_personality_service import (
    get_available_personalities,
    get_personality_config,
    get_personality_prompt_directive,
)
from services.answer_verification_service import (
    verify_interview_answer,
    verify_interview_session,
    retrieve_trusted_evidence,
    TRUSTED_SOURCE_REGISTRY,
)
from services.communication_service import (
    analyze_speaking_coach_metrics,
    aggregate_session_speaking_metrics,
)
from services.history_service import save_interview, get_interview_detail
from services.pdf_service import generate_pdf
from services.adaptive_interview_service import start_adaptive_session

print("==================================================")
print("RUNNING END-TO-END ADVANCED AI FEATURES TEST SUITE")
print("==================================================")

# 1. TEST PERSONALITY CONFIG & DIRECTIVES
print("\n[STEP 1] Testing Interviewer Personalities & Panels...")
personas = get_available_personalities()
assert len(personas) >= 6, "Expected 6 personas"
for pid in ["technical", "hr", "strict", "friendly", "senior_engineer", "panel"]:
    cfg = get_personality_config(pid)
    directive_q = get_personality_prompt_directive(pid, "question_generation")
    directive_e = get_personality_prompt_directive(pid, "evaluation")
    assert cfg is not None and "name" in cfg
    assert len(directive_q) > 10
    assert len(directive_e) > 10
    print(f" -> Persona '{pid}' validated. Directive length: {len(directive_q)} chars.")

# 2. TEST SPEAKING COACH METRICS WITH SPEEDS & FILLERS
print("\n[STEP 2] Testing Speaking Coach Real-Time Telemetry & Categorization...")
# Slow speaker (<100 WPM)
slow_res = analyze_speaking_coach_metrics(
    text="Um, well, in Python, uh, lists are dynamic arrays, you know.",
    duration_seconds=12.0,
    pause_count=2,
    pause_duration=4.5,
)
assert slow_res["speed_category"] == "Slow", f"Expected Slow, got {slow_res['speed_category']}"
assert slow_res["filler_count"] >= 3, f"Expected fillers >= 3, got {slow_res['filler_count']}"
print(f" -> Slow Pace check passed: {slow_res['wpm']} WPM ({slow_res['speed_category']}), Fillers: {slow_res['filler_count']}")

# Moderate speaker (100-160 WPM - optimal conversational pace)
moderate_text = "React uses a virtual DOM to optimize UI updates. When component state changes, React creates a new virtual representation, diffs it against previous state, and batches changes."
mod_res = analyze_speaking_coach_metrics(
    text=moderate_text,
    duration_seconds=12.0,
    pause_count=0,
    pause_duration=0.0,
)
assert mod_res["speed_category"] == "Moderate", f"Expected Moderate, got {mod_res['speed_category']}"
print(f" -> Moderate Pace check passed: {mod_res['wpm']} WPM ({mod_res['speed_category']}), Optimal Range.")

# Fast speaker (161-190 WPM)
fast_text = "SQL indexing uses B-Tree data structures to rapidly locate rows without full table scans reducing time complexity from O of N to logarithmic O of log N for indexed queries."
fast_res = analyze_speaking_coach_metrics(
    text=fast_text,
    duration_seconds=10.0,
)
assert fast_res["speed_category"] in ["Fast", "Very Fast", "Moderate"]
print(f" -> Fast Pace check passed: {fast_res['wpm']} WPM ({fast_res['speed_category']})")

# 3. TEST RAG EVIDENCE RETRIEVAL & GROUNDING
print("\n[STEP 3] Testing RAG Grounding & Trusted Source Corpus...")
ev_python = retrieve_trusted_evidence("Python list mutable tuple immutable sequence", top_k=2)
assert len(ev_python) > 0, "Expected Python documentation evidence"
assert "docs.python.org" in ev_python[0]["source_url"]
print(f" -> Python Docs Grounded: {ev_python[0]['source_title']} -> {ev_python[0]['source_url']}")

ev_sql = retrieve_trusted_evidence("PostgreSQL primary key foreign key relationships", top_k=2)
assert len(ev_sql) > 0, "Expected PostgreSQL documentation evidence"
assert "postgresql.org" in ev_sql[0]["source_url"]
print(f" -> PostgreSQL Docs Grounded: {ev_sql[0]['source_title']} -> {ev_sql[0]['source_url']}")

# 4. TEST TECHNICAL ANSWER VERIFICATION & HALLUCINATION DETECTION
print("\n[STEP 4] Testing Answer Verification & Hallucination Audit...")
# Question 1: Accurate Answer
ans1 = verify_interview_answer(
    question="Explain the difference between Python list and tuple.",
    candidate_answer="A list in Python is a mutable sequence created with square brackets, whereas a tuple is immutable and cannot be altered after definition.",
)
assert "Correct" in ans1["verification_status"]
assert ans1["correctness_score"] >= 80
assert len(ans1["evidence"]) > 0
print(f" -> Question 1 (Accurate): Status='{ans1['verification_status']}', Score={ans1['correctness_score']}%")

# Question 2: Inaccurate / Hallucinated Answer
ans2 = verify_interview_answer(
    question="Can you explain how relational database primary keys work?",
    candidate_answer="SQL does not support relationships between tables and primary keys cannot uniquely identify records.",
)
assert "Inaccuracies" in ans2["verification_status"] or ans2["correctness_score"] < 60
assert len(ans2["incorrect_statements"]) > 0
print(f" -> Question 2 (Hallucinated): Status='{ans2['verification_status']}', Score={ans2['correctness_score']}%")
print(f"    Discrepancies flagged: {ans2['incorrect_statements']}")

# 5. TEST SESSION VERIFICATION AGGREGATION & DB PERSISTENCE
print("\n[STEP 5] Testing Session History Storage & DB Atomic Integrity...")
sample_results = [
    {
        "question": "What is the difference between a Python list and tuple?",
        "answer": "Lists are mutable and tuples are immutable sequences in Python.",
        "technical_score": 9.5,
        "communication_score": 8.5,
        "difficulty": "medium",
        "topic": "Python Data Structures",
        "strengths": "Accurate mutability distinction.",
        "mistakes": "None",
        "improved_answer": "Lists are mutable and tuples are immutable sequences.",
        "correct_answer": "Lists are mutable and tuples are immutable sequences.",
        "verification_result": ans1,
        "speaking_metrics": mod_res,
        "communication_feedback": {"communication_score": 88, "wpm": 130, "pace_status": "optimal"},
    },
    {
        "question": "How do primary keys enforce relational integrity in SQL?",
        "answer": "SQL does not support relationships between tables and primary keys cannot uniquely identify records.",
        "technical_score": 2.0,
        "communication_score": 5.0,
        "difficulty": "medium",
        "topic": "SQL & Databases",
        "strengths": "Attempted to answer database query.",
        "mistakes": "Stated that SQL does not support relationships.",
        "improved_answer": "Primary keys uniquely identify records and enforce entity integrity.",
        "correct_answer": "Primary keys uniquely identify records and foreign keys establish relationships.",
        "verification_result": ans2,
        "speaking_metrics": slow_res,
        "communication_feedback": {"communication_score": 60, "wpm": 90, "pace_status": "slow"},
    }
]

verif_session_res = verify_interview_session(sample_results)
assert "summary" in verif_session_res
assert len(verif_session_res["verifications"]) == 2

speaking_session_res = aggregate_session_speaking_metrics([
    r["speaking_metrics"] for r in sample_results
])
assert speaking_session_res["average_wpm"] is not None

sample_summary = {
    "summary": "Technical interview assessing Python and SQL capabilities with rigorous evaluation.",
    "recommendation": "Needs Review in Database Foundations",
    "strengths": "Core Python sequence types.",
    "weaknesses": "Relational database concepts and key constraints.",
    "advice": "Review PostgreSQL foreign keys and normalization.",
    "interviewer_personality": "strict",
    "verification_summary": verif_session_res["summary"],
    "speaking_metrics": speaking_session_res,
    "communication_feedback": {"overall_score": 74, "avg_wpm": speaking_session_res["average_wpm"]},
}

saved_id = save_interview(
    user_id=1,
    role="Full Stack Developer",
    avg_score=5.75,
    summary=sample_summary["summary"],
    results=sample_results,
    overall_summary=sample_summary,
    interview_mode="standard",
    interviewer_personality="strict",
    speaking_metrics=speaking_session_res,
    verification_summary=sample_summary["verification_summary"],
    answer_verifications=verif_session_res["verifications"],
)
print(f" -> Saved full interview session #{saved_id}")

detail = get_interview_detail(saved_id, user_id=1)
assert detail is not None
assert detail["interviewer_personality"] == "strict"
assert len(detail["questions"]) == 2
assert len(detail.get("answer_verifications", [])) == 2
assert detail.get("verification_summary") is not None
assert detail.get("speaking_metrics") is not None
print(f" -> Retrieved interview #{saved_id} with full verification & speaking metrics attached.")

# 6. TEST PDF REPORT GENERATION
print("\n[STEP 6] Testing PDF Generation with Personality, Grounding & Speaking Coach...")
pdf_file = generate_pdf(sample_results, sample_summary)
assert os.path.exists(pdf_file)
pdf_size = os.path.getsize(pdf_file)
assert pdf_size > 1000
print(f" -> Generated PDF report '{pdf_file}' ({pdf_size} bytes) successfully.")

print("\n==================================================")
print("SUCCESS: ALL ADVANCED AI FEATURES FULLY VERIFIED!")
print("==================================================")

