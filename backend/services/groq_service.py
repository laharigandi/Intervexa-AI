import os
import sys
import re
import json
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv, find_dotenv

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from groq import (
    Groq,
    APIError,
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    APIStatusError,
)

# Explicitly load .env from backend directory
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(find_dotenv(), override=True)

# Centralized Model Configuration
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

try:
    from services.interviewer_personality_service import get_personality_config
except ImportError:
    try:
        from interviewer_personality_service import get_personality_config
    except ImportError:
        def get_personality_config(pid):
            return {"id": "technical", "name": "Technical Interviewer", "prompt_directive": "", "evaluation_tone": "", "tone": "objective"}


def _safe_print(*args, **kwargs):
    """Safely print strings even if they contain Unicode characters outside console charmap."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        safe_args = [
            arg.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(sys.stdout.encoding or "utf-8")
            if isinstance(arg, str) else arg
            for arg in args
        ]
        try:
            print(*safe_args, **kwargs)
        except Exception:
            pass


def get_client():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        _safe_print("[GROQ CONFIG ERROR] GROQ_API_KEY is not set in environment variables.")
        raise ValueError("GROQ_API_KEY is not set in environment variables.")
    return Groq(api_key=api_key)


def _log_groq_error(e, model, context=""):
    """
    Categorize and log the exact technical error to the backend console.
    """
    _safe_print("\n================== [GROQ ERROR DIAGNOSTIC] ==================")
    _safe_print(f"[CONTEXT]   : {context or 'AI Chat Completion'}")
    if isinstance(e, AuthenticationError):
        _safe_print(f"[ERROR TYPE]: Authentication Error (Invalid/Expired API Key 401)")
        _safe_print(f"[DETAILS]   : Check your GROQ_API_KEY in backend/.env")
    elif isinstance(e, NotFoundError):
        _safe_print(f"[ERROR TYPE]: Model Not Found (404)")
        _safe_print(f"[DETAILS]   : The requested model '{model}' does not exist or is unavailable.")
    elif isinstance(e, PermissionDeniedError):
        _safe_print(f"[ERROR TYPE]: Permission Denied (403)")
        _safe_print(f"[DETAILS]   : Your API key lacks access permissions for model '{model}'.")
    elif isinstance(e, RateLimitError):
        _safe_print(f"[ERROR TYPE]: Rate Limit Exceeded (429)")
        _safe_print(f"[DETAILS]   : Groq API quota or requests per minute exceeded.")
    elif isinstance(e, APITimeoutError):
        _safe_print(f"[ERROR TYPE]: Request Timeout")
        _safe_print(f"[DETAILS]   : Groq API took too long to respond.")
    elif isinstance(e, APIConnectionError):
        _safe_print(f"[ERROR TYPE]: Network Connection Error")
        _safe_print(f"[DETAILS]   : Failed to reach Groq API servers. Check internet connection.")
    elif isinstance(e, BadRequestError):
        _safe_print(f"[ERROR TYPE]: Bad Request (400)")
        _safe_print(f"[DETAILS]   : Malformed request payload sent to Groq API.")
    elif isinstance(e, APIStatusError):
        _safe_print(f"[ERROR TYPE]: API Status Error (HTTP {getattr(e, 'status_code', 'Unknown')})")
        _safe_print(f"[DETAILS]   : {getattr(e, 'message', str(e))}")
    elif isinstance(e, ValueError):
        _safe_print(f"[ERROR TYPE]: Configuration Error")
        _safe_print(f"[DETAILS]   : {e}")
    else:
        _safe_print(f"[ERROR TYPE]: Unexpected Groq/AI Error ({type(e).__name__})")
        _safe_print(f"[DETAILS]   : {e}")

    _safe_print(f"[TARGET MODEL]: {model}")
    _safe_print(f"[RAW ERROR]   : {e}")
    _safe_print("============================================================\n")


def _call_groq(messages, json_mode=False, max_tokens=4096, temperature=0.3, context=""):
    """
    Centralized Groq chat completion invocation with detailed error logging, token limits,
    execution timing diagnostics, and automatic failover to fast secondary model before raising explicit errors.
    """
    import time
    primary_model = os.getenv("GROQ_MODEL", GROQ_MODEL).strip()
    client = get_client()

    kwargs = {
        "model": primary_model,
        "messages": messages,
        "temperature": temperature,
        "timeout": 15.0,
    }
    if max_tokens:
        kwargs["max_tokens"] = max_tokens
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    t_start = time.time()
    _safe_print(f"[GROQ REQ] context='{context}', model='{primary_model}', max_tokens={max_tokens}")

    # Attempt primary model
    try:
        response = client.chat.completions.create(**kwargs)
        if response.choices and len(response.choices) > 0:
            content = response.choices[0].message.content or ""
            dur = time.time() - t_start
            finish_reason = getattr(response.choices[0], 'finish_reason', 'unknown')
            if content.strip():
                _safe_print(f"[GROQ OK] context='{context}', model='{primary_model}', duration={dur:.2f}s, finish_reason='{finish_reason}', len={len(content)}")
                return content
            # If primary returned empty content (e.g. reasoning model token exhaustion), fall through to secondary
            _safe_print(f"[GROQ WARN] Primary model '{primary_model}' returned empty content (finish_reason='{finish_reason}') in {dur:.2f}s.")
    except Exception as e:
        _log_groq_error(e, primary_model, context=context)

    # Attempt secondary model failover if primary failed or produced empty output
    secondary_model = "openai/gpt-oss-120b" if primary_model == "qwen/qwen3.8-27b" else "qwen/qwen3.8-27b"
    if primary_model != secondary_model:
        try:
            t_sec_start = time.time()
            _safe_print(f"[GROQ RETRY]: Attempting secondary model '{secondary_model}' for context '{context}'")
            kwargs["model"] = secondary_model
            if "openai/" in secondary_model:
                kwargs["max_tokens"] = max(kwargs.get("max_tokens", 1200), 3000)
            backup_resp = client.chat.completions.create(**kwargs)
            if backup_resp.choices and len(backup_resp.choices) > 0:
                backup_content = backup_resp.choices[0].message.content or ""
                dur_sec = time.time() - t_sec_start
                if backup_content.strip():
                    _safe_print(f"[GROQ OK] context='{context}', model='{secondary_model}', duration={dur_sec:.2f}s, len={len(backup_content)}")
                    return backup_content
        except Exception as backup_err:
            _log_groq_error(backup_err, secondary_model, context=f"{context} [Secondary Model Failover]")

    raise RuntimeError("AI service is temporarily unavailable. Please try again.")


def _extract_json(text):
    """
    Robustly extract and parse JSON from LLM response text.
    Handles markdown blocks (```json ... ```), partial / truncated JSON,
    leading/trailing explanatory text, and dictionary-wrapped arrays.
    """
    if not text:
        return {}

    cleaned = (text or "").strip()
    
    # Strip markdown fences
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    cleaned = cleaned.strip()

    # 1. Direct JSON parsing
    try:
        data = json.loads(cleaned)
        return data
    except Exception:
        pass

    # 2. Extract first complete JSON array
    array_match = re.search(r'\[\s*\{.*\}\s*\]', cleaned, re.DOTALL)
    if array_match:
        try:
            return json.loads(array_match.group(0))
        except Exception:
            pass

    # 3. Extract first complete JSON object
    object_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if object_match:
        try:
            return json.loads(object_match.group(0))
        except Exception:
            pass

    # 4. Partial / individual JSON objects extraction using depth-tracking
    extracted_objects = []
    depth = 0
    start_idx = None
    in_string = False
    escape = False

    for i, char in enumerate(cleaned):
        if escape:
            escape = False
            continue
        if char == '\\':
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if not in_string:
            if char == '{':
                if depth == 0:
                    start_idx = i
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0 and start_idx is not None:
                    block = cleaned[start_idx : i + 1]
                    try:
                        extracted_objects.append(json.loads(block))
                    except Exception:
                        fixed_block = re.sub(r',\s*}', '}', block)
                        try:
                            extracted_objects.append(json.loads(fixed_block))
                        except Exception:
                            pass
                    start_idx = None

    if extracted_objects:
        return extracted_objects

    # 5. Last-ditch repair for truncated JSON array
    if '[' in cleaned:
        start_arr = cleaned.find('[')
        sub = cleaned[start_arr:]
        for fix in ['"}]', '}]', '}', ']']:
            try:
                fixed = sub + fix
                fixed = re.sub(r',\s*([\]}])', r'\1', fixed)
                parsed = json.loads(fixed)
                if isinstance(parsed, (list, dict)):
                    return parsed
            except Exception:
                continue

    raise json.JSONDecodeError("Failed to extract valid JSON from response", cleaned, 0)


ROLE_TOPIC_FOCUS = {
    "full stack developer": [
        "HTML, CSS, JavaScript, and React fundamentals & state management",
        "Backend development, REST APIs, HTTP methods, and status codes",
        "Authentication and authorization (JWT, sessions, cookies, RBAC)",
        "SQL, relational database schema design, and query optimization",
        "Frontend-backend integration, error handling, and CORS",
        "Testing, deployment (CI/CD), and full-stack system design fundamentals",
    ],
    "frontend developer": [
        "HTML, modern CSS layouts (Flexbox/Grid), responsive design, and CSS architecture",
        "JavaScript ES6+, DOM manipulation, event loop, and asynchronous programming",
        "React components, state management (hooks, Context, Redux), and Virtual DOM reconciliation",
        "Frontend performance optimization (Core Web Vitals, code splitting, lazy loading, asset compression)",
        "REST API integration, data fetching, loading skeletons, error boundaries, and CORS",
        "Cross-browser responsive design, accessibility (WCAG), and frontend testing (RTL, Jest)",
    ],
    "backend developer": [
        "Backend server development, REST APIs, HTTP methods, and status codes",
        "Authentication, authorization, JWT tokens, session security, and RBAC",
        "Relational SQL databases, schema design, normalization, indexing, and query optimization",
        "Caching strategies (Redis, in-memory) and performance bottleneck isolation",
        "Asynchronous processing, message queues, and background worker systems",
        "Backend architecture, microservices, fault tolerance, and API security",
    ],
    "java developer": [
        "Core Java, OOP principles, inheritance, polymorphism, encapsulation, and abstraction",
        "Java Collections framework (List, Set, Map implementations, time complexity)",
        "Exception handling hierarchy (checked vs unchecked, custom exceptions, try-with-resources)",
        "JVM architecture, memory management (Heap, Stack, Metaspace), and garbage collection",
        "Spring Boot framework, Dependency Injection (IoC), REST controllers, and application configuration",
        "Database integration with JDBC, Spring Data JPA, Hibernate, and SQL persistence",
    ],
    "machine learning engineer": [
        "Python and essential data structures (NumPy vectorization, Pandas DataFrames)",
        "Supervised and unsupervised learning algorithms (regression, classification, clustering)",
        "Feature engineering, scaling, categorical encoding, and data preprocessing",
        "Model evaluation metrics (ROC-AUC, Precision, Recall, F1) and overfitting/underfitting remedies",
        "ML algorithms and model selection, bias-variance tradeoff, and cross-validation",
        "Model deployment, REST/gRPC endpoints, containerization, and production ML fundamentals (monitoring, drift)",
    ],
    "software test engineer": [
        "Software testing fundamentals, testing levels (unit, integration, system, acceptance), and testing principles",
        "Test-case design techniques (boundary value analysis, equivalence partitioning, decision tables, state transitions)",
        "Regression testing strategies, smoke testing, sanity testing, and test suite prioritization",
        "Defect lifecycle, bug reporting, severity vs priority, and root cause analysis",
        "API testing (REST endpoints, HTTP status codes, headers, JSON payload validation, Postman/RestAssured)",
        "Automation fundamentals, test frameworks (Selenium, Cypress, PyTest), Page Object Model, and CI/CD test integration",
    ],
}


def _build_fallback_questions(role, skills):
    """Generate high-quality default placement interview questions (exactly 10 questions)."""
    role_lower = str(role or "").strip().lower()
    skills_list = [str(s).strip() for s in skills if str(s).strip()] if isinstance(skills, list) else []
    primary_skill = skills_list[0] if skills_list else "Core Technology"
    secondary_skill = skills_list[1] if len(skills_list) > 1 else "System Design"

    if "test" in role_lower or "qa" in role_lower:
        return [
            f"Can you walk me through the end-to-end testing lifecycle and your test strategy for a major project using {primary_skill}?",
            "What testing fundamentals and test-case design techniques (like boundary value analysis and equivalence partitioning) do you use to ensure high coverage?",
            "How do you plan, select, and prioritize test cases for regression testing when application features are deployed frequently?",
            "Walk me through the complete defect lifecycle: how do you report, track, and verify a bug, and differentiate severity from priority?",
            "How do you perform API testing on RESTful endpoints, validating status codes, response headers, schema contracts, and authentication?",
            "What is your approach to designing automated test suites, and how do you handle flaky tests in continuous integration (CI/CD) pipelines?",
            f"Describe a real-world scenario where you applied {secondary_skill} to catch a critical defect or security bug before production release.",
            "What is the difference between functional and non-functional testing, and how do you approach performance or load testing?",
            "How would you test an asynchronous worker system or event-driven architecture where responses are not immediate?",
            "As an aspiring Software Test Engineer, how do you balance manual exploratory testing with scalable test automation frameworks?"
        ]

    if "frontend" in role_lower:
        return [
            f"Can you walk me through the component hierarchy and state management approach of a production frontend app you built using {primary_skill}?",
            "How does React's Virtual DOM reconcile updates, and what strategies (useMemo, useCallback, React.memo) prevent wasteful re-renders?",
            "Explain modern responsive layouts using CSS Grid and Flexbox, and how you approach mobile-first breakpoint design.",
            "How do you handle asynchronous data fetching, error boundaries, race conditions, and loading skeletons in complex UIs?",
            "What techniques do you use to optimize Core Web Vitals (LCP, FID/INP, CLS), asset bundles, and image compression?",
            "Explain browser rendering mechanics (HTML parsing, CSSOM, Render Tree, Layout, Paint, Composite) and how to avoid layout thrashing.",
            f"Describe how you applied {secondary_skill} to solve a complex state synchronization, routing, or accessibility challenge.",
            "How do you ensure web accessibility (WCAG, semantic HTML, ARIA labels, keyboard focus management) across multi-device viewports?",
            "What automated testing frameworks (Jest, React Testing Library, Cypress/Playwright) do you write to verify UI component stability?",
            "As an aspiring Frontend Developer, how do you balance snappy user experience, performance budgets, and modern framework ecosystems?"
        ]

    if "backend" in role_lower:
        return [
            f"Can you walk me through the architecture, request lifecycle, and data flow of a backend service you built using {primary_skill}?",
            "How do you design high-throughput REST or gRPC APIs, and how do you implement rate limiting, pagination, and status codes?",
            "Explain the trade-offs between relational (SQL) and non-relational (NoSQL) databases, and how you structure indices to optimize queries.",
            "How do you implement authentication, authorization, and secure session management (JWT with refresh tokens, OAuth2, RBAC)?",
            "What caching strategies (write-through, cache-aside, Redis eviction policies) do you implement to reduce database load?",
            "How do you handle distributed transactions, data consistency, and database connection pooling under high concurrent traffic?",
            f"Describe a real-world scenario where you used {secondary_skill} to isolate and resolve a backend bottleneck or latency spike.",
            "How do you structure asynchronous message queues (RabbitMQ, Kafka, Celery) to decouple heavy processing from HTTP request handlers?",
            "What automated testing approaches (unit, integration, contract, load testing) do you enforce in a production CI/CD pipeline?",
            "As an aspiring Backend Developer, how do you design fault-tolerant microservices that gracefully degrade during upstream outages?"
        ]

    if "full stack" in role_lower or "fullstack" in role_lower:
        return [
            f"Can you walk me through the end-to-end architecture and technical stack of a full stack application you built using {primary_skill}?",
            "How do HTML, modern CSS layouts (Flexbox/Grid), and JavaScript work with React's Virtual DOM and component lifecycle?",
            "How do you design a scalable backend REST API, and how do you handle idempotency, pagination, and HTTP status codes?",
            "Explain the difference between authentication and authorization, and how you securely implement JWT or session-based auth with token refresh.",
            "How do you structure a relational SQL database schema with indexing and normalization to balance read and write performance?",
            "Walk me through how you handle frontend-backend integration, error boundaries, loading states, and CORS in a production web application.",
            f"Describe how you applied {secondary_skill} to debug, profile, or optimize performance in a full stack system.",
            "What automated testing strategies (unit, integration, end-to-end) and CI/CD deployment pipelines do you set up before releasing to production?",
            "How would you architect a full-stack system that processes long-running asynchronous jobs without blocking user HTTP requests?",
            "As an aspiring Full Stack Developer, how do you continuously stay updated with evolving frontend frameworks and backend infrastructure best practices?"
        ]

    if "machine learning" in role_lower or "ml" in role_lower or "ai" in role_lower:
        return [
            f"Can you walk me through the end-to-end ML pipeline and key technical challenges of a machine learning project you built using {primary_skill}?",
            "How do Python memory management and vectorized data structures (NumPy/Pandas) optimize large-scale data preprocessing pipelines?",
            "Explain the difference between supervised and unsupervised learning, and compare decision boundaries of tree ensembles versus linear models.",
            "What feature engineering techniques do you employ for handling high-cardinality categorical features, skewed distributions, and missing values?",
            "How do you diagnose and mitigate overfitting and underfitting, and which evaluation metrics (ROC-AUC, PR-AUC, F1) do you choose for imbalanced datasets?",
            "Walk me through your framework for algorithm and model selection when trading off interpretability, training time, and inference latency.",
            f"Describe a real-world scenario where you applied {secondary_skill} to improve model performance or prevent data leakage.",
            "How do you package, containerize (Docker), and deploy trained machine learning models as production REST or gRPC microservices?",
            "What production ML monitoring strategies would you put in place to detect concept drift, covariate shift, and pipeline failures post-deployment?",
            "As an aspiring Machine Learning Engineer, how do you bridge the gap between experimental notebook prototyping and production-grade MLOps pipelines?"
        ]

    if "python" in role_lower:
        return [
            f"Can you walk me through a complex technical project you built in Python, and how you leveraged {primary_skill}?",
            "Explain Python's Global Interpreter Lock (GIL), memory management (reference counting + garbage collector), and concurrency (multiprocessing vs threading vs asyncio).",
            "What are generators, iterators, and decorators in Python, and how do you use them to write memory-efficient, reusable code?",
            "How do you structure clean, idiomatic Python code following PEP 8, type hinting (mypy), and modular package layout?",
            "How do you optimize slow Python code using profiling tools (cProfile), algorithmic refactoring, or vectorized operations?",
            "Explain how relational ORMs (SQLAlchemy, Django ORM) generate SQL queries, and how you diagnose and eliminate N+1 query problems.",
            f"Describe a real-world debugging challenge where you applied {secondary_skill} to find and fix a tricky bug in Python.",
            "How do you design, secure, and containerize (Docker) Python web backends using frameworks like FastAPI, Flask, or Django?",
            "What unit testing frameworks (pytest, unittest, mock) and automated CI workflows do you set up to maintain code reliability?",
            "As an aspiring Python Developer, what best practices do you follow to transition experimental code into production-ready software?"
        ]

    if "java" in role_lower:
        return [
            f"Can you walk me through the architecture and enterprise patterns of a Java application you built using {primary_skill}?",
            "Explain the JVM memory model (Heap, Stack, Metaspace), garbage collection algorithms (G1, ZGC), and memory leak diagnosis.",
            "How does Java's concurrency framework (ExecutorService, synchronized, ReentrantLock, ConcurrentHashMap) manage thread safety?",
            "What are the core Spring / Spring Boot mechanisms (Dependency Injection, Inversion of Control, AOP, Auto-configuration)?",
            "How do you design and structure microservices with Spring Cloud, REST endpoints, and JPA/Hibernate database persistence?",
            "Explain Java 8+ functional programming features (Streams API, Lambda expressions, Optional, CompletableFuture) and their benefits.",
            f"Describe a real-world scenario where you applied {secondary_skill} to tune JVM performance or resolve a deadlock issue.",
            "How do you design robust exception handling hierarchies and transaction management (@Transactional rollback policies)?",
            "What automated test suites (JUnit 5, Mockito, Testcontainers) do you construct for reliable integration testing?",
            "As an aspiring Java Developer, how do you apply SOLID design principles and clean architecture to enterprise scale systems?"
        ]

    if "data" in role_lower or "analyst" in role_lower:
        return [
            f"Can you walk me through an end-to-end data analysis project where you derived actionable business insights using {primary_skill}?",
            "How do you structure complex SQL queries using window functions, Common Table Expressions (CTEs), and multi-table joins?",
            "What data cleaning and validation methodologies do you apply to handle missing values, anomalies, and inconsistent schema formats?",
            "Explain the principles of effective exploratory data analysis (EDA) and how you communicate metrics to non-technical stakeholders.",
            "What statistical concepts (hypothesis testing, confidence intervals, p-values, A/B testing) do you apply to validate analytical findings?",
            "How do you build automated, reproducible data extraction and transformation pipelines using Python (Pandas) or SQL?",
            f"Describe how you applied {secondary_skill} to design intuitive dashboards or data visualizations that influenced a key decision.",
            "How do you differentiate correlation from causation, and how do you guard against bias or Simpson's Paradox in analytical reports?",
            "What dashboarding tools (Tableau, Power BI, Streamlit) and metrics tracking do you use to monitor ongoing business KPIs?",
            "As an aspiring Data Analyst, how do you translate ambiguous business problem statements into structured, data-driven deliverables?"
        ]

    return [
        f"Can you walk me through the key architecture and technical challenges of a major project you built using {primary_skill}?",
        f"How did you approach debugging and optimizing performance in your most challenging technical project?",
        f"Describe a real-world scenario where you applied {secondary_skill} to solve a complex problem.",
        "What software design principles (like SOLID or DRY) do you prioritize when writing maintainable code?",
        f"Explain the core runtime and memory trade-offs when selecting data structures for high-throughput operations in {primary_skill}.",
        "How do relational databases differ from NoSQL databases, and how do indexing strategies improve query performance?",
        "What are the fundamental differences between processes and threads, and how is concurrency managed safely?",
        "Explain how RESTful APIs handle idempotency, authentication, and error status codes in a scalable architecture.",
        "Can you describe an instance during an internship, academic project, or team work where you had to quickly learn an unfamiliar technology?",
        f"As an aspiring {role}, how do you stay updated with industry best practices and continuously sharpen your technical skills?"
    ]


def generate_questions(role, skills, resume_text="", job_description="", personality="technical"):
    """
    Generate exactly 10 technical and resume-based interview questions as a validated list of strings.
    If job_description is provided, questions are tailored to both the role, resume, and job description.
    Incorporates the chosen interviewer persona (technical, hr, strict, friendly, senior_engineer, panel).
    Always returns exactly 10 unique, non-empty questions.
    """
    skills_str = ", ".join(skills) if isinstance(skills, list) else str(skills)
    personality_cfg = get_personality_config(personality)

    role_key = (role or "").strip().lower()
    topic_focus_section = ""
    for k, topics in ROLE_TOPIC_FOCUS.items():
        if k in role_key or role_key in k:
            formatted_topics = "\n".join(f"- {t}" for t in topics)
            topic_focus_section = f"""
