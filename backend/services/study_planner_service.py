"""
AI Personalized Study Planner Service
Intervexa AI - Smart Interview Coach

Generates customized, adaptive daily and weekly study plans based on:
- Target Job Role
- Resume & ATS analysis
- Job Description matching
- Past Interview Performance & Topic Scores
- AI Interview Memory (Recurring Mistakes & Weak Topics)
- Interview Readiness Score & Skill Gap Radar
- Active Learning Activities & Topic Mastery
"""

import os
import sys
import json
import re
import datetime
import sqlite3
from typing import Dict, List, Any, Optional, Tuple

try:
    from database import get_db_connection
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from database import get_db_connection

try:
    from services.groq_service import _call_groq, _extract_json, _safe_print
except ImportError:
    try:
        from groq_service import _call_groq, _extract_json, _safe_print
    except ImportError:
        def _call_groq(*args, **kwargs):
            return "{}"
        def _extract_json(t):
            return {}
        def _safe_print(m):
            print(m)

try:
    from services.interview_memory_service import (
        get_candidate_memory_profile,
        TOPIC_PATTERNS,
        extract_topic_from_question,
        normalize_score_pct
    )
except ImportError:
    try:
        from interview_memory_service import (
            get_candidate_memory_profile,
            TOPIC_PATTERNS,
            extract_topic_from_question,
            normalize_score_pct
        )
    except ImportError:
        def get_candidate_memory_profile(u):
            return {"weak_topics": [], "strong_topics": [], "recurring_mistakes": []}
        def normalize_score_pct(s):
            try:
                v = float(s)
                return v * 10 if v <= 10 else v
            except Exception:
                return 50.0

try:
    from services.readiness_service import calculate_readiness_score, analyze_skill_gaps
except ImportError:
    try:
        from readiness_service import calculate_readiness_score, analyze_skill_gaps
    except ImportError:
        def calculate_readiness_score(user_id, role=None, **kwargs):
            return {"overall_score": 50.0, "readiness_category": "Needs Preparation"}
        def analyze_skill_gaps(user_id, role=None, **kwargs):
            return []

try:
    from services.roadmap_structured_content import (
        normalize_task_structured_fields,
        build_structured_topic_curriculum
    )
except ImportError:
    try:
        from roadmap_structured_content import (
            normalize_task_structured_fields,
            build_structured_topic_curriculum
        )
    except ImportError:
        def normalize_task_structured_fields(t):
            return t
        def build_structured_topic_curriculum(*args, **kwargs):
            return {"plan_title": "Plan", "summary": "", "focus_areas": [], "tasks": []}


# =============================================================================
# DEFAULT TOPIC CURRICULUMS BY ROLE (Used for comprehensive baseline plans)
# =============================================================================

ROLE_DEFAULT_TOPICS = {
    "full stack developer": [
        ("React & Frontend Architecture", "Master component lifecycle, hooks, state management, and virtual DOM performance."),
        ("REST APIs & Web Services", "Design idempotent RESTful endpoints, proper HTTP status codes, and JSON schemas."),
        ("SQL & Database Design", "Schema normalization, indexing strategies, complex JOINs, and transaction management."),
        ("Authentication & Security", "JWT authentication, OAuth2 flows, CSRF, XSS prevention, and CORS policies."),
        ("Data Structures & Algorithms", "Core data structures: arrays, linked lists, hashmaps, tree traversals, and complexity."),
        ("System Design & Architecture", "Client-server architecture, caching strategies (Redis), load balancing, and scalability."),
        ("DevOps & Cloud Deployment", "Docker containerization, CI/CD pipelines, and cloud hosting architecture."),
        ("Software Testing & QA", "Unit testing, integration testing, frontend component testing, and mock servers.")
    ],
    "python developer": [
        ("Python Fundamentals & Idioms", "Generators, decorators, list comprehensions, GIL, and memory management."),
        ("SQL & Database Optimization", "Advanced SQL queries, JOINs, indexing, and ORM query optimization (SQLAlchemy)."),
        ("REST APIs with FastAPI/Flask", "API route design, request validation (Pydantic), error handling, and async endpoints."),
        ("OOP Concepts & Design Patterns", "Inheritance, encapsulation, polymorphism, SOLID principles, and design patterns."),
        ("Data Structures & Algorithms", "Hashmaps, stacks/queues, sorting, binary search, and dynamic programming."),
        ("Microservices & System Design", "Service communication, message queues (RabbitMQ/Kafka), and Redis caching."),
        ("Testing & Quality Assurance", "Pytest, fixtures, mocking dependencies, test coverage, and automated tests."),
        ("DevOps & Containerization", "Dockerizing Python services, environment configs, and CI/CD pipelines.")
    ],
    "frontend developer": [
        ("React Fundamentals & Hooks", "Custom hooks, useMemo, useCallback, useEffect caveats, and state architecture."),
        ("JavaScript / TypeScript Core", "Closures, prototypes, event loop, Promises, async/await, and TypeScript types."),
        ("CSS, Flexbox & Responsive Design", "Modern CSS layout models, Grid, Flexbox, media queries, and Tailwind CSS."),
        ("Web Performance & Optimization", "Code splitting, lazy loading, bundle analysis, and Core Web Vitals."),
        ("Frontend State Management", "Context API vs Redux Toolkit vs Zustand, state normalization, and selectors."),
        ("API Integration & Error Handling", "Axios/fetch patterns, optimistic UI updates, retry logic, and error boundaries."),
        ("Testing Frontend Applications", "Jest, React Testing Library, userEvent, and mock service worker (MSW)."),
        ("Frontend Security & Accessibility", "XSS mitigation, Content Security Policy, WCAG guidelines, and ARIA labels.")
    ],
    "data analyst": [
        ("SQL & Complex Queries", "Window functions, aggregate queries, CTEs, self-joins, and subqueries."),
        ("Data Cleaning & Preprocessing", "Handling missing values, outlier detection, data standardization, and pandas."),
        ("Exploratory Data Analysis (EDA)", "Descriptive statistics, distribution analysis, correlation, and feature inspection."),
        ("Data Visualization & Dashboards", "Creating actionable charts, chart types selection, PowerBI/Tableau concepts."),
        ("Business Metric Calculations", "CAC, LTV, Retention rate, churn analysis, and cohort analysis."),
        ("Statistical Concepts & A/B Testing", "Hypothesis testing, p-values, confidence intervals, and sample sizing."),
        ("Python for Data Analysis", "Pandas, NumPy, Matplotlib/Seaborn, data pipeline scripting."),
        ("Database Modeling & Warehousing", "Star schema, snowflake schema, dimensional modeling, and ETL basics.")
    ],
    "backend developer": [
        ("API Design & REST Architecture", "RESTful standards, GraphQL basics, idempotency, rate limiting, and versioning."),
        ("SQL & Database Internals", "Transactions (ACID), isolation levels, B-Tree indexes, and query profiling."),
        ("Authentication, Authorization & Security", "JWT, OAuth2, session stores, password hashing, and OWASP top 10."),
        ("System Design & High Availability", "Horizontal vs vertical scaling, load balancers, caching, and database replication."),
        ("Data Structures & Algorithms", "Hash tables, graphs, trees, search algorithms, and algorithmic complexity."),
        ("Microservices & Message Queues", "Asynchronous task workers (Celery), Redis, Kafka/RabbitMQ message brokers."),
        ("Concurrency & Asynchronous I/O", "Multithreading, multiprocessing, event loops, and non-blocking I/O."),
        ("Testing, CI/CD & Monitoring", "Integration tests, Docker, health checks, structured logging, and APM.")
    ],
    "java developer": [
        ("Core Java & OOP Principles", "Object-oriented design, inheritance, polymorphism, encapsulation, abstraction, and memory management."),
        ("Java Collections Framework", "List, Set, Map hierarchies, time complexities, fail-fast vs fail-safe iterators, and internal HashMap hashing."),
        ("Exception Handling & Robust Code", "Checked vs unchecked exceptions, custom exception hierarchies, and try-with-resources."),
        ("Multithreading & Concurrency", "Thread lifecycle, ExecutorService, synchronization, locks, volatile, and ConcurrentHashMap."),
        ("Spring Boot & Dependency Injection", "Inversion of Control (IoC), Beans, Spring MVC controllers, REST endpoints, and auto-configuration."),
        ("JDBC, Hibernate & Spring Data JPA", "Entity mapping, relationship annotations, query performance, and connection pooling."),
        ("JVM Architecture & Performance Tuning", "JVM memory structure (Heap, Stack, Metaspace), garbage collection algorithms, and profiling."),
        ("Enterprise Architecture & Testing", "JUnit 5, Mockito, RESTful API design, microservice patterns, and transaction management.")
    ]
}


def _get_curriculum_for_role(role: str) -> List[Tuple[str, str]]:
    """Returns baseline topic curriculum matched to role with fallback to Full Stack."""
    r = (role or "").strip().lower()
    for key, topics in ROLE_DEFAULT_TOPICS.items():
        if key in r or r in key:
            return topics
    return ROLE_DEFAULT_TOPICS["full stack developer"]


# =============================================================================
# 1. TOPIC PRIORITIZATION ENGINE (Phase 3)
# =============================================================================

