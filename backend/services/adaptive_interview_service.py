"""
Adaptive AI Interview Engine Service
Provides dynamic question selection, bounded difficulty adjustment,
and real-time session progression for adaptive mock interviews.
"""

import os
import sys
import re
import json
import uuid
import time
import threading
from typing import Dict, Any, List, Optional, Tuple

try:
    from services.groq_service import (
        _call_groq,
        _extract_json,
        _safe_print,
        evaluate_interview,
        generate_overall_summary,
        _build_fallback_evaluation,
    )
    from services.history_service import save_interview
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from services.groq_service import (
        _call_groq,
        _extract_json,
        _safe_print,
        evaluate_interview,
        generate_overall_summary,
        _build_fallback_evaluation,
    )
    from services.history_service import save_interview

DIFFICULTY_LEVELS = ["easy", "medium", "hard"]
DEFAULT_MAX_QUESTIONS = 10

# Thread-safe in-memory store for active adaptive interview sessions
_SESSION_LOCK = threading.Lock()
_ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}


def normalize_difficulty(diff: Any) -> str:
    """Normalize and validate difficulty string to one of: 'easy', 'medium', 'hard'."""
    val = str(diff or "").strip().lower()
    if val in DIFFICULTY_LEVELS:
        return val
    if "easy" in val:
        return "easy"
    if "hard" in val:
        return "hard"
    return "medium"


def adjust_difficulty(current_difficulty: str, technical_score: float) -> str:
    """
    Transparent, bounded difficulty adjustment policy:
    - Current difficulty must be one of: 'easy', 'medium', 'hard'.
    - Score >= 8.0 (~80%): Increase difficulty by at most 1 level.
    - 5.0 <= Score < 8.0: Maintain current difficulty.
    - Score < 5.0 (<50%): Decrease difficulty by at most 1 level.
    - Never exceeds 'hard' or drops below 'easy'.
    """
    curr = normalize_difficulty(current_difficulty)
    try:
        score = float(technical_score)
    except (ValueError, TypeError):
        score = 6.0

    idx = DIFFICULTY_LEVELS.index(curr)

    if score >= 8.0:
        # Step up by at most 1 level
        new_idx = min(idx + 1, len(DIFFICULTY_LEVELS) - 1)
    elif score < 5.0:
        # Step down by at most 1 level
        new_idx = max(idx - 1, 0)
    else:
        # Intermediate / partial: maintain level
        new_idx = idx

    return DIFFICULTY_LEVELS[new_idx]


