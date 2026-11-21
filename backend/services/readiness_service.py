"""
AI Interview Readiness Prediction & Skill Gap Radar Service
Intervexa AI - Smart Interview Coach

Calculates transparent, weighted readiness scores, performs role-specific skill gap analysis,
generates radar chart datasets, and prioritizes actionable preparation recommendations.
"""

import math
import json
import sqlite3
from typing import Dict, Any, List, Optional, Tuple

from database import get_db_connection


# =============================================================================
# 1. CONFIGURATION & BENCHMARKS
# =============================================================================

DEFAULT_READINESS_WEIGHTS = {
    "technical_knowledge": 0.30,
    "communication_skills": 0.15,
    "problem_solving": 0.20,
    "role_specific_skills": 0.20,
    "resume_job_match": 0.10,
    "interview_consistency": 0.05,
}

ROLE_COMPETENCY_BENCHMARKS = {
    "python developer": [
        {"skill": "Python Fundamentals", "target": 85, "keywords": ["python", "oop", "decorator", "generator"]},
        {"skill": "SQL & Databases", "target": 80, "keywords": ["sql", "join", "query", "database", "orm"]},
        {"skill": "REST APIs & Architecture", "target": 80, "keywords": ["api", "rest", "fastapi", "flask", "django", "endpoint"]},
        {"skill": "Data Structures & Algos", "target": 75, "keywords": ["data structure", "tree", "hash", "array", "complexity", "big o"]},
        {"skill": "Problem Solving", "target": 80, "keywords": ["problem", "scenario", "edge case", "debug", "solve"]},
        {"skill": "Communication", "target": 80, "keywords": ["communication", "clarity", "articulation"]},
    ],
    "full stack developer": [
        {"skill": "Frontend & UI", "target": 85, "keywords": ["react", "javascript", "css", "dom", "html", "vue"]},
        {"skill": "Backend Architecture", "target": 80, "keywords": ["backend", "node", "express", "python", "server", "microservice"]},
        {"skill": "SQL & Databases", "target": 80, "keywords": ["database", "sql", "postgres", "mongodb", "schema"]},
        {"skill": "API Design & Security", "target": 80, "keywords": ["api", "jwt", "auth", "rest", "cors"]},
        {"skill": "Problem Solving", "target": 80, "keywords": ["problem", "scenario", "optimization", "system design"]},
        {"skill": "Communication", "target": 80, "keywords": ["communication", "structure", "clarity"]},
    ],
    "frontend developer": [
        {"skill": "React Architecture", "target": 85, "keywords": ["react", "component", "hook", "state", "props", "lifecycle"]},
        {"skill": "Core JavaScript", "target": 85, "keywords": ["javascript", "es6", "closure", "promise", "async", "event loop"]},
        {"skill": "CSS & Responsive UI", "target": 80, "keywords": ["css", "flexbox", "grid", "responsive", "tailwind", "layout"]},
        {"skill": "Web Performance", "target": 75, "keywords": ["performance", "render", "bundle", "memo", "lazy"]},
        {"skill": "Problem Solving", "target": 80, "keywords": ["debug", "refactor", "scenario", "problem"]},
        {"skill": "Communication", "target": 80, "keywords": ["communication", "clarity"]},
    ],
    "data analyst": [
        {"skill": "SQL & Aggregations", "target": 85, "keywords": ["sql", "join", "window", "group by", "query", "aggregate"]},
        {"skill": "Statistical Analysis", "target": 80, "keywords": ["statistic", "variance", "probability", "mean", "hypothesis", "sample"]},
        {"skill": "Python / Data Wrangling", "target": 80, "keywords": ["python", "pandas", "numpy", "dataframe", "clean"]},
        {"skill": "Data Storytelling", "target": 80, "keywords": ["chart", "visualization", "dashboard", "metric", "insight"]},
        {"skill": "Problem Solving", "target": 80, "keywords": ["scenario", "business", "metric", "problem"]},
        {"skill": "Communication", "target": 80, "keywords": ["communication", "presentation", "clarity"]},
    ],
    "general": [
        {"skill": "Core Technical Principles", "target": 80, "keywords": ["technical", "definition", "core", "mechanism"]},
        {"skill": "Database & Storage", "target": 75, "keywords": ["database", "sql", "data", "storage", "query"]},
        {"skill": "Architecture & APIs", "target": 75, "keywords": ["architecture", "api", "design", "network", "integration"]},
        {"skill": "Algorithms & Optimization", "target": 75, "keywords": ["algorithm", "complexity", "performance", "trade-off"]},
        {"skill": "Problem Solving", "target": 80, "keywords": ["scenario", "troubleshoot", "debug", "solve"]},
        {"skill": "Communication Clarity", "target": 80, "keywords": ["communication", "clarity", "structure"]},
    ]
}