Mandatory Technical Topic Areas for '{role}':
{formatted_topics}
Ensure the core technical questions systematically assess these topics for '{role}'.
"""
            break

    jd_section = ""
    if job_description and str(job_description).strip():
        jd_section = f"""
Target Job Description:
{str(job_description).strip()}
"""

    persona_section = f"""
Interviewer Persona: {personality_cfg['name']} ({personality_cfg.get('tagline', '')})
Interviewer Style & Philosophy:
{personality_cfg['prompt_directive']}
Ensure all 10 questions reflect this interviewer's characteristic tone, focus areas, and evaluation philosophy.
"""

    prompt = f"""
You are an expert interviewer and placement mentor.

{persona_section}

Candidate Profile:
- Engineering Student / Graduate
- Preparing for Campus Placements & Software Roles

Target Role:
{role}

Candidate Skills:
{skills_str}

Resume Information:
{resume_text}
{jd_section}{topic_focus_section}
Instructions:
1. Generate exactly 10 unique, comprehensive interview questions tailored for the role '{role}'.
2. Include 4 resume- and project-oriented questions covering candidate projects, tools, and experience.
3. Include 6 core fundamental technical questions relevant to '{role}' and '{skills_str}'{' and specifically addressing key requirements from the Target Job Description' if job_description else ''}.
4. Questions must be clear, direct, and suitable for technical placement rounds.
5. You MUST return exactly 10 questions.
6. Return ONLY a valid JSON object in this exact schema:
{{
  "questions": [
    "Question 1 text here",
    "Question 2 text here",
    "Question 3 text here",
    "Question 4 text here",
    "Question 5 text here",
    "Question 6 text here",
    "Question 7 text here",
    "Question 8 text here",
    "Question 9 text here",
    "Question 10 text here"
  ]
}}