def prioritize_learning_topics(
    user_id: int,
    role: str,
    weak_skills: Optional[List[Dict[str, Any]]] = None,
    strong_skills: Optional[List[Dict[str, Any]]] = None,
    resume_skills: Optional[List[str]] = None,
    missing_skills: Optional[List[str]] = None,
    readiness_data: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Intelligently classifies and ranks topics into:
    - Critical: Weak areas (<60%), recurring mistakes, large skill gaps
    - High: Essential role competencies, missing skills from job match, developing skills (60-74%)
    - Medium: Proficient topics (75-84%), algorithmic problem solving, supplementary practice
    - Low: Mastered topics (>=85%) for periodic quick refreshers
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Gather Candidate Performance History
    cursor.execute("""
    SELECT topic, score, identified_mistakes, improvement_suggestions
    FROM topic_performance_history
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 25
    """, (user_id,))
    recent_history = cursor.fetchall()

    cursor.execute("""
    SELECT topic, average_score, latest_score, attempt_count, mastery_status
    FROM candidate_skill_progress
    WHERE user_id = ?
    """, (user_id,))
    skill_progress_rows = cursor.fetchall()
    conn.close()

    skill_map = {}
    for row in skill_progress_rows:
        topic_name = row[0]
        skill_map[topic_name.lower()] = {
            "topic": topic_name,
            "avg_score": float(row[1] or 0),
            "latest_score": float(row[2] or 0),
            "attempts": int(row[3] or 0),
            "mastery": str(row[4] or "Needs Practice")
        }

    # 2. Extract Recurring Mistakes from memory & history
    mistakes_by_topic = {}
    for row in recent_history:
        t_name = row[0]
        mistakes = row[2]
        if mistakes and t_name:
            t_key = t_name.lower()
            if t_key not in mistakes_by_topic:
                mistakes_by_topic[t_key] = []
            try:
                m_list = json.loads(mistakes) if mistakes.startswith("[") else [mistakes]
                for m in m_list:
                    if m and str(m) not in mistakes_by_topic[t_key]:
                        mistakes_by_topic[t_key].append(str(m))
            except Exception:
                mistakes_by_topic[t_key].append(str(mistakes))

    baseline_curriculum = _get_curriculum_for_role(role)
    all_candidate_topics = []
    seen_topic_keys = set()

    # Add baseline curriculum
    for t_name, t_desc in baseline_curriculum:
        t_key = t_name.lower()
        seen_topic_keys.add(t_key)
        all_candidate_topics.append({
            "topic": t_name,
            "base_desc": t_desc,
            "key": t_key
        })

    # Add any observed user topics not in baseline
    for t_key, s_data in skill_map.items():
        if t_key not in seen_topic_keys:
            seen_topic_keys.add(t_key)
            all_candidate_topics.append({
                "topic": s_data["topic"],
                "base_desc": f"Technical focus on {s_data['topic']} for {role}.",
                "key": t_key
            })

    prioritized_list = []

    for item in all_candidate_topics:
        t_key = item["key"]
        t_name = item["topic"]
        base_desc = item["base_desc"]

        perf = skill_map.get(t_key)
        topic_mistakes = mistakes_by_topic.get(t_key, [])

        is_missing_skill = False
        if missing_skills:
            for ms in missing_skills:
                if ms.lower() in t_key or t_key in ms.lower():
                    is_missing_skill = True
                    break

        priority = "Medium"
        difficulty = "Intermediate"
        estimated_minutes = 60
        why_recommended = ""
        completion_criteria = "Complete conceptual study and score at least 75% on technical practice exercises."
        recommended_practice = "Review core architecture, complete 5 MCQs, and solve 1 code/scenario challenge."

        if perf:
            score = perf["avg_score"]
            if score < 60.0 or len(topic_mistakes) >= 2:
                priority = "Critical"
                difficulty = "Beginner" if score < 45 else "Intermediate"
                estimated_minutes = 75
                why_recommended = (
                    f"Identified as a critical weak area ({round(score, 1)}% average score) with recurring mistakes "
                    f"in previous interviews. Needs intensive conceptual reinforcement."
                )
                completion_criteria = "Score 80%+ on focused practice questions and successfully explain core concepts."
                recommended_practice = "Read core architectural explanation, review identified mistakes, and resolve practice exercise."
            elif score < 75.0 or is_missing_skill:
                priority = "High"
                difficulty = "Intermediate"
                estimated_minutes = 60
                why_recommended = (
                    f"Essential competency for {role} role currently at Developing level ({round(score, 1)}%). "
                    f"Target is 80%+ proficiency."
                )
                completion_criteria = "Score 75%+ on practice exercises and complete hands-on scenario walkthrough."
                recommended_practice = "Review real-world implementation examples and complete practice MCQs."
            elif score >= 85.0 and perf["attempts"] >= 2:
                priority = "Low"
                difficulty = "Advanced"
                estimated_minutes = 45
                why_recommended = (
                    f"Strong performance demonstrated ({round(score, 1)}%). Scheduled for efficient revision to keep concepts sharp."
                )
                completion_criteria = "Quick review of advanced edge cases and 1 rapid-fire quiz."
                recommended_practice = "Review advanced edge cases, performance trade-offs, and micro-optimizations."
            else: # 75 - 84.9
                priority = "Medium"
                difficulty = "Intermediate"
                estimated_minutes = 60
                why_recommended = (
                    f"Solid baseline ({round(score, 1)}%). Strengthening this topic ensures high-confidence answers during technical rounds."
                )
                completion_criteria = "Complete practice questions with zero major conceptual gaps."
                recommended_practice = "Tackle scenario-based problems and behavioral system design discussions."
        else:
            # Topic not practiced yet
            if is_missing_skill:
                priority = "Critical"
                difficulty = "Intermediate"
                estimated_minutes = 75
                why_recommended = f"Missing core requirement identified from your target job description for {role}."
                completion_criteria = "Master fundamentals and pass initial assessment practice."
                recommended_practice = "Foundational study followed by beginner-to-intermediate practical questions."
            else:
                priority = "High"
                difficulty = "Intermediate"
                estimated_minutes = 60
                why_recommended = f"Core syllabus requirement for {role} interview readiness."
                completion_criteria = "Understand theoretical foundation and solve basic interview challenges."
                recommended_practice = "Study conceptual definitions, code patterns, and common interview questions."

        prioritized_list.append({
            "topic": t_name,
            "description": base_desc,
            "learning_objective": f"Attain mastery in {t_name} concepts, real-world patterns, and standard interview problem scenarios.",
            "priority": priority,
            "difficulty": difficulty,
            "estimated_minutes": estimated_minutes,
            "why_recommended": why_recommended,
            "completion_criteria": completion_criteria,
            "recommended_practice": recommended_practice,
            "mistakes": topic_mistakes
        })

    # Sort prioritized list: Critical -> High -> Medium -> Low
    priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    prioritized_list.sort(key=lambda x: priority_order.get(x["priority"], 2))

    return prioritized_list


# =============================================================================
# 2. STUDY PLAN GENERATION (Phase 2 & 4)
# =============================================================================

def _build_topic_fallback_plan(
    topic: str,
    duration_days: int,
    daily_study_minutes: int,
    preparation_level: str,
    role: str = ""
) -> Dict[str, Any]:
    """
    Generates a structured, progressive learning curriculum for a topic or role
    with full bullet-point clarity, subtopic explanations, numbered steps, code examples,
    and measurable goals.
    """
    return build_structured_topic_curriculum(
        topic=topic,
        duration_days=duration_days,
        daily_study_minutes=daily_study_minutes,
        preparation_level=preparation_level,
        role=role
    )


def generate_study_plan(
    user_id: int,
    target_role: str = "Full Stack Developer",
    topic: Optional[str] = None,
    duration_days: int = 14,
    daily_study_minutes: int = 60,
    preparation_level: str = "Intermediate",
    resume_text: str = "",
    job_description: str = "",
    resume_skills: Optional[List[str]] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates a full personalized study plan with daily tasks, calendar dates,
    milestones, and spaced revision sessions based on actual candidate data.
    Supports single topic roadmaps (e.g. Python, SQL, React) as well as role-based curricula.
    """
    valid_durations = [7, 14, 30, 60]
    if duration_days not in valid_durations:
        duration_days = 14

    valid_minutes = [30, 60, 120, 180]
    if daily_study_minutes not in valid_minutes:
        daily_study_minutes = 60

    if preparation_level not in ["Beginner", "Intermediate", "Advanced"]:
        preparation_level = "Intermediate"

    clean_topic = (topic or "").strip()
    role = (target_role or "").strip()
    if clean_topic:
        if not role or role == "Full Stack Developer":
            role = f"{clean_topic} Specialist"
    else:
        role = role or "Full Stack Developer"

    # Step 1: Collect User Data (Optional Personalization Context)
    memory_profile = get_candidate_memory_profile(user_id)
    weak_skills = memory_profile.get("weak_topics", [])
    strong_skills = memory_profile.get("strong_topics", [])

    missing_skills = []
    try:
        gap_analysis = analyze_skill_gaps(user_id=user_id, role=role)
        crit_gaps = gap_analysis.get("critical_gaps", []) if isinstance(gap_analysis, dict) else []
        missing_skills = [g.get("skill", "") for g in crit_gaps if isinstance(g, dict)]
    except Exception as e:
        _safe_print(f"[STUDY PLANNER] Gaps calculation notice: {e}")

    readiness_data = {}
    try:
        readiness_data = calculate_readiness_score(user_id=user_id, role=role)
    except Exception as e:
        _safe_print(f"[STUDY PLANNER] Readiness profile notice: {e}")

    # Step 2: Prioritize Topics
    prioritized_topics = prioritize_learning_topics(
        user_id=user_id,
        role=role,
        weak_skills=weak_skills,
        strong_skills=strong_skills,
        resume_skills=resume_skills,
        missing_skills=missing_skills,
        readiness_data=readiness_data
    )

    recurring_mistakes = []
    for t_item in prioritized_topics:
        for m in t_item.get("mistakes", []):
            if m and m not in recurring_mistakes:
                recurring_mistakes.append(m)
    for m in memory_profile.get("recurring_mistakes", []):
        if m and m not in recurring_mistakes:
            recurring_mistakes.append(m)

    # Step 3: Groq LLM Plan Generation
    system_prompt = (
        "You are an expert technical interviewer and AI career coach at Intervexa AI. "
        "You create rigorous, personalized, and highly actionable daily interview study plans. "
        "When a specific subject or topic is requested, you focus 100% on that subject without deviating. "
        "You must respond with ONLY a valid JSON object matching the requested schema."
    )

    weak_topics_str = ", ".join([w.get("topic", str(w)) for w in weak_skills]) if weak_skills else "None recorded yet"
    strong_topics_str = ", ".join([s.get("topic", str(s)) for s in strong_skills]) if strong_skills else "None recorded yet"
    missing_skills_str = ", ".join(missing_skills) if missing_skills else "None identified"
    resume_skills_str = ", ".join(resume_skills) if resume_skills else "General technical foundation"
    mistakes_str = ", ".join(recurring_mistakes) if recurring_mistakes else "No recurring mistakes recorded"

    readiness_score_val = readiness_data.get("overall_score", 50.0) if isinstance(readiness_data, dict) else 50.0
    readiness_category = readiness_data.get("readiness_category", "Needs Preparation") if isinstance(readiness_data, dict) else "Needs Preparation"

    if clean_topic:
        subject_directive = f"""
CRITICAL FOCUS DIRECTIVE:
The user explicitly requested a dedicated learning roadmap specifically for: **"{clean_topic}"**.
Every single day and daily task MUST focus exclusively on learning, mastering, and applying **"{clean_topic}"**.
Do NOT introduce unrelated programming languages, databases, or technologies.
Structure the progression logically across the {duration_days} days:
- Early Phase: Fundamentals, syntax, primitive types, and execution model of {clean_topic}.
- Intermediate Phase: Control flow, data structures, modularity, OOP/functional patterns, error handling in {clean_topic}.
- Advanced Phase: Concurrency/async, performance optimization, design patterns, profiling, and production best practices in {clean_topic}.
- Spaced Review days (e.g. Day 4, 8, 12...): Synthesize learned concepts, solve common interview questions/puzzles in {clean_topic}.
- Final Day (Day {duration_days}): Comprehensive technical assessment / mock interview on {clean_topic}.
Target Subject: {clean_topic}
"""
    else:
        subject_directive = f"""
Target Job Role: {role}
Address core role competencies and identified weak areas.
"""

    user_prompt = f"""Generate a personalized {duration_days}-day interview preparation study plan.

{subject_directive}

Plan Duration: {duration_days} days
Daily Study Time Commitment: {daily_study_minutes} minutes/day
Preparation Level: {preparation_level}

Candidate Background & Context (Optional Personalization):
- Target Role: {role}
- Resume Skills: {resume_skills_str}
- Identified Weak Topics: {weak_topics_str}
- Missing Job Requirements: {missing_skills_str}
- Recurring Mistakes: {mistakes_str}
- Readiness Score: {readiness_score_val}% ({readiness_category})

Curriculum Guidelines & Structure Rules:
1. Create exactly {duration_days} distinct daily tasks (one for each day from day 1 to day {duration_days}).
2. Days 1 through {duration_days - 1} systematically build from core fundamentals to advanced patterns.
3. Every 4th day (e.g. Day 4, 8, 12...) MUST be a spaced revision session reinforcing previously covered topics.
4. The final day (Day {duration_days}) MUST be a comprehensive mock interview simulation and readiness checkpoint.
5. Estimated duration for each task must be {daily_study_minutes} minutes.
6. CRITICAL FORMATTING RULE: DO NOT return long unbroken paragraphs. Break all explanations into clear, readable bullet points and numbered steps.
7. Include complete structured sections for each day:
   - What You Will Learn (3-6 bullet points)
   - Topic Breakdown (subtopics with name, 2-3 sentence explanation, example, and where used)
   - Step-by-Step Learning Instructions (numbered 1., 2., 3...)
   - Practical Examples (code snippet, explanation, expected output, and use case)
   - Practice Activities (actionable bullet points)
   - Completion Goals (measurable criteria bullet points)

Return ONLY a valid JSON object with the following schema:
{{
  "plan_title": "string",
  "summary": "string (2-3 sentences overview)",
  "focus_areas": ["string"],
  "tasks": [
    {{
      "day_number": 1,
      "topic": "string (Day title)",
      "priority": "Critical" | "High" | "Medium" | "Low",
      "difficulty": "{preparation_level}",
      "estimated_minutes": {daily_study_minutes},
      "what_you_will_learn": [
        "Simple bullet point 1",
        "Simple bullet point 2",
        "Simple bullet point 3"
      ],
      "topic_breakdown": [
        {{
          "name": "Subtopic Name",
          "explanation": "Simple explanation in 2-3 sentences.",
          "example": "Practical snippet or pattern.",
          "use_case": "Where and why it is used in production."
        }}
      ],
      "learning_steps": [
        "1. Step one instructions.",
        "2. Step two instructions.",
        "3. Step three instructions."
      ],
      "practical_examples": [
        {{
          "title": "Example Title",
          "code": "working code snippet or scenario",
          "explanation": "line-by-line or simple explanation",
          "output": "expected output",
          "use_case": "real-world use case"
        }}
      ],
      "practice_activities": [
        "Actionable hands-on coding challenge or question 1",
        "Actionable challenge 2"
      ],
      "completion_goals": [
        "Measurable completion goal 1",
        "Measurable completion goal 2"
      ],
      "subtopics": ["string", "string"],
      "why_recommended": "string",
      "recommended_resources": [
        {{"title": "string", "url": "string", "type": "documentation" | "tutorial" | "practice"}}
      ]
    }}
  ]
}}
"""

    groq_tasks = []
    groq_plan_title = ""
    groq_summary = ""

    try:
        raw_resp = _call_groq(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            json_mode=True,
            max_tokens=4096,
            temperature=0.3,
            context="AI Study Plan Generation"
        )
        plan_ai = _extract_json(raw_resp)
        if isinstance(plan_ai, dict) and plan_ai.get("tasks"):
            groq_tasks = plan_ai.get("tasks", [])
            groq_plan_title = plan_ai.get("plan_title") or (
                f"{duration_days}-Day Targeted {clean_topic} Roadmap" if clean_topic else f"{duration_days}-Day Targeted {role} Study Plan"
            )
            groq_summary = plan_ai.get("summary") or (
                f"Personalized curriculum targeting {clean_topic} competencies at {preparation_level} level." if clean_topic else f"Personalized curriculum targeting {role} competencies."
            )
    except Exception as ai_err:
        _safe_print(f"[STUDY PLANNER] Groq plan generation warning: {ai_err}")

    # Fallback to dynamic progressive curriculum if Groq returned no tasks
    if not groq_tasks:
        _safe_print(f"[STUDY PLANNER] Using structured progressive fallback for: {clean_topic or role}")
        fallback_plan = _build_topic_fallback_plan(
            topic=clean_topic or role,
            duration_days=duration_days,
            daily_study_minutes=daily_study_minutes,
            preparation_level=preparation_level,
            role=role
        )
        groq_tasks = fallback_plan["tasks"]
        groq_plan_title = groq_plan_title or fallback_plan["plan_title"]
        groq_summary = groq_summary or fallback_plan["summary"]

    # Step 4: Map tasks across Duration Days
    start_date = datetime.date.today()
    end_date = start_date + datetime.timedelta(days=duration_days - 1)

    tasks_to_create = []
    for day in range(1, duration_days + 1):
        task_date = start_date + datetime.timedelta(days=day - 1)
        ai_task = None
        for t in groq_tasks:
            if t.get("day_number") == day:
                ai_task = t
                break
        if not ai_task and (day - 1) < len(groq_tasks):
            ai_task = groq_tasks[day - 1]
        elif not ai_task:
            ai_task = groq_tasks[-1] if groq_tasks else {}

        # Normalize task to ensure all structured bullet-point fields are present
        normalized_task = normalize_task_structured_fields(ai_task)

        subtopics_raw = normalized_task.get("subtopics") or [normalized_task.get("topic") or f"Core Module: Day {day}"]
        if isinstance(subtopics_raw, str):
            subtopics_raw = [s.strip() for s in subtopics_raw.split(",") if s.strip()]

        rec_resources_raw = normalized_task.get("recommended_resources") or [
            {"title": f"Study Reference: Day {day}", "url": f"https://www.google.com/search?q={clean_topic or role}+day+{day}+tutorial", "type": "documentation"}
        ]

        tasks_to_create.append({
            "day_number": day,
            "task_date": task_date.isoformat(),
            "topic": str(normalized_task.get("topic") or f"Core Study: Day {day}"),
            "subtopics": subtopics_raw,
            "description": str(normalized_task.get("description") or f"Study key interview topics for {clean_topic or role}."),
            "learning_objective": str(normalized_task.get("learning_objective") or f"Master fundamental concepts for {clean_topic or role}."),
            "explanation": str(normalized_task.get("explanation") or normalized_task.get("description") or f"Key architectural concepts for {clean_topic or role}."),
            "estimated_minutes": int(normalized_task.get("estimated_minutes") or daily_study_minutes),
            "priority": str(normalized_task.get("priority") or "Medium"),
            "difficulty": str(normalized_task.get("difficulty") or preparation_level),
            "status": "pending",
            "completion_criteria": str(normalized_task.get("completion_criteria") or "Complete practice exercises."),
            "recommended_practice": str(normalized_task.get("recommended_practice") or "Review core questions."),
            "why_recommended": str(normalized_task.get("why_recommended") or f"Core requirement for {clean_topic or role}."),
            "recommended_resources": rec_resources_raw,
            "what_you_will_learn": normalized_task.get("what_you_will_learn") or [],
            "learning_steps": normalized_task.get("learning_steps") or [],
            "practical_examples": normalized_task.get("practical_examples") or [],
            "topic_breakdown": normalized_task.get("topic_breakdown") or [],
            "practice_activities": normalized_task.get("practice_activities") or [],
            "completion_goals": normalized_task.get("completion_goals") or []
        })

    # Step 5: Persist in SQLite
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    try:
        # Archive any previous active plan for this user
        cursor.execute("""
        UPDATE study_plans
        SET status = 'archived', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND status = 'active'
        """, (user_id,))

        # Insert new active plan
        cursor.execute("""
        INSERT INTO study_plans (
            user_id, target_role, duration_days, daily_study_minutes,
            preparation_level, start_date, end_date, status, plan_title, summary,
            requested_topic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
        """, (
            user_id, role, duration_days, daily_study_minutes,
            preparation_level, start_date.isoformat(), end_date.isoformat(),
            groq_plan_title, groq_summary, clean_topic
        ))
        plan_id = cursor.lastrowid

        # Insert daily tasks with all 23 columns including structured bullet-point fields
        for t in tasks_to_create:
            cursor.execute("""
            INSERT INTO study_tasks (
                plan_id, user_id, day_number, task_date, topic, description,
                learning_objective, estimated_minutes, priority, difficulty,
                status, completion_criteria, recommended_practice, why_recommended,
                subtopics, recommended_resources, explanation,
                what_you_will_learn, learning_steps, practical_examples,
                topic_breakdown, practice_activities, completion_goals
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                plan_id, user_id, t["day_number"], t["task_date"], t["topic"],
                t["description"], t["learning_objective"], t["estimated_minutes"],
                t["priority"], t["difficulty"], t["status"], t["completion_criteria"],
                t["recommended_practice"], t["why_recommended"],
                json.dumps(t.get("subtopics") or []),
                json.dumps(t.get("recommended_resources") or []),
                t.get("explanation") or "",
                json.dumps(t.get("what_you_will_learn") or []),
                json.dumps(t.get("learning_steps") or []),
                json.dumps(t.get("practical_examples") or []),
                json.dumps(t.get("topic_breakdown") or []),
                json.dumps(t.get("practice_activities") or []),
                json.dumps(t.get("completion_goals") or [])
            ))

        # Ensure topics are recorded in study_topic_mastery
        for t in tasks_to_create:
            t_name = t["topic"]
            cursor.execute("""
            INSERT OR IGNORE INTO study_topic_mastery (
                user_id, topic, total_attempts, completed_tasks_count,
                latest_score, average_score, mastery_status
            ) VALUES (?, ?, 0, 0, 0.0, 0.0, 'Not Started')
            """, (user_id, t_name))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        _safe_print(f"[STUDY PLANNER ERROR] Database insert failed: {e}")
        raise e

    conn.close()

    # Step 6: Return comprehensive overview
    return get_study_plan_overview(user_id, plan_id, db_path=db_path)


# =============================================================================
# 3. STUDY PLAN OVERVIEW & DASHBOARD METRICS (Phase 4 & 6)
# =============================================================================

def delete_study_plan(user_id: int, plan_id: Optional[int] = None, db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Permanently deletes a specific study plan and its associated tasks/activities for the authenticated user.
    If plan_id is provided, deletes only that specific plan (enforcing user ownership).
    If plan_id is None, finds and deletes the user's currently active study plan.
    Does not delete unrelated roadmaps or other candidate data.
    Runs atomically inside a database transaction.
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    try:
        target_id = plan_id

        # If plan_id is not specified, resolve to the user's currently active plan
        if target_id is None:
            cursor.execute(
                "SELECT id FROM study_plans WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
                (user_id,)
            )
            active_row = cursor.fetchone()
            if not active_row:
                return {
                    "success": False,
                    "error": "No roadmap found.",
                    "message": "No active learning roadmap found to delete.",
                    "code": "NOT_FOUND"
                }
            target_id = active_row[0]

        # Verify the roadmap exists
        cursor.execute("SELECT id, user_id FROM study_plans WHERE id = ?", (target_id,))
        plan_row = cursor.fetchone()
        if not plan_row:
            return {
                "success": False,
                "error": "Roadmap not found.",
                "message": f"Learning roadmap #{target_id} does not exist or has already been deleted.",
                "code": "NOT_FOUND"
            }

        # Verify user ownership
        owner_id = plan_row[1] if isinstance(plan_row, tuple) else plan_row["user_id"]
        if int(owner_id) != int(user_id):
            return {
                "success": False,
                "error": "Forbidden.",
                "message": "You do not have permission to delete this learning roadmap.",
                "code": "FORBIDDEN"
            }

        _safe_print(f"[STUDY PLANNER SERVICE] Deleting roadmap #{target_id} for user #{user_id}")

        # Inside atomic transaction:
        # 1. Delete associated learning activities for tasks of this plan
        cursor.execute(
            "DELETE FROM learning_activities WHERE user_id = ? AND task_id IN (SELECT id FROM study_tasks WHERE plan_id = ?)",
            (user_id, target_id)
        )

        # 2. Delete study tasks for this plan
        cursor.execute("DELETE FROM study_tasks WHERE plan_id = ? AND user_id = ?", (target_id, user_id))
        deleted_tasks = cursor.rowcount

        # 3. Delete the study plan itself
        cursor.execute("DELETE FROM study_plans WHERE id = ? AND user_id = ?", (target_id, user_id))

        # 4. If user has no more active study plans remaining, clean up legacy learning_roadmaps table
        cursor.execute("SELECT COUNT(*) FROM study_plans WHERE user_id = ? AND status = 'active'", (user_id,))
        active_remaining = cursor.fetchone()[0]
        if active_remaining == 0:
            cursor.execute("DELETE FROM learning_roadmaps WHERE user_id = ?", (user_id,))

        conn.commit()
        _safe_print(f"[STUDY PLANNER SERVICE] Successfully deleted plan #{target_id} ({deleted_tasks} tasks removed)")
        return {
            "success": True,
            "message": "Learning roadmap deleted successfully.",
            "deleted_plan_id": target_id,
            "deleted_tasks_count": deleted_tasks
        }
    except Exception as e:
        conn.rollback()
        _safe_print(f"[STUDY PLANNER ERROR] Delete failed for plan #{plan_id}: {e}")
        raise e
    finally:
        conn.close()


def get_study_plan_overview(user_id: int, plan_id: Optional[int] = None, db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns full plan metrics, progress tracking, day/task schedules, streak calculation,
    and topic mastery breakdowns for the dashboard.
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # Retrieve plan
    if plan_id:
        cursor.execute("SELECT * FROM study_plans WHERE id = ? AND user_id = ?", (plan_id, user_id))
    else:
        cursor.execute(
            "SELECT * FROM study_plans WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
            (user_id,)
        )
    plan_row = cursor.fetchone()

    if not plan_row:
        conn.close()
        return {
            "has_active_plan": False,
            "message": "No active study plan found. Please generate a personalized plan."
        }

    col_names = [d[0] for d in cursor.description]
    plan_dict = dict(zip(col_names, plan_row))
    cur_plan_id = plan_dict["id"]
    target_role = plan_dict["target_role"]
    requested_topic = plan_dict.get("requested_topic") or ""
    duration_days = plan_dict["duration_days"]
    daily_study_minutes = plan_dict["daily_study_minutes"]
    preparation_level = plan_dict["preparation_level"]
    start_date = plan_dict["start_date"]
    end_date = plan_dict["end_date"]
    plan_status = plan_dict["status"]
    plan_title = plan_dict.get("plan_title") or (
        f"{duration_days}-Day Targeted {requested_topic} Roadmap" if requested_topic else f"{duration_days}-Day Targeted {target_role} Study Plan"
    )
    summary = plan_dict.get("summary") or f"Personalized interview preparation curriculum for {requested_topic or target_role}."

    # Fetch all tasks for this plan
    cursor.execute("""
    SELECT id, plan_id, user_id, day_number, task_date, topic, description,
           learning_objective, estimated_minutes, priority, difficulty, status,
           completion_criteria, recommended_practice, why_recommended,
           rescheduled_date, skip_reason, completed_at, created_at,
           subtopics, recommended_resources, explanation,
           what_you_will_learn, learning_steps, practical_examples, topic_breakdown,
           practice_activities, completion_goals
    FROM study_tasks
    WHERE plan_id = ?
    ORDER BY day_number ASC, id ASC
    """, (cur_plan_id,))
    task_rows = cursor.fetchall()

    tasks = []
    total_tasks = len(task_rows)
    completed_tasks = 0
    pending_tasks = 0
    skipped_tasks = 0
    rescheduled_tasks = 0
    total_est_minutes = 0
    completed_minutes = 0

    priority_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    today_str = datetime.date.today().isoformat()
    today_tasks = []

    for r in task_rows:
        t_id = r[0]
        day_num = r[3]
        t_date = r[4]
        topic = r[5]
        desc = r[6]
        learn_obj = r[7]
        est_mins = r[8] or daily_study_minutes
        priority = r[9] or "Medium"
        difficulty = r[10] or "Intermediate"
        status = r[11] or "pending"
        criteria = r[12]
        rec_practice = r[13]
        why_rec = r[14]
        resched_date = r[15]
        skip_rsn = r[16]
        comp_at = r[17]

        # Extract subtopics
        subtopics = []
        if len(r) > 19 and r[19]:
            try:
                subtopics = json.loads(r[19]) if isinstance(r[19], str) else r[19]
            except Exception:
                subtopics = [str(r[19])]

        # Extract recommended resources
        rec_resources = []
        if len(r) > 20 and r[20]:
            try:
                rec_resources = json.loads(r[20]) if isinstance(r[20], str) else r[20]
            except Exception:
                rec_resources = []

        # Extract explanation
        explanation = r[21] if len(r) > 21 and r[21] else ""

        # Extract structured bullet fields (indices 22..27)
        what_you_will_learn = []
        if len(r) > 22 and r[22]:
            try:
                what_you_will_learn = json.loads(r[22]) if isinstance(r[22], str) else r[22]
            except Exception:
                what_you_will_learn = []

        learning_steps = []
        if len(r) > 23 and r[23]:
            try:
                learning_steps = json.loads(r[23]) if isinstance(r[23], str) else r[23]
            except Exception:
                learning_steps = []

        practical_examples = []
        if len(r) > 24 and r[24]:
            try:
                practical_examples = json.loads(r[24]) if isinstance(r[24], str) else r[24]
            except Exception:
                practical_examples = []

        topic_breakdown = []
        if len(r) > 25 and r[25]:
            try:
                topic_breakdown = json.loads(r[25]) if isinstance(r[25], str) else r[25]
            except Exception:
                topic_breakdown = []

        practice_activities = []
        if len(r) > 26 and r[26]:
            try:
                practice_activities = json.loads(r[26]) if isinstance(r[26], str) else r[26]
            except Exception:
                practice_activities = []

        completion_goals = []
        if len(r) > 27 and r[27]:
            try:
                completion_goals = json.loads(r[27]) if isinstance(r[27], str) else r[27]
            except Exception:
                completion_goals = []

        total_est_minutes += est_mins
        priority_counts[priority] = priority_counts.get(priority, 0) + 1

        if status == "completed":
            completed_tasks += 1
            completed_minutes += est_mins
        elif status == "skipped":
            skipped_tasks += 1
        elif status == "rescheduled":
            rescheduled_tasks += 1
        else:
            pending_tasks += 1

        raw_task_dict = {
            "id": t_id,
            "plan_id": cur_plan_id,
            "day_number": day_num,
            "task_date": t_date,
            "topic": topic,
            "subtopics": subtopics,
            "description": desc,
            "learning_objective": learn_obj,
            "explanation": explanation,
            "estimated_minutes": est_mins,
            "priority": priority,
            "difficulty": difficulty,
            "status": status,
            "completion_criteria": criteria,
            "recommended_practice": rec_practice,
            "why_recommended": why_rec,
            "recommended_resources": rec_resources,
            "rescheduled_date": resched_date,
            "skip_reason": skip_rsn,
            "completed_at": comp_at,
            "is_today": (t_date == today_str),
            "what_you_will_learn": what_you_will_learn,
            "learning_steps": learning_steps,
            "practical_examples": practical_examples,
            "topic_breakdown": topic_breakdown,
            "practice_activities": practice_activities,
            "completion_goals": completion_goals
        }
        # Run normalization to guarantee clean bullet-point fields on every task
        task_dict = normalize_task_structured_fields(raw_task_dict)
        tasks.append(task_dict)

        if t_date == today_str:
            today_tasks.append(task_dict)

    # If no tasks are specifically for today, populate today_tasks with the next upcoming pending tasks
    if not today_tasks:
        upcoming_pending = [t for t in tasks if t["status"] == "pending"]
        today_tasks = upcoming_pending[:1] if upcoming_pending else (tasks[:1] if tasks else [])

    completion_rate_pct = round((completed_tasks / total_tasks * 100.0), 1) if total_tasks > 0 else 0.0

    # Calculate Study Streak (consecutive days of completed tasks or activities)
    cursor.execute("""
    SELECT DISTINCT DATE(completed_at)
    FROM study_tasks
    WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
    UNION
    SELECT DISTINCT DATE(created_at)
    FROM learning_activities
    WHERE user_id = ?
    ORDER BY 1 DESC
    """, (user_id, user_id))
    active_dates = [row[0] for row in cursor.fetchall() if row[0]]

    streak_days = 0
    if active_dates:
        check_date = datetime.date.today()
        # Allow streak to count if today or yesterday was active
        date_objs = set()
        for d_str in active_dates:
            try:
                date_objs.add(datetime.date.fromisoformat(d_str))
            except Exception:
                pass

        if check_date in date_objs or (check_date - datetime.timedelta(days=1)) in date_objs:
            curr = check_date if check_date in date_objs else (check_date - datetime.timedelta(days=1))
            while curr in date_objs:
                streak_days += 1
                curr -= datetime.timedelta(days=1)

    # Topic Mastery Summary
    cursor.execute("""
    SELECT topic, total_attempts, completed_tasks_count, latest_score, average_score, mastery_status, last_practiced_at
    FROM study_topic_mastery
    WHERE user_id = ?
    ORDER BY average_score DESC
    """, (user_id,))
    mastery_rows = cursor.fetchall()

    mastery_list = []
    mastery_summary_counts = {
        "Mastered": 0,
        "Proficient": 0,
        "Learning": 0,
        "Needs Revision": 0,
        "Not Started": 0
    }

    for m in mastery_rows:
        m_topic = m[0]
        m_status = m[5] or "Not Started"
        mastery_summary_counts[m_status] = mastery_summary_counts.get(m_status, 0) + 1
        mastery_list.append({
            "topic": m_topic,
            "total_attempts": m[1],
            "completed_tasks_count": m[2],
            "latest_score": round(m[3], 1),
            "average_score": round(m[4], 1),
            "mastery_status": m_status,
            "last_practiced_at": m[6]
        })

    # Days remaining calculation
    try:
        end_d = datetime.date.fromisoformat(end_date)
        today_d = datetime.date.today()
        days_remaining = max(0, (end_d - today_d).days + 1)
    except Exception:
        days_remaining = max(0, duration_days - completed_tasks)

    conn.close()

    return {
        "has_active_plan": True,
        "plan_id": cur_plan_id,
        "id": cur_plan_id,
        "plan_title": plan_title,
        "summary": summary,
        "target_role": target_role,
        "requested_topic": requested_topic,
        "duration_days": duration_days,
        "daily_study_minutes": daily_study_minutes,
        "preparation_level": preparation_level,
        "start_date": start_date,
        "end_date": end_date,
        "plan_status": plan_status,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "skipped_tasks": skipped_tasks,
        "rescheduled_tasks": rescheduled_tasks,
        "completion_rate_pct": completion_rate_pct,
        "total_estimated_minutes": total_est_minutes,
        "completed_minutes": completed_minutes,
        "streak_days": streak_days,
        "days_remaining": days_remaining,
        "priority_breakdown": priority_counts,
        "mastery_summary": mastery_summary_counts,
        "today_tasks": today_tasks,
        "tasks": tasks,
        "topic_mastery_list": mastery_list
    }


# =============================================================================
# 4. TASK ACTIONS: COMPLETE, SKIP, RESCHEDULE (Phase 4)
# =============================================================================

def update_task_status(
    user_id: int,
    task_id: int,
    status: str,
    skip_reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Updates a study task status (completed, pending, skipped, rescheduled).
    Synchronizes topic mastery records and adapts the plan if necessary.
    """
    allowed_statuses = ["completed", "pending", "skipped", "rescheduled"]
    if status not in allowed_statuses:
        raise ValueError(f"Invalid status '{status}'. Must be one of {allowed_statuses}")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, plan_id, topic, status
    FROM study_tasks
    WHERE id = ? AND user_id = ?
    """, (task_id, user_id))
    task_row = cursor.fetchone()

    if not task_row:
        conn.close()
        raise ValueError(f"Study task #{task_id} not found for this user.")

    topic = task_row[2]
    old_status = task_row[3]

    if status == "completed":
        cursor.execute("""
        UPDATE study_tasks
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, skip_reason = NULL
        WHERE id = ?
        """, (task_id,))

        # Update study_topic_mastery
        cursor.execute("""
        SELECT total_attempts, completed_tasks_count, average_score
        FROM study_topic_mastery
        WHERE user_id = ? AND topic = ?
        """, (user_id, topic))
        mastery_row = cursor.fetchone()

        if mastery_row:
            new_comp = mastery_row[1] + 1
            # If not yet scored, baseline completion confers Developing/Learning
            avg_sc = mastery_row[2] or 70.0
            new_status = "Proficient" if avg_sc >= 75.0 else "Learning"
            cursor.execute("""
            UPDATE study_topic_mastery
            SET completed_tasks_count = ?,
                average_score = CASE WHEN average_score = 0 THEN 70.0 ELSE average_score END,
                mastery_status = ?,
                last_practiced_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND topic = ?
            """, (new_comp, new_status, user_id, topic))
        else:
            cursor.execute("""
            INSERT INTO study_topic_mastery (
                user_id, topic, total_attempts, completed_tasks_count,
                latest_score, average_score, mastery_status, last_practiced_at
            ) VALUES (?, ?, 1, 1, 70.0, 70.0, 'Learning', CURRENT_TIMESTAMP)
            """, (user_id, topic))

    elif status == "skipped":
        cursor.execute("""
        UPDATE study_tasks
        SET status = 'skipped', skip_reason = ?, completed_at = NULL
        WHERE id = ?
        """, (skip_reason or "Skipped by user", task_id))

    elif status == "pending":
        cursor.execute("""
        UPDATE study_tasks
        SET status = 'pending', completed_at = NULL, skip_reason = NULL
        WHERE id = ?
        """, (task_id,))

    conn.commit()
    conn.close()

    # Check for plan adaptation trigger (e.g., multiple skips)
    if status == "skipped":
        _check_and_trigger_skip_adaptation(user_id)

    return {"success": True, "task_id": task_id, "new_status": status, "topic": topic}


def reschedule_study_task(user_id: int, task_id: int, new_date: str) -> Dict[str, Any]:
    """Reschedules a task to a target calendar date."""
    try:
        # Validate ISO date format
        datetime.date.fromisoformat(new_date)
    except Exception:
        raise ValueError(f"Invalid date format '{new_date}'. Must be YYYY-MM-DD.")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM study_tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise ValueError(f"Task #{task_id} not found.")

    cursor.execute("""
    UPDATE study_tasks
    SET task_date = ?, rescheduled_date = ?, status = 'rescheduled'
    WHERE id = ? AND user_id = ?
    """, (new_date, new_date, task_id, user_id))

    conn.commit()
    conn.close()

    return {"success": True, "task_id": task_id, "rescheduled_date": new_date}


def _check_and_trigger_skip_adaptation(user_id: int):
    """If user has skipped 2 or more recent tasks, auto-adjust upcoming priorities."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT COUNT(*)
        FROM study_tasks
        WHERE user_id = ? AND status = 'skipped'
        """, (user_id,))
        skipped_count = cursor.fetchone()[0]
        conn.close()

        if skipped_count >= 2:
            adapt_existing_study_plan(user_id, reason="skipped_tasks", metadata={"skipped_count": skipped_count})
    except Exception as e:
        _safe_print(f"[STUDY PLANNER] Skip adaptation check notice: {e}")


# =============================================================================
# 5. AI LEARNING ASSISTANT (Phase 5)
# =============================================================================

def generate_ai_learning_content(
    topic: str,
    role: str = "Full Stack Developer",
    content_type: str = "explain",
    user_answer: Optional[str] = None,
    question_id: Optional[str] = None,
    context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Groq LLM-powered interactive learning assistant that provides:
    1. explain: In-depth conceptual breakdown with real-world examples and common interview pitfalls.
    2. examples: Practical code implementations and real-world architectures.
    3. mcqs: 5 tailored multiple-choice interview questions with full explanations.
    4. exercise: Real-world coding challenge / system design exercise.
    5. evaluate_answer: Objective scoring (0-100), breakdown of strengths, mistakes, and ideal answer.
    """
    clean_topic = (topic or "").strip() or "Core Technical Concepts"
    clean_role = (role or "").strip() or "Full Stack Developer"

    # ─────────────────────────────────────────────────────────────
    # ACTION: EXPLAIN CONCEPT
    # ─────────────────────────────────────────────────────────────
    if content_type == "explain":
        system_prompt = (
            "You are an elite Staff Software Engineer and Technical Interview Coach at Intervexa AI. "
            "Explain technical topics with exceptional clarity, high architectural depth, real-world relevance, "
            "and direct alignment with technical interview expectations. "
            "Respond in strictly valid JSON format."
        )
        user_prompt = f"""
Provide an in-depth, master-level interview study guide for:
Topic: "{clean_topic}"
Target Role: "{clean_role}"

Return a JSON object with this exact structure:
{{
  "topic": "{clean_topic}",
  "role": "{clean_role}",
  "overview": "Clear 2-3 sentence summary of what this topic is and why tech interviewers care about it.",
  "core_concepts": [
    {{"title": "Concept 1 Name", "explanation": "Clear explanation of how it works under the hood.", "key_takeaway": "Bullet takeaway"}},
    {{"title": "Concept 2 Name", "explanation": "Clear explanation of how it works under the hood.", "key_takeaway": "Bullet takeaway"}},
    {{"title": "Concept 3 Name", "explanation": "Clear explanation of how it works under the hood.", "key_takeaway": "Bullet takeaway"}}
  ],
  "common_pitfalls_and_mistakes": [
    "Common misunderstanding or mistake candidates make in interviews",
    "Suboptimal pattern or anti-pattern to avoid",
    "Edge case frequently tested by senior interviewers"
  ],
  "interview_pro_tips": [
    "Strategic tip on how to structure your response when asked about this topic",
    "Key architectural trade-off to mention to demonstrate senior engineering depth"
  ]
}}
"""
        try:
            raw_resp = _call_groq([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], json_mode=True, temperature=0.25, context="AI Learning Assistant - Explain")
            parsed = _extract_json(raw_resp)
            if parsed and parsed.get("overview"):
                return {"success": True, "type": "explain", "data": parsed}
        except Exception as e:
            _safe_print(f"[AI LEARNING ASSISTANT] Groq explain fallback: {e}")

        # Deterministic Fallback
        return {
            "success": True,
            "type": "explain",
            "data": {
                "topic": clean_topic,
                "role": clean_role,
                "overview": f"{clean_topic} is a core competency for {clean_role} positions, frequently evaluated to measure fundamental understanding, design trade-offs, and system resilience.",
                "core_concepts": [
                    {
                        "title": "Fundamental Architecture",
                        "explanation": f"Understanding how {clean_topic} functions at the operational level, including data flow, state guarantees, and performance boundaries.",
                        "key_takeaway": "Always articulate the computational trade-offs (time vs memory vs latency)."
                    },
                    {
                        "title": "Common Implementation Patterns",
                        "explanation": "Standard design patterns, idioms, and industry standards used to implement scalable solutions.",
                        "key_takeaway": "Cite modern production best practices rather than legacy approaches."
                    },
                    {
                        "title": "Failure Modes & Edge Cases",
                        "explanation": "Handling concurrency, null/empty states, resource contention, and fault-tolerance.",
                        "key_takeaway": "Proactively mention error handling and defensive coding in interviews."
                    }
                ],
                "common_pitfalls_and_mistakes": [
                    "Focusing solely on syntax rather than underlying architectural trade-offs.",
                    "Neglecting edge cases such as network latency, concurrency, and volume spikes.",
                    "Failing to discuss monitoring, logging, and maintainability in production."
                ],
                "interview_pro_tips": [
                    "Structure your answer using the STAR or Problem-Option-Tradeoff method.",
                    "Offer concrete metrics or production experiences when answering technical questions."
                ]
            }
        }

    # ─────────────────────────────────────────────────────────────
    # ACTION: CODE EXAMPLES
    # ─────────────────────────────────────────────────────────────
    elif content_type == "examples":
        system_prompt = (
            "You are a Senior Principal Engineer. Provide production-ready, clean, well-commented code snippets "
            "and concrete architectural examples for interview preparation. Respond in strictly valid JSON format."
        )
        user_prompt = f"""
Provide realistic code and architecture examples for:
Topic: "{clean_topic}"
Role: "{clean_role}"

Return a JSON object with this exact structure:
{{
  "topic": "{clean_topic}",
  "examples": [
    {{
      "title": "Production-Grade Implementation Pattern",
      "language": "python or javascript or sql depending on topic",
      "code": "Clean, runnable, well-commented code snippet",
      "explanation": "Walkthrough of what the code does and why it is written this way.",
      "best_practices": ["Best practice 1", "Best practice 2"]
    }},
    {{
      "title": "Handling Edge Cases & Error Boundaries",
      "language": "python or javascript or sql depending on topic",
      "code": "Defensive code handling failures or edge cases",
      "explanation": "Explanation of defensive mechanisms and performance implications.",
      "best_practices": ["Defensive practice 1", "Defensive practice 2"]
    }}
  ]
}}
"""
        try:
            raw_resp = _call_groq([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], json_mode=True, temperature=0.25, context="AI Learning Assistant - Examples")
            parsed = _extract_json(raw_resp)
            if parsed and parsed.get("examples"):
                return {"success": True, "type": "examples", "data": parsed}
        except Exception as e:
            _safe_print(f"[AI LEARNING ASSISTANT] Groq examples fallback: {e}")

        # Deterministic Fallback
        return {
            "success": True,
            "type": "examples",
            "data": {
                "topic": clean_topic,
                "examples": [
                    {
                        "title": f"Standard {clean_topic} Solution",
                        "language": "python" if "python" in clean_role.lower() else "javascript",
                        "code": "# Production Pattern Implementation\ndef solve_interview_problem(data):\n    # 1. Validate inputs\n    if not data:\n        return None\n    # 2. Optimized processing with O(1) lookups\n    seen = set()\n    for item in data:\n        if item in seen:\n            return item\n        seen.add(item)\n    return None",
                        "explanation": "Demonstrates defensive input checking, hashset-based lookups, and clear control flow.",
                        "best_practices": ["Prefer linear time complexity O(n)", "Protect against None/undefined inputs"]
                    }
                ]
            }
        }

    # ─────────────────────────────────────────────────────────────
    # ACTION: 5 MULTIPLE CHOICE QUESTIONS (MCQs)
    # ─────────────────────────────────────────────────────────────
    elif content_type == "mcqs":
        system_prompt = (
            "You are a technical interviewer drafting 5 challenging, high-yield Multiple Choice Questions "
            "for technical interview candidates. Questions must test deep understanding, tricky edge cases, and "
            "architectural principles. Respond in strictly valid JSON format."
        )
        user_prompt = f"""
Generate 5 Multiple Choice Questions for:
Topic: "{clean_topic}"
Role: "{clean_role}"

Return a JSON object with this exact structure:
{{
  "topic": "{clean_topic}",
  "questions": [
    {{
      "id": 1,
      "question": "Clear, technically rigorous interview question text?",
      "options": [
        "A) Option A text",
        "B) Option B text",
        "C) Option C text",
        "D) Option D text"
      ],
      "correct_answer": "B",
      "explanation": "Detailed explanation of why B is correct, and why other options are suboptimal or incorrect.",
      "tested_concept": "Specific concept tested"
    }}
  ]
}}
"""
        try:
            raw_resp = _call_groq([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], json_mode=True, temperature=0.3, context="AI Learning Assistant - MCQs")
            parsed = _extract_json(raw_resp)
            if parsed and isinstance(parsed.get("questions"), list) and len(parsed["questions"]) >= 3:
                return {"success": True, "type": "mcqs", "data": parsed}
        except Exception as e:
            _safe_print(f"[AI LEARNING ASSISTANT] Groq MCQs fallback: {e}")

        # Deterministic Fallback MCQs
        return {
            "success": True,
            "type": "mcqs",
            "data": {
                "topic": clean_topic,
                "questions": [
                    {
                        "id": 1,
                        "question": f"When implementing {clean_topic} in a high-scale production system, what is the most critical consideration?",
                        "options": [
                            "A) Maximizing memory consumption to accelerate CPU caches",
                            "B) Ensuring idempotency, safe concurrency, and low latency",
                            "C) Disabling all database indexing to decrease write overhead",
                            "D) Relying exclusively on client-side state without backend validation"
                        ],
                        "correct_answer": "B",
                        "explanation": "In production systems, idempotency prevents duplicate side-effects during network retries, and concurrency control prevents race conditions.",
                        "tested_concept": "High-scale production reliability"
                    },
                    {
                        "id": 2,
                        "question": f"Which of the following is considered an anti-pattern when working with {clean_topic}?",
                        "options": [
                            "A) Writing unit tests for critical edge cases",
                            "B) Performing N+1 queries or unbounded operations without pagination",
                            "C) Using environment variables for secret credentials",
                            "D) Encapsulating business logic in dedicated service layers"
                        ],
                        "correct_answer": "B",
                        "explanation": "Unbounded operations or N+1 queries result in severe performance degradation and database thread pool exhaustion.",
                        "tested_concept": "Performance anti-patterns"
                    },
                    {
                        "id": 3,
                        "question": f"How should you handle unexpected runtime exceptions during {clean_topic} execution?",
                        "options": [
                            "A) Silently suppress the exception with an empty try/except block",
                            "B) Crash the entire process without logging",
                            "C) Catch specific exceptions, log structured diagnostic context, and return a standardized error response",
                            "D) Expose internal database stack traces directly to the API caller"
                        ],
                        "correct_answer": "C",
                        "explanation": "Catching specific errors and logging structured metadata ensures system resilience and observability while protecting security.",
                        "tested_concept": "Robust error handling"
                    },
                    {
                        "id": 4,
                        "question": f"What is the primary advantage of decoupling modules related to {clean_topic}?",
                        "options": [
                            "A) Increases monolithic dependency coupling",
                            "B) Enables independent testing, easier refactoring, and modular scalability",
                            "C) Doubles the number of required database instances",
                            "D) Bypasses authentication security policies"
                        ],
                        "correct_answer": "B",
                        "explanation": "Decoupling promotes the Single Responsibility Principle and simplifies unit testing, maintenance, and scale.",
                        "tested_concept": "Modular software design"
                    },
                    {
                        "id": 5,
                        "question": f"In a technical interview, when asked to optimize a solution for {clean_topic}, what should you do first?",
                        "options": [
                            "A) Immediately write code without asking any clarifying questions",
                            "B) State the time and space complexity of the baseline approach and discuss trade-offs with the interviewer",
                            "C) Claim that micro-optimizations never matter in software engineering",
                            "D) Change the subject to a completely different language"
                        ],
                        "correct_answer": "B",
                        "explanation": "Top-tier candidates analyze Big-O complexity first, communicate potential trade-offs, and align with the interviewer before writing optimized code.",
                        "tested_concept": "Interview optimization methodology"
                    }
                ]
            }
        }

    # ─────────────────────────────────────────────────────────────
    # ACTION: PRACTICAL EXERCISE / CODING CHALLENGE
    # ─────────────────────────────────────────────────────────────
    elif content_type == "exercise":
        system_prompt = (
            "You are a technical interview problem setter. Generate a realistic, practical coding or architecture "
            "exercise for a candidate practicing this topic. Respond in strictly valid JSON format."
        )
        user_prompt = f"""
Generate an interview exercise for:
Topic: "{clean_topic}"
Role: "{clean_role}"

Return a JSON object with this exact structure:
{{
  "topic": "{clean_topic}",
  "exercise_title": "Practical Scenario / Coding Challenge Title",
  "difficulty": "Intermediate",
  "problem_statement": "Clear problem statement outlining requirements, input/output, and constraints.",
  "starter_code": "Boilerplate code or SQL schema to get started",
  "expected_solution_hints": [
    "Hint 1: Think about edge cases such as empty inputs",
    "Hint 2: How can you optimize time complexity to O(N)?"
  ],
  "sample_test_case": {{
    "input": "Sample input representation",
    "expected_output": "Sample expected output"
  }}
}}
"""
        try:
            raw_resp = _call_groq([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], json_mode=True, temperature=0.25, context="AI Learning Assistant - Exercise")
            parsed = _extract_json(raw_resp)
            if parsed and parsed.get("problem_statement"):
                return {"success": True, "type": "exercise", "data": parsed}
        except Exception as e:
            _safe_print(f"[AI LEARNING ASSISTANT] Groq exercise fallback: {e}")

        # Deterministic Fallback Exercise
        return {
            "success": True,
            "type": "exercise",
            "data": {
                "topic": clean_topic,
                "exercise_title": f"{clean_topic} Interview Challenge",
                "difficulty": "Intermediate",
                "problem_statement": (
                    f"Design and implement a clean, resilient solution for {clean_topic} handling standard inputs, "
                    "protecting against edge cases, and minimizing computational complexity."
                ),
                "starter_code": "def process_solution(input_data):\n    # TODO: Implement your solution here\n    pass",
                "expected_solution_hints": [
                    "Validate the input for None/empty edge cases.",
                    "Strive for optimal Big-O time and space complexity.",
                    "Add inline comments explaining your architectural reasoning."
                ],
                "sample_test_case": {
                    "input": "[1, 2, 3, 2, 1]",
                    "expected_output": "Processed Result"
                }
            }
        }

    # ─────────────────────────────────────────────────────────────
    # ACTION: EVALUATE CANDIDATE ANSWER
    # ─────────────────────────────────────────────────────────────
    elif content_type == "evaluate_answer":
        if not user_answer or not str(user_answer).strip():
            return {
                "success": False,
                "error": "Answer cannot be empty."
            }

        system_prompt = (
            "You are an objective, encouraging, and rigorous Technical Interview Evaluator at Intervexa AI. "
            "Evaluate the candidate's answer thoroughly. Provide a fair score from 0 to 100, "
            "highlighting concrete strengths, identified mistakes or misconceptions, and a model ideal answer. "
            "Respond in strictly valid JSON format."
        )
        user_prompt = f"""
Evaluate this interview answer:
Topic: "{clean_topic}"
Role: "{clean_role}"
Candidate's Answer:
\"\"\"{user_answer}\"\"\"

Return a JSON object with this exact structure:
{{
  "score": 82,
  "mastery_level": "Proficient",
  "strengths": [
    "Specific strength or accurate concept mentioned",
    "Good engineering intuition"
  ],
  "mistakes": [
    "Specific gap, omission, or misunderstanding in the answer"
  ],
  "missing_concepts": [
    "Key concept that would elevate this to a top 10% answer"
  ],
  "improvement_feedback": "Constructive 2-3 sentence feedback explaining exactly how to answer this next time.",
  "ideal_answer": "Complete, articulate, production-grade model answer demonstrating Staff Engineer depth."
}}
"""
        try:
            raw_resp = _call_groq([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], json_mode=True, temperature=0.2, context="AI Learning Assistant - Evaluate")
            parsed = _extract_json(raw_resp)
            if parsed and parsed.get("score") is not None:
                # Ensure score is normalized
                score_val = normalize_score_pct(parsed["score"])
                parsed["score"] = score_val
                if score_val >= 85:
                    parsed["mastery_level"] = "Mastered"
                elif score_val >= 75:
                    parsed["mastery_level"] = "Proficient"
                elif score_val >= 60:
                    parsed["mastery_level"] = "Learning"
                else:
                    parsed["mastery_level"] = "Needs Revision"
                return {"success": True, "type": "evaluation", "data": parsed}
        except Exception as e:
            _safe_print(f"[AI LEARNING ASSISTANT] Groq evaluation fallback: {e}")

        # Deterministic Fallback Evaluation
        word_count = len(str(user_answer).split())
        score_val = 78.0 if word_count >= 25 else 55.0
        m_level = "Proficient" if score_val >= 75 else "Needs Revision"

        return {
            "success": True,
            "type": "evaluation",
            "data": {
                "score": score_val,
                "mastery_level": m_level,
                "strengths": [
                    "Directly addressed the core question prompt.",
                    "Demonstrated awareness of practical implementation concepts."
                ],
                "mistakes": [
                    "Could elaborate further on edge case handling and architectural trade-offs."
                ] if word_count < 35 else [],
                "missing_concepts": [
                    "Discussing production performance metrics and monitoring."
                ],
                "improvement_feedback": (
                    f"Good foundational response for {clean_topic}. In a live interview, back up your points with "
                    "a concrete example from a past project or explicitly state time and memory trade-offs."
                ),
                "ideal_answer": (
                    f"A comprehensive answer for {clean_topic} defines the core mechanism, provides a step-by-step "
                    "architectural walkthrough, highlights error boundaries and concurrency guarantees, and specifies "
                    "how to monitor and scale the solution in production."
                )
            }
        }

    return {"success": False, "error": f"Unknown content_type '{content_type}'."}


# =============================================================================
# 6. LEARNING ACTIVITY TRACKING & MASTERY SYNCHRONIZATION (Phase 6)
# =============================================================================

def record_learning_activity(
    user_id: int,
    task_id: Optional[int],
    topic: str,
    activity_type: str,
    practice_score: float,
    total_questions: int = 0,
    correct_answers: int = 0,
    activity_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Records an interactive study session (e.g. MCQ quiz, coding challenge, QA evaluation)
    and updates topic mastery progression in real time.
    """
    clean_score = normalize_score_pct(practice_score)
    clean_topic = (topic or "").strip() or "Core Technical Concepts"

    conn = get_db_connection()
    cursor = conn.cursor()

    data_json = json.dumps(activity_data or {})

    cursor.execute("""
    INSERT INTO learning_activities (
        user_id, task_id, topic, activity_type, practice_score,
        total_questions, correct_answers, activity_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, task_id, clean_topic, activity_type, clean_score,
        total_questions, correct_answers, data_json
    ))
    activity_id = cursor.lastrowid

    # Update or insert into study_topic_mastery
    cursor.execute("""
    SELECT id, total_attempts, completed_tasks_count, latest_score, average_score
    FROM study_topic_mastery
    WHERE user_id = ? AND topic = ?
    """, (user_id, clean_topic))
    mastery_row = cursor.fetchone()

    new_mastery_status = "Learning"
    if mastery_row:
        m_id, prev_attempts, comp_tasks, prev_latest, prev_avg = mastery_row
        new_attempts = prev_attempts + 1
        new_avg = round(((prev_avg * prev_attempts) + clean_score) / new_attempts, 1)

        if new_avg >= 85.0 and new_attempts >= 2:
            new_mastery_status = "Mastered"
        elif new_avg >= 75.0:
            new_mastery_status = "Proficient"
        elif new_avg >= 60.0:
            new_mastery_status = "Learning"
        else:
            new_mastery_status = "Needs Revision"

        cursor.execute("""
        UPDATE study_topic_mastery
        SET total_attempts = ?,
            latest_score = ?,
            average_score = ?,
            mastery_status = ?,
            last_practiced_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (new_attempts, clean_score, new_avg, new_mastery_status, m_id))
    else:
        new_avg = clean_score
        if clean_score >= 85.0:
            new_mastery_status = "Proficient" # Needs at least 2 attempts to be Mastered
        elif clean_score >= 75.0:
            new_mastery_status = "Proficient"
        elif clean_score >= 60.0:
            new_mastery_status = "Learning"
        else:
            new_mastery_status = "Needs Revision"

        cursor.execute("""
        INSERT INTO study_topic_mastery (
            user_id, topic, total_attempts, completed_tasks_count,
            latest_score, average_score, mastery_status, last_practiced_at
        ) VALUES (?, ?, 1, 0, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, clean_topic, clean_score, new_avg, new_mastery_status))

    # Also update candidate_skill_progress if table exists to keep memory in sync
    try:
        cursor.execute("""
        SELECT id, attempt_count, average_score FROM candidate_skill_progress
        WHERE user_id = ? AND LOWER(topic) = LOWER(?)
        """, (user_id, clean_topic))
        csp_row = cursor.fetchone()
        if csp_row:
            c_att = csp_row[1] + 1
            c_avg = round(((csp_row[2] * csp_row[1]) + clean_score) / c_att, 1)
            cursor.execute("""
            UPDATE candidate_skill_progress
            SET attempt_count = ?, latest_score = ?, average_score = ?,
                mastery_status = ?, last_practiced_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, (c_att, clean_score, c_avg, new_mastery_status, csp_row[0]))
    except Exception as e:
        _safe_print(f"[STUDY PLANNER] Skill progress sync notice: {e}")

    conn.commit()
    conn.close()

    # Trigger automatic plan adaptation if performance is critical (<60%) or high (>=85%)
    if clean_score < 60.0:
        adapt_existing_study_plan(user_id, reason="low_score", metadata={"topic": clean_topic, "score": clean_score})
    elif clean_score >= 85.0:
        adapt_existing_study_plan(user_id, reason="high_proficiency", metadata={"topic": clean_topic, "score": clean_score})

    return {
        "success": True,
        "activity_id": activity_id,
        "topic": clean_topic,
        "score": clean_score,
        "mastery_status": new_mastery_status
    }


# =============================================================================
# 7. DYNAMIC PLAN ADAPTATION ENGINE (Phase 7)
# =============================================================================

def adapt_existing_study_plan(
    user_id: int,
    reason: str = "performance",
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Dynamically adjusts the active study plan based on:
    - Low practice scores (<60%): Inserts targeted reinforcement and revision tasks.
    - High proficiency (>=85%): Accelerates topic, moves upcoming tasks to advanced/revision.
    - Multiple skipped tasks: Rebalances remaining task schedule to avoid overload.
    - New interview completion / Target role change: Seamlessly aligns pending tasks with latest skill gaps.
    """
    metadata = metadata or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, duration_days, target_role, end_date
    FROM study_plans
    WHERE user_id = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1
    """, (user_id,))
    plan_row = cursor.fetchone()

    if not plan_row:
        conn.close()
        return {"adapted": False, "message": "No active study plan to adapt."}

    plan_id = plan_row[0]
    target_role = plan_row[2]

    adjustments = []

    if reason == "low_score":
        weak_topic = metadata.get("topic")
        score = metadata.get("score", 50.0)
        if weak_topic:
            # Add a targeted reinforcement revision task
            cursor.execute("""
            SELECT MAX(day_number), MAX(task_date)
            FROM study_tasks
            WHERE plan_id = ?
            """, (plan_id,))
            max_row = cursor.fetchone()
            next_day = (max_row[0] or 1) + 1
            try:
                last_date = datetime.date.fromisoformat(max_row[1])
                next_date = (last_date + datetime.timedelta(days=1)).isoformat()
            except Exception:
                next_date = (datetime.date.today() + datetime.timedelta(days=next_day)).isoformat()

            cursor.execute("""
            INSERT INTO study_tasks (
                plan_id, user_id, day_number, task_date, topic, description,
                learning_objective, estimated_minutes, priority, difficulty,
                status, completion_criteria, recommended_practice, why_recommended
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Critical', 'Intermediate', 'pending', ?, ?, ?)
            """, (
                plan_id, user_id, next_day, next_date,
                f"Reinforcement & Review: {weak_topic}",
                f"Targeted review of {weak_topic} after recent practice score ({round(score, 1)}%). Focus on identified misconceptions.",
                f"Achieve confidence and solidify fundamental understanding in {weak_topic}.",
                60,
                "Score 80%+ on follow-up quiz and review ideal model answers.",
                "Review core concept guide and re-attempt practice MCQs.",
                f"Automatically added by AI Study Planner because your recent practice score was {round(score, 1)}%."
            ))
            adjustments.append(f"Added targeted reinforcement session for {weak_topic}.")

    elif reason == "high_proficiency":
        mastered_topic = metadata.get("topic")
        if mastered_topic:
            # Mark upcoming pending tasks on this topic as completed or advance difficulty
            cursor.execute("""
            UPDATE study_tasks
            SET difficulty = 'Advanced',
                priority = 'Low',
                why_recommended = 'Upgraded to Advanced challenges due to verified high proficiency (85%+).'
            WHERE plan_id = ? AND status = 'pending' AND LOWER(topic) LIKE LOWER(?)
            """, (plan_id, f"%{mastered_topic}%"))
            adjustments.append(f"Elevated upcoming {mastered_topic} tasks to Advanced difficulty.")

    elif reason == "skipped_tasks":
        # Spread out remaining pending tasks so candidate is not overwhelmed
        cursor.execute("""
        SELECT id, day_number, task_date FROM study_tasks
        WHERE plan_id = ? AND status = 'pending'
        ORDER BY day_number ASC
        """, (plan_id,))
        pending_rows = cursor.fetchall()

        curr_date = datetime.date.today()
        for idx, p in enumerate(pending_rows):
            new_target_date = (curr_date + datetime.timedelta(days=idx)).isoformat()
            cursor.execute("""
            UPDATE study_tasks
            SET task_date = ?
            WHERE id = ?
            """, (new_target_date, p[0]))
        adjustments.append("Rebalanced remaining pending tasks across upcoming calendar dates.")

    conn.commit()
    conn.close()

    return {
        "adapted": True,
        "plan_id": plan_id,
        "reason": reason,
        "adjustments": adjustments
    }


# =============================================================================
# 8. CALENDAR SCHEDULE & PROGRESS VIEWS (Phase 4 & 6)
# =============================================================================

def get_calendar_schedule(
    user_id: int,
    plan_id: Optional[int] = None,
    view_mode: str = "week",
    start_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Returns study tasks organized by date for Calendar view.
    Supports Day, Week, and Month views.
    """
    overview = get_study_plan_overview(user_id, plan_id)
    if not overview.get("has_active_plan"):
        return {"has_active_plan": False, "schedule_by_date": {}}

    tasks = overview.get("tasks", [])
    schedule_by_date = {}

    for t in tasks:
        d = t["task_date"]
        if d not in schedule_by_date:
            schedule_by_date[d] = []
        schedule_by_date[d].append(t)

    return {
        "has_active_plan": True,
        "plan_id": overview.get("plan_id"),
        "target_role": overview.get("target_role"),
        "start_date": overview.get("start_date"),
        "end_date": overview.get("end_date"),
        "schedule_by_date": schedule_by_date,
        "view_mode": view_mode
    }


def get_learning_progress(user_id: int) -> Dict[str, Any]:
    """
    Returns consolidated learning analytics: topic mastery list, streak,
    completed tasks vs planned, recent activity timeline, and readiness score.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Topic Mastery List
    cursor.execute("""
    SELECT topic, total_attempts, completed_tasks_count, latest_score, average_score, mastery_status, last_practiced_at
    FROM study_topic_mastery
    WHERE user_id = ?
    ORDER BY average_score DESC
    """, (user_id,))
    mastery_rows = cursor.fetchall()

    topic_mastery = []
    for r in mastery_rows:
        topic_mastery.append({
            "topic": r[0],
            "total_attempts": r[1],
            "completed_tasks_count": r[2],
            "latest_score": round(r[3], 1),
            "average_score": round(r[4], 1),
            "mastery_status": r[5] or "Not Started",
            "last_practiced_at": r[6]
        })

    # Recent Learning Activities
    cursor.execute("""
    SELECT id, task_id, topic, activity_type, practice_score, total_questions, correct_answers, created_at
    FROM learning_activities
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 15
    """, (user_id,))
    activity_rows = cursor.fetchall()

    recent_activities = []
    for a in activity_rows:
        recent_activities.append({
            "id": a[0],
            "task_id": a[1],
            "topic": a[2],
            "activity_type": a[3],
            "practice_score": round(a[4], 1) if a[4] is not None else None,
            "total_questions": a[5],
            "correct_answers": a[6],
            "created_at": a[7]
        })

    conn.close()

    overview = get_study_plan_overview(user_id)

    return {
        "has_active_plan": overview.get("has_active_plan", False),
        "plan_id": overview.get("plan_id"),
        "completion_rate_pct": overview.get("completion_rate_pct", 0.0),
        "streak_days": overview.get("streak_days", 0),
        "completed_tasks": overview.get("completed_tasks", 0),
        "total_tasks": overview.get("total_tasks", 0),
        "days_remaining": overview.get("days_remaining", 0),
        "topic_mastery": topic_mastery,
        "recent_activities": recent_activities,
        "mastery_summary": overview.get("mastery_summary", {})
    }