# Fallback question repository by role and difficulty
_ROLE_FALLBACK_QUESTIONS = {
    "full stack developer": {
        "easy": [
            {"question": "How do HTML, modern CSS (Flexbox/Grid), and JavaScript work with React components to render dynamic UIs?", "topic": "HTML/CSS/JS & React", "assesses_skill": "Frontend"},
            {"question": "Explain the difference between synchronous HTTP requests and RESTful APIs, and what status codes 200, 201, 400, 401, 404, and 500 represent.", "topic": "REST APIs", "assesses_skill": "Backend"},
            {"question": "What is the difference between primary keys and foreign keys in a relational database, and why are they fundamental to data integrity?", "topic": "SQL & Database Design", "assesses_skill": "Databases"},
        ],
        "medium": [
            {"question": "How do you securely implement token-based authentication (JWT) with HTTP-only cookies and handle token expiration/refresh?", "topic": "Authentication & Authorization", "assesses_skill": "Security"},
            {"question": "How do you structure backend REST endpoints, and how does your React frontend manage asynchronous fetch requests, error handling, and CORS?", "topic": "Frontend-Backend Integration", "assesses_skill": "Full Stack"},
            {"question": "Explain database normalization (1NF through 3NF) versus indexing strategies when optimizing slow SQL queries in a web application.", "topic": "SQL & Query Optimization", "assesses_skill": "Databases"},
        ],
        "hard": [
            {"question": "How would you architect a full-stack system with a React SPA, stateless API servers, Redis caching, and an asynchronous worker queue for high-throughput spikes?", "topic": "Full-Stack System Design", "assesses_skill": "System Design"},
            {"question": "How would you design and implement automated testing (unit, integration, end-to-end) and a zero-downtime CI/CD deployment pipeline for a production full-stack application?", "topic": "Testing & Deployment", "assesses_skill": "DevOps"},
            {"question": "How do you prevent security vulnerabilities like SQL Injection, Cross-Site Scripting (XSS), and CSRF across the entire stack from frontend to backend database?", "topic": "Full-Stack Security & Hardening", "assesses_skill": "Security"},
        ],
    },
    "machine learning engineer": {
        "easy": [
            {"question": "What are the core differences between Python lists and NumPy arrays, and why is vectorization essential for ML computations?", "topic": "Python & Data Structures", "assesses_skill": "Python"},
            {"question": "What is the difference between supervised and unsupervised learning, and when would you use classification versus clustering?", "topic": "Supervised & Unsupervised Learning", "assesses_skill": "ML Fundamentals"},
            {"question": "What is data scaling (StandardScaler vs MinMaxScaler) and why is it crucial for distance-based and gradient-based algorithms?", "topic": "Feature Engineering & Preprocessing", "assesses_skill": "Data Preprocessing"},
        ],
        "medium": [
            {"question": "How do you detect and mitigate overfitting and underfitting in ML models, and how does L1 vs L2 regularization influence feature weights?", "topic": "Model Evaluation & Overfitting", "assesses_skill": "Model Optimization"},
            {"question": "Why is accuracy a misleading metric for imbalanced datasets, and how do Precision, Recall, F1-Score, and ROC-AUC provide better insights?", "topic": "Model Evaluation Metrics", "assesses_skill": "Evaluation"},
            {"question": "Walk me through how you choose between linear models, decision tree ensembles (like XGBoost/Random Forest), and neural networks for a tabular problem.", "topic": "ML Algorithms & Model Selection", "assesses_skill": "Algorithm Selection"},
        ],
        "hard": [
            {"question": "How do you package, containerize, and deploy a trained ML model as a production microservice ensuring sub-50ms latency under high concurrent load?", "topic": "Model Deployment & Serving", "assesses_skill": "Production ML"},
            {"question": "How would you design a production ML monitoring pipeline to detect data drift, concept drift, and performance degradation over time?", "topic": "Production ML & MLOps", "assesses_skill": "MLOps"},
            {"question": "How do you design an end-to-end feature pipeline that prevents data leakage between training and validation/test splits during complex transformations?", "topic": "Feature Engineering & Architecture", "assesses_skill": "Pipeline Design"},
        ],
    },
    "software test engineer": {
        "easy": [
            {"question": "What is the difference between verification and validation in software testing, and what does the defect lifecycle look like?", "topic": "Testing Fundamentals & Defect Lifecycle", "assesses_skill": "QA Fundamentals"},
            {"question": "Explain the difference between functional and non-functional testing, and provide examples of each.", "topic": "Testing Fundamentals", "assesses_skill": "Testing Concepts"},
            {"question": "What are boundary value analysis (BVA) and equivalence class partitioning (ECP), and how do they reduce total test cases?", "topic": "Test-Case Design", "assesses_skill": "Test Design"},
        ],
        "medium": [
            {"question": "How do you select, prioritize, and maintain an automated regression test suite when code changes are deployed daily?", "topic": "Regression Testing Strategies", "assesses_skill": "Regression Testing"},
            {"question": "How do you perform REST API testing (validating status codes, JSON payload schemas, headers, and authentication) using tools like Postman or PyTest/RestAssured?", "topic": "API Testing", "assesses_skill": "API Testing"},
            {"question": "How do you distinguish bug severity from bug priority, and how do you handle a high-severity but low-priority defect before release?", "topic": "Defect Lifecycle & Triage", "assesses_skill": "Defect Management"},
        ],
        "hard": [
            {"question": "How would you design an end-to-end test automation architecture using the Page Object Model (POM), parallel test execution, and CI/CD integration?", "topic": "Automation Fundamentals & Framework Design", "assesses_skill": "Test Automation"},
            {"question": "How do you detect, isolate, and remediate flaky automated tests in a high-concurrency continuous integration pipeline?", "topic": "CI/CD & Flaky Test Remediation", "assesses_skill": "Test Automation"},
            {"question": "How would you design a comprehensive test strategy for testing an asynchronous microservices system with message queues and eventual consistency?", "topic": "System & Integration Testing", "assesses_skill": "Distributed Testing"},
        ],
    },
    "python developer": {
        "easy": [
            {"question": "What is the difference between list and tuple in Python, and when would you use each?", "topic": "Python Fundamentals", "assesses_skill": "Python"},
            {"question": "How does Python handle memory management and garbage collection?", "topic": "Memory & Runtime", "assesses_skill": "Python"},
            {"question": "Explain the purpose of the 'self' keyword in Python class methods.", "topic": "OOP in Python", "assesses_skill": "OOP"},
        ],
        "medium": [
            {"question": "Explain how Python generators and the 'yield' statement work, and how they optimize memory usage.", "topic": "Generators & Iterators", "assesses_skill": "Python"},
            {"question": "How do Python decorators work internally, and can you write an example of a timing decorator?", "topic": "Decorators & Metaprogramming", "assesses_skill": "Python"},
            {"question": "What is the Global Interpreter Lock (GIL) and how does it impact multi-threaded programs?", "topic": "Concurrency & GIL", "assesses_skill": "Concurrency"},
        ],
        "hard": [
            {"question": "How would you architect an asynchronous task queue in Python using asyncio or Celery to handle 10,000 concurrent jobs?", "topic": "Distributed Architecture", "assesses_skill": "Architecture"},
            {"question": "Explain the internal memory layout of Python dictionaries (hash table implementation) and how key collisions are resolved.", "topic": "Internals & CPython", "assesses_skill": "Data Structures"},
            {"question": "How would you profile, identify, and eliminate a memory leak in a long-running Flask or FastAPI production service?", "topic": "Performance & Profiling", "assesses_skill": "Debugging"},
        ],
    },
    "frontend developer": {
        "easy": [
            {"question": "What is the CSS box model, and what is the difference between border-box and content-box?", "topic": "CSS Fundamentals", "assesses_skill": "CSS"},
            {"question": "What is the DOM, and how does JavaScript interact with it?", "topic": "DOM Manipulation", "assesses_skill": "JavaScript"},
            {"question": "Explain the difference between let, const, and var in modern JavaScript.", "topic": "JavaScript Scoping", "assesses_skill": "JavaScript"},
        ],
        "medium": [
            {"question": "How does React's Virtual DOM reconciliation algorithm determine what parts of the UI need updating?", "topic": "React Internals", "assesses_skill": "React"},
            {"question": "Explain the JavaScript event loop, microtasks vs macrotasks, and how promises are scheduled.", "topic": "Async JavaScript", "assesses_skill": "JavaScript"},
            {"question": "What are the core differences between client-side rendering (CSR) and server-side rendering (SSR)?", "topic": "Rendering Architecture", "assesses_skill": "Web Architecture"},
        ],
        "hard": [
            {"question": "How would you optimize the Core Web Vitals (LCP, FID/INP, CLS) of an enterprise single-page application experiencing performance degradation?", "topic": "Web Performance", "assesses_skill": "Optimization"},
            {"question": "Describe how you would architect a micro-frontend system with shared state, asset isolation, and independent deployments.", "topic": "Micro-Frontends", "assesses_skill": "Architecture"},
            {"question": "How does React 18 Concurrent Mode and Suspense work under the hood with time-slicing?", "topic": "React Concurrency", "assesses_skill": "React"},
        ],
    },
    "backend developer": {
        "easy": [
            {"question": "Explain the difference between synchronous HTTP requests and RESTful APIs, and what status codes 200, 201, 400, 401, 404, and 500 represent.", "topic": "REST APIs", "assesses_skill": "REST APIs"},
            {"question": "What is the difference between primary keys, foreign keys, and indexes in a relational SQL database?", "topic": "SQL & Databases", "assesses_skill": "SQL"},
            {"question": "Explain the difference between session-based authentication and token-based authentication (JWT).", "topic": "Authentication & Authorization", "assesses_skill": "Authentication"},
        ],
        "medium": [
            {"question": "How do you securely implement token-based authentication (JWT) with refresh tokens and role-based access control (RBAC)?", "topic": "Security & Auth", "assesses_skill": "Authentication"},
            {"question": "Explain database normalization (1NF through 3NF) versus indexing strategies when optimizing slow SQL queries in a backend service.", "topic": "Database Design & SQL", "assesses_skill": "Database Design"},
            {"question": "How do you implement caching strategies (such as cache-aside with Redis) and handle cache invalidation in backend APIs?", "topic": "Caching & Latency", "assesses_skill": "Backend Architecture"},
        ],
        "hard": [
            {"question": "How would you architect a distributed backend system handling high-throughput writes with asynchronous message queues (Kafka or RabbitMQ) and eventual consistency?", "topic": "Backend Architecture & Distributed Systems", "assesses_skill": "Backend Architecture"},
            {"question": "How do you handle distributed transactions, database connection pooling, and circuit breakers during upstream microservice outages?", "topic": "System Resilience & Transactions", "assesses_skill": "Backend Architecture"},
            {"question": "How do you prevent security vulnerabilities like SQL Injection, SSRF, and broken object-level authorization across backend APIs?", "topic": "Backend Security & Hardening", "assesses_skill": "Authentication"},
        ],
    },
    "java developer": {
        "easy": [
            {"question": "What are the four pillars of Object-Oriented Programming (OOP) and how are they implemented in Java?", "topic": "Java OOP Fundamentals", "assesses_skill": "OOP"},
            {"question": "Explain the difference between ArrayList, LinkedList, and HashMap in the Java Collections Framework.", "topic": "Java Collections", "assesses_skill": "Collections"},
            {"question": "What is the difference between checked and unchecked exceptions in Java, and how does the try-catch-finally block work?", "topic": "Exception Handling", "assesses_skill": "Exception Handling"},
        ],
        "medium": [
            {"question": "Explain how the JVM memory model works (Heap, Stack, Metaspace) and how Garbage Collection manages memory.", "topic": "JVM Memory & Garbage Collection", "assesses_skill": "Core Java"},
            {"question": "How does Spring Boot's Dependency Injection (IoC container) and Auto-configuration work under the hood?", "topic": "Spring Boot & IoC", "assesses_skill": "Spring Boot"},
            {"question": "What is JDBC and how does Spring Data JPA / Hibernate map Java objects to relational database tables?", "topic": "JDBC & Persistence", "assesses_skill": "JDBC"},
        ],
        "hard": [
            {"question": "How does Java manage multithreading and thread safety using ExecutorService, ConcurrentHashMap, volatile, and synchronized blocks?", "topic": "Java Concurrency & Multithreading", "assesses_skill": "Core Java"},
            {"question": "How would you diagnose and resolve a Java JVM memory leak or high CPU spike in a production Spring Boot microservice?", "topic": "JVM Performance Tuning & Profiling", "assesses_skill": "Spring Boot"},
            {"question": "How do you handle distributed database transactions and rollback boundaries in Spring Boot using @Transactional and the Saga pattern?", "topic": "Enterprise Architecture & Transactions", "assesses_skill": "Spring Boot"},
        ],
    },
    "general": {
        "easy": [
            {"question": "What is the difference between a process and a thread?", "topic": "Operating Systems", "assesses_skill": "OS"},
            {"question": "Explain the four pillars of Object-Oriented Programming with a simple analogy.", "topic": "Software Design", "assesses_skill": "OOP"},
            {"question": "How do relational databases differ from NoSQL databases?", "topic": "Databases", "assesses_skill": "Databases"},
        ],
        "medium": [
            {"question": "Explain how database indexing works (e.g. B-Trees) and what trade-offs indexes introduce for write operations.", "topic": "Database Indexing", "assesses_skill": "SQL"},
            {"question": "What happens under the hood when a user types a URL into their browser and presses Enter?", "topic": "Networking & Protocols", "assesses_skill": "Networking"},
            {"question": "What is RESTful API idempotency and why is it critical in distributed financial or payment systems?", "topic": "API Design", "assesses_skill": "System Design"},
        ],
        "hard": [
            {"question": "How would you design a distributed caching layer (like Redis) ensuring cache invalidation consistency across multiple datacenters?", "topic": "Distributed Caching", "assesses_skill": "System Design"},
            {"question": "Explain the CAP theorem and describe how you would choose between consistency and availability in a global ticketing system.", "topic": "Distributed Systems", "assesses_skill": "Architecture"},
            {"question": "How do you detect, mitigate, and recover from a cascading service failure in a microservices architecture?", "topic": "Reliability Engineering", "assesses_skill": "Resilience"},
        ],
    },
}


