import os
import sys
import json
import re
import time
import sqlite3
from typing import Dict, List, Any, Optional

try:
    from database import get_db_connection
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from database import get_db_connection

from services.groq_service import _call_groq, _extract_json, _safe_print


# Common topic keywords mapping for resilient topic detection
TOPIC_PATTERNS = [
    (r"\b(sql|database|query|joins?|table|normalization|indexing|acid|transaction|schema|foreign key)\b", "SQL & Database Design"),
    (r"\b(rest|api|apis|http|endpoint|status codes?|graphql|crud|json)\b", "REST APIs & Web Services"),
    (r"\b(oop|object oriented|inheritance|polymorphism|encapsulation|abstraction|class|interface)\b", "OOP Concepts"),
    (r"\b(data structure|array|linked list|stack|queue|tree|graph|hashmap|hash table|binary search|sorting)\b", "Data Structures & Algorithms"),
    (r"\b(react|component|state|props|hook|virtual dom|jsx|lifecycle|redux)\b", "React & Frontend Architecture"),
    (r"\b(jwt|token|auth|authentication|authorization|oauth|session|security|cors|xss|csrf)\b", "Authentication & Security"),
    (r"\b(docker|container|kubernetes|ci/cd|pipeline|devops|aws|deploy|cloud)\b", "DevOps & Cloud Deployment"),
    (r"\b(test|testing|unit test|integration test|selenium|pytest|mock|tdd|assertion|bug|defect)\b", "Software Testing & QA"),
    (r"\b(python|generator|decorator|async|await|gil|lambda|pandas|numpy)\b", "Python Fundamentals"),
    (r"\b(system design|microservice|scalability|load balancer|cache|redis|kafka|architecture)\b", "System Design & Architecture"),
    (r"\b(javascript|typescript|closure|promise|event loop|async|prototype)\b", "JavaScript / TypeScript Fundamentals"),
    (r"\b(machine learning|model|regression|classification|neural|overfitting|deep learning)\b", "Machine Learning & AI"),
]


def extract_topic_from_question(question: str, explicit_topic: Optional[str] = None, assesses_skill: Optional[str] = None) -> str:
    """Derives a normalized, professional topic label from metadata or question text."""
    if explicit_topic and str(explicit_topic).strip() and str(explicit_topic).strip().lower() != "general":
        return str(explicit_topic).strip()
    if assesses_skill and str(assesses_skill).strip() and str(assesses_skill).strip().lower() != "general":
        return str(assesses_skill).strip()

    q_lower = str(question or "").lower()
    for pattern, label in TOPIC_PATTERNS:
        if re.search(pattern, q_lower, re.IGNORECASE):
            return label

    return "Core Technical Concepts"


def normalize_score_pct(score: Any) -> float:
    """Normalizes score to a transparent 0-100 percentage float."""
    try:
        val = float(score)
        # If score is on a 0-10 scale, convert to 0-100
        if 0.0 <= val <= 10.0:
            return round(val * 10.0, 1)
        elif 0.0 <= val <= 100.0:
            return round(val, 1)
        return 50.0
    except (ValueError, TypeError):
        return 50.0


def calculate_mastery_status(average_score: float, attempt_count: int) -> str:
    """
    Transparent Mastery Rules:
    - Needs Practice: < 60%
    - Developing: 60% - 74.9%
    - Proficient: 75% - 84.9%
    - Mastered: >= 85% AND attempt_count >= 2 (never claimed on a single answer)
    """
    if average_score >= 85.0:
        return "Mastered" if attempt_count >= 2 else "Proficient"
    elif average_score >= 75.0:
        return "Proficient"
    elif average_score >= 60.0:
        return "Developing"
    else:
        return "Needs Practice"


# =============================================================================
# 1. RECORD & UPDATE INTERVIEW MEMORY
# =============================================================================