Rules:
- Do NOT include question number prefixes (such as '1.', 'Question 1:') inside the question string.
- Return ONLY valid JSON, with no preamble or trailing conversational text.
"""

    messages = [{"role": "user", "content": prompt}]

    try:
        raw_response = _call_groq(messages, json_mode=True, max_tokens=2500, temperature=0.3, context="generate_questions")
        parsed = _extract_json(raw_response)

        raw_list = []
        if isinstance(parsed, dict):
            for key in ["questions", "interview_questions", "technical_questions", "data", "results"]:
                if key in parsed and isinstance(parsed[key], list):
                    raw_list = parsed[key]
                    break
            else:
                raw_list = list(parsed.values())
        elif isinstance(parsed, list):
            raw_list = parsed

        clean_questions = []
        for item in raw_list:
            if isinstance(item, dict):
                q_text = item.get("question") or item.get("text") or item.get("q") or str(item)
            else:
                q_text = str(item)

            q_clean = re.sub(r'^(?:Question\s*\d+[\s:.-]*|\d+[\s:.-]+)', '', q_text.strip(), flags=re.IGNORECASE).strip()
            if q_clean and len(q_clean) > 5 and q_clean not in clean_questions:
                clean_questions.append(q_clean)

        if len(clean_questions) >= 10:
            return clean_questions[:10]

        # If LLM returned fewer than 10 valid questions, make a fast targeted call for the missing questions
        needed = 10 - len(clean_questions)
        supplement_prompt = f"""