def _get_fallback_question(
    role: str,
    difficulty: str,
    questions_asked: List[str]
) -> Dict[str, Any]:
    """Select a deterministic fallback question that has not yet been asked."""
    role_key = (role or "general").strip().lower()
    matched_role = "general"
    if "full stack" in role_key:
        matched_role = "full stack developer"
    elif "frontend" in role_key:
        matched_role = "frontend developer"
    elif "backend" in role_key:
        matched_role = "backend developer"
    elif "java" in role_key:
        matched_role = "java developer"
    elif "machine learning" in role_key or "ml engineer" in role_key or "ai/ml" in role_key:
        matched_role = "machine learning engineer"
    elif "test" in role_key or "qa" in role_key:
        matched_role = "software test engineer"
    else:
        for r_k in _ROLE_FALLBACK_QUESTIONS:
            if r_k in role_key or role_key in r_k:
                matched_role = r_k
                break

    diff = normalize_difficulty(difficulty)
    pool = _ROLE_FALLBACK_QUESTIONS[matched_role].get(diff, _ROLE_FALLBACK_QUESTIONS["general"][diff])

    asked_lower = [str(q).strip().lower() for q in questions_asked]

    for item in pool:
        if item["question"].strip().lower() not in asked_lower:
            return {
                "question": item["question"],
                "topic": item["topic"],
                "difficulty": diff,
                "assesses_skill": item["assesses_skill"],
                "reason": f"Fallback question assessing {item['topic']} at {diff} difficulty."
            }

    # If all in current difficulty pool used, check other difficulties or general
    for alt_diff in ["medium", "easy", "hard"]:
        for item in _ROLE_FALLBACK_QUESTIONS["general"][alt_diff]:
            if item["question"].strip().lower() not in asked_lower:
                return {
                    "question": item["question"],
                    "topic": item["topic"],
                    "difficulty": diff,
                    "assesses_skill": item["assesses_skill"],
                    "reason": f"Broad general assessment of {item['topic']}."
                }

    return {
        "question": f"Can you describe an advanced project you developed for {role} and explain how you handled system trade-offs?",
        "topic": "Practical Project Architecture",
        "difficulty": diff,
        "assesses_skill": "System Architecture",
        "reason": "Comprehensive project assessment."
    }