def record_interview_memory(
    user_id: int,
    role: str,
    interview_mode: str,
    results: List[Dict[str, Any]],
    overall_summary: Optional[Dict[str, Any]] = None,
    interview_id: Optional[int] = None,
    db_path: Optional[str] = None,
) -> bool:
    """
    Atomically updates the candidate's persistent interview memory:
    1. Inserts topic-by-topic evaluation into `topic_performance_history`.
    2. Updates or creates `candidate_skill_progress` with previous vs latest score,
       delta, attempt count, and transparent mastery status.
    3. Updates high-level `interview_memory` table.
    """
    if not user_id or not results or len(results) == 0:
        return False

    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()

        # Step 1: Update interview_memory table
        cursor.execute(
            """
            SELECT total_completed_interviews FROM interview_memory
            WHERE user_id = ? AND target_role = ?
            """,
            (user_id, role),
        )
        mem_row = cursor.fetchone()
        if mem_row:
            new_total = (mem_row[0] or 0) + 1
            cursor.execute(
                """
                UPDATE interview_memory
                SET total_completed_interviews = ?, last_updated = CURRENT_TIMESTAMP
                WHERE user_id = ? AND target_role = ?
                """,
                (new_total, user_id, role),
            )
        else:
            cursor.execute(
                """
                INSERT INTO interview_memory (user_id, target_role, total_completed_interviews, last_updated)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                """,
                (user_id, role),
            )

        # Step 2: Process each question result and update topic mastery
        for item in results:
            q_text = str(item.get("question") or "").strip()
            score_pct = normalize_score_pct(item.get("technical_score", 5))
            topic = extract_topic_from_question(
                q_text,
                explicit_topic=item.get("topic"),
                assesses_skill=item.get("assesses_skill"),
            )

            mistakes = item.get("mistakes") or ""
            if isinstance(mistakes, list):
                mistakes = "; ".join([str(m) for m in mistakes if str(m).strip()])
            else:
                mistakes = str(mistakes).strip()

            missing_concepts = item.get("missing_concepts") or []
            if isinstance(missing_concepts, list):
                missing_str = "; ".join([str(c) for c in missing_concepts if str(c).strip()])
            else:
                missing_str = str(missing_concepts).strip()

            suggestions = item.get("improvement_suggestions") or []
            if isinstance(suggestions, list):
                sug_str = "; ".join([str(s) for s in suggestions if str(s).strip()])
            else:
                sug_str = str(suggestions).strip()

            # Check if interview_id exists in interviews table to avoid FK error
            valid_interview_id = None
            if interview_id:
                cursor.execute("SELECT id FROM interviews WHERE id = ?", (interview_id,))
                if cursor.fetchone():
                    valid_interview_id = interview_id

            cursor.execute(
                """
                INSERT INTO topic_performance_history
                (user_id, interview_id, topic, score, identified_mistakes, improvement_suggestions, missing_concepts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, valid_interview_id, topic, score_pct, mistakes, sug_str, missing_str),
            )

            # Update or Insert candidate_skill_progress
            cursor.execute(
                """
                SELECT previous_score, latest_score, average_score, attempt_count
                FROM candidate_skill_progress
                WHERE user_id = ? AND topic = ?
                """,
                (user_id, topic),
            )
            prog_row = cursor.fetchone()

            if prog_row:
                old_latest = prog_row[1] or 0.0
                old_avg = prog_row[2] or 0.0
                old_count = prog_row[3] or 1

                new_count = old_count + 1
                new_avg = round(((old_avg * old_count) + score_pct) / new_count, 1)
                trend = round(score_pct - old_latest, 1)
                mastery = calculate_mastery_status(new_avg, new_count)

                cursor.execute(
                    """
                    UPDATE candidate_skill_progress
                    SET previous_score = ?,
                        latest_score = ?,
                        average_score = ?,
                        attempt_count = ?,
                        improvement_trend = ?,
                        mastery_status = ?,
                        last_practiced_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND topic = ?
                    """,
                    (old_latest, score_pct, new_avg, new_count, trend, mastery, user_id, topic),
                )
            else:
                mastery = calculate_mastery_status(score_pct, 1)
                cursor.execute(
                    """
                    INSERT INTO candidate_skill_progress
                    (user_id, topic, previous_score, latest_score, average_score, attempt_count, improvement_trend, mastery_status, last_practiced_at)
                    VALUES (?, ?, ?, ?, ?, 1, 0.0, ?, CURRENT_TIMESTAMP)
                    """,
                    (user_id, topic, score_pct, score_pct, score_pct, mastery),
                )

        conn.commit()
        _safe_print(f"[MEMORY] Successfully updated AI interview memory for user #{user_id} across {len(results)} topics.")
        return True

    except Exception as e:
        conn.rollback()
        _safe_print(f"[MEMORY ERROR] Failed to record interview memory: {e}")
        return False
    finally:
        conn.close()


# =============================================================================
# 2. QUERY METHODS
# =============================================================================

def get_interview_memory_overview(user_id: int, db_path: Optional[str] = None) -> Dict[str, Any]:
    """Returns a high-level summary of candidate memory."""
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()

        # Total completed interviews from memory / interviews table
        cursor.execute(
            "SELECT SUM(total_completed_interviews) as total_interviews, MAX(last_updated) as last_updated, MAX(target_role) as target_role FROM interview_memory WHERE user_id = ?",
            (user_id,),
        )
        mem_row = cursor.fetchone()
        total_interviews = (mem_row["total_interviews"] if mem_row and mem_row["total_interviews"] else 0)
        last_updated = mem_row["last_updated"] if mem_row else None
        target_role = mem_row["target_role"] if mem_row and mem_row["target_role"] else "Software Developer"

        # If interview_memory table is empty but interviews table has records, count directly
        if total_interviews == 0:
            cursor.execute("SELECT COUNT(*) as count, MAX(created_at) as last_time, MAX(role) as last_role FROM interviews WHERE user_id = ?", (user_id,))
            hist_row = cursor.fetchone()
            if hist_row and hist_row["count"]:
                total_interviews = hist_row["count"]
                last_updated = hist_row["last_time"]
                target_role = hist_row["last_role"] or target_role

        # Total topics tracked
        cursor.execute("SELECT COUNT(*) as cnt FROM candidate_skill_progress WHERE user_id = ?", (user_id,))
        topics_count = cursor.fetchone()["cnt"] or 0

        # Weak areas (< 60%)
        cursor.execute("SELECT COUNT(*) as cnt FROM candidate_skill_progress WHERE user_id = ? AND latest_score < 60", (user_id,))
        weak_count = cursor.fetchone()["cnt"] or 0

        # Strong areas (>= 75%)
        cursor.execute("SELECT COUNT(*) as cnt FROM candidate_skill_progress WHERE user_id = ? AND latest_score >= 75", (user_id,))
        strong_count = cursor.fetchone()["cnt"] or 0

        return {
            "has_memory": total_interviews > 0,
            "total_interviews": total_interviews,
            "topics_remembered": topics_count,
            "weak_topics_count": weak_count,
            "strong_topics_count": strong_count,
            "last_updated": last_updated,
            "target_role": target_role,
        }
    finally:
        conn.close()


def get_weak_areas(user_id: int, limit: int = 10, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns topics where latest score < 60% or marked as Needs Practice / Developing."""
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT topic, previous_score, latest_score, average_score, attempt_count, improvement_trend, mastery_status, last_practiced_at
            FROM candidate_skill_progress
            WHERE user_id = ? AND (latest_score < 60 OR mastery_status IN ('Needs Practice', 'Developing'))
            ORDER BY latest_score ASC, average_score ASC
            LIMIT ?
            """,
            (user_id, limit),
        )
        rows = cursor.fetchall()
        weak_list = []
        for r in rows:
            # Fetch latest identified mistake if available
            cursor.execute(
                """
                SELECT identified_mistakes, missing_concepts
                FROM topic_performance_history
                WHERE user_id = ? AND topic = ?
                ORDER BY created_at DESC LIMIT 1
                """,
                (user_id, r["topic"]),
            )
            mistake_row = cursor.fetchone()
            recent_mistake = mistake_row["identified_mistakes"] if mistake_row else ""
            missing_concepts = mistake_row["missing_concepts"] if mistake_row else ""

            weak_list.append({
                "topic": r["topic"],
                "previous_score": r["previous_score"],
                "latest_score": r["latest_score"],
                "average_score": r["average_score"],
                "attempt_count": r["attempt_count"],
                "improvement_trend": r["improvement_trend"],
                "mastery_status": r["mastery_status"],
                "last_practiced_at": r["last_practiced_at"],
                "recent_mistake": recent_mistake,
                "missing_concepts": missing_concepts,
            })
        return weak_list
    finally:
        conn.close()


def get_strong_areas(user_id: int, limit: int = 10, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns topics where latest score >= 75%."""
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT topic, previous_score, latest_score, average_score, attempt_count, improvement_trend, mastery_status, last_practiced_at
            FROM candidate_skill_progress
            WHERE user_id = ? AND latest_score >= 75
            ORDER BY latest_score DESC, attempt_count DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def get_skill_progress(user_id: int, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns all tracked topics with improvement trajectory."""
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT topic, previous_score, latest_score, average_score, attempt_count, improvement_trend, mastery_status, last_practiced_at
            FROM candidate_skill_progress
            WHERE user_id = ?
            ORDER BY last_practiced_at DESC
            """,
            (user_id,),
        )
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def get_recent_improvements(user_id: int, limit: int = 6, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns topics with positive improvement trends across multiple attempts."""
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT topic, previous_score, latest_score, average_score, attempt_count, improvement_trend, mastery_status, last_practiced_at
            FROM candidate_skill_progress
            WHERE user_id = ? AND attempt_count > 1
            ORDER BY improvement_trend DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def get_next_interview_recommendations(user_id: int, role: Optional[str] = None, db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns prioritized recommendations for the next interview based on:
    - 50%: Previous weak topics
    - 30%: Target job role core requirements
    - 20%: New / advanced concepts
    """
    weak_areas = get_weak_areas(user_id, limit=5, db_path=db_path)
    strong_areas = get_strong_areas(user_id, limit=5, db_path=db_path)

    # Core role topics
    role_core_topics = [
        "Architecture & Design Principles",
        "Data Structures & Optimization",
        "REST APIs & Integration",
        "Authentication & Security",
    ]
    if role:
        r_low = role.lower()
        if "machine learning" in r_low or "ml" in r_low:
            role_core_topics = ["Feature Engineering", "Model Evaluation Metrics", "Vectorization & NumPy", "Supervised Algorithms"]
        elif "test" in r_low or "qa" in r_low:
            role_core_topics = ["API Testing & Validation", "Test Case Design Techniques", "Regression Strategy", "Defect Lifecycle"]
        elif "frontend" in r_low:
            role_core_topics = ["React Component State", "Virtual DOM & Performance", "CSS Layouts & Responsive UI", "Async HTTP & Error Handling"]

    # Build prioritized list
    recommended_topics = []

    # 1. Weak topics (50% weight)
    for w in weak_areas[:3]:
        recommended_topics.append({
            "topic": w["topic"],
            "category": "Remediation (Weak Area)",
            "score": w["latest_score"],
            "reason": f"Scored {w['latest_score']}% previously. Targeted follow-up recommended to close concept gaps.",
            "priority": "High (50% Focus)",
        })

    # 2. Core role topics (30% weight)
    for c in role_core_topics[:2]:
        if not any(r["topic"].lower() == c.lower() for r in recommended_topics):
            recommended_topics.append({
                "topic": c,
                "category": "Role Requirement",
                "score": None,
                "reason": f"Fundamental requirement for {role or 'your target role'}.",
                "priority": "Medium (30% Focus)",
            })

    # 3. Advanced / New concept (20% weight)
    advanced_topics = ["High-Throughput Concurrency", "System Scalability & Caching", "Edge Case Fault Tolerance"]
    for a in advanced_topics[:1]:
        recommended_topics.append({
            "topic": a,
            "category": "Stretch / Advanced",
            "score": None,
            "reason": "Test advanced competency and architectural judgment.",
            "priority": "Growth (20% Focus)",
        })

    return {
        "recommended_topics": recommended_topics,
        "distribution": {
            "weak_areas_pct": 50,
            "target_role_pct": 30,
            "advanced_new_pct": 20,
        },
        "weak_count": len(weak_areas),
        "strong_count": len(strong_areas),
        "target_role": role or "Software Developer",
    }


def reset_interview_memory(user_id: int, db_path: Optional[str] = None) -> bool:
    """
    Safely resets the candidate's interview memory tables.
    Preserves general `interviews` history table.
    """
    if not user_id:
        return False

    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM interview_memory WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM candidate_skill_progress WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM topic_performance_history WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM personalized_question_history WHERE user_id = ?", (user_id,))
        conn.commit()
        _safe_print(f"[MEMORY] Successfully cleared persistent memory for user #{user_id}.")
        return True
    except Exception as e:
        conn.rollback()
        _safe_print(f"[MEMORY ERROR] Reset failed: {e}")
        return False
    finally:
        conn.close()


# =============================================================================
# 3. PERSONALIZED FOLLOW-UP QUESTION GENERATION
# =============================================================================

def generate_personalized_followup_question(
    user_id: Optional[int],
    role: str,
    skills: List[str],
    job_description: str = "",
    difficulty: str = "medium",
    previous_questions: Optional[List[Dict[str, Any]]] = None,
    previous_evaluations: Optional[List[Dict[str, Any]]] = None,
    topics_covered: Optional[List[str]] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates a memory-aware interview question by consulting the candidate's
    previous interview history, weak topics, and recurring mistakes.
    Falls back gracefully if Groq API fails.
    """
    weak_areas = get_weak_areas(user_id, limit=3, db_path=db_path) if user_id else []
    strong_areas = get_strong_areas(user_id, limit=3, db_path=db_path) if user_id else []

    already_asked = [q.get("question", "") for q in (previous_questions or []) if isinstance(q, dict)]

    weak_summary = ""
    if weak_areas:
        weak_summary = "Candidate's Identified Weak Topics from Previous Interviews:\n"
        for w in weak_areas:
            mistake_note = f" (Mistake: {w['recent_mistake']})" if w.get("recent_mistake") else ""
            weak_summary += f"- {w['topic']}: scored {w['latest_score']}%{mistake_note}\n"

    strong_summary = ""
    if strong_areas:
        strong_summary = "Candidate's Mastered / Strong Topics (DO NOT repeat basic questions on these):\n"
        for s in strong_areas:
            strong_summary += f"- {s['topic']}: scored {s['latest_score']}%\n"

    jd_snippet = f"\nTarget Job Description Requirements:\n{job_description[:800]}\n" if job_description else ""

    history_snippet = ""
    if already_asked:
        history_snippet = "Questions ALREADY asked in this session (NEVER REPEAT):\n"
        for i, q in enumerate(already_asked, 1):
            history_snippet += f"- Q{i}: {q}\n"

    prompt = f"""
You are an expert technical interviewer for '{role}'.
Your task is to generate ONE personalized technical interview question tailored to this candidate's preparation journey.

{weak_summary}
{strong_summary}
{jd_snippet}
{history_snippet}

Question Distribution Strategy:
- 50% Focus: Previous weak topics requiring targeted diagnostic or conceptual follow-up.
- 30% Focus: Core target role competency.
- 20% Focus: Stretch or scenario-based problem.

Target Difficulty: '{difficulty}'.

Return ONLY a valid JSON object with EXACTLY this structure:
{{
  "question": "The interview question text",
  "topic": "Name of the topic assessed (e.g. SQL & Database Design)",
  "difficulty": "{difficulty}",
  "question_type": "conceptual OR scenario_based OR practical_application",
  "reason": "Specific reason why this question is being asked based on candidate memory",
  "memory_reference": "Reference to candidate's previous performance or learning focus"
}}
Rules:
- DO NOT repeat any already asked questions.
- Return ONLY the raw JSON object, no markdown backticks or commentary.
"""

    messages = [{"role": "user", "content": prompt}]

    try:
        raw_response = _call_groq(messages, json_mode=True, max_tokens=1024, temperature=0.3, context="personalized_question")
        parsed = _extract_json(raw_response)

        if isinstance(parsed, dict) and parsed.get("question"):
            result = {
                "question": str(parsed.get("question")).strip(),
                "topic": str(parsed.get("topic") or "Core Engineering").strip(),
                "difficulty": difficulty,
                "question_type": str(parsed.get("question_type") or "conceptual").strip(),
                "reason": str(parsed.get("reason") or "Personalized follow-up from previous performance").strip(),
                "memory_reference": str(parsed.get("memory_reference") or "Previous interview memory").strip(),
            }

            # Record in personalized_question_history
            if user_id:
                try:
                    conn = get_db_connection(db_path)
                    conn.execute(
                        """
                        INSERT INTO personalized_question_history (user_id, question, topic, difficulty, question_type, reason, memory_reference)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (user_id, result["question"], result["topic"], result["difficulty"], result["question_type"], result["reason"], result["memory_reference"]),
                    )
                    conn.commit()
                    conn.close()
                except Exception as db_err:
                    _safe_print(f"[MEMORY] Could not log personalized question: {db_err}")

            return result

    except Exception as e:
        _safe_print(f"[MEMORY GROQ ERROR / FALLBACK]: {e}")

    # Fallback if Groq is offline or returns invalid structure
    fallback_question = _build_fallback_personalized_question(role, weak_areas, difficulty, already_asked)

    if user_id:
        try:
            conn = get_db_connection(db_path)
            conn.execute(
                """
                INSERT INTO personalized_question_history (user_id, question, topic, difficulty, question_type, reason, memory_reference)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, fallback_question["question"], fallback_question["topic"], fallback_question["difficulty"], fallback_question["question_type"], fallback_question["reason"], fallback_question["memory_reference"]),
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

    return fallback_question


def _build_fallback_personalized_question(
    role: str,
    weak_areas: List[Dict[str, Any]],
    difficulty: str,
    already_asked: List[str]
) -> Dict[str, Any]:
    """Generates an intelligent fallback question prioritizing identified weak areas."""
    asked_lower = [a.lower() for a in already_asked]

    # If candidate has a recorded weak topic, generate a focused question for it
    if weak_areas:
        top_weak = weak_areas[0]["topic"].lower()
        if "sql" in top_weak or "database" in top_weak:
            q = "Explain the difference between 1NF, 2NF, and 3NF database normalization, and what problems can occur in production without normalization?"
            if q.lower() not in asked_lower:
                return {
                    "question": q,
                    "topic": "SQL & Database Design",
                    "difficulty": difficulty,
                    "question_type": "conceptual",
                    "reason": f"Candidate previously scored {weak_areas[0].get('latest_score', 45)}% on SQL concepts.",
                    "memory_reference": "Targeted remediation on database normalization rules.",
                }

        if "rest" in top_weak or "api" in top_weak:
            q = "What is the difference between PUT and PATCH in RESTful APIs, and how should idempotency be maintained across asynchronous endpoints?"
            if q.lower() not in asked_lower:
                return {
                    "question": q,
                    "topic": "REST APIs & Web Services",
                    "difficulty": difficulty,
                    "question_type": "practical_application",
                    "reason": f"Candidate previously had gaps in RESTful API architectures ({weak_areas[0].get('latest_score', 50)}%).",
                    "memory_reference": "Targeted follow-up on HTTP API standards.",
                }

        if "data structure" in top_weak or "algorithm" in top_weak:
            q = "When would you choose a Hash Map over a Balanced Binary Search Tree (such as a Red-Black tree), and what are the time/space trade-offs?"
            if q.lower() not in asked_lower:
                return {
                    "question": q,
                    "topic": "Data Structures & Algorithms",
                    "difficulty": difficulty,
                    "question_type": "conceptual",
                    "reason": "Previous performance indicated need for additional practice with core data structures.",
                    "memory_reference": "Personalized assessment of fundamental data structure selection.",
                }

    # Standard role-specific fallback
    role_low = (role or "").lower()
    if "python" in role_low:
        q = "How do Python generators work using the yield keyword, and how does memory consumption compare to returning a full list?"
        topic = "Python Fundamentals"
    elif "machine learning" in role_low or "ml" in role_low:
        q = "How do you detect and mitigate overfitting in deep neural networks or tree-based models, and when do you choose L1 vs L2 regularization?"
        topic = "Machine Learning & AI"
    elif "test" in role_low or "qa" in role_low:
        q = "Walk me through how you design boundary value analysis and equivalence partitioning test suites for an e-commerce checkout workflow."
        topic = "Software Testing & QA"
    else:
        q = f"In your experience as a {role}, how do you design scalable system interfaces and prevent common architectural bottlenecks?"
        topic = "System Design & Architecture"

    return {
        "question": q,
        "topic": topic,
        "difficulty": difficulty,
        "question_type": "scenario_based",
        "reason": f"Core competency assessment for {role}.",
        "memory_reference": "Role baseline question distribution.",
    }