You are an expert technical interviewer.
Generate exactly {needed} additional unique, challenging technical interview questions for the role '{role}' ({skills_str}).
Do NOT repeat any of these existing questions:
{json.dumps(clean_questions, indent=2)}

Return ONLY a valid JSON object:
{{
  "questions": [
    "New unique technical question text"
  ]
}}
"""
        try:
            sup_res = _call_groq(
                [{"role": "user", "content": supplement_prompt}],
                json_mode=True,
                max_tokens=1500,
                temperature=0.4,
                context="supplement_questions"
            )
            sup_parsed = _extract_json(sup_res)
            sup_list = []
            if isinstance(sup_parsed, dict):
                for k in ["questions", "interview_questions", "data", "results"]:
                    if k in sup_parsed and isinstance(sup_parsed[k], list):
                        sup_list = sup_parsed[k]
                        break
                else:
                    sup_list = list(sup_parsed.values())
            elif isinstance(sup_parsed, list):
                sup_list = sup_parsed

            for item in sup_list:
                q_text = item.get("question") if isinstance(item, dict) else str(item)
                q_clean = re.sub(r'^(?:Question\s*\d+[\s:.-]*|\d+[\s:.-]+)', '', str(q_text).strip(), flags=re.IGNORECASE).strip()
                if q_clean and len(q_clean) > 5 and q_clean not in clean_questions:
                    clean_questions.append(q_clean)
                if len(clean_questions) >= 10:
                    break
        except Exception as sup_err:
            _safe_print(f"[SUPPLEMENT QUESTIONS ERROR]: {sup_err}")

        if len(clean_questions) >= 10:
            return clean_questions[:10]
        elif len(clean_questions) >= 5:
            return clean_questions

    except Exception as e:
        _safe_print(f"[QUESTION GENERATION ERROR]: {e}")

    # Explicit failure when AI is genuinely unavailable — never silent mock substitution
    raise RuntimeError("AI service is temporarily unavailable. Please try again.")



def _clean_str_list(val, default_list):
    """Safely extracts a list of non-empty strings from varied AI response types."""
    if isinstance(val, list):
        res = [str(x).strip() for x in val if str(x).strip()]
        if res:
            return res
    elif isinstance(val, str) and val.strip():
        parts = [p.strip().lstrip("-*•0123456789. ") for p in val.replace("\n", ",").split(",") if p.strip()]
        if parts:
            return parts
    return default_list


def _is_skipped_or_empty(ans):
    """Check if candidate explicitly skipped or left the answer blank."""
    if not ans or not isinstance(ans, str):
        return True
    cleaned = ans.strip().lower()
    if not cleaned:
        return True
    skip_phrases = {
        "skipped", "skip", "no answer", "no answer provided",
        "n/a", "na", "none", "pass", "i don't know", "idk",
        "did not answer", "no response", "skip question", "unanswered"
    }
    return cleaned in skip_phrases


def _is_gibberish_text(text):
    """Detect obvious random keyboard mash / meaningless non-words like 'yjgnbnb'."""
    if not text or not isinstance(text, str):
        return False
    cleaned = text.strip()
    if len(cleaned) < 5:
        return False
    if " " not in cleaned:
        vowels = set("aeiouAEIOU")
        vowel_count = sum(1 for c in cleaned if c in vowels)
        # Random consonants without vowels
        if vowel_count == 0 and len(cleaned) >= 5:
            return True
        # Extremely low character variety
        if len(set(cleaned.lower())) <= 2 and len(cleaned) >= 5:
            return True
        # Common keyboard mash runs
        mashes = ["asdfgh", "zxcvbn", "qwerty", "hjkl"]
        if any(m in cleaned.lower() for m in mashes):
            return True
    return False


def _build_gibberish_evaluation(question, answer):
    """Deterministic evaluation for an unintelligible or keyboard-mashed answer."""
    q_clean = (question or "this technical question").strip()
    ans_clean = str(answer or "")[:40]
    return {
        "technical_score": 0,
        "communication_score": 0,
        "strengths": "Submitted response, but no meaningful technical terms or reasoning were detected.",
        "mistakes": f"The response '{ans_clean}' appears to be keyboard mash or meaningless text without conceptual relevance to '{q_clean}'.",
        "improved_answer": f"For '{q_clean}': Formulate an answer defining core concepts, architectural mechanisms, and concrete production trade-offs.",
        "correct_answer": f"A comprehensive response to '{q_clean}' addresses fundamental concepts, operational mechanisms, and relevant real-world use cases.",
        "correct_concepts": [],
        "missing_concepts": ["Complete explanation omitted (unintelligible response)"],
        "improvement_suggestions": [
            "Use clear technical terminology and explain underlying operational mechanics.",
            "If unsure of the specific solution, explain foundational computer science principles or the basic problem setup."
        ],
        "key_takeaways": [
            f"Review the foundational principles of '{q_clean}'."
        ],
        "follow_up_questions": [
            f"What baseline prerequisites are needed to approach '{q_clean}'?"
        ]
    }


def _build_skipped_evaluation(question):
    """Deterministic evaluation for an unattempted or skipped interview question."""
    q_clean = (question or "this technical question").strip()
    return {
        "technical_score": 0,
        "communication_score": 0,
        "strengths": "Question was skipped by candidate.",
        "mistakes": "No answer was provided during the interview session.",
        "improved_answer": f"For '{q_clean}': Formulate an answer defining core concepts, architectural mechanisms, and concrete production trade-offs.",
        "correct_answer": f"A comprehensive response to '{q_clean}' addresses fundamental concepts, operational mechanisms, and relevant real-world use cases.",
        "correct_concepts": [],
        "missing_concepts": ["Complete explanation omitted (question skipped)"],
        "improvement_suggestions": [
            "Attempt every interview question, even by explaining basic foundational principles.",
            "Use a structured STAR or Definition-Mechanism-Example approach."
        ],
        "key_takeaways": [
            f"Review the foundational concepts governing '{q_clean}'."
        ],
        "follow_up_questions": [
            f"What baseline prerequisites are needed to approach '{q_clean}'?"
        ]
    }


def _build_fallback_evaluation(question, answer):
    """Generate a safe, well-formed evaluation dictionary for a single question/answer."""
    ans_clean = (answer or "").strip()
    has_content = len(ans_clean) >= 3
    tech_score = 6 if has_content else 0
    comm_score = 6 if has_content else 0

    return {
        "technical_score": tech_score,
        "communication_score": comm_score,
        "strengths": "Candidate provided a concise response addressing the question premise." if has_content else "No substantial answer provided.",
        "mistakes": "Could incorporate more technical depth, trade-offs, and production considerations." if has_content else "Answer was incomplete or omitted key technical details.",
        "improved_answer": f"For {question}: Clearly articulate the fundamental definition, underlying mechanism, trade-offs, and a concrete production use case.",
        "correct_answer": f"A comprehensive answer for '{question}' should explain the core architectural principles, key mechanisms, and practical engineering trade-offs.",
        "correct_concepts": ["Foundational conceptual awareness"] if has_content else [],
        "missing_concepts": ["Production edge cases", "System performance trade-offs"] if has_content else ["Core definition", "Practical implementation details"],
        "improvement_suggestions": [
            "Structure your response using the STAR or Definition-Mechanism-Example format.",
            "Cite concrete industry examples or performance metrics to substantiate your points."
        ],
        "key_takeaways": [
            f"Master the core operational principles governing '{question}'.",
            "Be prepared to contrast this approach with alternative architectural designs."
        ],
        "follow_up_questions": [
            f"How would you monitor and troubleshoot issues related to this in a distributed system?",
            f"What trade-offs would you consider when scaling this solution under heavy load?"
        ]
    }


def _evaluate_single_question_safely(q, a, personality="technical"):
    """
    Fallback targeted evaluation for an individual question/answer.
    Attempts single-question Groq invocation; if Groq is unreachable, falls back to deterministic evaluator.
    Never throws an exception.
    """
    personality_cfg = get_personality_config(personality)
    prompt = f"""You are an expert interviewer and mentor evaluating an interview question.
Interviewer Persona: {personality_cfg['name']}. Tone: {personality_cfg.get('evaluation_tone', '')}.

Question: {q}
Candidate Answer: {a}

Rules:
1. Technical Score: 0 to 10 based on conceptual accuracy.
2. Communication Score: 0 to 10 based on clarity and structure.
3. For irrelevant answers, award 0-1 scores and state why in mistakes.
4. For valid short or one-word answers (e.g. 'TCP', 'GIL'), evaluate fairly based on correctness.