def get_readiness_category(score: float) -> Tuple[str, str, str]:
    """
    Categorizes the readiness score on a 0–100 scale:
    - 0–39: Needs Improvement
    - 40–59: Beginner
    - 60–74: Developing
    - 75–89: Interview Ready
    - 90–100: Highly Prepared
    """
    if score >= 90:
        return "Highly Prepared", "var(--success, #10B981)", "Exceptional technical mastery and articulate communication. Ready for top-tier competitive interviews."
    elif score >= 75:
        return "Interview Ready", "var(--primary, #7138F5)", "Solid conceptual grasp and structured delivery. Well prepared for standard industry technical rounds."
    elif score >= 60:
        return "Developing", "var(--accent, #3B82F6)", "Good foundational awareness with minor gaps in advanced edge cases and trade-off depth."
    elif score >= 40:
        return "Beginner", "var(--warning, #F59E0B)", "Early preparation stage. Needs targeted practice on core definitions and multi-step implementations."
    else:
        return "Needs Improvement", "var(--danger, #EF4444)", "Foundational technical revision required before attempting mock technical interviews."


def _get_matched_role_benchmarks(role: Optional[str]) -> List[Dict[str, Any]]:
    """Resolves role-specific competency benchmarks based on candidate's target role."""
    if not role:
        return ROLE_COMPETENCY_BENCHMARKS["general"]

    r_clean = role.lower().strip()
    for key, benchmarks in ROLE_COMPETENCY_BENCHMARKS.items():
        if key in r_clean or r_clean in key:
            return benchmarks
    return ROLE_COMPETENCY_BENCHMARKS["general"]


# =============================================================================
# 2. CORE READINESS CALCULATION ENGINE
# =============================================================================

