"""
Daily Quiz Preparation System Service for Intervexa AI.
Generates dynamic daily technical quizzes tailored to the daily learning topic,
difficulty level, and user role. Tracks daily completion status, scores, and review logs.
"""

import os
import sys
import json
import re
import datetime
from typing import Dict, List, Any, Optional

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


def _get_active_study_plan(user_id: int, plan_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Retrieves the active or requested study plan for the user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if plan_id:
            cursor.execute(
                "SELECT id, user_id, target_role, duration_days, preparation_level, status FROM study_plans WHERE id = ? AND user_id = ?",
                (plan_id, user_id),
            )
        else:
            cursor.execute(
                "SELECT id, user_id, target_role, duration_days, preparation_level, status FROM study_plans WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
                (user_id,),
            )
        row = cursor.fetchone()
        if not row:
            # Fallback to any recent plan
            cursor.execute(
                "SELECT id, user_id, target_role, duration_days, preparation_level, status FROM study_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                (user_id,),
            )
            row = cursor.fetchone()

        if not row:
            return None

        return {
            "id": row[0],
            "user_id": row[1],
            "target_role": row[2],
            "duration_days": row[3],
            "preparation_level": row[4],
            "status": row[5],
        }
    finally:
        conn.close()


def _get_plan_task_for_day(user_id: int, plan_id: int, day_number: int) -> Optional[Dict[str, Any]]:
    """Retrieves the specific study task for a given day in the plan."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT id, plan_id, day_number, topic, difficulty, status, task_date, description
            FROM study_tasks
            WHERE plan_id = ? AND day_number = ? AND user_id = ?
            LIMIT 1
            """,
            (plan_id, day_number, user_id),
        )
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "plan_id": row[1],
                "day_number": row[2],
                "topic": row[3],
                "difficulty": row[4] or "Intermediate",
                "status": row[5],
                "task_date": str(row[6]),
                "description": row[7],
            }
        return None
    finally:
        conn.close()


def _get_previous_quiz_questions(user_id: int, plan_id: int, current_day: int) -> List[str]:
    """Retrieves question texts from previous days' quizzes to ensure no repetition."""
    conn = get_db_connection()
    cursor = conn.cursor()
    previous_questions: List[str] = []
    try:
        cursor.execute(
            """
            SELECT questions_json FROM daily_quizzes
            WHERE user_id = ? AND plan_id = ? AND day_number != ?
            """,
            (user_id, plan_id, current_day),
        )
        rows = cursor.fetchall()
        for r in rows:
            try:
                q_list = json.loads(r[0]) if r[0] else []
                for q in q_list:
                    if isinstance(q, dict) and q.get("question"):
                        previous_questions.append(q["question"].strip())
            except Exception:
                continue
    finally:
        conn.close()
    return previous_questions[:25]