Return ONLY a valid JSON object in this format:
{{
  "technical_score": 8,
  "communication_score": 8,
  "strengths": "1-2 sentences on strengths.",
  "mistakes": "1-2 sentences on gaps or mistakes.",
  "improved_answer": "Concise improved response.",
  "correct_answer": "Ideal benchmark response.",
  "correct_concepts": ["concept 1"],
  "missing_concepts": ["concept 2"],
  "improvement_suggestions": ["tip 1"],
  "key_takeaways": ["takeaway 1"],
  "follow_up_questions": ["question 1"]
}}"""
    try:
        raw = _call_groq([{"role": "user", "content": prompt}], max_tokens=1500, temperature=0.2, context="single_question_eval")
        parsed = _extract_json(raw)
        if isinstance(parsed, list) and len(parsed) > 0:
            parsed = parsed[0]
        if isinstance(parsed, dict) and ("technical_score" in parsed or "strengths" in parsed):
            try:
                tech = max(0, min(10, int(float(parsed.get("technical_score", 5)))))
            except Exception:
                tech = 5
            try:
                comm = max(0, min(10, int(float(parsed.get("communication_score", 6)))))
            except Exception:
                comm = 6
            return {
                "technical_score": tech,
                "communication_score": comm,
                "strengths": str(parsed.get("strengths") or "Addressed the question premise."),
                "mistakes": str(parsed.get("mistakes") or "Could provide deeper technical detail."),
                "improved_answer": str(parsed.get("improved_answer") or f"For {q}: Structure answer with definition and trade-offs."),
                "correct_answer": str(parsed.get("correct_answer") or f"An authoritative answer for '{q}' outlines core architecture."),
                "correct_concepts": _clean_str_list(parsed.get("correct_concepts"), []),
                "missing_concepts": _clean_str_list(parsed.get("missing_concepts"), ["Implementation details"]),
                "improvement_suggestions": _clean_str_list(parsed.get("improvement_suggestions"), ["Structure response with Definition -> Mechanism -> Trade-off"]),
                "key_takeaways": _clean_str_list(parsed.get("key_takeaways"), [f"Master principles of '{q}'."]),
                "follow_up_questions": _clean_str_list(parsed.get("follow_up_questions"), ["How would you optimize this?"]),
            }
    except Exception as e:
        _safe_print(f"[SINGLE Q EVAL RECOVERY]: {e}")
    return _build_fallback_evaluation(q, a)


def evaluate_interview(questions, answers, personality="technical"):
    """
    Evaluate candidate answers against questions with ultra-reliable micro-batching and resilient error recovery.
    - Instantly fast-paths empty or skipped answers without burning Groq tokens.
    - Accurately detects and scores keyboard mash / gibberish with 0 score and constructive feedback.
    - Evaluates valid short, one-word, and detailed answers fairly based on conceptual accuracy.
    - Micro-batches answered questions in chunks of 2 with generous token allowance (2500) to eliminate finish_reason='length'.
    - Runs chunks concurrently in ThreadPoolExecutor for 3-5 second total turnaround.
    - Recovers missing chunk items or failed chunks individually so the evaluation NEVER throws an unhandled error.
    - Guarantees a 100% complete list of valid evaluation objects.
    """
    if not questions:
        return []

    personality_cfg = get_personality_config(personality)
    pairs = list(zip(questions, list(answers) + [""] * (len(questions) - len(answers))))

    evaluations = [None] * len(questions)
    items_for_ai = []

    for idx, (q, a) in enumerate(pairs):
        if _is_skipped_or_empty(a):
            evaluations[idx] = _build_skipped_evaluation(q)
        elif _is_gibberish_text(a):
            evaluations[idx] = _build_gibberish_evaluation(q, a)
        else:
            items_for_ai.append((idx, q, a))

    # If no questions require AI inference, return immediately
    if not items_for_ai:
        _safe_print("[EVALUATION] All questions fast-pathed (skipped/gibberish). Finished in 0ms.")
        return evaluations

    # Micro-batch answered questions in chunks of at most 2 for maximum model reliability and speed
    batch_size = 2
    chunks = [items_for_ai[i:i + batch_size] for i in range(0, len(items_for_ai), batch_size)]

    def _evaluate_single_chunk(chunk_idx, chunk):
        qa_text = ""
        for item_i, (orig_idx, q, a) in enumerate(chunk, start=1):
            qa_text += f"\n--- Item {item_i} ---\nQuestion: {q}\nCandidate Answer: {a}\n"

        prompt = f"""You are an expert interviewer evaluating technical interview answers.
Interviewer Persona: {personality_cfg['name']}. Tone: {personality_cfg.get('evaluation_tone', '')}.

Evaluate each candidate answer against its respective question.
Rules:
1. Technical Score: 0 to 10 based on conceptual accuracy.
2. Communication Score: 0 to 10 based on clarity and structure.
3. For irrelevant answers, award 0-1 scores and state why in mistakes.
4. For valid short or one-word answers (e.g. 'TCP', 'GIL', 'B-Tree'), evaluate fairly based on accuracy.
5. Return a JSON array of exactly {len(chunk)} evaluation objects corresponding to the {len(chunk)} items in order.

Format:
[
  {{
    "technical_score": 8,
    "communication_score": 8,
    "strengths": "Concise sentence highlighting strengths.",
    "mistakes": "Concise sentence noting missing concepts or inaccuracies.",
    "improved_answer": "Concise improved response.",
    "correct_answer": "Concise ideal benchmark response.",
    "correct_concepts": ["concept 1"],
    "missing_concepts": ["concept 2"],
    "improvement_suggestions": ["tip 1"],
    "key_takeaways": ["takeaway 1"],
    "follow_up_questions": ["question 1"]
  }}
]

Items to Evaluate:
{qa_text}"""
        messages = [{"role": "user", "content": prompt}]
        raw_response = _call_groq(messages, max_tokens=2500, temperature=0.2, context=f"evaluate_chunk_{chunk_idx}")
        extracted = _extract_json(raw_response)
        parsed_chunk = []
        if isinstance(extracted, dict):
            for key in ["evaluations", "results", "data", "answers", "questions"]:
                if key in extracted and isinstance(extracted[key], list):
                    parsed_chunk = extracted[key]
                    break
            else:
                parsed_chunk = [extracted]
        elif isinstance(extracted, list):
            parsed_chunk = extracted

        chunk_results = []
        for c_i, (orig_idx, q, a) in enumerate(chunk):
            item = parsed_chunk[c_i] if c_i < len(parsed_chunk) and isinstance(parsed_chunk[c_i], dict) else None
            if item is not None and ("technical_score" in item or "strengths" in item):
                try:
                    tech = max(0, min(10, int(float(item.get("technical_score", 5)))))
                except Exception:
                    tech = 5
                try:
                    comm = max(0, min(10, int(float(item.get("communication_score", 6)))))
                except Exception:
                    comm = 6
                chunk_results.append((orig_idx, {
                    "technical_score": tech,
                    "communication_score": comm,
                    "strengths": str(item.get("strengths") or "Addressed the core question premise."),
                    "mistakes": str(item.get("mistakes") or "Needs deeper technical precision and operational detail."),
                    "improved_answer": str(item.get("improved_answer") or f"For {q}: Structure explanation with definition and trade-offs."),
                    "correct_answer": str(item.get("correct_answer") or f"An authoritative answer for '{q}' outlines core mechanisms."),
                    "correct_concepts": _clean_str_list(item.get("correct_concepts"), []),
                    "missing_concepts": _clean_str_list(item.get("missing_concepts"), ["Implementation details"]),
                    "improvement_suggestions": _clean_str_list(item.get("improvement_suggestions"), ["Structure response with Definition -> Mechanism -> Trade-off"]),
                    "key_takeaways": _clean_str_list(item.get("key_takeaways"), [f"Master principles of '{q}'."]),
                    "follow_up_questions": _clean_str_list(item.get("follow_up_questions"), ["How would you optimize this in production?"]),
                }))
            else:
                _safe_print(f"[CHUNK ITEM RECOVERY] Item {orig_idx} missing from chunk response, recovering safely...")
                chunk_results.append((orig_idx, _evaluate_single_question_safely(q, a, personality)))
        return chunk_results

    if len(chunks) == 1:
        try:
            chunk_res = _evaluate_single_chunk(0, chunks[0])
            for orig_idx, eval_dict in chunk_res:
                evaluations[orig_idx] = eval_dict
        except Exception as e:
            _safe_print(f"[CHUNK ERROR 0]: {e}. Recovering chunk items safely...")
            for orig_idx, q, a in chunks[0]:
                evaluations[orig_idx] = _evaluate_single_question_safely(q, a, personality)
    else:
        with ThreadPoolExecutor(max_workers=min(3, len(chunks))) as executor:
            future_to_chunk = {executor.submit(_evaluate_single_chunk, idx, c): c for idx, c in enumerate(chunks)}
            for future in as_completed(future_to_chunk):
                chunk = future_to_chunk[future]
                try:
                    chunk_res = future.result(timeout=45)
                    for orig_idx, eval_dict in chunk_res:
                        evaluations[orig_idx] = eval_dict
                except Exception as e:
                    _safe_print(f"[CHUNK ERROR RECOVERY]: {e}. Recovering chunk items safely...")
                    for orig_idx, q, a in chunk:
                        evaluations[orig_idx] = _evaluate_single_question_safely(q, a, personality)

    # Ensure no None entries remain anywhere
    for idx, (q, a) in enumerate(pairs):
        if evaluations[idx] is None:
            if _is_skipped_or_empty(a):
                evaluations[idx] = _build_skipped_evaluation(q)
            else:
                evaluations[idx] = _build_fallback_evaluation(q, a)

    return evaluations


def _build_fallback_summary(results):
    """Generate a high-quality deterministic fallback summary based on evaluation results."""
    scores = [int(r.get("technical_score", 0)) for r in results if isinstance(r, dict)]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    if avg_score >= 7.5:
        recommendation = "Ready"
        summary_text = f"Strong performance with an average score of {avg_score}/10. Demonstrates solid core technical understanding and clear communication across interview topics."
        strengths_text = "Clear conceptual clarity, structured answers, and strong fundamental knowledge."
        weaknesses_text = "Minor gaps in advanced edge cases and practical optimization scenarios."
        advice_text = "Continue practicing system design and advanced problem scenarios to excel in top-tier interviews."
    elif avg_score >= 5.0:
        recommendation = "Almost Ready"
        summary_text = f"Moderate performance with an average score of {avg_score}/10. Demonstrates basic familiarity with key concepts, but needs deeper technical precision."
        strengths_text = "Good understanding of fundamentals and honest attempt across technical topics."
        weaknesses_text = "Answers lacked in-depth technical terminology, concrete examples, and trade-off analysis."
        advice_text = "Focus on structuring answers with definitions, examples, and best practices. Revise core topics thoroughly."
    else:
        recommendation = "Needs Improvement"
        summary_text = f"Candidate scored an average of {avg_score}/10. Foundational concepts require structured revision before upcoming campus placements."
        strengths_text = "Identified core subject areas to focus on."
        weaknesses_text = "Significant gaps in conceptual definitions, technical terminology, and practical explanations."
        advice_text = "Review fundamental subject tutorials, practice mock interview questions, and write code snippets regularly."

    return {
        "summary": summary_text,
        "strengths": strengths_text,
        "weaknesses": weaknesses_text,
        "advice": advice_text,
        "recommendation": recommendation
    }


def generate_overall_summary(results, personality="technical"):
    """
    Generate overall summary, strengths, weaknesses, and recommendation based on evaluation results.
    Uses condensed metrics to minimize LLM token count and ensure fast sub-second completion.
    Reflects the chosen interviewer persona's perspective.
    """
    if not results:
        return _build_fallback_summary(results)

    personality_cfg = get_personality_config(personality)

    condensed = [
        {
            "question_num": i + 1,
            "technical_score": r.get("technical_score", 0),
            "communication_score": r.get("communication_score", 0),
            "strengths": r.get("strengths", ""),
            "mistakes": r.get("mistakes", "")
        }
        for i, r in enumerate(results) if isinstance(r, dict)
    ]

    prompt = f"""