def generate_adaptive_question(
    role: str,
    skills: List[str],
    resume_text: str = "",
    job_description: str = "",
    difficulty: str = "medium",
    previous_questions: Optional[List[Dict[str, Any]]] = None,
    previous_evaluations: Optional[List[Dict[str, Any]]] = None,
    topics_covered: Optional[List[str]] = None,
    personality: str = "technical",
) -> Dict[str, Any]:
    """
    Calls Groq to generate a contextual, structured adaptive question.
    Dynamically responds to candidate strengths, gaps, and targets JD skills.
    Falls back gracefully to deterministic repository on API failure.
    """
    prev_qs = previous_questions or []
    prev_evals = previous_evaluations or []
    topics = topics_covered or []
    diff = normalize_difficulty(difficulty)

    asked_texts = [q.get("question", "") for q in prev_qs if isinstance(q, dict)]

    skills_str = ", ".join(skills) if isinstance(skills, list) else str(skills or "")

    last_q = prev_qs[-1] if prev_qs else None
    last_eval = prev_evals[-1] if prev_evals else None

    # Personality directive
    persona_directive = ""
    try:
        from services.interviewer_personality_service import get_personality_prompt_directive
        persona_directive = get_personality_prompt_directive(personality, context_type="question_generation")
    except Exception:
        persona_directive = ""

    context_directive = ""
    if last_q and last_eval:
        last_tech = last_eval.get("technical_score", 6)
        last_mistakes = last_eval.get("mistakes", "")
        last_strengths = last_eval.get("strengths", "")

        if last_tech < 5.0:
            context_directive = f"""
The candidate struggled with the previous question ({last_q.get('question')}).
Identified Knowledge Gap: {last_mistakes}
Instructions: Ask a supportive, focused follow-up question testing the foundational principle behind this topic or a simpler diagnostic question at '{diff}' difficulty.
"""
        elif last_tech >= 8.0:
            context_directive = f"""
The candidate gave an excellent answer to the previous question ({last_q.get('question')}).
Demonstrated Strength: {last_strengths}
Instructions: Progress to a deeper, more challenging scenario or trade-off analysis at '{diff}' difficulty to probe the depth of their expertise.
"""
        else:
            context_directive = f"""
The candidate gave a partially correct answer to the previous question ({last_q.get('question')}).
Identified Area to Explore: {last_mistakes}
Instructions: Ask an application-oriented follow-up or explore another critical competency for '{role}' at '{diff}' difficulty.
"""

    jd_snippet = ""
    if job_description and str(job_description).strip():
        jd_snippet = f"\nTarget Job Description Requirements:\n{str(job_description).strip()[:1000]}\n"

    history_snippet = ""
    if prev_qs:
        history_snippet = "Questions already asked (DO NOT REPEAT ANY OF THESE):\n"
        for i, q in enumerate(prev_qs, 1):
            history_snippet += f"- Q{i}: {q.get('question')} (Topic: {q.get('topic')})\n"

    role_topics_hint = ""
    role_k = (role or "").strip().lower()
    if "full stack" in role_k:
        role_topics_hint = """
Essential Topics to Assess for Full Stack Developer:
- HTML, CSS, JavaScript, React fundamentals and UI state
- Backend development and REST APIs (HTTP methods, status codes)
- Authentication and authorization (JWT, sessions, cookies)
- SQL and database design (schema, relationships, indexing)
- Frontend-backend integration, error handling, and CORS
- Testing, deployment, and system design fundamentals
"""
    elif "machine learning" in role_k or "ml engineer" in role_k or "ai/ml" in role_k:
        role_topics_hint = """
Essential Topics to Assess for Machine Learning Engineer:
- Python and essential data structures (NumPy vectorization, Pandas)
- Supervised and unsupervised learning
- Feature engineering and data preprocessing
- Model evaluation and overfitting (ROC-AUC, Precision, Recall, Regularization)
- ML algorithms and model selection
- Model deployment and production ML fundamentals (low-latency APIs, monitoring, drift)
"""
    elif "test" in role_k or "qa" in role_k:
        role_topics_hint = """
Essential Topics to Assess for Software Test Engineer:
- Software testing fundamentals, testing levels (unit, integration, system, acceptance), and test principles
- Test-case design techniques (boundary value analysis, equivalence partitioning, decision tables)
- Regression testing strategies, smoke/sanity testing, and test prioritization
- Defect lifecycle, bug reporting, severity vs priority, and root cause analysis
- API testing (REST endpoints, HTTP status codes, headers, payload validation, Postman/RestAssured)
- Automation fundamentals, test frameworks (Selenium/Playwright/PyTest), Page Object Model, and CI/CD integration
"""

    prompt = f"""
You are an expert technical interviewer conducting an adaptive technical interview for the role of '{role}'.

{persona_directive}

Interview Target Role: {role}
Candidate Skills: {skills_str}
Target Difficulty: {diff}
Topics already covered: {', '.join(topics) if topics else 'None'}
{jd_snippet}
{history_snippet}
{context_directive}
{role_topics_hint}
Task:
Generate the next adaptive interview question.
1. The question MUST test the candidate at the requested '{diff}' difficulty level.
2. Address relevant competencies for '{role}'.
3. Do NOT repeat or rephrase any question already asked.
4. Ensure practical relevance to modern industry standards.

Return ONLY a strict JSON object with this exact schema:
{{
  "question": "Clear, concise question text without numbering prefixes",
  "topic": "Specific topic or competency (e.g. React Reconciliation, SQL Indexing)",
  "difficulty": "{diff}",
  "question_type": "conceptual | scenario | trade-off | debugging",
  "reason": "Brief explanation of why this question was selected",
  "assesses_skill": "Primary skill tested (e.g. Python, System Design)"
}}
"""

    messages = [{"role": "user", "content": prompt}]

    try:
        raw = _call_groq(messages, json_mode=True, max_tokens=1024, temperature=0.3, context="adaptive_next_question")
        parsed = _extract_json(raw)

        if isinstance(parsed, dict) and parsed.get("question"):
            q_text = str(parsed["question"]).strip()
            # Clean prefixes
            q_text = re.sub(r'^(?:Question\s*\d+[\s:.-]*|\d+[\s:.-]+)', '', q_text, flags=re.IGNORECASE).strip()

            # Ensure not a duplicate
            if q_text and len(q_text) > 5 and q_text.lower() not in [a.lower() for a in asked_texts]:
                return {
                    "question": q_text,
                    "topic": str(parsed.get("topic") or "Technical Competency"),
                    "difficulty": normalize_difficulty(parsed.get("difficulty") or diff),
                    "question_type": str(parsed.get("question_type") or "scenario"),
                    "reason": str(parsed.get("reason") or "Adaptive interview progression"),
                    "assesses_skill": str(parsed.get("assesses_skill") or (skills[0] if skills else role)),
                }
    except Exception as e:
        _safe_print(f"[ADAPTIVE QUESTION AI ERROR]: {e}")

    raise RuntimeError("AI service is temporarily unavailable. Please try again.")