def _generate_deterministic_fallback_questions(
    topic: str,
    role: str,
    difficulty: str,
    day_number: int
) -> List[Dict[str, Any]]:
    """High-quality deterministic fallback technical questions if LLM is unavailable."""
    clean_topic = topic.strip()
    clean_lower = clean_topic.lower()

    # Specialized questions for React / Frontend Architecture
    if any(k in clean_lower for k in ["react", "frontend", "component", "ui", "dom", "redux", "state management"]):
        return [
            {
                "id": 1,
                "question": "In React 18+, what is the primary purpose of the useEffect cleanup function?",
                "options": [
                    "A) To synchronously abort HTTP requests before the component initial render",
                    "B) To clean up subscriptions, timers, or event listeners before the component unmounts or before re-running the effect",
                    "C) To force re-rendering of parent components whenever props change",
                    "D) To reset the component's internal state to initial values upon each re-render"
                ],
                "correct_answer": "B",
                "explanation": "The cleanup function runs before the component unmounts and before the effect re-runs on subsequent renders to prevent memory leaks and dangling subscriptions.",
                "tested_concept": "React Hooks Lifecycle & Memory Management"
            },
            {
                "id": 2,
                "question": "Which hook should be used to memoize an expensive computational calculation between renders in React?",
                "options": [
                    "A) useCallback",
                    "B) useMemo",
                    "C) useRef",
                    "D) useTransition"
                ],
                "correct_answer": "B",
                "explanation": "useMemo caches the calculated result of an expensive function until one of its declared dependencies changes, avoiding redundant recalculations.",
                "tested_concept": "Performance Optimization & Memoization"
            },
            {
                "id": 3,
                "question": "Why does React require a stable and unique 'key' prop when rendering dynamic lists?",
                "options": [
                    "A) To bind list item styles directly to CSS stylesheets",
                    "B) To allow the reconciliation algorithm to efficiently identify which items changed, were added, or were removed",
                    "C) To enforce strict alphabetical sorting of rendered DOM nodes",
                    "D) To prevent asynchronous JavaScript execution while traversing elements"
                ],
                "correct_answer": "B",
                "explanation": "Stable keys allow React's virtual DOM reconciliation algorithm to match previous trees with new trees without re-mounting the entire list unnecessarily.",
                "tested_concept": "Virtual DOM Reconciliation"
            },
            {
                "id": 4,
                "question": "In React state management, why is mutating state objects directly considered an anti-pattern?",
                "options": [
                    "A) React relies on shallow reference equality checks (Object.is) to detect state changes and schedule re-renders",
                    "B) Direct mutation causes browsers to throw unhandled SyntaxErrors",
                    "C) Virtual DOM will immediately crash if object properties are re-assigned",
                    "D) Props cannot be passed to child components if objects are mutated"
                ],
                "correct_answer": "A",
                "explanation": "React compares previous and next states by object reference; direct mutations do not change the reference, so React fails to trigger re-renders.",
                "tested_concept": "Immutability & State Updates"
            },
            {
                "id": 5,
                "question": "What is the key advantage of React Server Components (RSC) compared to traditional client-side rendering?",
                "options": [
                    "A) They completely eliminate the need for server-side databases",
                    "B) They execute exclusively on the server and send zero JavaScript bundle weight to the client for server-only dependencies",
                    "C) They force all animations to run in WebAssembly",
                    "D) They allow browser localStorage to be accessed synchronously on the server"
                ],
                "correct_answer": "B",
                "explanation": "Server Components run on the server and keep heavy dependencies on the backend, dramatically reducing client JavaScript bundle sizes.",
                "tested_concept": "Modern Frontend Architecture & RSC"
            }
        ]

    # Specialized questions for SQL & Database Design
    if any(k in clean_lower for k in ["sql", "database", "query", "schema", "indexing", "relational", "orm"]):
        return [
            {
                "id": 1,
                "question": "What is the primary difference between a clustered and a non-clustered index in relational databases?",
                "options": [
                    "A) A clustered index stores index keys in RAM while non-clustered indexes are written to disk",
                    "B) A clustered index defines the physical order of data rows in the table; only one clustered index can exist per table",
                    "C) Non-clustered indexes cannot be used in WHERE clause lookups",
                    "D) Clustered indexes can only be created on VARCHAR columns"
                ],
                "correct_answer": "B",
                "explanation": "A clustered index physically orders the rows on disk, meaning a table can have only one clustered index (typically on the primary key).",
                "tested_concept": "Database Indexing Architecture"
            },
            {
                "id": 2,
                "question": "In transaction management, which ACID property guarantees that all operations within a transaction succeed completely or are rolled back entirely?",
                "options": [
                    "A) Atomicity",
                    "B) Consistency",
                    "C) Isolation",
                    "D) Durability"
                ],
                "correct_answer": "A",
                "explanation": "Atomicity ensures the 'all-or-nothing' execution rule: if any statement fails, the entire transaction is rolled back to leave state unchanged.",
                "tested_concept": "ACID Properties"
            },
            {
                "id": 3,
                "question": "What causes the classic 'N+1 Query Problem' when using Object-Relational Mapping (ORM) frameworks?",
                "options": [
                    "A) An index is missing on the primary key of the parent entity",
                    "B) The application loads N parent records with 1 query, then issues N separate individual queries to fetch each parent's related child records",
                    "C) The database connection pool size is configured exactly to N + 1 threads",
                    "D) A recursive common table expression executes more than N times"
                ],
                "correct_answer": "B",
                "explanation": "Lazy-loading related entities in loops results in 1 initial query plus N queries for children, drastically increasing database round-trips. Fixed using eager loading (JOINs).",
                "tested_concept": "ORM Optimization & N+1 Problem"
            },
            {
                "id": 4,
                "question": "Which database normalization form requires removing transitive functional dependencies (non-key attributes depending on other non-key attributes)?",
                "options": [
                    "A) First Normal Form (1NF)",
                    "B) Second Normal Form (2NF)",
                    "C) Third Normal Form (3NF)",
                    "D) Boyce-Codd Normal Form (BCNF)"
                ],
                "correct_answer": "C",
                "explanation": "3NF requires that a table is in 2NF and that all non-key columns depend only on the primary key, eliminating transitive dependencies.",
                "tested_concept": "Database Normalization"
            },
            {
                "id": 5,
                "question": "What is the primary benefit of applying database read replicas with asynchronous replication?",
                "options": [
                    "A) Guarantees zero latency on write transactions",
                    "B) Offloads read-heavy query traffic from the primary writer node to improve scalability",
                    "C) Eliminates all possibility of data divergence during network partitions",
                    "D) Bypasses foreign key constraint verification automatically"
                ],
                "correct_answer": "B",
                "explanation": "Read replicas scale horizontal read throughput by distributing SELECT queries away from the primary master node.",
                "tested_concept": "High Availability & Read Scalability"
            }
        ]

    # Specialized questions for REST APIs & Web Services
    if any(k in clean_lower for k in ["api", "rest", "endpoint", "http", "microservice", "web service"]):
        return [
            {
                "id": 1,
                "question": "In RESTful architecture, which HTTP methods are defined as idempotent according to the RFC HTTP specification?",
                "options": [
                    "A) POST and PATCH only",
                    "B) GET, PUT, DELETE, and HEAD",
                    "C) POST, GET, and CONNECT",
                    "D) Only GET requests are idempotent"
                ],
                "correct_answer": "B",
                "explanation": "An idempotent method can be called multiple times with identical parameters and produce the same server-side state as a single invocation. GET, PUT, and DELETE are idempotent.",
                "tested_concept": "HTTP Method Idempotency"
            },
            {
                "id": 2,
                "question": "What is the semantic distinction between HTTP status code 401 Unauthorized and 403 Forbidden?",
                "options": [
                    "A) 401 means the client lacks valid authentication credentials; 403 means the client is authenticated but lacks required authorization permissions",
                    "B) 401 is used for rate limiting; 403 is used for missing URLs",
                    "C) 401 indicates server failure; 403 indicates database downtime",
                    "D) Both status codes are interchangeable in modern web applications"
                ],
                "correct_answer": "A",
                "explanation": "401 indicates authentication is missing or invalid; 403 indicates authentication is known, but access to the requested resource is disallowed.",
                "tested_concept": "HTTP Status Codes & Security Semantics"
            },
            {
                "id": 3,
                "question": "When designing high-volume API pagination, why is cursor-based pagination preferred over offset-based pagination (LIMIT/OFFSET)?",
                "options": [
                    "A) Offset pagination cannot sort results chronologically",
                    "B) Cursor pagination provides O(1) index seeks and prevents skipped or duplicated records when new rows are inserted concurrently",
                    "C) Cursor pagination avoids encoding responses in JSON",
                    "D) Offset pagination requires full-table locks during query execution"
                ],
                "correct_answer": "B",
                "explanation": "Large offsets force the database to scan and discard thousands of rows (O(N)), and concurrent writes cause page shifts. Cursors leverage indexed pointers.",
                "tested_concept": "API Pagination Strategies"
            },
            {
                "id": 4,
                "question": "Which HTTP header and status code combination should a server return when a client exceeds its designated API rate limit?",
                "options": [
                    "A) 400 Bad Request with 'X-Error-Reason'",
                    "B) 429 Too Many Requests with 'Retry-After'",
                    "C) 503 Service Unavailable with 'Keep-Alive'",
                    "D) 404 Not Found with 'Cache-Control'"
                ],
                "correct_answer": "B",
                "explanation": "HTTP 429 (Too Many Requests) accompanied by the 'Retry-After' header informs the client how long to wait before issuing further requests.",
                "tested_concept": "API Rate Limiting & Throttling"
            },
            {
                "id": 5,
                "question": "What is the primary role of a Reverse Proxy (e.g., NGINX, Cloudflare) positioned in front of backend API services?",
                "options": [
                    "A) Directly compiling Python/Java source files in real time",
                    "B) Handling SSL termination, load balancing, request routing, and caching before forwarding to application workers",
                    "C) Replacing the database management system",
                    "D) Enforcing browser CSS rendering rules"
                ],
                "correct_answer": "B",
                "explanation": "Reverse proxies terminate TLS connections, distribute incoming requests across backend nodes, and cache responses to protect application servers.",
                "tested_concept": "Gateway Architecture & Reverse Proxies"
            }
        ]

    # Specialized questions for Authentication & Security
    if any(k in clean_lower for k in ["auth", "security", "jwt", "oauth", "token", "session", "cryptography"]):
        return [
            {
                "id": 1,
                "question": "In JSON Web Token (JWT) architecture, why is storing sensitive secrets (e.g., user passwords or API keys) inside the JWT payload considered dangerous?",
                "options": [
                    "A) JWT tokens cannot be transmitted over HTTP connections",
                    "B) The payload is only Base64URL-encoded, not encrypted, meaning anyone with the token can decode and view its claims",
                    "C) The signature verification algorithm will reject payloads containing strings",
                    "D) Cryptographic hashing functions will corrupt sensitive data"
                ],
                "correct_answer": "B",
                "explanation": "JWT payloads are digitally signed to prevent tampering, but they are not encrypted by default. Any client or intermediary can easily inspect their contents.",
                "tested_concept": "JWT Architecture & Payload Security"
            },
            {
                "id": 2,
                "question": "How does the 'SameSite=Strict' cookie attribute protect web applications against Cross-Site Request Forgery (CSRF)?",
                "options": [
                    "A) It prevents the cookie from ever being sent in requests originating from third-party websites",
                    "B) It encrypts cookie contents with asymmetric public keys",
                    "C) It forces JavaScript to execute in an isolated sandbox",
                    "D) It converts all HTTP POST requests into safe GET requests"
                ],
                "correct_answer": "A",
                "explanation": "SameSite=Strict prevents browsers from attaching session cookies to cross-site requests, effectively blocking unauthorized cross-origin action triggers.",
                "tested_concept": "CSRF Mitigation & Cookie Security"
            },
            {
                "id": 3,
                "question": "What is the purpose of the 'HttpOnly' flag when setting authentication cookies in browser headers?",
                "options": [
                    "A) Ensures the cookie is only sent across HTTPS connections",
                    "B) Prevents client-side scripts (e.g., JavaScript via document.cookie) from accessing the cookie, mitigating XSS token theft",
                    "C) Disables cookie expiration timestamps entirely",
                    "D) Allows cross-origin iframe embedding without restrictions"
                ],
                "correct_answer": "B",
                "explanation": "HttpOnly blocks document.cookie access from JavaScript, protecting session tokens from being exfiltrated during Cross-Site Scripting (XSS) attacks.",
                "tested_concept": "XSS Defense & Session Hardening"
            },
            {
                "id": 4,
                "question": "In OAuth 2.0 Authorization Code flow with PKCE, what security risk does the Proof Key for Code Exchange (PKCE) specifically prevent?",
                "options": [
                    "A) SQL Injection in backend databases",
                    "B) Authorization code interception attacks on public or mobile clients that cannot securely store client secrets",
                    "C) Memory buffer overflows in web servers",
                    "D) Expired TLS certificates on authorization servers"
                ],
                "correct_answer": "B",
                "explanation": "PKCE uses dynamically generated code verifiers and challenges to ensure that intercepted authorization codes cannot be exchanged by malicious third-party apps.",
                "tested_concept": "OAuth 2.0 PKCE Flow"
            },
            {
                "id": 5,
                "question": "Why should password hashes always be salted with a unique random value before hashing with algorithms like bcrypt or Argon2?",
                "options": [
                    "A) Salting decreases the computational work factor of the algorithm",
                    "B) Salting prevents precomputed dictionary attacks (rainbow tables) and ensures identical passwords produce distinct hash values",
                    "C) Salting compresses password hashes into shorter string lengths",
                    "D) Salting is required to allow plain-text password retrieval"
                ],
                "correct_answer": "B",
                "explanation": "A unique salt guarantees that two users with the same password have completely different hashes, neutralizing precomputed rainbow table lookups.",
                "tested_concept": "Cryptographic Salting & Password Hashing"
            }
        ]

    # Specialized questions for Python Fundamentals
    if any(k in clean_lower for k in ["python", "django", "flask", "fastapi", "asyncio", "gil"]):
        return [
            {
                "id": 1,
                "question": "In Python, how does the Global Interpreter Lock (GIL) impact multi-threaded application performance?",
                "options": [
                    "A) It prevents multiple threads from accessing I/O operations simultaneously",
                    "B) It allows only one native thread to execute Python bytecode at a time, limiting CPU-bound speedups across multiple CPU cores",
                    "C) It automatically parallelizes all recursive functions across all available processor cores",
                    "D) It disables garbage collection during multi-threaded execution"
                ],
                "correct_answer": "B",
                "explanation": "The GIL is a mutex that protects Python objects from concurrent corruption; CPU-bound tasks in threads do not run in true parallel. Multiprocessing is used instead.",
                "tested_concept": "Python GIL & Concurrency"
            },
            {
                "id": 2,
                "question": "Why is using a mutable object (such as a list or dictionary) as a default parameter in a Python function dangerous?",
                "options": [
                    "A) The default argument is evaluated only once when the function is defined, persisting mutations across subsequent function calls",
                    "B) Python interpreter raises a TypeError immediately when compiling the function",
                    "C) Mutable arguments are automatically converted into immutable tuples",
                    "D) It causes an infinite recursion loop during execution"
                ],
                "correct_answer": "A",
                "explanation": "Default argument expressions are evaluated once at function definition time. Subsequent calls mutate the same shared instance unless initialized with None.",
                "tested_concept": "Python Function Arguments & Scoping"
            },
            {
                "id": 3,
                "question": "What is the primary memory and performance benefit of using a Generator (yield) over returning a full list in Python?",
                "options": [
                    "A) Generators pre-calculate all values in C memory before iteration begins",
                    "B) Generators produce items lazily on demand (O(1) memory), avoiding loading the entire collection into memory at once",
                    "C) Generators bypass Python's type checking system",
                    "D) Generators automatically write output records to disk"
                ],
                "correct_answer": "B",
                "explanation": "Generators evaluate expressions lazily one item at a time, allowing processing of massive or infinite data streams without RAM exhaustion.",
                "tested_concept": "Python Generators & Lazy Evaluation"
            },
            {
                "id": 4,
                "question": "When defining custom decorators in Python, why should 'functools.wraps' be applied to the wrapper function?",
                "options": [
                    "A) To ensure the decorated function runs asynchronously",
                    "B) To preserve the original function's metadata (such as __name__, __doc__, and type annotations)",
                    "C) To convert the wrapper into a class-based method",
                    "D) To suppress all runtime exceptions raised within the inner function"
                ],
                "correct_answer": "B",
                "explanation": "functools.wraps copies the original function's introspection attributes (__name__, __doc__, docstrings) to the wrapper, preventing debugging confusion.",
                "tested_concept": "Decorators & Metaprogramming"
            },
            {
                "id": 5,
                "question": "In Python memory management, what mechanism is responsible for reclaiming memory occupied by objects with circular references?",
                "options": [
                    "A) Immediate reference counting alone",
                    "B) Generational cyclic garbage collection (gc module)",
                    "C) Virtual memory paging by the host operating system",
                    "D) Dynamic recompilation via PyPy"
                ],
                "correct_answer": "B",
                "explanation": "Reference counting handles immediate deallocation, but cyclic garbage collection is required to detect and clean up circular reference loops.",
                "tested_concept": "Python Memory Management & GC"
            }
        ]

    # Generic architectural fallback questions
    return [
        {
            "id": 1,
            "question": f"In {clean_topic}, what is the primary architectural purpose and operational benefit in {role} workflows?",
            "options": [
                f"A) Eliminates the need for input sanitization and error logging",
                f"B) Improves structural modularity, maintainability, and resource utilization",
                f"C) Bypasses network latency by removing asynchronous execution",
                f"D) Forces synchronous blocking on all downstream database requests"
            ],
            "correct_answer": "B",
            "explanation": f"{clean_topic} provides structured modularity and efficient resource management, reducing system bottlenecks in production.",
            "tested_concept": "Core Architecture & Modularity"
        },
        {
            "id": 2,
            "question": f"When scaling {clean_topic} under heavy concurrent traffic, which practice is considered an anti-pattern?",
            "options": [
                "A) Implementing connection pooling and bounding thread allocation",
                "B) Spawning unbounded parallel workers without memory limits or rate controls",
                "C) Using caching layers for high-read, low-write queries",
                "D) Adding telemetry and latency percentiles to detect regressions"
            ],
            "correct_answer": "B",
            "explanation": "Spawning unbounded workers or threads under heavy load causes resource exhaustion, thread contention, and severe latency spikes.",
            "tested_concept": "Concurrency & Scalability Patterns"
        },
        {
            "id": 3,
            "question": f"Which of the following best represents a critical error handling requirement when designing {clean_topic}?",
            "options": [
                "A) Catching generic exceptions and silently returning null to client consumers",
                "B) Guaranteeing idempotency, structured error codes, and graceful state cleanup",
                "C) Terminating the host process immediately upon receiving unexpected payloads",
                "D) Disabling timeout configurations to prevent prematurely aborted jobs"
            ],
            "correct_answer": "B",
            "explanation": "Production systems rely on idempotent operations, deterministic status codes, and atomic rollback/cleanup upon failures.",
            "tested_concept": "Fault Tolerance & Idempotency"
        },
        {
            "id": 4,
            "question": f"For an engineer operating at {difficulty} level, how should data consistency be managed in {clean_topic}?",
            "options": [
                "A) Prioritizing eventual consistency where appropriate and validating transactional boundaries",
                "B) Ignoring distributed state conflicts because network partitions never occur",
                "C) Storing all state in transient global variables in the application process",
                "D) Delegating validation solely to client browser interfaces"
            ],
            "correct_answer": "A",
            "explanation": "Managing consistency requires understanding ACID vs BASE trade-offs and correctly implementing transactional safety boundaries.",
            "tested_concept": "State Management & Data Consistency"
        },
        {
            "id": 5,
            "question": f"What is the most effective approach to benchmark and profile the performance of {clean_topic}?",
            "options": [
                "A) Measuring p95/p99 response latency and CPU/memory utilization under synthetic load",
                "B) Counting the total number of lines of source code written",
                "C) Running single-threaded manual curl requests on local machines only",
                "D) Disabling garbage collection profiling to improve execution speeds"
            ],
            "correct_answer": "A",
            "explanation": "Evaluating tail latencies (p95/p99) and monitoring resource footprints under load provides accurate performance diagnostics.",
            "tested_concept": "Performance Profiling & Observability"
        }
    ]