You are an expert interviewer and mentor acting as: {personality_cfg['name']} ({personality_cfg.get('tone', '')}).

Analyze these condensed interview results from your persona's perspective:
{json.dumps(condensed, indent=2)}

Return ONLY valid JSON in this exact format:
{{
    "summary": "2-3 sentences summarizing overall candidate performance.",
    "strengths": "Key technical strengths observed across responses.",
    "weaknesses": "Key technical weaknesses or knowledge gaps.",
    "advice": "Actionable placement preparation advice.",
    "recommendation": "Ready"
}}

Rules:
1. "recommendation" MUST be exactly one of: "Ready", "Almost Ready", "Needs Improvement".
2. Return ONLY JSON.
"""

    messages = [{"role": "user", "content": prompt}]

    try:
        raw_response = _call_groq(messages, max_tokens=600, temperature=0.3, context="generate_overall_summary")
        parsed = _extract_json(raw_response)

        if isinstance(parsed, dict) and "summary" in parsed:
            rec = str(parsed.get("recommendation", "")).strip()
            if "ready" in rec.lower() and "almost" not in rec.lower():
                parsed["recommendation"] = "Ready"
            elif "almost" in rec.lower():
                parsed["recommendation"] = "Almost Ready"
            else:
                parsed["recommendation"] = "Needs Improvement"

            return {
                "summary": str(parsed.get("summary", "")),
                "strengths": str(parsed.get("strengths", "")),
                "weaknesses": str(parsed.get("weaknesses", "")),
                "advice": str(parsed.get("advice", "")),
                "recommendation": parsed["recommendation"]
            }
    except Exception as e:
        _safe_print(f"[SUMMARY AI ERROR]: {e}")

    # Honest factual aggregation from candidate's real evaluations if LLM is unreachable
    scores = [int(r.get("technical_score", 0)) for r in results if isinstance(r, dict)]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    top_strengths = [r.get("strengths") for r in results if isinstance(r, dict) and r.get("technical_score", 0) >= 6 and r.get("strengths")]
    top_weaknesses = [r.get("mistakes") for r in results if isinstance(r, dict) and r.get("technical_score", 0) < 6 and r.get("mistakes")]

    rec = "Ready" if avg_score >= 7.5 else ("Almost Ready" if avg_score >= 5.0 else "Needs Improvement")

    return {
        "summary": f"Interview completed with an overall average technical score of {avg_score}/10 based on candidate responses.",
        "strengths": top_strengths[0] if top_strengths else "Demonstrated participation across technical question rounds.",
        "weaknesses": top_weaknesses[0] if top_weaknesses else "Deepen discussions around system scalability and production trade-offs.",
        "advice": "Review question-level feedback, practice structured explanations, and reinforce weak topic areas.",
        "recommendation": rec
    }


def _build_fallback_learning_content(role, weak_skills):
    """Generate high-quality fallback learning resources for each weak skill."""
    topics = []
    for skill in weak_skills:
        skill_name = str(skill).strip()
        if not skill_name:
            continue
        topics.append({
            "skill": skill_name,
            "summary": f"Mastering {skill_name} is essential for excelling as a {role}, helping you build scalable systems, write clean code, and succeed in technical interviews.",
            "youtube_searches": [
                f"{skill_name} complete tutorial for beginners",
                f"{skill_name} advanced interview concepts",
                f"{skill_name} full project crash course"
            ],
            "udemy_searches": [
                f"{skill_name} bootcamp masterclass",
                f"{skill_name} from zero to hero"
            ],
            "google_doc_searches": [
                f"{skill_name} official documentation roadmap",
                f"{skill_name} cheatsheet best practices"
            ],
            "key_concepts": [
                f"{skill_name} Core Fundamentals & Architecture",
                f"State Management and Data Flow in {skill_name}",
                f"Performance Optimization and Efficiency",
                f"Testing, Debugging, and Troubleshooting",
                f"Real-World Best Practices and Industry Standards"
            ]
        })
    return {"topics": topics}


def generate_learning_content(role, weak_skills):
    """
    Generate structured learning plan and resources based on weak skills with fallback support.
    """
    if isinstance(weak_skills, str):
        weak_skills = [s.strip() for s in weak_skills.split(",") if s.strip()]
    elif isinstance(weak_skills, list):
        weak_skills = [str(s).strip() for s in weak_skills if str(s).strip()]
    else:
        weak_skills = []

    if not weak_skills:
        return {"topics": []}

    skills_str = ", ".join(weak_skills)

    prompt = f"""
You are an expert career coach and senior technical advisor.

A candidate preparing for the role of '{role}' needs a structured learning plan for these skills:
{skills_str}

Generate high-quality learning resources and core concepts.

Return ONLY valid JSON in this exact structure:
{{
  "topics": [
    {{
      "skill": "Skill Name",
      "summary": "2-3 sentences explaining the significance of this skill for the {role} role.",
      "youtube_searches": [
        "Search Query 1",
        "Search Query 2",
        "Search Query 3"
      ],
      "udemy_searches": [
        "Course Search 1",
        "Course Search 2"
      ],
      "google_doc_searches": [
        "Doc Search 1",
        "Doc Search 2"
      ],
      "key_concepts": [
        "Concept 1",
        "Concept 2",
        "Concept 3",
        "Concept 4",
        "Concept 5"
      ]
    }}
  ]
}}

