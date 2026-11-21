"""
Verification script for the 3 new target roles in Intervexa AI backend:
- Frontend Developer
- Backend Developer
- Java Developer
"""

import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.groq_service import _build_fallback_questions, ROLE_TOPIC_FOCUS
from services.adaptive_interview_service import _get_fallback_question, _ROLE_FALLBACK_QUESTIONS
from services.study_planner_service import _get_curriculum_for_role, ROLE_DEFAULT_TOPICS

passed = 0
failed = 0

def check(condition, desc):
    global passed, failed
    if condition:
        print(f"  ✓ PASS: {desc}")
        passed += 1
    else:
        print(f"  ✗ FAIL: {desc}")
        failed += 1

print("\n=======================================================")
print("INTERVEXA AI - 3 NEW TARGET ROLES BACKEND VERIFICATION")
print("=======================================================\n")

# 1. Standard Interview Question Fallbacks
print("--- 1. Standard Interview Question Generation (10 Questions Each) ---")
for role_name, expected_keyword in [
    ("Frontend Developer", "frontend"),
    ("Backend Developer", "backend"),
    ("Java Developer", "java"),
]:
    questions = _build_fallback_questions(role_name, ["HTML", "React", "Python", "Java"])
    check(isinstance(questions, list), f"{role_name} returns a list of questions")
    check(len(questions) == 10, f"{role_name} returns exactly 10 questions (got {len(questions)})")
    check(all(isinstance(q, str) and len(q) > 20 for q in questions), f"{role_name} all 10 questions are detailed non-empty strings")

# 2. ROLE_TOPIC_FOCUS in groq_service
print("\n--- 2. ROLE_TOPIC_FOCUS Technical Areas ---")
for r_key in ["frontend developer", "backend developer", "java developer"]:
    check(r_key in ROLE_TOPIC_FOCUS, f"ROLE_TOPIC_FOCUS contains key '{r_key}'")
    topics = ROLE_TOPIC_FOCUS.get(r_key, [])
    check(len(topics) >= 5, f"'{r_key}' has at least 5 structured topic areas (got {len(topics)})")

# 3. Adaptive Interview Fallback Pools
print("\n--- 3. Adaptive Interview Fallback Question Pools ---")
for r_key in ["frontend developer", "backend developer", "java developer"]:
    check(r_key in _ROLE_FALLBACK_QUESTIONS, f"Adaptive _ROLE_FALLBACK_QUESTIONS contains '{r_key}'")
    for diff in ["easy", "medium", "hard"]:
        pool = _ROLE_FALLBACK_QUESTIONS.get(r_key, {}).get(diff, [])
        check(len(pool) >= 3, f"'{r_key}' [{diff}] pool has at least 3 questions (got {len(pool)})")
        
    # Test _get_fallback_question
    q_easy = _get_fallback_question(r_key, "easy", [])
    check("question" in q_easy and len(q_easy["question"]) > 10, f"_get_fallback_question('{r_key}', 'easy') succeeds")
    q_hard = _get_fallback_question(r_key, "hard", [])
    check("question" in q_hard and len(q_hard["question"]) > 10, f"_get_fallback_question('{r_key}', 'hard') succeeds")

# 4. Study Planner Role Curriculum
print("\n--- 4. Study Planner Curriculum Integration ---")
for r_key in ["frontend developer", "backend developer", "java developer"]:
    check(r_key in ROLE_DEFAULT_TOPICS, f"Study planner ROLE_DEFAULT_TOPICS contains '{r_key}'")
    curriculum = _get_curriculum_for_role(r_key)
    check(len(curriculum) >= 6, f"'{r_key}' curriculum has at least 6 topics (got {len(curriculum)})")

print("\n=======================================================")
print(f"RESULTS: {passed} Passed, {failed} Failed")
print("=======================================================\n")

if failed > 0:
    sys.exit(1)
else:
    print("All backend role integrations verified successfully!")
    sys.exit(0)