class AdaptiveInterviewSession:
    """Manages state, answers, and evaluation transitions for an active adaptive session."""

    def __init__(
        self,
        session_id: str,
        user_id: Optional[int],
        role: str,
        skills: List[str],
        resume_text: str = "",
        job_description: str = "",
        max_questions: int = DEFAULT_MAX_QUESTIONS,
        initial_difficulty: str = "medium",
        personalized: bool = True,
        personality: str = "technical",
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.role = role or "General"
        self.skills = skills or []
        self.resume_text = resume_text or ""
        self.job_description = job_description or ""
        self.max_questions = max(1, min(20, int(max_questions)))
        self.current_difficulty = normalize_difficulty(initial_difficulty)
        self.personalized = bool(personalized)
        self.personality = personality or "technical"

        self.questions_asked: List[Dict[str, Any]] = []
        self.answers: List[str] = []
        self.evaluations: List[Dict[str, Any]] = []
        self.topics_covered: List[str] = []

        self.status = "in_progress"  # 'in_progress' | 'completed'
        self.created_at = time.time()
        self.updated_at = time.time()

        # Initialize the first question (personalized if requested & user has memory)
        q1 = None
        if self.personalized and self.user_id:
            try:
                from services.interview_memory_service import generate_personalized_followup_question
                q1 = generate_personalized_followup_question(
                    user_id=self.user_id,
                    role=self.role,
                    skills=self.skills,
                    job_description=self.job_description,
                    difficulty=self.current_difficulty,
                    previous_questions=[],
                    previous_evaluations=[],
                    topics_covered=[],
                )
            except Exception as mem_err:
                _safe_print(f"[MEMORY] Could not generate personalized q1: {mem_err}")
                q1 = None

        if not q1:
            q1 = generate_adaptive_question(
                role=self.role,
                skills=self.skills,
                resume_text=self.resume_text,
                job_description=self.job_description,
                difficulty=self.current_difficulty,
                previous_questions=[],
                previous_evaluations=[],
                topics_covered=[],
                personality=self.personality,
            )

        self.questions_asked.append(q1)
        if q1.get("topic") and q1["topic"] not in self.topics_covered:
            self.topics_covered.append(q1["topic"])

    def to_dict(self) -> Dict[str, Any]:
        """Serialize current public session state."""
        current_q_idx = len(self.answers)
        curr_q = self.questions_asked[current_q_idx] if current_q_idx < len(self.questions_asked) else None

        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "role": self.role,
            "interviewer_personality": self.personality,
            "current_question_index": current_q_idx + 1,
            "max_questions": self.max_questions,
            "current_difficulty": self.current_difficulty,
            "current_question": curr_q.get("question") if curr_q else None,
            "current_topic": curr_q.get("topic") if curr_q else None,
            "current_skill": curr_q.get("assesses_skill") if curr_q else None,
            "reason": curr_q.get("reason") if curr_q else None,
            "personalized": getattr(self, "personalized", False),
            "memory_applied": bool(getattr(self, "personalized", False) and self.user_id),
            "status": self.status,
            "answers_count": len(self.answers),
            "topics_covered": list(self.topics_covered),
            "created_at": self.created_at,
            "current_question_meta": curr_q,
            "questions_count": len(self.questions_asked),
            "answered_count": len(self.answers),
            "is_completed": self.status == "completed",
        }

    def submit_answer(self, answer_text: str) -> Dict[str, Any]:
        """
        Submits and evaluates an answer for the current active question.
        Returns evaluation result and either the next question or completion summary.
        """
        if self.status == "completed":
            return {
                "error": "Interview session is already completed.",
                "is_completed": True,
                "session": self.to_dict()
            }

        current_idx = len(self.answers)
        if current_idx >= len(self.questions_asked):
            return {"error": "No question waiting for an answer.", "session": self.to_dict()}

        clean_answer = str(answer_text or "").strip()
        if not clean_answer:
            return {"error": "Answer cannot be empty.", "code": "EMPTY_ANSWER"}

        current_q_obj = self.questions_asked[current_idx]
        current_question_text = current_q_obj["question"]

        # Evaluate answer using existing Groq evaluation logic with personality context
        eval_list = evaluate_interview([current_question_text], [clean_answer], personality=self.personality)
        if not eval_list:
            raise RuntimeError("AI service is temporarily unavailable. Please try again.")
        eval_result = eval_list[0]

        # Record answer and evaluation
        self.answers.append(clean_answer)
        self.evaluations.append(eval_result)
        self.updated_at = time.time()

        tech_score = float(eval_result.get("technical_score", 6.0))

        # Adjust difficulty for the next question using bounded rule
        next_difficulty = adjust_difficulty(self.current_difficulty, tech_score)
        self.current_difficulty = next_difficulty

        # Check if interview is now complete
        if len(self.answers) >= self.max_questions:
            self.status = "completed"
            return {
                "success": True,
                "is_completed": True,
                "evaluation": eval_result,
                "next_question": None,
                "session": self.to_dict(),
            }

        # Generate next question dynamically (memory-aware if personalized)
        next_q_obj = None
        if getattr(self, "personalized", False) and self.user_id:
            try:
                from services.interview_memory_service import generate_personalized_followup_question
                next_q_obj = generate_personalized_followup_question(
                    user_id=self.user_id,
                    role=self.role,
                    skills=self.skills,
                    job_description=self.job_description,
                    difficulty=self.current_difficulty,
                    previous_questions=self.questions_asked,
                    previous_evaluations=self.evaluations,
                    topics_covered=self.topics_covered,
                )
            except Exception as mem_err:
                _safe_print(f"[MEMORY] Next question fallback: {mem_err}")
                next_q_obj = None

        if not next_q_obj:
            next_q_obj = generate_adaptive_question(
                role=self.role,
                skills=self.skills,
                resume_text=self.resume_text,
                job_description=self.job_description,
                difficulty=self.current_difficulty,
                previous_questions=self.questions_asked,
                previous_evaluations=self.evaluations,
                topics_covered=self.topics_covered,
                personality=self.personality,
            )

        self.questions_asked.append(next_q_obj)
        if next_q_obj.get("topic") and next_q_obj["topic"] not in self.topics_covered:
            self.topics_covered.append(next_q_obj["topic"])

        return {
            "success": True,
            "is_completed": False,
            "evaluation": eval_result,
            "next_question": next_q_obj,
            "session": self.to_dict(),
        }

    def finish_session(self) -> Dict[str, Any]:
        """Finalizes the session, computes overall summary, and returns the result structure."""
        self.status = "completed"
        self.updated_at = time.time()

        from services.communication_service import (
            analyze_single_answer_communication,
            generate_overall_communication_summary
        )

        # Build full results list conforming to existing evaluate_answers response format
        combined_results = []
        q_comm_feedbacks = []
        for i in range(len(self.answers)):
            q_obj = self.questions_asked[i] if i < len(self.questions_asked) else {}
            ev_obj = self.evaluations[i] if i < len(self.evaluations) else {}
            q_text = q_obj.get("question", f"Question {i+1}")
            a_text = self.answers[i]

            comm_analysis = analyze_single_answer_communication(q_text, a_text)
            q_comm_feedbacks.append(comm_analysis)

            combined_results.append({
                "question": q_text,
                "answer": a_text,
                "technical_score": ev_obj.get("technical_score", 6),
                "communication_score": ev_obj.get("communication_score", 7),
                "strengths": ev_obj.get("strengths", ""),
                "mistakes": ev_obj.get("mistakes", ""),
                "improved_answer": ev_obj.get("improved_answer", ""),
                "correct_answer": ev_obj.get("correct_answer", ""),
                "correct_concepts": ev_obj.get("correct_concepts") or [],
                "missing_concepts": ev_obj.get("missing_concepts") or [],
                "improvement_suggestions": ev_obj.get("improvement_suggestions") or [],
                "key_takeaways": ev_obj.get("key_takeaways") or [],
                "follow_up_questions": ev_obj.get("follow_up_questions") or [],
                "difficulty": q_obj.get("difficulty", "medium"),
                "topic": q_obj.get("topic", ""),
                "assesses_skill": q_obj.get("assesses_skill", ""),
                "reason": q_obj.get("reason", ""),
                "communication_feedback": comm_analysis,
            })

        avg_score = 0.0
        if combined_results:
            avg_score = round(sum(r["technical_score"] for r in combined_results) / len(combined_results), 1)

        summary = generate_overall_summary(combined_results, personality=self.personality)

        summary["interview_mode"] = "adaptive"
        summary["interviewer_personality"] = self.personality

        overall_comm_summary = generate_overall_communication_summary(q_comm_feedbacks)
        summary["communication_feedback"] = overall_comm_summary
        summary["communication_score"] = overall_comm_summary.get("overall_score", 0)

        # Technical Answer Verification & Grounded Hallucination Detection
        verification_payload = {}
        try:
            from services.answer_verification_service import verify_interview_session
            verification_payload = verify_interview_session(combined_results)
            summary["verification_summary"] = verification_payload.get("summary")
            summary["answer_verifications"] = verification_payload.get("verifications", [])
            for i, r in enumerate(combined_results):
                if i < len(verification_payload.get("verifications", [])):
                    r["verification_result"] = verification_payload["verifications"][i]
        except Exception as v_err:
            _safe_print(f"[VERIFICATION ERROR]: {v_err}")
            summary["verification_summary"] = None
            summary["answer_verifications"] = []

        # Speaking Coach session aggregation
        try:
            from services.communication_service import aggregate_session_speaking_metrics
            speaking_metrics = aggregate_session_speaking_metrics(q_comm_feedbacks)
            summary["speaking_metrics"] = speaking_metrics
        except Exception as s_err:
            _safe_print(f"[SPEAKING COACH ERROR]: {s_err}")
            speaking_metrics = {}
            summary["speaking_metrics"] = speaking_metrics

        # Persist interview session (supports both authenticated user and guest)
        saved_interview_id = None
        try:
            saved_interview_id = save_interview(
                user_id=self.user_id,
                role=self.role,
                avg_score=avg_score,
                summary=summary.get("summary", ""),
                results=combined_results,
                overall_summary=summary,
                interview_mode="adaptive",
                interview_type="Adaptive",
                communication_score=overall_comm_summary.get("overall_score", 0),
                communication_feedback=overall_comm_summary,
                interviewer_personality=self.personality,
                speaking_metrics=speaking_metrics,
                verification_summary=summary.get("verification_summary"),
                answer_verifications=summary.get("answer_verifications"),
            )
            _safe_print(f"[INFO] Successfully saved adaptive interview #{saved_interview_id} for user #{self.user_id}")
        except Exception as e:
            _safe_print(f"[DB ERROR] Failed to save adaptive interview history: {e}")
            saved_interview_id = None

        if self.user_id and saved_interview_id:
            # Record in AI interview memory system
            try:
                from services.interview_memory_service import record_interview_memory
                record_interview_memory(
                    user_id=self.user_id,
                    role=self.role,
                    interview_mode="adaptive",
                    results=combined_results,
                    overall_summary=summary,
                    interview_id=saved_interview_id,
                )
            except Exception as mem_err:
                _safe_print(f"[MEMORY ERROR] Failed to record memory for adaptive session: {mem_err}")

            # Record in AI readiness prediction history
            try:
                from services.readiness_service import record_readiness_snapshot
                record_readiness_snapshot(
                    user_id=self.user_id,
                    interview_id=saved_interview_id,
                    role=self.role,
                )
            except Exception as r_err:
                _safe_print(f"[READINESS ERROR] Failed to record readiness snapshot: {r_err}")

            # Adapt AI Study Plan dynamically after adaptive interview
            try:
                from services.study_planner_service import adapt_existing_study_plan
                adapt_existing_study_plan(
                    user_id=self.user_id,
                    reason="new_interview",
                    metadata={"interview_id": saved_interview_id, "role": self.role}
                )
            except Exception as sp_err:
                _safe_print(f"[STUDY PLAN ADAPT ERROR]: {sp_err}")

        return {
            "success": True,
            "interview_id": saved_interview_id,
            "results": combined_results,
            "summary": summary,
            "communication_feedback": overall_comm_summary,
            "verification_summary": summary.get("verification_summary"),
            "answer_verifications": summary.get("answer_verifications"),
            "speaking_metrics": speaking_metrics,
            "interviewer_personality": self.personality,
            "topics_covered": self.topics_covered,
            "interview_mode": "adaptive",
            "session": self.to_dict(),
        }