Rules:
1. Include exactly one topic object for each skill in the list ({skills_str}).
2. Provide realistic, highly targeted search queries and concepts.
3. Return ONLY valid JSON, no conversational markdown.
"""

    messages = [{"role": "user", "content": prompt}]

    try:
        raw_response = _call_groq(messages, max_tokens=3072, temperature=0.3, context="generate_learning_content")
        parsed = _extract_json(raw_response)

        raw_topics = []
        if isinstance(parsed, dict):
            for key in ["topics", "learning_plan", "skills", "resources", "data"]:
                if key in parsed and isinstance(parsed[key], list):
                    raw_topics = parsed[key]
                    break
            else:
                raw_topics = [parsed]
        elif isinstance(parsed, list):
            raw_topics = parsed

        if raw_topics:
            normalized_topics = []
            for i, topic in enumerate(raw_topics):
                if not isinstance(topic, dict):
                    continue
                default_skill = weak_skills[i] if i < len(weak_skills) else f"Skill {i+1}"
                normalized_topics.append({
                    "skill": str(topic.get("skill") or default_skill),
                    "summary": str(topic.get("summary") or f"Important foundational knowledge for {role}."),
                    "youtube_searches": [str(x) for x in topic.get("youtube_searches", []) if x] or [f"{default_skill} tutorial"],
                    "udemy_searches": [str(x) for x in topic.get("udemy_searches", []) if x] or [f"{default_skill} course"],
                    "google_doc_searches": [str(x) for x in topic.get("google_doc_searches", []) if x] or [f"{default_skill} documentation"],
                    "key_concepts": [str(x) for x in topic.get("key_concepts", []) if x] or [f"Core {default_skill} fundamentals"]
                })

            if normalized_topics:
                return {"topics": normalized_topics}

    except Exception as e:
        _safe_print(f"[LEARNING GEN ERROR]: {e}")

    raise RuntimeError("AI service is temporarily unavailable. Please try again.")


def _get_ats_scorer():
    """Helper to lazily import ats_scorer avoiding circular dependencies."""
    try:
        from services.ats_scorer import evaluate_ats_score, calculate_jd_alignment
        return evaluate_ats_score, calculate_jd_alignment
    except ImportError:
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        from services.ats_scorer import evaluate_ats_score, calculate_jd_alignment
        return evaluate_ats_score, calculate_jd_alignment


def analyze_resume(resume_text, job_description=None):
    """
    Deterministic ATS Evaluation with Grounded AI Qualitative Insights.
    Calculates deterministic ATS score (0-100), factor breakdown, and detected skills.
    Differentiates between General Resume Quality Score and Job-Specific ATS Match Score.
    Enhances qualitative feedback (strengths, improvement areas, suggestions, summary, skills analysis) via Groq LLM.
    If AI service fails, deterministic scores and factors are 100% preserved.
    """
    evaluate_ats_score_fn, _ = _get_ats_scorer()
    base_eval = evaluate_ats_score_fn(resume_text, job_description=job_description)

    # If resume text is empty or invalid, return base evaluation directly
    if not resume_text or not resume_text.strip():
        return base_eval

    score_label = base_eval.get("score_label", "Score")
    jd_context_str = f"\nTarget Job Description:\n{job_description[:1500]}\n" if job_description else ""

    # Condense candidate resume text (up to 2800 chars) to prevent excessive token consumption
    condensed_text = "\n".join([line.strip() for line in resume_text.splitlines() if line.strip()])[:2800]

    prompt = f"""You are an expert ATS Resume Coach and Technical Hiring Specialist.
Evaluate this candidate resume and provide rigorous, personalized, and actionable feedback based on their actual content.

Deterministic ATS Score: {base_eval['ats_score']}/100 ({score_label})
Detected Skills: {', '.join(base_eval.get('skills', [])) if base_eval.get('skills') else 'See resume'}
{jd_context_str}
Candidate Resume Content:
{condensed_text}

Instructions:
1. Base feedback STRICTLY on the candidate's actual skills, projects, and work history.
2. DO NOT hallucinate tools, companies, or accomplishments not mentioned in the resume.
3. Be constructive, candid, and concrete.

Return ONLY a valid JSON object matching this schema:
{{
    "summary": "Concise 2-3 sentence executive summary of the candidate's technical profile and professional positioning.",
    "skills_analysis": "Technical evaluation of skill depth, stack coherence, and domain breadth.",
    "strengths": "• Strength 1 based on actual resume\\n• Strength 2 based on actual resume\\n• Strength 3 based on actual resume",
    "weaknesses": "• Gap 1 identified in resume\\n• Gap 2 identified in resume",
    "project_experience_feedback": "Constructive assessment of work history, quantifiable outcomes, and project depth.",
    "suggestions": "• Action 1 to optimize for ATS\\n• Action 2 to optimize for ATS\\n• Action 3 to optimize for ATS",
    "missing_skills": "Skill 1, Skill 2, Skill 3",
    "action_items": "• Prioritized recommendation 1\\n• Prioritized recommendation 2"
}}
"""

    messages = [{"role": "user", "content": prompt}]

    try:
        raw_response = _call_groq(messages, json_mode=True, max_tokens=1200, temperature=0.2, context="analyze_resume")
        parsed = _extract_json(raw_response)

        if isinstance(parsed, dict) and (parsed.get("strengths") or parsed.get("summary")):
            result = dict(base_eval)
            summary = str(parsed.get("summary") or "").strip()
            skills_analysis = str(parsed.get("skills_analysis") or "").strip()
            strengths = str(parsed.get("strengths") or "").strip()
            weaknesses = str(parsed.get("weaknesses") or "").strip()
            project_feedback = str(parsed.get("project_experience_feedback") or "").strip()
            suggestions = str(parsed.get("suggestions") or "").strip()
            missing_skills = str(parsed.get("missing_skills") or "").strip()
            action_items = str(parsed.get("action_items") or "").strip()

            if summary:
                result["summary"] = summary
            if skills_analysis:
                result["skills_analysis"] = skills_analysis
            if strengths:
                result["strengths"] = strengths
            if weaknesses:
                result["weaknesses"] = weaknesses
            if project_feedback:
                result["project_experience_feedback"] = project_feedback
            if suggestions:
                result["suggestions"] = [s.strip() for s in suggestions.split("\n") if s.strip()] or base_eval["suggestions"]
            if missing_skills:
                result["missing_skills"] = missing_skills
            if action_items:
                result["action_items"] = [a.strip() for a in action_items.split("\n") if a.strip()]

            result["factors"] = base_eval.get("factors", [])
            result["factor_breakdown"] = base_eval.get("factor_breakdown", base_eval.get("factors", []))
            result["ai_feedback_status"] = "available"
            result["ai_feedback_note"] = "Personalized AI feedback successfully generated."
            return result

    except Exception as e:
        _safe_print(f"[ATS AI ADVISORY ERROR (preserves deterministic score)]: {e}")

    # Fallback to pure deterministic evaluation if AI service fails
    fallback_result = dict(base_eval)
    fallback_result["factors"] = base_eval.get("factors", [])
    fallback_result["factor_breakdown"] = base_eval.get("factor_breakdown", base_eval.get("factors", []))
    fallback_result["ai_feedback_status"] = "unavailable"
    fallback_result["ai_feedback_note"] = "AI feedback service temporarily unavailable. Deterministic ATS scores and factor breakdown preserved."
    return fallback_result


def _get_skill_extractor():
    """Helper to lazily import extract_skills avoiding circular dependencies."""
    try:
        from services.skill_extractor import extract_skills
        return extract_skills
    except ImportError:
        try:
            from skill_extractor import extract_skills
            return extract_skills
        except ImportError:
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)
            from services.skill_extractor import extract_skills
            return extract_skills


def analyze_jd_match(resume_text, job_description, explicit_skills=None):
    """
    Deterministic Job Description Alignment with Grounded AI Qualitative Insights.
    Calculates deterministic match score (0-100), matching skills, and missing skills.
    Enhances qualitative advice (relevant experience narrative, strengths, suggestions) via Groq LLM.
    If AI service fails, deterministic scores and skill gap lists are 100% preserved.
    """
    _, calculate_jd_alignment_fn = _get_ats_scorer()
    base_match = calculate_jd_alignment_fn(resume_text, job_description, explicit_skills=explicit_skills)

    # If JD is not provided or unavailable, return base deterministic response immediately
    if not base_match.get("available") or not job_description or not job_description.strip():
        return base_match

    prompt = f"""
You are an expert technical recruiter and talent evaluator.

A candidate's resume has been evaluated against a target Job Description with verified results:
- Match Score: {base_match['match_score']}%
- Matching Skills: {', '.join(base_match['matching_skills']) if base_match['matching_skills'] else 'None directly matching'}
- Missing Skills: {', '.join(base_match['missing_skills']) if base_match['missing_skills'] else 'None detected'}

Candidate Resume:
{resume_text[:3500]}

Target Job Description:
{job_description[:3500]}

Instructions:
1. DO NOT alter or modify the match score ({base_match['match_score']}%).
2. DO NOT change the matching skills or missing skills lists.
3. relevant_experience: Provide 2-3 concise sentences summarizing candidate experience aligning with the JD. DO NOT invent candidate experience.
4. strengths: Provide 2-3 concise sentences describing the candidate's genuine competitive strengths for this posting.
5. improvement_suggestions: Provide 3 concrete, actionable suggestions to bridge skill gaps and tailor their profile.