def calculate_readiness_score(
    user_id: int,
    role: Optional[str] = None,
    resume_match_score: Optional[float] = None,
    custom_weights: Optional[Dict[str, float]] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculates a comprehensive, transparent AI Interview Readiness Score.
    Normalizes component scores to 0–100.
    Dynamically redistributes weights when certain optional metrics (like resume match) are not available.
    """
    weights = dict(custom_weights or DEFAULT_READINESS_WEIGHTS)
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()

        # 1. Fetch completed interviews
        cursor.execute(
            """
            SELECT id, role, avg_score, communication_score, created_at
            FROM interviews
            WHERE user_id = ?
            ORDER BY created_at ASC
            """,
            (user_id,)
        )
        interview_rows = [dict(r) for r in cursor.fetchall()]
        total_interviews = len(interview_rows)

        # Insufficient data check
        if total_interviews == 0:
            return {
                "has_sufficient_data": False,
                "overall_score": None,
                "readiness_category": "Insufficient Data",
                "category_color": "var(--muted, #94A3B8)",
                "category_description": "Complete at least one mock interview to calculate your AI Interview Readiness Score.",
                "total_completed_interviews": 0,
                "target_role": role or "Candidate",
                "metrics_breakdown": {},
                "weights_used": weights,
                "disclaimer": (
                    "The AI Readiness Score is an educational estimation based on your mock interview performance, "
                    "communication clarity, and skill mastery. It does not predict or guarantee employment decisions."
                )
            }

        # Resolve effective target role
        effective_role = role or interview_rows[-1].get("role") or "Software Developer"

        # 2. Fetch question details for fine-grained problem solving and topic evaluation
        cursor.execute(
            """
            SELECT d.technical_score, d.communication_score, d.difficulty, d.topic, d.question
            FROM interview_details d
            JOIN interviews i ON d.interview_id = i.id
            WHERE i.user_id = ?
            """,
            (user_id,)
        )
        detail_rows = [dict(r) for r in cursor.fetchall()]

        # 3. Fetch topic mastery records from candidate_skill_progress
        cursor.execute(
            """
            SELECT topic, average_score, latest_score, attempt_count, mastery_status
            FROM candidate_skill_progress
            WHERE user_id = ?
            """,
            (user_id,)
        )
        skill_rows = [dict(r) for r in cursor.fetchall()]

        # ── COMPONENT 1: TECHNICAL KNOWLEDGE (0-100) ──
        # Average of technical scores across all completed interviews
        tech_scores = []
        for inv in interview_rows:
            s = inv.get("avg_score")
            if s is not None:
                try:
                    v = float(s)
                    tech_scores.append(v * 10 if v <= 10 else v)
                except Exception:
                    pass
        technical_knowledge = round(sum(tech_scores) / len(tech_scores), 1) if tech_scores else 60.0

        # ── COMPONENT 2: COMMUNICATION SKILLS (0-100) ──
        comm_scores = []
        for inv in interview_rows:
            c = inv.get("communication_score")
            if c is not None:
                try:
                    c_val = float(c)
                    comm_scores.append(c_val * 10 if c_val <= 10 else c_val)
                except Exception:
                    pass
        if not comm_scores and detail_rows:
            for d in detail_rows:
                c = d.get("communication_score")
                if c is not None:
                    try:
                        c_val = float(c)
                        comm_scores.append(c_val * 10 if c_val <= 10 else c_val)
                    except Exception:
                        pass
        communication_skills = round(sum(comm_scores) / len(comm_scores), 1) if comm_scores else technical_knowledge

        # ── COMPONENT 3: PROBLEM SOLVING ABILITY (0-100) ──
        # Performance on medium/hard difficulty questions and architectural/scenario problems
        ps_scores = []
        for d in detail_rows:
            diff = (d.get("difficulty") or "medium").lower()
            topic = (d.get("topic") or "").lower()
            q_text = (d.get("question") or "").lower()
            is_ps = (
                diff in ["medium", "hard"] or
                any(k in topic for k in ["algorithm", "data structure", "design", "problem", "optimization", "scenario"]) or
                any(k in q_text for k in ["how would you", "design", "architect", "troubleshoot", "trade-off", "optimize"])
            )
            if is_ps and d.get("technical_score") is not None:
                try:
                    t_val = float(d["technical_score"])
                    ps_scores.append(t_val * 10 if t_val <= 10 else t_val)
                except Exception:
                    pass
        problem_solving = round(sum(ps_scores) / len(ps_scores), 1) if ps_scores else technical_knowledge

        # ── COMPONENT 4: ROLE-SPECIFIC SKILLS (0-100) ──
        benchmarks = _get_matched_role_benchmarks(effective_role)
        role_skill_scores = []
        for b in benchmarks:
            matched_skill = next(
                (s for s in skill_rows if any(k in s["topic"].lower() for k in b["keywords"])),
                None
            )
            if matched_skill:
                role_skill_scores.append(float(matched_skill["average_score"]))
        role_specific_skills = round(sum(role_skill_scores) / len(role_skill_scores), 1) if role_skill_scores else technical_knowledge

        # ── COMPONENT 5: RESUME AND JOB MATCH (0-100, OPTIONAL) ──
        # If resume match was not run, we exclude this component and redistribute weights
        has_resume_match = resume_match_score is not None and resume_match_score >= 0
        resume_job_match = float(resume_match_score) if has_resume_match else None

        # ── COMPONENT 6: INTERVIEW CONSISTENCY (0-100) ──
        # Measures performance stability over time
        if len(tech_scores) <= 1:
            consistency = 75.0  # Neutral baseline for single interview
        else:
            mean = sum(tech_scores) / len(tech_scores)
            variance = sum((s - mean) ** 2 for s in tech_scores) / len(tech_scores)
            std_dev = math.sqrt(variance)
            # Consistency penalty: stable scores yield high consistency
            consistency = round(max(30.0, min(100.0, 100.0 - (std_dev * 2.5))), 1)

        # ── DYNAMIC WEIGHT NORMALIZATION & AGGREGATION ──
        available_components = {
            "technical_knowledge": (technical_knowledge, weights["technical_knowledge"]),
            "communication_skills": (communication_skills, weights["communication_skills"]),
            "problem_solving": (problem_solving, weights["problem_solving"]),
            "role_specific_skills": (role_specific_skills, weights["role_specific_skills"]),
            "interview_consistency": (consistency, weights["interview_consistency"]),
        }
        if has_resume_match and resume_job_match is not None:
            available_components["resume_job_match"] = (resume_job_match, weights["resume_job_match"])

        total_weight = sum(w for _, w in available_components.values())
        overall_score = sum(score * (w / total_weight) for score, w in available_components.values())
        overall_score = round(max(0.0, min(100.0, overall_score)), 1)

        category, color, description = get_readiness_category(overall_score)

        # Query previous readiness score snapshot from readiness_history
        cursor.execute(
            """
            SELECT overall_score, created_at
            FROM readiness_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (user_id,)
        )
        prev_snapshot = cursor.fetchone()
        previous_score = round(float(prev_snapshot["overall_score"]), 1) if prev_snapshot else None
        score_improvement = round(overall_score - previous_score, 1) if previous_score is not None else 0.0

        metrics_breakdown = {
            "technical_knowledge": {"score": technical_knowledge, "weight": weights["technical_knowledge"], "label": "Technical Knowledge"},
            "communication_skills": {"score": communication_skills, "weight": weights["communication_skills"], "label": "Communication Skills"},
            "problem_solving": {"score": problem_solving, "weight": weights["problem_solving"], "label": "Problem Solving"},
            "role_specific_skills": {"score": role_specific_skills, "weight": weights["role_specific_skills"], "label": "Role-Specific Skills"},
            "resume_job_match": {
                "score": resume_job_match,
                "weight": weights["resume_job_match"] if has_resume_match else 0.0,
                "label": "Resume & Job Match",
                "status": "Available" if has_resume_match else "Pending Upload / Scan"
            },
            "interview_consistency": {"score": consistency, "weight": weights["interview_consistency"], "label": "Interview Consistency"},
        }

        return {
            "has_sufficient_data": True,
            "overall_score": overall_score,
            "readiness_category": category,
            "category_color": color,
            "category_description": description,
            "previous_score": previous_score,
            "score_improvement": score_improvement,
            "total_completed_interviews": total_interviews,
            "target_role": effective_role,
            "metrics_breakdown": metrics_breakdown,
            "weights_used": weights,
            "disclaimer": (
                "The AI Readiness Score is an educational estimation based on your mock interview performance, "
                "communication clarity, and skill mastery. It does not predict or guarantee employment decisions."
            )
        }

    finally:
        conn.close()