# API-level session helpers
def start_adaptive_session(
    user_id: Optional[int],
    role: str,
    skills: List[str],
    resume_text: str = "",
    job_description: str = "",
    max_questions: int = DEFAULT_MAX_QUESTIONS,
    initial_difficulty: str = "medium",
    personalized: bool = True,
    personality: str = "technical",
) -> Dict[str, Any]:
    """Creates, registers, and returns a new AdaptiveInterviewSession."""
    session_id = str(uuid.uuid4())
    session = AdaptiveInterviewSession(
        session_id=session_id,
        user_id=user_id,
        role=role,
        skills=skills,
        resume_text=resume_text,
        job_description=job_description,
        max_questions=max_questions,
        initial_difficulty=initial_difficulty,
        personalized=personalized,
        personality=personality,
    )

    with _SESSION_LOCK:
        _ACTIVE_SESSIONS[session_id] = session

    return session.to_dict()


def get_adaptive_session(session_id: str, user_id: Optional[int] = None) -> Optional[AdaptiveInterviewSession]:
    """Retrieves an active session enforcing user ownership."""
    with _SESSION_LOCK:
        session = _ACTIVE_SESSIONS.get(session_id)

    if not session:
        return None

    # Ownership check: if session has user_id, ensure requesting user matches
    if session.user_id is not None and user_id is not None and session.user_id != user_id:
        return None

    return session


def submit_adaptive_answer(session_id: str, answer_text: str, user_id: Optional[int] = None) -> Dict[str, Any]:
    """Submit answer to active session."""
    session = get_adaptive_session(session_id, user_id)
    if not session:
        return {"success": False, "error": "Adaptive session not found or unauthorized.", "code": "SESSION_NOT_FOUND"}

    return session.submit_answer(answer_text)


def finish_adaptive_session(session_id: str, user_id: Optional[int] = None) -> Dict[str, Any]:
    """Finalizes an active session."""
    session = get_adaptive_session(session_id, user_id)
    if not session:
        return {"success": False, "error": "Adaptive session not found or unauthorized.", "code": "SESSION_NOT_FOUND"}

    if user_id and not session.user_id:
        session.user_id = user_id

    result = session.finish_session()

    # Clean up from active memory once completed
    with _SESSION_LOCK:
        _ACTIVE_SESSIONS.pop(session_id, None)

    return result