Return ONLY a valid JSON object matching this schema:
{{
  "relevant_experience": "...",
  "strengths": "...",
  "improvement_suggestions": [
    "Suggestion 1...",
    "Suggestion 2...",
    "Suggestion 3..."
  ]
}}
"""

    messages = [{"role": "user", "content": prompt}]

    try:
        raw_response = _call_groq(messages, json_mode=True, max_tokens=1500, temperature=0.0, context="analyze_jd_match")
        parsed = _extract_json(raw_response)

        if isinstance(parsed, dict):
            def _clean_str_list(val, default=None):
                if isinstance(val, list):
                    return [str(x).strip() for x in val if str(x).strip()]
                if isinstance(val, str) and val.strip():
                    return [s.strip() for s in val.split("\n") if s.strip()]
                return default or []

            relevant_exp = str(parsed.get("relevant_experience") or "").strip()
            strengths_text = str(parsed.get("strengths") or "").strip()
            suggestions = _clean_str_list(parsed.get("improvement_suggestions"))

            result = dict(base_match)
            if relevant_exp:
                result["relevant_experience"] = relevant_exp
            if strengths_text:
                result["strengths"] = strengths_text
            if suggestions:
                result["improvement_suggestions"] = suggestions

            result["ai_feedback_status"] = "available"
            return result

    except Exception as e:
        _safe_print(f"[JD MATCH AI ADVISORY ERROR (preserves deterministic match)]: {e}")

    # Fallback to pure deterministic calculation if AI service fails
    fallback_result = dict(base_match)
    fallback_result["ai_feedback_status"] = "unavailable"
    fallback_result["ai_feedback_note"] = "AI feedback service temporarily unavailable. Deterministic match score and skill gaps preserved."
    return fallback_result


def _build_fallback_roadmap(role, weak_skills):
    """Provides a deterministic 5-day structured curriculum tailored to role and weak skills."""
    skills_list = [s.strip() for s in (weak_skills or []) if s.strip()]
    if not skills_list:
        skills_list = ["System Architecture", "Performance Optimization", "Clean Code Best Practices"]

    s1 = skills_list[0] if len(skills_list) > 0 else "Core Fundamentals"
    s2 = skills_list[1] if len(skills_list) > 1 else s1
    s3 = skills_list[2] if len(skills_list) > 2 else "Scalability & Reliability"

    return {
        "role": role or "Software Engineer",
        "skill_gaps": skills_list[:5],
        "days": [
            {
                "day": 1,
                "title": f"Day 1: Foundations & Architecture of {s1}",
                "focus": f"Solidify mental models and fundamental mechanisms behind {s1}.",
                "tasks": [
                    {
                        "id": "d1_t1",
                        "title": f"Review official documentation and core design patterns for {s1}",
                        "estimated_minutes": 45,
                        "resource_url": f"https://www.google.com/search?q={s1}+official+documentation+roadmap"
                    },
                    {
                        "id": "d1_t2",
                        "title": f"Write an implementation snippet illustrating common configurations and pitfalls in {s1}",
                        "estimated_minutes": 40
                    }
                ],
                "practice_question": f"Explain the fundamental lifecycle and execution model of {s1}.",
                "key_concept": f"Understanding how {s1} manages state and execution prevents critical production bottlenecks."
            },
            {
                "day": 2,
                "title": f"Day 2: Deep Dive into {s2} & Practical Troubleshooting",
                "focus": f"Analyze complex use cases, common failure modes, and debugging techniques for {s2}.",
                "tasks": [
                    {
                        "id": "d2_t1",
                        "title": f"Analyze top 5 interview questions and edge cases regarding {s2}",
                        "estimated_minutes": 45,
                        "resource_url": f"https://www.youtube.com/results?search_query={s2}+interview+questions"
                    },
                    {
                        "id": "d2_t2",
                        "title": f"Implement unit and integration tests covering boundary conditions for {s2}",
                        "estimated_minutes": 35
                    }
                ],
                "practice_question": f"What are the most common performance bottlenecks in {s2} and how do you profile them?",
                "key_concept": f"Always evaluate time/space complexity and observability when applying {s2}."
            },
            {
                "day": 3,
                "title": f"Day 3: Systems Integration & Data Flow",
                "focus": f"Connect {s1} and {s2} in an end-to-end distributed workflow.",
                "tasks": [
                    {
                        "id": "d3_t1",
                        "title": "Design a clean REST/gRPC API contract with robust validation and error handling",
                        "estimated_minutes": 50
                    },
                    {
                        "id": "d3_t2",
                        "title": "Evaluate asynchronous message passing vs synchronous HTTP for service communication",
                        "estimated_minutes": 40
                    }
                ],
                "practice_question": "How do you ensure idempotency and data consistency across independent service boundaries?",
                "key_concept": "Decoupled architecture improves resilience and fault isolation."
            },
            {
                "day": 4,
                "title": f"Day 4: Performance Optimization & {s3}",
                "focus": f"Measure, profile, and optimize resource utilization focusing on {s3}.",
                "tasks": [
                    {
                        "id": "d4_t1",
                        "title": f"Benchmarking and load testing strategies for {role} systems",
                        "estimated_minutes": 45
                    },
                    {
                        "id": "d4_t2",
                        "title": "Implement caching layers (Redis/in-memory) with explicit TTL and eviction policies",
                        "estimated_minutes": 45
                    }
                ],
                "practice_question": "Explain cache-aside vs write-through caching patterns and their trade-offs.",
                "key_concept": "Premature optimization introduces complexity; measure baseline metrics before tuning."
            },
            {
                "day": 5,
                "title": "Day 5: Mock Interview Simulation & Live Synthesis",
                "focus": "Simulate real interview conditions with verbal synthesis and STAR behavioral storytelling.",
                "tasks": [
                    {
                        "id": "d5_t1",
                        "title": "Conduct a 5-question AI Mock Interview on Smart Interview Coach targeting your role",
                        "estimated_minutes": 30
                    },
                    {
                        "id": "d5_t2",
                        "title": "Review AI evaluation breakdown and refine answers targeting technical depth",
                        "estimated_minutes": 30
                    }
                ],
                "practice_question": f"Walk me through a challenging technical problem you solved while working with {s1}.",
                "key_concept": "Effective communication requires concise framing, explicit trade-offs, and measurable impact."
            }
        ]
    }


def generate_learning_roadmap(role, weak_skills=None, resume_skills=None, missing_skills=None):
    """Generates an actionable 5-day curriculum with daily tasks, practice questions, and key concepts."""
    role_str = (role or "Software Engineer").strip()

    weak_list = []
    if isinstance(weak_skills, list):
        weak_list.extend([str(s).strip() for s in weak_skills if str(s).strip()])
    elif isinstance(weak_skills, str) and weak_skills.strip():
        weak_list.extend([s.strip() for s in weak_skills.split(",") if s.strip()])

    if isinstance(missing_skills, list):
        for s in missing_skills:
            clean_s = str(s).strip()
            if clean_s and clean_s not in weak_list:
                weak_list.append(clean_s)

    fallback = _build_fallback_roadmap(role_str, weak_list)
    if not weak_list:
        weak_list = fallback["skill_gaps"]

    prompt = f"""
You are an elite career development mentor and tech lead.
Create an intensive 5-day personalized learning roadmap for a candidate targeting the role of '{role_str}'.

Candidate Skill Gaps to Address:
{', '.join(weak_list[:6])}

Requirements:
1. Provide exactly 5 days (Day 1 to Day 5).
2. Each day must focus on a specific skill gap or integration area.
3. Each day must contain 2 specific, actionable tasks with unique IDs (d1_t1, d1_t2, etc.) and estimated minutes.
4. Each day must contain 1 realistic interview practice question and 1 key concept to remember.
5. Return ONLY a valid JSON object matching the schema below.

JSON Schema:
{{
  "role": "{role_str}",
  "skill_gaps": {json.dumps(weak_list[:6])},
  "days": [
    {{
      "day": 1,
      "title": "Day 1: ...",
      "focus": "...",
      "tasks": [
        {{ "id": "d1_t1", "title": "...", "estimated_minutes": 45, "resource_url": "..." }},
        {{ "id": "d1_t2", "title": "...", "estimated_minutes": 40 }}
      ],
      "practice_question": "...",
      "key_concept": "..."
    }}
  ]
}}
"""
    messages = [{"role": "user", "content": prompt}]
    try:
        raw_res = _call_groq(messages, max_tokens=3072, temperature=0.3, context="generate_learning_roadmap")
        parsed = _extract_json(raw_res)
        if isinstance(parsed, dict) and "days" in parsed and isinstance(parsed["days"], list) and len(parsed["days"]) >= 3:
            parsed["role"] = role_str
            if "skill_gaps" not in parsed:
                parsed["skill_gaps"] = weak_list[:6]
            return parsed
    except Exception as e:
        _safe_print(f"[ROADMAP GEN ERROR]: {e}")

    raise RuntimeError("AI service is temporarily unavailable. Please try again.")