# =============================================================================
# 3. SKILL GAP ANALYSIS & RADAR DATASET
# =============================================================================

def analyze_skill_gaps(
    user_id: int,
    role: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Performs role-specific skill gap analysis comparing actual candidate performance
    with target industry benchmarks for the selected target role.
    """
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()

        # Retrieve user's target role if not provided
        cursor.execute("SELECT target_role FROM interview_memory WHERE user_id = ?", (user_id,))
        mem = cursor.fetchone()
        effective_role = role or (mem["target_role"] if mem else None)
        if not effective_role:
            cursor.execute("SELECT role FROM interviews WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
            inv = cursor.fetchone()
            effective_role = inv["role"] if inv else "Software Developer"

        benchmarks = _get_matched_role_benchmarks(effective_role)

        # Retrieve candidate skill mastery records
        cursor.execute(
            """
            SELECT topic, previous_score, latest_score, average_score, attempt_count, improvement_trend, mastery_status
            FROM candidate_skill_progress
            WHERE user_id = ?
            """,
            (user_id,)
        )
        candidate_skills = [dict(r) for r in cursor.fetchall()]

        radar_data = []
        strong_skills = []
        skills_requiring_improvement = []
        critical_gaps = []
        missing_skills = []

        for b in benchmarks:
            b_name = b["skill"]
            target = float(b["target"])
            keywords = b["keywords"]

            matched = next(
                (s for s in candidate_skills if any(k in s["topic"].lower() for k in keywords)),
                None
            )

            if matched:
                # Weighted proficiency: 60% latest score + 40% historical average
                latest = float(matched.get("latest_score", 0))
                average = float(matched.get("average_score", 0))
                current = round(latest * 0.6 + average * 0.4, 1)
                attempts = int(matched.get("attempt_count", 1))
                trend = float(matched.get("improvement_trend", 0))
                mastery = matched.get("mastery_status", "Needs Practice")
                gap = round(max(0.0, target - current), 1)

                radar_item = {
                    "skill": b_name,
                    "current": current,
                    "target": target,
                    "gap": gap,
                    "attempts": attempts,
                    "trend": trend,
                    "mastery_status": mastery,
                    "status": "Attempted",
                    "fullMark": 100
                }
                radar_data.append(radar_item)

                if gap <= 5.0 and current >= 75.0:
                    strong_skills.append(radar_item)
                elif gap >= 25.0:
                    critical_gaps.append(radar_item)
                else:
                    skills_requiring_improvement.append(radar_item)

            else:
                # Missing skill: required by role but unattempted
                gap = target
                radar_item = {
                    "skill": b_name,
                    "current": 0.0,
                    "target": target,
                    "gap": gap,
                    "attempts": 0,
                    "trend": 0.0,
                    "mastery_status": "Unattempted",
                    "status": "Missing",
                    "fullMark": 100
                }
                radar_data.append(radar_item)
                missing_skills.append(radar_item)

        return {
            "target_role": effective_role,
            "radar_data": radar_data,
            "strong_skills": strong_skills,
            "skills_requiring_improvement": skills_requiring_improvement,
            "critical_gaps": critical_gaps,
            "missing_skills": missing_skills,
            "total_evaluated_skills": len(radar_data)
        }

    finally:
        conn.close()


# =============================================================================
# 4. PERSONALIZED PREPARATION RECOMMENDATIONS
# =============================================================================

def generate_readiness_recommendations(
    user_id: int,
    role: Optional[str] = None,
    db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Generates actionable, prioritized preparation recommendations based on
    highest skill gaps, recent mistakes logged in memory, and missing job skills.
    """
    gaps_result = analyze_skill_gaps(user_id=user_id, role=role, db_path=db_path)
    radar_data = gaps_result.get("radar_data", [])

    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT topic, identified_mistakes, improvement_suggestions
            FROM topic_performance_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 10
            """,
            (user_id,)
        )
        mistake_rows = [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()

    recommendations = []

    # Sort radar items by gap descending
    sorted_by_gap = sorted(radar_data, key=lambda x: x["gap"], reverse=True)

    for item in sorted_by_gap:
        skill = item["skill"]
        gap = item["gap"]
        current = item["current"]
        attempts = item["attempts"]

        if gap <= 5.0 and current >= 80:
            continue  # Already mastered

        # Determine priority
        if gap >= 25.0 or attempts == 0:
            priority = "High"
            priority_color = "var(--danger, #EF4444)"
        elif gap >= 15.0:
            priority = "Medium"
            priority_color = "var(--warning, #F59E0B)"
        else:
            priority = "Low"
            priority_color = "var(--primary, #7138F5)"

        # Find associated mistakes
        matched_mistake = next(
            (m for m in mistake_rows if any(k in m["topic"].lower() for k in skill.lower().split())),
            None
        )

        if attempts == 0:
            action_plan = f"Complete an initial mock interview round focusing on '{skill}' to calibrate your baseline."
            reason = f"Essential competency for {gaps_result.get('target_role')}; currently unattempted."
            suggested_track = "Targeted Adaptive Interview"
        elif matched_mistake and matched_mistake.get("identified_mistakes"):
            raw_mistake = matched_mistake["identified_mistakes"]
            action_plan = f"Review technical concepts: {raw_mistake}"
            reason = f"Current proficiency is {current}% (Target: {item['target']}%, Gap: {gap}%)."
            suggested_track = "Standard Interview: Focus Mode"
        else:
            action_plan = f"Practice structured scenario questions and trade-off analysis for {skill}."
            reason = f"Skill gap of {gap}% identified relative to standard {gaps_result.get('target_role')} benchmarks."
            suggested_track = "Personalized Adaptive Track"

        recommendations.append({
            "skill": skill,
            "priority": priority,
            "priority_color": priority_color,
            "current_score": current,
            "target_score": item["target"],
            "skill_gap": gap,
            "action_plan": action_plan,
            "reason": reason,
            "suggested_track": suggested_track
        })

    return recommendations[:6]


# =============================================================================
# 5. SNAPSHOT PERSISTENCE & HISTORY TRACKING
# =============================================================================

def record_readiness_snapshot(
    user_id: int,
    interview_id: Optional[int] = None,
    role: Optional[str] = None,
    resume_match_score: Optional[float] = None,
    db_path: Optional[str] = None
) -> Optional[int]:
    """
    Computes current readiness and safely records an immutable historical snapshot.
    Prevents duplicate snapshots if the interview completion is retried.
    """
    readiness = calculate_readiness_score(
        user_id=user_id,
        role=role,
        resume_match_score=resume_match_score,
        db_path=db_path
    )

    if not readiness.get("has_sufficient_data") or readiness.get("overall_score") is None:
        return None

    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()

        # Idempotency check: avoid duplicate snapshot for same interview_id
        if interview_id:
            cursor.execute(
                "SELECT id FROM readiness_history WHERE user_id = ? AND interview_id = ?",
                (user_id, interview_id)
            )
            existing = cursor.fetchone()
            if existing:
                # Update existing record
                cursor.execute(
                    """
                    UPDATE readiness_history
                    SET overall_score = ?, readiness_category = ?, technical_score = ?,
                        communication_score = ?, problem_solving_score = ?, role_skills_score = ?,
                        resume_match_score = ?, consistency_score = ?, metrics_breakdown = ?
                    WHERE id = ?
                    """,
                    (
                        readiness["overall_score"],
                        readiness["readiness_category"],
                        readiness["metrics_breakdown"]["technical_knowledge"]["score"],
                        readiness["metrics_breakdown"]["communication_skills"]["score"],
                        readiness["metrics_breakdown"]["problem_solving"]["score"],
                        readiness["metrics_breakdown"]["role_specific_skills"]["score"],
                        readiness["metrics_breakdown"]["resume_job_match"]["score"],
                        readiness["metrics_breakdown"]["interview_consistency"]["score"],
                        json.dumps(readiness["metrics_breakdown"]),
                        existing[0]
                    )
                )
                conn.commit()
                return existing[0]

        cursor.execute(
            """
            INSERT INTO readiness_history (
                user_id, interview_id, overall_score, readiness_category,
                technical_score, communication_score, problem_solving_score,
                role_skills_score, resume_match_score, consistency_score,
                metrics_breakdown
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                interview_id,
                readiness["overall_score"],
                readiness["readiness_category"],
                readiness["metrics_breakdown"]["technical_knowledge"]["score"],
                readiness["metrics_breakdown"]["communication_skills"]["score"],
                readiness["metrics_breakdown"]["problem_solving"]["score"],
                readiness["metrics_breakdown"]["role_specific_skills"]["score"],
                readiness["metrics_breakdown"]["resume_job_match"]["score"],
                readiness["metrics_breakdown"]["interview_consistency"]["score"],
                json.dumps(readiness["metrics_breakdown"]),
            )
        )
        conn.commit()
        return cursor.lastrowid
    except Exception as e:
        conn.rollback()
        print(f"[READINESS ERROR] Failed to record snapshot: {e}")
        return None
    finally:
        conn.close()


def get_readiness_history(user_id: int, limit: int = 10, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns chronological snapshots of readiness scores for trend progression charts."""
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, interview_id, overall_score, readiness_category,
                   technical_score, communication_score, problem_solving_score,
                   role_skills_score, resume_match_score, consistency_score,
                   created_at
            FROM readiness_history
            WHERE user_id = ?
            ORDER BY created_at ASC, id ASC
            LIMIT ?
            """,
            (user_id, limit)
        )
        rows = [dict(r) for r in cursor.fetchall()]
        return rows
    finally:
        conn.close()