def generate_daily_quiz_questions(
    topic: str,
    role: str = "Software Engineer",
    difficulty: str = "Intermediate",
    day_number: int = 1,
    excluded_questions: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Dynamically generates 5 technical multiple choice questions for the daily topic.
    Uses Groq LLM with strict JSON schema and anti-repetition exclusion.
    """
    clean_topic = topic.strip()
    clean_role = role.strip()
    clean_diff = difficulty.strip()
    excluded = excluded_questions or []
    excluded_str = "\n".join([f"- {q}" for q in excluded[:10]]) if excluded else "None"

    system_prompt = (
        "You are a Staff Technical Interviewer and Engineering Lead at Intervexa AI. "
        "Your task is to generate exactly 5 rigorous, practical multiple-choice interview questions "
        "tailored specifically to the designated learning topic, candidate role, and difficulty level. "
        "Questions must test real technical comprehension, edge cases, and architectural best practices. "
        "Each question must have exactly 4 options labeled A), B), C), D). "
        "Explanations must be short (1-2 sentences), clear, and technically accurate. "
        "Respond in strictly valid JSON format only."
    )

    user_prompt = f"""
Generate 5 technical Multiple Choice Questions for:
- Topic: "{clean_topic}"
- Target Role: "{clean_role}"
- Difficulty Level: "{clean_diff}"
- Day Number: Day {day_number}

DO NOT repeat or paraphrase these questions from earlier days:
{excluded_str}

Return a JSON object with this exact structure:
{{
  "topic": "{clean_topic}",
  "difficulty": "{clean_diff}",
  "questions": [
    {{
      "id": 1,
      "question": "Clear, technically precise question testing {clean_topic}?",
      "options": [
        "A) Option A text",
        "B) Option B text",
        "C) Option C text",
        "D) Option D text"
      ],
      "correct_answer": "B",
      "explanation": "Clear 1-2 sentence explanation of why B is correct and other options are incorrect.",
      "tested_concept": "Core concept"
    }}
  ]
}}
"""

    try:
        raw_resp = _call_groq(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            json_mode=True,
            temperature=0.3,
            context=f"Daily Quiz Generation Day {day_number} - {clean_topic}"
        )
        parsed = _extract_json(raw_resp)
        if parsed and isinstance(parsed.get("questions"), list) and len(parsed["questions"]) >= 5:
            # Validate options and formatting
            cleaned_questions = []
            for idx, q in enumerate(parsed["questions"][:5], start=1):
                raw_opts = q.get("options") or []
                if len(raw_opts) < 4:
                    continue
                # Normalize option prefixes
                formatted_opts = []
                labels = ["A)", "B)", "C)", "D)"]
                for i, opt in enumerate(raw_opts[:4]):
                    opt_str = str(opt).strip()
                    if not re.match(r'^[A-D]\)', opt_str):
                        opt_str = f"{labels[i]} {opt_str}"
                    formatted_opts.append(opt_str)

                ans_letter = str(q.get("correct_answer") or "A").strip()[:1].upper()
                if ans_letter not in ["A", "B", "C", "D"]:
                    ans_letter = "A"

                cleaned_questions.append({
                    "id": idx,
                    "question": str(q.get("question") or "").strip(),
                    "options": formatted_opts,
                    "correct_answer": ans_letter,
                    "explanation": str(q.get("explanation") or "").strip(),
                    "tested_concept": str(q.get("tested_concept") or clean_topic).strip(),
                })

            if len(cleaned_questions) >= 5:
                return cleaned_questions
    except Exception as e:
        _safe_print(f"[DAILY QUIZ GENERATION ERROR] Groq failed, using deterministic fallback: {e}")

    # Fallback questions
    return _generate_deterministic_fallback_questions(clean_topic, clean_role, clean_diff, day_number)


def get_or_generate_daily_quiz(
    user_id: int,
    plan_id: Optional[int] = None,
    day_number: Optional[int] = None,
    force_regenerate: bool = False
) -> Dict[str, Any]:
    """
    Retrieves or generates the daily quiz for a specific day in the user's study plan.
    Guarantees:
    - 5 questions per quiz.
    - Matches that day's exact learning topic.
    - Prevents question duplicate repeats from other days.
    - Returns previous score and user choices if already completed.
    """
    plan = _get_active_study_plan(user_id, plan_id)
    if not plan:
        return {
            "success": False,
            "error": "No active study plan found. Please create or activate a study plan first.",
        }

    actual_plan_id = plan["id"]
    role = plan["target_role"]
    prep_level = plan["preparation_level"]

    # If day_number not provided, determine day from today's date or earliest pending day
    if not day_number or day_number < 1:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT day_number FROM study_tasks WHERE plan_id = ? AND user_id = ? AND task_date = CURRENT_DATE LIMIT 1",
                (actual_plan_id, user_id),
            )
            r = cursor.fetchone()
            if r:
                day_number = r[0]
            else:
                # Select earliest pending quiz day in the active plan
                cursor.execute(
                    """
                    SELECT t.day_number
                    FROM study_tasks t
                    LEFT JOIN daily_quizzes q ON t.plan_id = q.plan_id AND t.day_number = q.day_number AND q.user_id = ?
                    WHERE t.plan_id = ? AND t.user_id = ? AND (q.status IS NULL OR q.status != 'completed')
                    ORDER BY t.day_number ASC
                    LIMIT 1
                    """,
                    (user_id, actual_plan_id, user_id),
                )
                r_pending = cursor.fetchone()
                day_number = r_pending[0] if r_pending else 1
        finally:
            conn.close()

    task = _get_plan_task_for_day(user_id, actual_plan_id, day_number)
    topic = task["topic"] if task else f"Day {day_number} Interview Concepts"
    task_difficulty = task["difficulty"] if task else prep_level
    task_id = task["id"] if task else None

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT id, questions_json, user_answers_json, score_pct, total_questions,
                   correct_answers, wrong_answers, status, completed_at
            FROM daily_quizzes
            WHERE user_id = ? AND plan_id = ? AND day_number = ?
            """,
            (user_id, actual_plan_id, day_number),
        )
        existing = cursor.fetchone()

        if existing and not force_regenerate:
            quiz_id, q_json, a_json, score_pct, total_q, correct_a, wrong_a, status, completed_at = existing
            questions = json.loads(q_json) if q_json else []
            user_answers = json.loads(a_json) if a_json else {}

            # Build review structure if completed
            review = []
            if status == "completed":
                for q in questions:
                    qid_str = str(q.get("id"))
                    selected = user_answers.get(qid_str) or user_answers.get(q.get("id"))
                    correct = q.get("correct_answer", "A").upper()
                    is_correct = bool(selected and selected.strip()[:1].upper() == correct)
                    review.append({
                        "id": q.get("id"),
                        "question": q.get("question"),
                        "options": q.get("options", []),
                        "user_selected": selected,
                        "correct_answer": correct,
                        "is_correct": is_correct,
                        "explanation": q.get("explanation", ""),
                        "tested_concept": q.get("tested_concept", ""),
                    })

            return {
                "success": True,
                "quiz_id": quiz_id,
                "plan_id": actual_plan_id,
                "day_number": day_number,
                "topic": topic,
                "role": role,
                "difficulty": task_difficulty,
                "total_questions": len(questions),
                "status": status,
                "score_pct": score_pct or 0.0,
                "correct_answers": correct_a or 0,
                "wrong_answers": wrong_a or 0,
                "completed_at": str(completed_at) if completed_at else None,
                "questions": questions,
                "user_answers": user_answers,
                "review": review,
                "is_completed": (status == "completed"),
            }

        # Need to generate fresh questions
        previous_questions = _get_previous_quiz_questions(user_id, actual_plan_id, day_number)
        questions = generate_daily_quiz_questions(
            topic=topic,
            role=role,
            difficulty=task_difficulty,
            day_number=day_number,
            excluded_questions=previous_questions
        )

        q_json = json.dumps(questions)

        if existing and force_regenerate:
            cursor.execute(
                """
                UPDATE daily_quizzes
                SET topic = ?, role = ?, difficulty = ?, questions_json = ?,
                    user_answers_json = '{}', score_pct = 0, total_questions = ?,
                    correct_answers = 0, wrong_answers = 0, status = 'pending',
                    completed_at = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (topic, role, task_difficulty, q_json, len(questions), existing[0]),
            )
            quiz_id = existing[0]
        else:
            cursor.execute(
                """
                INSERT INTO daily_quizzes (
                    user_id, plan_id, task_id, day_number, topic, role, difficulty,
                    questions_json, total_questions, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                """,
                (user_id, actual_plan_id, task_id, day_number, topic, role, task_difficulty, q_json, len(questions)),
            )
            quiz_id = cursor.lastrowid

        conn.commit()

        return {
            "success": True,
            "quiz_id": quiz_id,
            "plan_id": actual_plan_id,
            "day_number": day_number,
            "topic": topic,
            "role": role,
            "difficulty": task_difficulty,
            "total_questions": len(questions),
            "status": "pending",
            "score_pct": 0.0,
            "correct_answers": 0,
            "wrong_answers": 0,
            "completed_at": None,
            "questions": questions,
            "user_answers": {},
            "review": [],
            "is_completed": False,
        }
    finally:
        conn.close()


def submit_daily_quiz(
    user_id: int,
    plan_id: int,
    day_number: int,
    user_answers: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Validates submitted answers, calculates score, updates daily_quizzes,
    updates learning activity history, topic mastery, and daily task progress.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT id, task_id, topic, questions_json
            FROM daily_quizzes
            WHERE user_id = ? AND plan_id = ? AND day_number = ?
            """,
            (user_id, plan_id, day_number),
        )
        row = cursor.fetchone()
        if not row:
            return {"success": False, "error": f"Quiz for Day {day_number} not found."}

        quiz_id, task_id, topic, q_json = row
        questions = json.loads(q_json) if q_json else []
        if not questions:
            return {"success": False, "error": "No questions found for this quiz."}

        correct_count = 0
        review = []

        for q in questions:
            qid = str(q.get("id"))
            user_choice = str(user_answers.get(qid) or user_answers.get(q.get("id")) or "").strip()
            correct_choice = str(q.get("correct_answer") or "A").strip()[:1].upper()

            # Normalization: match letter (e.g. "B" or "B) Option text")
            is_correct = bool(user_choice and user_choice[:1].upper() == correct_choice)
            if is_correct:
                correct_count += 1

            review.append({
                "id": q.get("id"),
                "question": q.get("question"),
                "options": q.get("options", []),
                "user_selected": user_choice,
                "correct_answer": correct_choice,
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
                "tested_concept": q.get("tested_concept", ""),
            })

        total_questions = len(questions)
        wrong_count = total_questions - correct_count
        score_pct = round((correct_count / total_questions) * 100.0, 1)

        # Update daily_quizzes record
        cursor.execute(
            """
            UPDATE daily_quizzes
            SET user_answers_json = ?, score_pct = ?, total_questions = ?,
                correct_answers = ?, wrong_answers = ?, status = 'completed',
                completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (json.dumps(user_answers), score_pct, total_questions, correct_count, wrong_count, quiz_id),
        )

        # Update learning_activities
        try:
            cursor.execute(
                """
                INSERT INTO learning_activities (
                    user_id, task_id, topic, activity_type, practice_score,
                    total_questions, correct_answers, activity_data
                ) VALUES (?, ?, ?, 'daily_quiz', ?, ?, ?, ?)
                """,
                (
                    user_id,
                    task_id,
                    topic,
                    score_pct,
                    total_questions,
                    correct_count,
                    json.dumps({"day_number": day_number, "score_pct": score_pct}),
                ),
            )
        except Exception as e:
            _safe_print(f"[QUIZ SUBMIT NOTE] learning_activities insert: {e}")

        # Update topic mastery table
        try:
            cursor.execute(
                """
                INSERT INTO study_topic_mastery (
                    user_id, topic, total_attempts, latest_score, average_score,
                    mastery_status, last_practiced_at
                ) VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, topic) DO UPDATE SET
                    total_attempts = total_attempts + 1,
                    latest_score = excluded.latest_score,
                    average_score = (average_score * total_attempts + excluded.latest_score) / (total_attempts + 1),
                    mastery_status = CASE WHEN excluded.latest_score >= 80 THEN 'Mastered' WHEN excluded.latest_score >= 60 THEN 'Proficient' ELSE 'Needs Practice' END,
                    last_practiced_at = CURRENT_TIMESTAMP
                """,
                (
                    user_id,
                    topic,
                    score_pct,
                    score_pct,
                    "Mastered" if score_pct >= 80 else ("Proficient" if score_pct >= 60 else "Needs Practice")
                ),
            )
        except Exception as e:
            _safe_print(f"[QUIZ SUBMIT NOTE] study_topic_mastery update: {e}")

        # If passed (score >= 60%), mark study_task completed if currently pending
        if task_id and score_pct >= 60.0:
            try:
                cursor.execute(
                    """
                    UPDATE study_tasks
                    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND status != 'completed'
                    """,
                    (task_id,),
                )
            except Exception as e:
                _safe_print(f"[QUIZ SUBMIT NOTE] study_tasks update: {e}")

        conn.commit()

        return {
            "success": True,
            "quiz_id": quiz_id,
            "day_number": day_number,
            "topic": topic,
            "score": correct_count,
            "total_questions": total_questions,
            "correct_answers": correct_count,
            "wrong_answers": wrong_count,
            "percentage": score_pct,
            "status": "completed",
            "passed": (score_pct >= 60.0),
            "review": review,
        }
    finally:
        conn.close()


def get_daily_quizzes_overview(user_id: int, plan_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Returns the comprehensive daily quiz schedule and completion status
    for all days in the user's active study plan.
    """
    plan = _get_active_study_plan(user_id, plan_id)
    if not plan:
        return {
            "success": True,
            "has_active_plan": False,
            "quizzes": [],
        }

    actual_plan_id = plan["id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Load all tasks for the plan
        cursor.execute(
            """
            SELECT id, day_number, topic, difficulty, status, task_date
            FROM study_tasks
            WHERE plan_id = ? AND user_id = ?
            ORDER BY day_number ASC
            """,
            (actual_plan_id, user_id),
        )
        tasks = cursor.fetchall()

        # Load all quiz records for this plan
        cursor.execute(
            """
            SELECT day_number, status, score_pct, total_questions, correct_answers, completed_at
            FROM daily_quizzes
            WHERE user_id = ? AND plan_id = ?
            """,
            (user_id, actual_plan_id),
        )
        quiz_map = {}
        for r in cursor.fetchall():
            quiz_map[r[0]] = {
                "status": r[1],
                "score_pct": r[2] or 0.0,
                "total_questions": r[3] or 5,
                "correct_answers": r[4] or 0,
                "completed_at": str(r[5]) if r[5] else None,
            }

        days_summary = []
        completed_quizzes_count = 0
        total_score_sum = 0.0

        for t in tasks:
            task_id, day_num, topic, diff, t_status, t_date = t
            q_info = quiz_map.get(day_num, {
                "status": "pending",
                "score_pct": 0.0,
                "total_questions": 5,
                "correct_answers": 0,
                "completed_at": None,
            })

            is_completed = (q_info["status"] == "completed")
            if is_completed:
                completed_quizzes_count += 1
                total_score_sum += q_info["score_pct"]

            days_summary.append({
                "day_number": day_num,
                "task_id": task_id,
                "topic": topic,
                "difficulty": diff or plan["preparation_level"],
                "task_date": str(t_date),
                "task_status": t_status,
                "quiz_status": q_info["status"],
                "is_completed": is_completed,
                "score_pct": q_info["score_pct"],
                "total_questions": q_info["total_questions"],
                "correct_answers": q_info["correct_answers"],
                "completed_at": q_info["completed_at"],
            })

        avg_score = round(total_score_sum / completed_quizzes_count, 1) if completed_quizzes_count > 0 else 0.0

        return {
            "success": True,
            "has_active_plan": True,
            "plan_id": actual_plan_id,
            "target_role": plan["target_role"],
            "preparation_level": plan["preparation_level"],
            "total_days": len(days_summary),
            "completed_quizzes_count": completed_quizzes_count,
            "pending_quizzes_count": len(days_summary) - completed_quizzes_count,
            "average_quiz_score": avg_score,
            "quizzes": days_summary,
        }
    finally:
        conn.close()
