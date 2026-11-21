"""
Roadmap Structured Content & Bullet-Point Generation Service
Intervexa AI – Smart Interview Coach

Ensures every learning roadmap is actionable, well-structured, and explained in clear
bullet points and numbered steps instead of long confusing paragraphs.

Structure enforced on every daily task:
A. Day Information (Day number, Date, Topic, Priority, Difficulty, Estimated Duration)
B. What You Will Learn (3-6 simple bullet points)
C. Topic Explanation (Subtopics breakdown with name, explanation, example, use case)
D. Step-by-Step Learning Instructions (Numbered steps)
E. Practical Examples (Code snippet, line-by-line explanation, expected output, use case)
F. Practice Activity (Actionable bullet points)
G. Completion Goal (Measurable criteria bullet points)
H. Learning Resources (Clickable bullet points)
"""

import re
import json
from typing import Dict, Any, List, Optional


def clean_bullet_text(val: Any) -> str:
    """Strip leading bullet characters or numbers from a bullet item."""
    if not val:
        return ""
    s = str(val).strip()
    s = re.sub(r"^[\s\u2022\u25e6\u25aa\u2023\u2219\*\-\+\d+\.\)]+\s*", "", s).strip()
    return s


def parse_into_bullet_points(text: Any, default_bullets: Optional[List[str]] = None) -> List[str]:
    """
    Parses any text (including multi-sentence paragraphs or bullet-point strings)
    into a list of clean, simple bullet points.
    """
    if not text:
        return default_bullets or []

    if isinstance(text, list):
        bullets = [clean_bullet_text(x) for x in text if clean_bullet_text(x)]
        return bullets if bullets else (default_bullets or [])

    text_str = str(text).strip()
    if not text_str:
        return default_bullets or []

    # Check if text is JSON list
    if text_str.startswith("["):
        try:
            parsed = json.loads(text_str)
            if isinstance(parsed, list):
                bullets = [clean_bullet_text(x) for x in parsed if clean_bullet_text(x)]
                if bullets:
                    return bullets
        except Exception:
            pass

    # Split on newlines, bullet characters, or numbered patterns
    lines = re.split(r"[\r\n]+", text_str)
    raw_bullets = []
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        # Split on inline bullets if present
        sub_items = re.split(r"(?<=[.!?])\s+(?=[•\-\*\d+\.])", line_clean)
        for item in sub_items:
            c = clean_bullet_text(item)
            if c and len(c) > 2:
                raw_bullets.append(c)

    # If only 1 long paragraph without bullets, split by sentences
    if len(raw_bullets) <= 1 and len(text_str) > 80:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text_str) if s.strip()]
        if len(sentences) > 1:
            return sentences

    return raw_bullets if raw_bullets else (default_bullets or [text_str])


def normalize_task_structured_fields(task: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensures that every daily task dictionary contains the complete set of
    structured bullet-point fields:
    - what_you_will_learn: List[str]
    - topic_breakdown: List[Dict[str, str]]
    - learning_steps: List[str]
    - practical_examples: List[Dict[str, str]]
    - practice_activities: List[str]
    - completion_goals: List[str]
    - recommended_resources: List[Dict[str, str]]
    Also formats description, recommended_practice, completion_criteria, and
    explanation as clean bullet points for backward compatibility.
    """
    topic = str(task.get("topic") or "Core Technical Study").strip()
    est_mins = int(task.get("estimated_minutes") or 60)
    prep_level = str(task.get("difficulty") or "Intermediate").strip()

    # 1. What You Will Learn (3-6 bullet points)
    raw_learn = task.get("what_you_will_learn")
    learn_bullets = []
    if raw_learn:
        if isinstance(raw_learn, str) and raw_learn.startswith("["):
            try:
                learn_bullets = parse_into_bullet_points(json.loads(raw_learn))
            except Exception:
                learn_bullets = parse_into_bullet_points(raw_learn)
        else:
            learn_bullets = parse_into_bullet_points(raw_learn)

    if not learn_bullets:
        # Fallback extraction from description or learning_objective
        learn_bullets = parse_into_bullet_points(
            task.get("learning_objective") or task.get("description"),
            default_bullets=[
                f"Core architectural principles and mechanics of {topic}.",
                f"Key syntax, execution flow, and standard conventions for {topic}.",
                f"High-frequency interview questions and practical problem-solving in {topic}.",
                f"Production best practices and performance trade-offs."
            ]
        )

    # 2. Topic Breakdown (Subtopics with explanation, example, use case)
    raw_breakdown = task.get("topic_breakdown")
    breakdown_list = []
    if raw_breakdown:
        if isinstance(raw_breakdown, str) and raw_breakdown.startswith("["):
            try:
                breakdown_list = json.loads(raw_breakdown)
            except Exception:
                pass
        elif isinstance(raw_breakdown, list):
            breakdown_list = raw_breakdown

    if not breakdown_list:
        subtopics = task.get("subtopics") or []
        if isinstance(subtopics, str):
            try:
                subtopics = json.loads(subtopics) if subtopics.startswith("[") else [s.strip() for s in subtopics.split(",") if s.strip()]
            except Exception:
                subtopics = [subtopics]

        if not subtopics:
            subtopics = [f"{topic} Fundamentals", f"{topic} Practical Applications"]

        for st in subtopics[:4]:
            st_name = str(st).strip()
            breakdown_list.append({
                "name": st_name,
                "explanation": f"{st_name} defines core operational mechanics and syntax required to build reliable software solutions.",
                "example": f"Code/Pattern: import/declare {st_name.lower().replace(' ', '_')} logic in clean modules.",
                "use_case": f"Used in production software systems to ensure maintainability, correctness, and speed."
            })

    # 3. Step-by-Step Learning Instructions (Numbered steps)
    raw_steps = task.get("learning_steps")
    steps_list = []
    if raw_steps:
        if isinstance(raw_steps, str) and raw_steps.startswith("["):
            try:
                steps_list = json.loads(raw_steps)
            except Exception:
                steps_list = parse_into_bullet_points(raw_steps)
        else:
            steps_list = parse_into_bullet_points(raw_steps)

    if not steps_list:
        steps_list = [
            f"Understand the core definition and execution model of {topic}.",
            f"Review standard syntax rules, signatures, and conventions.",
            f"Walk through working code examples and inspect terminal outputs.",
            f"Implement hands-on practice challenges independently.",
            f"Test edge cases, error conditions, and optimize solution trade-offs."
        ]

    # Clean numbering in steps
    cleaned_steps = []
    for idx, s in enumerate(steps_list, 1):
        s_clean = clean_bullet_text(s)
        cleaned_steps.append(f"{idx}. {s_clean}")

    # 4. Practical Examples (Code snippet, explanation, output, use case)
    raw_examples = task.get("practical_examples")
    examples_list = []
    if raw_examples:
        if isinstance(raw_examples, str) and raw_examples.startswith("["):
            try:
                examples_list = json.loads(raw_examples)
            except Exception:
                pass
        elif isinstance(raw_examples, list):
            examples_list = raw_examples

    if not examples_list:
        topic_lower = topic.lower()
        if "sql" in topic_lower or "join" in topic_lower:
            code_snip = "-- Practical SQL Join Query\nSELECT u.id, u.name, o.total_amount\nFROM users u\nINNER JOIN orders o ON u.id = o.user_id\nWHERE o.status = 'completed'\nORDER BY o.total_amount DESC;"
            exp_snip = "Joins the users table with orders on user_id foreign key, filtering only completed orders."
            out_snip = "| id | name | total_amount |\n| 10 | Alex | 249.99 |\n| 14 | Sarah| 189.50 |"
            uc_snip = "E-commerce order reporting and customer lifetime value computation."
        elif "python" in topic_lower or "variable" in topic_lower:
            code_snip = "# Python Variables & Formatting\nuser_name = 'Alice'\nstudy_hours = 2.5\nis_active = True\n\nprint(f'{user_name} studied {study_hours} hrs today (Active: {is_active})')\nprint('Type of study_hours:', type(study_hours).__name__)"
            exp_snip = "Declares string, float, and boolean variables; outputs formatted f-string and inspects runtime type."
            out_snip = "Alice studied 2.5 hrs today (Active: True)\nType of study_hours: float"
            uc_snip = "User profile tracking and session metrics computation."
        elif "machine learning" in topic_lower or "ml" in topic_lower:
            code_snip = "# Scikit-Learn Model Training\nfrom sklearn.linear_model import LogisticRegression\nimport numpy as np\n\nX = np.array([[1], [2], [3], [4]])\ny = np.array([0, 0, 1, 1])\nclf = LogisticRegression().fit(X, y)\nprint('Prediction for 2.5:', clf.predict([[2.5]])[0])"
            exp_snip = "Initializes synthetic binary classification data, fits logistic model, and predicts class boundary."
            out_snip = "Prediction for 2.5: 1"
            uc_snip = "Customer churn classification and risk assessment models."
        else:
            code_snip = f"// Implementation for {topic}\nfunction runLesson() {{\n  const topic = '{topic}';\n  console.log('Mastering:', topic);\n  return true;\n}}\nrunLesson();"
            exp_snip = f"Initializes and executes practical implementation of {topic} principles."
            out_snip = f"Mastering: {topic}"
            uc_snip = f"Standard architectural pattern for {topic} in production applications."

        examples_list = [{
            "title": f"{topic} Code Implementation",
            "code": code_snip,
            "explanation": exp_snip,
            "output": out_snip,
            "use_case": uc_snip
        }]

    # 5. Practice Activities (Actionable bullet points)
    raw_practice = task.get("practice_activities")
    practice_bullets = []
    if raw_practice:
        if isinstance(raw_practice, str) and raw_practice.startswith("["):
            try:
                practice_bullets = parse_into_bullet_points(json.loads(raw_practice))
            except Exception:
                practice_bullets = parse_into_bullet_points(raw_practice)
        else:
            practice_bullets = parse_into_bullet_points(raw_practice)

    if not practice_bullets:
        practice_bullets = parse_into_bullet_points(
            task.get("recommended_practice"),
            default_bullets=[
                f"Write a standalone script demonstrating the core principles of {topic}.",
                f"Solve at least 2 hands-on coding challenges or scenario questions on {topic}.",
                f"Refactor your solution to eliminate edge-case errors and optimize readability."
            ]
        )

    # 6. Completion Goals (Measurable criteria bullet points)
    raw_goals = task.get("completion_goals")
    goal_bullets = []
    if raw_goals:
        if isinstance(raw_goals, str) and raw_goals.startswith("["):
            try:
                goal_bullets = parse_into_bullet_points(json.loads(raw_goals))
            except Exception:
                goal_bullets = parse_into_bullet_points(raw_goals)
        else:
            goal_bullets = parse_into_bullet_points(raw_goals)

    if not goal_bullets:
        goal_bullets = parse_into_bullet_points(
            task.get("completion_criteria"),
            default_bullets=[
                "Successfully execute all code snippets and practice scripts with zero errors.",
                f"Clearly explain the core mechanics and trade-offs of {topic} out loud.",
                "Solve at least 3 relevant interview-level practice questions independently."
            ]
        )

    # 7. Resources (Structured list)
    resources_raw = task.get("recommended_resources") or []
    if isinstance(resources_raw, str):
        try:
            resources_raw = json.loads(resources_raw) if resources_raw.startswith("[") else []
        except Exception:
            resources_raw = []

    if not resources_raw:
        topic_query = topic.replace(" ", "+")
        resources_raw = [
            {"title": f"{topic} Official Documentation", "url": f"https://www.google.com/search?q={topic_query}+official+documentation", "type": "documentation"},
            {"title": f"{topic} Interactive Tutorial & Practice", "url": f"https://www.google.com/search?q={topic_query}+tutorial+practice", "type": "practice"}
        ]

    # Convert formatted fields for backward compatibility
    formatted_desc = "\n".join([f"• {b}" for b in learn_bullets])
    formatted_practice = "\n".join([f"• {b}" for b in practice_bullets])
    formatted_criteria = "\n".join([f"• {b}" for b in goal_bullets])

    # Build clear bulleted explanation
    explanation_parts = []
    for b in breakdown_list[:3]:
        name = b.get("name") or "Concept"
        exp = b.get("explanation") or ""
        ex = b.get("example") or ""
        explanation_parts.append(f"• {name}: {exp}")
        if ex:
            explanation_parts.append(f"  Example: {ex}")
    formatted_explanation = "\n".join(explanation_parts) if explanation_parts else task.get("explanation") or formatted_desc

    normalized = dict(task)
    normalized["topic"] = topic
    normalized["what_you_will_learn"] = learn_bullets
    normalized["topic_breakdown"] = breakdown_list
    normalized["learning_steps"] = cleaned_steps
    normalized["practical_examples"] = examples_list
    normalized["practice_activities"] = practice_bullets
    normalized["completion_goals"] = goal_bullets
    normalized["recommended_resources"] = resources_raw

    # Synchronize bullet-point strings for backward compatibility
    normalized["description"] = formatted_desc
    normalized["recommended_practice"] = formatted_practice
    normalized["completion_criteria"] = formatted_criteria
    normalized["explanation"] = formatted_explanation

    return normalized


# =============================================================================
# CURRICULUM TEMPLATES FOR TARGET TOPICS & ROLES
# =============================================================================

def _build_python_variables_curriculum(duration_days: int, daily_minutes: int, prep_level: str) -> List[Dict[str, Any]]:
    """Specialized high-clarity curriculum for Python Variables."""
    templates = [
        {
            "topic": "Python Variables & Dynamic Memory References",
            "what_you_will_learn": [
                "What variables are in Python and how memory references work",
                "Dynamic typing vs static typing in modern programming",
                "Python variable assignment syntax and the '=' operator",
                "How Python manages garbage collection and reference counting"
            ],
            "topic_breakdown": [
                {
                    "name": "Variables as Object References",
                    "explanation": "In Python, variables do not hold values directly; they point to objects stored in memory. Assigning a value creates an object and binds the variable name to it.",
                    "example": "x = 42  # Variable x references the integer object 42",
                    "use_case": "Fundamental to understanding parameter passing, memory efficiency, and immutability."
                },
                {
                    "name": "Dynamic Typing",
                    "explanation": "Python does not require explicit variable type declarations. The interpreter determines the type at runtime based on the assigned object.",
                    "example": "data = 10; data = 'ten'  # Valid in Python",
                    "use_case": "Allows flexible polymorphic functions and rapid development cycles."
                }
            ],
            "learning_steps": [
                "Understand what a variable is in Python.",
                "Learn how to declare and assign values to variables.",
                "Observe dynamic typing by reassigning different types to the same variable.",
                "Inspect object memory addresses using id().",
                "Execute simple Python programs in terminal and interactive REPL."
            ],
            "practical_examples": [
                {
                    "title": "Variable Assignment & Identity Inspection",
                    "code": "# Declaring variables\nx = 100\ny = x\nprint(f'x: {x}, y: {y}')\nprint(f'Same object in memory: {x is y}')\n\nx = 200  # Rebinding x\nprint(f'After rebinding -> x: {x}, y: {y}')",
                    "explanation": "Assigns 100 to x, and points y to the same object. Checks object identity with 'is', then rebinds x to 200 while y remains 100.",
                    "output": "x: 100, y: 100\nSame object in memory: True\nAfter rebinding -> x: 200, y: 100",
                    "use_case": "Understanding state mutation and avoiding unintended side effects in functions."
                }
            ],
            "practice_activities": [
                "Create a script that declares variables for candidate name, age, and desired salary.",
                "Reassign an integer variable to a string and inspect type() after each assignment.",
                "Print variable memory addresses using id() before and after modification."
            ],
            "completion_goals": [
                "Successfully write and execute a script demonstrating variable rebinding.",
                "Explain the difference between a variable name and an object in memory.",
                "Solve 3 practice questions on dynamic typing without notes."
            ]
        },
        {
            "topic": "Python Variable Naming Rules & PEP 8 Standards",
            "what_you_will_learn": [
                "Strict Python variable naming rules and invalid identifiers",
                "Python reserved keywords that cannot be used as variable names",
                "PEP 8 naming conventions: snake_case vs camelCase vs PascalCase",
                "Constants naming convention (ALL_CAPS) and private variables (_leading_underscore)"
            ],
            "topic_breakdown": [
                {
                    "name": "Identifier Rules",
                    "explanation": "Variable names must start with a letter (a-z, A-Z) or underscore (_). They cannot start with a digit and cannot contain spaces or special characters.",
                    "example": "Valid: user_count, _cache, item_2. Invalid: 2items, user-name, class.",
                    "use_case": "Prevents syntax errors and namespace conflicts with reserved keywords."
                },
                {
                    "name": "PEP 8 snake_case",
                    "explanation": "Standard Python convention requires variables and functions to use lowercase words separated by underscores for maximum readability.",
                    "example": "max_retry_count = 3  # Good Python style",
                    "use_case": "Ensures team consistency and clean code reviews across professional Python codebases."
                }
            ],
            "learning_steps": [
                "Learn legal characters for Python variable identifiers.",
                "Inspect Python's keyword list using import keyword; keyword.kwlist.",
                "Rewrite non-PEP 8 variable names into standard snake_case.",
                "Define module-level constants using UPPER_CASE convention.",
                "Run flake8 or black linter to verify naming conformity."
            ],
            "practical_examples": [
                {
                    "title": "Valid Naming and Keyword Checking",
                    "code": "import keyword\n\n# Checking invalid names\ntest_names = ['valid_name', '2nd_player', 'class', '_temp_result']\nfor name in test_names:\n    is_kw = keyword.iskeyword(name)\n    is_id = name.isidentifier()\n    print(f'{name:15} -> Valid Identifier: {is_id:1} | Reserved Keyword: {is_kw}')",
                    "explanation": "Uses the keyword module to check whether candidate strings are legal Python identifiers or reserved words.",
                    "output": "valid_name      -> Valid Identifier: True | Reserved Keyword: False\n2nd_player      -> Valid Identifier: False | Reserved Keyword: False\nclass           -> Valid Identifier: True | Reserved Keyword: True\n_temp_result    -> Valid Identifier: True | Reserved Keyword: False",
                    "use_case": "Building code analyzers, linters, or dynamic form field mapping."
                }
            ],
            "practice_activities": [
                "Write a list of 10 variable names and identify which 4 violate Python syntax rules.",
                "Print all reserved Python keywords in alphabetical order.",
                "Refactor an unreadable camelCase script into clean PEP 8 snake_case."
            ],
            "completion_goals": [
                "Correctly identify all valid and invalid Python variable names in a quiz.",
                "Explain why keywords like 'class' or 'def' cannot be used as variable names.",
                "Write a clean PEP 8 compliant script without linter warnings."
            ]
        },
        {
            "topic": "Python Primitive Data Types & Scalar Variables",
            "what_you_will_learn": [
                "The four fundamental primitive types: int, float, str, bool",
                "Numeric operations, precision, and floating-point quirks",
                "String declaration using single, double, and triple quotes",
                "Boolean evaluation and truthy/falsy concepts in variables"
            ],
            "topic_breakdown": [
                {
                    "name": "Numeric Types (int & float)",
                    "explanation": "Python integers have arbitrary precision (they never overflow). Floats use 64-bit IEEE 754 double precision representation.",
                    "example": "items = 5; unit_price = 19.99",
                    "use_case": "Mathematical computations, financial sums, counters, and statistics."
                },
                {
                    "name": "Strings & Booleans (str & bool)",
                    "explanation": "Strings are immutable sequences of Unicode characters. Booleans represent logical truth states (True or False) and are subclasses of integers.",
                    "example": "status = 'Active'; is_ready = True",
                    "use_case": "User interfaces, flag checks, API payloads, and condition branching."
                }
            ],
            "learning_steps": [
                "Declare variables of each primitive type: int, float, str, bool.",
                "Perform arithmetic calculations: addition, subtraction, division (/), and integer division (//).",
                "Evaluate boolean expressions using comparison operators (==, !=, <, >).",
                "Inspect the data type of each variable with type().",
                "Verify truthiness of empty strings, zero, and None."
            ],
            "practical_examples": [
                {
                    "title": "Primitive Types & Arithmetic Output",
                    "code": "# Variables of distinct primitive types\nproduct_name = 'Cloud Subscription'\nmonthly_cost = 29.50\nduration_months = 12\nis_auto_renew = True\n\nannual_total = monthly_cost * duration_months\nprint(f'Service: {product_name}')\nprint(f'Annual Cost: ${annual_total:.2f}')\nprint(f'Auto-Renew Enabled: {is_auto_renew}')\nprint(f'Types: cost={type(monthly_cost).__name__}, total={type(annual_total).__name__}')",
                    "explanation": "Calculates annual cost from float and int variables and prints formatted invoice details.",
                    "output": "Service: Cloud Subscription\nAnnual Cost: $354.00\nAuto-Renew Enabled: True\nTypes: cost=float, total=float",
                    "use_case": "Billing engine and invoice calculation."
                }
            ],
            "practice_activities": [
                "Write a program that calculates the area and perimeter of a rectangle given width and height.",
                "Declare variables for student name, 3 exam scores, and compute the average as a float.",
                "Test the output of 0.1 + 0.2 in Python and explain the result."
            ],
            "completion_goals": [
                "Successfully assign, compute, and print variables across all 4 scalar types.",
                "Explain why integers in Python 3 do not overflow.",
                "Solve 3 practice exercises on formatted strings and numeric operations."
            ]
        },
        {
            "topic": "Type Casting & Explicit Conversion in Python",
            "what_you_will_learn": [
                "Implicit type conversion (coercion) vs explicit type casting",
                "Using int(), float(), str(), and bool() conversion functions",
                "Handling ValueError when converting invalid string inputs",
                "Truthy and Falsy conversion rules in Python"
            ],
            "topic_breakdown": [
                {
                    "name": "Explicit Type Casting",
                    "explanation": "Converts an object from one data type to another using built-in constructors like int('100') or float(5).",
                    "example": "age_input = '25'; age_int = int(age_input)",
                    "use_case": "Parsing user input from forms, CLI args, or JSON API payloads."
                },
                {
                    "name": "Safe Conversion with Error Handling",
                    "explanation": "Converting strings with non-numeric characters raises ValueError. Must be caught with try/except blocks in robust code.",
                    "example": "try:\n    val = int(raw_input)\nexcept ValueError:\n    val = 0",
                    "use_case": "Preventing crashes when processing user inputs or reading CSV datasets."
                }
            ],
            "learning_steps": [
                "Understand why user input from input() is always a string.",
                "Convert string integers to int and string decimals to float.",
                "Handle conversion failures gracefully with try/except.",
                "Convert values to bool to inspect truthiness rules.",
                "Build a robust input validation snippet."
            ],
            "practical_examples": [
                {
                    "title": "Robust Input Casting Example",
                    "code": "# Converting string input to numerical variables\nraw_price = '49.99'\nraw_qty = '3'\n\n# Safe casting\nunit_price = float(raw_price)\nquantity = int(raw_qty)\ntotal = unit_price * quantity\n\nprint(f'Unit: ${unit_price:.2f} x {quantity} = ${total:.2f}')\nprint(f'Is Total Positive: {bool(total)}')",
                    "explanation": "Casts string inputs to float and int to perform arithmetic calculations and checks boolean truthiness.",
                    "output": "Unit: $49.99 x 3 = $149.97\nIs Total Positive: True",
                    "use_case": "E-commerce checkout price calculation from form inputs."
                }
            ],
            "practice_activities": [
                "Write a program that takes two numeric strings, casts them to floats, and prints their sum.",
                "Check the boolean value of: 0, 1, '', 'hello', [], [1], None.",
                "Write a function that safely converts any string to int or returns a default fallback."
            ],
            "completion_goals": [
                "Correctly perform type casting across strings, integers, floats, and booleans.",
                "Write error-handling code that catches ValueError when casting invalid strings.",
                "Pass all 3 unit exercises on type conversions."
            ]
        },
        {
            "topic": "Variable Scope: Local, Global, and Nonlocal Rules",
            "what_you_will_learn": [
                "The LEGB rule: Local, Enclosing, Global, and Built-in scope hierarchy",
                "How local variables are created inside functions",
                "When and why to use the global keyword (and its risks)",
                "Using the nonlocal keyword in nested closures"
            ],
            "topic_breakdown": [
                {
                    "name": "Local vs Global Scope",
                    "explanation": "Variables defined inside a function are local to that function. Variables defined outside any function belong to module-level global scope.",
                    "example": "x = 10  # Global\ndef fn():\n    y = 5  # Local to fn",
                    "use_case": "Encapsulating function state and preventing accidental variable clobbering."
                },
                {
                    "name": "The LEGB Lookup Hierarchy",
                    "explanation": "When resolving a variable name, Python searches Local scope first, then Enclosing functions, then Global module scope, and finally Built-in namespace.",
                    "example": "Nested function accessing outer function's variable.",
                    "use_case": "Essential for functional programming, closures, and custom decorators."
                }
            ],
            "learning_steps": [
                "Define a global variable and read it from inside a function.",
                "Understand why modifying a global variable inside a function creates an UnboundLocalError.",
                "Use the global keyword to modify global variables when necessary.",
                "Create a nested function closure demonstrating enclosing scope.",
                "Inspect variables in current scope using locals() and globals()."
            ],
            "practical_examples": [
                {
                    "title": "Scope Demonstration & LEGB Hierarchy",
                    "code": "# Global variable\napp_name = 'Intervexa AI'\n\ndef outer_function():\n    session_id = 'SESSION-101'  # Enclosing\n    def inner_function():\n        user = 'Sarah'  # Local\n        print(f'App: {app_name} | Session: {session_id} | User: {user}')\n    inner_function()\n\nouter_function()",
                    "explanation": "Demonstrates LEGB: inner_function accesses local 'user', enclosing 'session_id', and global 'app_name'.",
                    "output": "App: Intervexa AI | Session: SESSION-101 | User: Sarah",
                    "use_case": "Factory functions, middleware, and request context handlers."
                }
            ],
            "practice_activities": [
                "Write a function that counts how many times it has been called using a global variable.",
                "Rewrite the counter function using a closure and nonlocal keyword to eliminate the global.",
                "Demonstrate what causes UnboundLocalError and explain how to fix it."
            ],
            "completion_goals": [
                "Accurately explain the LEGB variable lookup sequence in Python.",
                "Explain why global variables are generally considered bad practice in production code.",
                "Solve 3 practice problems on variable scoping and closures."
            ]
        }
    ]

    tasks = []
    for day in range(1, duration_days + 1):
        tpl_idx = (day - 1) % len(templates)
        base = templates[tpl_idx]
        priority = "Critical" if day <= 2 else ("High" if day <= 4 else "Medium")
        t = {
            "day_number": day,
            "topic": f"{base['topic']}" if duration_days <= len(templates) else f"{base['topic']} (Part {(day-1)//len(templates) + 1})",
            "priority": priority,
            "difficulty": prep_level,
            "estimated_minutes": daily_minutes,
            "what_you_will_learn": base["what_you_will_learn"],
            "topic_breakdown": base["topic_breakdown"],
            "learning_steps": base["learning_steps"],
            "practical_examples": base["practical_examples"],
            "practice_activities": base["practice_activities"],
            "completion_goals": base["completion_goals"],
            "recommended_resources": [
                {"title": "Python Official Documentation: Variables & Types", "url": "https://docs.python.org/3/tutorial/introduction.html", "type": "documentation"},
                {"title": "Real Python: Variables in Python", "url": "https://realpython.com/python-variables/", "type": "tutorial"}
            ],
            "why_recommended": "Mastering Python variables is the foundational building block for all algorithmic coding and technical interview rounds."
        }
        tasks.append(normalize_task_structured_fields(t))

    return tasks


def _build_sql_joins_curriculum(duration_days: int, daily_minutes: int, prep_level: str) -> List[Dict[str, Any]]:
    """Specialized high-clarity curriculum for SQL Joins."""
    templates = [
        {
            "topic": "SQL Relational Keys & INNER JOIN Fundamentals",
            "what_you_will_learn": [
                "Relational table design: Primary Keys and Foreign Keys",
                "What an INNER JOIN is and how matching rows are returned",
                "Standard SQL JOIN syntax using ON condition clauses",
                "Table aliasing to disambiguate identical column names"
            ],
            "topic_breakdown": [
                {
                    "name": "INNER JOIN Mechanism",
                    "explanation": "Returns only rows where matching values exist in both tables. If a row in table A has no matching key in table B, it is excluded from the result.",
                    "example": "SELECT u.name, o.amount FROM users u INNER JOIN orders o ON u.id = o.user_id;",
                    "use_case": "Reporting related data such as customers with completed transactions."
                },
                {
                    "name": "Primary & Foreign Key Integrity",
                    "explanation": "A primary key uniquely identifies each row in a table. A foreign key in another table points back to that primary key, establishing the relational link.",
                    "example": "orders.user_id REFERENCES users.id",
                    "use_case": "Prevents orphaned records and enforces relational consistency."
                }
            ],
            "learning_steps": [
                "Understand primary key and foreign key relationships.",
                "Write an INNER JOIN query combining two tables on a foreign key.",
                "Use short table aliases (e.g. u, o) to make queries concise.",
                "Filter joined query results using a WHERE clause.",
                "Sort results using ORDER BY on a joined column."
            ],
            "practical_examples": [
                {
                    "title": "Two-Table INNER JOIN Query",
                    "code": "-- Query candidates with completed mock interviews\nSELECT c.name, m.topic, m.technical_score\nFROM candidates c\nINNER JOIN mock_interviews m\n  ON c.id = m.candidate_id\nWHERE m.technical_score >= 8.0\nORDER BY m.technical_score DESC;",
                    "explanation": "Joins candidates with mock_interviews on candidate_id, filters for scores 8.0+, and orders from highest to lowest.",
                    "output": "| name | topic | technical_score |\n| Sarah | System Design | 9.2 |\n| Alex | Python Backend | 8.5 |",
                    "use_case": "Recruitment candidate ranking and evaluation reporting."
                }
            ],
            "practice_activities": [
                "Write an INNER JOIN connecting an 'employees' table with a 'departments' table.",
                "Filter the joined employee records to only show departments in 'Engineering'.",
                "Calculate total salary paid per department using INNER JOIN and SUM() with GROUP BY."
            ],
            "completion_goals": [
                "Successfully write and execute an INNER JOIN query across 2 related tables without syntax errors.",
                "Accurately explain which rows are included and excluded by an INNER JOIN.",
                "Solve 3 practice interview queries combining INNER JOIN with WHERE and ORDER BY."
            ]
        },
        {
            "topic": "LEFT OUTER JOIN & Handling Missing / Null Records",
            "what_you_will_learn": [
                "How LEFT OUTER JOIN preserves all records from the left table",
                "How non-matching rows from the right table are filled with NULL",
                "Using 'WHERE right_table.id IS NULL' to find orphaned or missing records",
                "Difference between filtering in the ON clause vs filtering in the WHERE clause"
            ],
            "topic_breakdown": [
                {
                    "name": "LEFT JOIN Mechanics",
                    "explanation": "Returns all rows from the left table, and matching rows from the right table. Unmatched rows display NULL for right-table columns.",
                    "example": "SELECT u.name, o.id FROM users u LEFT JOIN orders o ON u.id = o.user_id;",
                    "use_case": "Finding all users regardless of whether they have placed an order."
                },
                {
                    "name": "Anti-Join Pattern (IS NULL)",
                    "explanation": "Adding WHERE right.id IS NULL isolates entities in the left table that have zero matching records in the right table.",
                    "example": "SELECT u.name FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE o.id IS NULL;",
                    "use_case": "Finding inactive customers who have never made a purchase."
                }
            ],
            "learning_steps": [
                "Understand when to choose LEFT JOIN over INNER JOIN.",
                "Write a LEFT JOIN query and observe NULL values in the result set.",
                "Use COALESCE() to replace NULL values with meaningful default text.",
                "Apply the Anti-Join pattern with WHERE right.id IS NULL.",
                "Differentiate between ON filtering and WHERE filtering."
            ],
            "practical_examples": [
                {
                    "title": "Finding Inactive Candidates with LEFT JOIN",
                    "code": "-- Identify candidates who have NOT yet taken any mock interviews\nSELECT c.id, c.name, c.email, m.id AS interview_id\nFROM candidates c\nLEFT JOIN mock_interviews m\n  ON c.id = m.candidate_id\nWHERE m.id IS NULL;",
                    "explanation": "Keeps all candidates from the left table and filters where the interview record is NULL.",
                    "output": "| id | name | email | interview_id |\n| 102 | David | david@example.com | NULL |\n| 105 | Emma | emma@example.com | NULL |",
                    "use_case": "Sending automated onboarding reminders to candidates who have not practiced."
                }
            ],
            "practice_activities": [
                "Write a query showing all departments and the count of employees in each (including empty departments).",
                "Use LEFT JOIN to find products that have never been purchased.",
                "Use COALESCE to replace NULL manager names with 'Executive Leader'."
            ],
            "completion_goals": [
                "Correctly construct a LEFT JOIN query and explain why NULL values appear.",
                "Successfully implement the Anti-Join pattern to identify missing records.",
                "Solve 3 practice questions distinguishing ON conditions from WHERE conditions."
            ]
        },
        {
            "topic": "RIGHT JOIN, FULL OUTER JOIN & Set Relationships",
            "what_you_will_learn": [
                "How RIGHT OUTER JOIN operates and why LEFT JOIN is preferred in practice",
                "FULL OUTER JOIN mechanics: preserving all rows from both tables",
                "Emulating FULL OUTER JOIN in databases that lack native support (UNION of LEFT JOINs)",
                "CROSS JOIN (Cartesian product) and when it is legitimately used"
            ],
            "topic_breakdown": [
                {
                    "name": "FULL OUTER JOIN",
                    "explanation": "Combines the results of both LEFT and RIGHT joins. Returns all matching rows, plus unmatched rows from both sides padded with NULLs.",
                    "example": "SELECT a.val, b.val FROM tableA a FULL OUTER JOIN tableB b ON a.id = b.id;",
                    "use_case": "Reconciling data feeds from two disparate accounting or inventory systems."
                },
                {
                    "name": "CROSS JOIN",
                    "explanation": "Produces the Cartesian product of two tables, matching every row of table A with every row of table B.",
                    "example": "SELECT s.size, c.color FROM sizes s CROSS JOIN colors c;",
                    "use_case": "Generating all combinations of product attributes (e.g. sizes and colors)."
                }
            ],
            "learning_steps": [
                "Understand Venn diagram representations of FULL OUTER JOIN.",
                "Write a FULL OUTER JOIN query connecting two inventory tables.",
                "Implement a CROSS JOIN to generate all pairs of items.",
                "Practice emulating FULL JOIN using LEFT JOIN + UNION ALL in SQLite/MySQL.",
                "Identify high-cost Cartesian product queries and how to prevent them."
            ],
            "practical_examples": [
                {
                    "title": "Cross Join Generating Matrix of Test Roles & Difficulties",
                    "code": "-- Generate every combination of interview roles and difficulty levels\nSELECT r.role_name, d.level_name\nFROM roles r\nCROSS JOIN difficulty_levels d\nORDER BY r.role_name, d.order_id;",
                    "explanation": "Cross-joins roles with difficulty tiers to build an exhaustive test matrix.",
                    "output": "| role_name | level_name |\n| Data Analyst | Beginner |\n| Data Analyst | Intermediate |\n| Data Analyst | Advanced |\n| Full Stack | Beginner |",
                    "use_case": "Seeding database test matrices and scheduling permutations."
                }
            ],
            "practice_activities": [
                "Write a query combining sizes and colors using CROSS JOIN.",
                "Reconcile two bank ledger tables using FULL OUTER JOIN to identify discrepancies on both sides.",
                "Emulate FULL OUTER JOIN using UNION in a database that only supports LEFT JOIN."
            ],
            "completion_goals": [
                "Explain the operational mechanics of FULL OUTER JOIN and CROSS JOIN.",
                "Identify when an accidental CROSS JOIN occurs due to missing ON conditions.",
                "Solve 3 practice problems on set-based joins."
            ]
        },
        {
            "topic": "Multi-Table Joins & Complex Filtering Architectures",
            "what_you_will_learn": [
                "Joining 3, 4, or more tables in a single SQL query pipeline",
                "Associative entity tables (Many-to-Many junction tables)",
                "Performance optimization: join order and index usage on foreign keys",
                "Aggregation across joined tables with GROUP BY and HAVING clauses"
            ],
            "topic_breakdown": [
                {
                    "name": "Many-to-Many Junction Joins",
                    "explanation": "When two entities have a many-to-many relationship, they are joined via an intermediary bridge table using two consecutive JOIN clauses.",
                    "example": "users -> user_roles -> roles",
                    "use_case": "Permissions, tags, enrollments, and shopping carts."
                },
                {
                    "name": "Foreign Key Indexing",
                    "explanation": "Databases perform hash joins or index lookups. Unindexed foreign keys cause full table scans that degrade performance on large tables.",
                    "example": "CREATE INDEX idx_orders_user_id ON orders(user_id);",
                    "use_case": "Scaling database query latency from seconds to milliseconds."
                }
            ],
            "learning_steps": [
                "Diagram a 3-table relational schema with a junction table.",
                "Write a query joining 3 tables: users, user_skills, and skills.",
                "Add an aggregation function (COUNT/AVG) across the joined tables.",
                "Filter aggregated joined groups using the HAVING clause.",
                "Inspect query execution plan using EXPLAIN QUERY PLAN."
            ],
            "practical_examples": [
                {
                    "title": "3-Table Join with Aggregation & Filtering",
                    "code": "-- Calculate total study minutes and completed tasks per candidate role\nSELECT c.name, p.target_role, COUNT(t.id) AS total_tasks, SUM(t.estimated_minutes) AS total_minutes\nFROM candidates c\nINNER JOIN study_plans p ON c.id = p.user_id\nINNER JOIN study_tasks t ON p.id = t.plan_id\nWHERE t.status = 'completed'\nGROUP BY c.id, p.target_role\nHAVING COUNT(t.id) >= 5;",
                    "explanation": "Joins candidates -> study_plans -> study_tasks, aggregates task counts and study minutes, filtering for active learners with 5+ completed tasks.",
                    "output": "| name | target_role | total_tasks | total_minutes |\n| Sarah | Full Stack | 14 | 840 |\n| Alex | ML Engineer | 8 | 480 |",
                    "use_case": "Candidate leaderboard and study analytics dashboard."
                }
            ],
            "practice_activities": [
                "Write a query joining students, enrollments, and courses to report course rosters.",
                "Join 4 tables: customers, orders, order_items, and products.",
                "Calculate total revenue per product category for orders placed in the last 30 days."
            ],
            "completion_goals": [
                "Confidently construct multi-table queries joining 3 or more tables.",
                "Accurately explain when to use WHERE vs HAVING in joined queries.",
                "Solve 3 complex SQL interview questions involving multi-table joins and aggregation."
            ]
        }
    ]

    tasks = []
    for day in range(1, duration_days + 1):
        tpl_idx = (day - 1) % len(templates)
        base = templates[tpl_idx]
        priority = "Critical" if day <= 2 else ("High" if day <= 4 else "Medium")
        t = {
            "day_number": day,
            "topic": f"{base['topic']}" if duration_days <= len(templates) else f"{base['topic']} (Part {(day-1)//len(templates) + 1})",
            "priority": priority,
            "difficulty": prep_level,
            "estimated_minutes": daily_minutes,
            "what_you_will_learn": base["what_you_will_learn"],
            "topic_breakdown": base["topic_breakdown"],
            "learning_steps": base["learning_steps"],
            "practical_examples": base["practical_examples"],
            "practice_activities": base["practice_activities"],
            "completion_goals": base["completion_goals"],
            "recommended_resources": [
                {"title": "PostgreSQL Official Documentation: Queries & Joins", "url": "https://www.postgresql.org/docs/current/queries-table-expressions.html", "type": "documentation"},
                {"title": "SQLZoo: Interactive JOIN Tutorial", "url": "https://sqlzoo.net/wiki/The_JOIN_operation", "type": "practice"}
            ],
            "why_recommended": "SQL Joins are tested in virtually 100% of technical backend, data, and software engineering interviews."
        }
        tasks.append(normalize_task_structured_fields(t))

    return tasks


def _build_python_fundamentals_curriculum(duration_days: int, daily_minutes: int, prep_level: str) -> List[Dict[str, Any]]:
    """Generates structured bullet-point curriculum for Python Fundamentals."""
    templates = [
        {
            "topic": "Python Execution Model, Data Types & Memory References",
            "what_you_will_learn": [
                "How Python code compiles to bytecode and executes on the CPython virtual machine",
                "Difference between mutable types (list, dict, set) and immutable types (int, str, tuple)",
                "How variable assignment creates references rather than copying raw memory",
                "Memory management and garbage collection via reference counting and cyclic GC"
            ],
            "topic_breakdown": [
                {
                    "name": "CPython Bytecode & GIL",
                    "explanation": "Python source code (.py) is compiled into bytecode (.pyc) which is interpreted line-by-line by the CPython VM under the Global Interpreter Lock.",
                    "example": "import dis; dis.dis(lambda x: x + 1)",
                    "use_case": "Explains Python execution speed and single-threaded concurrency constraints."
                },
                {
                    "name": "Mutability & Object Identity",
                    "explanation": "Immutable objects cannot be modified in-place; reassigning them binds the variable name to a brand-new object with a different id().",
                    "example": "a = [1, 2]; b = a; b.append(3) # mutates both a and b",
                    "use_case": "Avoids subtle bugs when passing mutable default arguments in functions."
                }
            ],
            "learning_steps": [
                "Verify your Python environment using python --version in the terminal.",
                "Inspect object memory addresses using id() and compare identities using is vs ==.",
                "Observe the behavior of mutating lists versus reassigning strings.",
                "Disassemble a simple arithmetic function using Python's dis module to view bytecode instructions.",
                "Write a script testing how function parameters modify caller arguments."
            ],
            "practical_examples": [
                {
                    "title": "Reference vs Mutation Demonstration",
                    "code": "# Demonstrating mutable vs immutable binding\ndef append_item(target_list, val):\n    target_list.append(val)\n    return target_list\n\nprimary = [10, 20]\nsecondary = primary\nappend_item(secondary, 30)\nprint('Primary:', primary)\nprint('Secondary:', secondary)\nprint('Identical Objects?', primary is secondary)",
                    "explanation": "secondary points to the exact same list in heap memory as primary, so appending to secondary mutates primary.",
                    "output": "Primary: [10, 20, 30]\nSecondary: [10, 20, 30]\nIdentical Objects? True",
                    "use_case": "Essential for understanding function call mechanics and defensive copying in Python."
                }
            ],
            "practice_activities": [
                "Write a function that proves strings are immutable by comparing id() before and after concatenation.",
                "Demonstrate why def add(item, lst=[]) is an anti-pattern and how to fix it using lst=None.",
                "Use the copy and copy.deepcopy modules to clone nested lists and observe reference differences."
            ],
            "completion_goals": [
                "Clearly explain the difference between is (object identity) and == (value equality).",
                "Explain how Python garbage collection detects and handles circular references.",
                "Solve 3 technical interview questions on Python memory references without error."
            ]
        },
        {
            "topic": "Control Structures, Comprehensions & Generator Iterators",
            "what_you_will_learn": [
                "Writing idiomatic Pythonic loops using enumerate(), zip(), and range()",
                "Constructing list, dict, and set comprehensions for clean data transformation",
                "How generators and yield create lazy memory-efficient streams",
                "The iterator protocol: __iter__() and __next__() mechanics"
            ],
            "topic_breakdown": [
                {
                    "name": "List & Dict Comprehensions",
                    "explanation": "Provides a concise, declarative syntax to construct collections by mapping and filtering an iterable in C-level performance.",
                    "example": "squares = [x**2 for x in range(10) if x % 2 == 0]",
                    "use_case": "Replaces bulky multi-line for loops with expressive, readable transformations."
                },
                {
                    "name": "Generators & Lazy Evaluation",
                    "explanation": "Functions containing yield return a generator object that produces items on-demand, holding O(1) memory regardless of stream length.",
                    "example": "def stream_nums(): yield 1; yield 2",
                    "use_case": "Processing large gigabyte-sized CSV or log files without exhausting RAM."
                }
            ],
            "learning_steps": [
                "Refactor traditional for-loops into concise list and dictionary comprehensions.",
                "Implement a custom generator function utilizing yield to stream sequences.",
                "Measure memory consumption of range() vs list(range()) using sys.getsizeof().",
                "Handle StopIteration when manually iterating via next() on an iterator.",
                "Combine multiple iterables simultaneously using zip(strict=True)."
            ],
            "practical_examples": [
                {
                    "title": "Memory-Efficient Fibonacci Generator",
                    "code": "def fibonacci_stream(limit):\n    a, b = 0, 1\n    for _ in range(limit):\n        yield a\n        a, b = b, a + b\n\n# Stream first 6 Fibonacci numbers\nfib_gen = fibonacci_stream(6)\nfor num in fib_gen:\n    print(num, end=' ')\nprint()",
                    "explanation": "Generates Fibonacci numbers lazily using yield, keeping O(1) space complexity during traversal.",
                    "output": "0 1 1 2 3 5",
                    "use_case": "Streaming pipeline computation and large dataset batch processing."
                }
            ],
            "practice_activities": [
                "Create a dictionary comprehension mapping employee names to their uppercase versions if active.",
                "Write a generator function that reads a text file line-by-line and yields only lines containing 'ERROR'.",
                "Implement a pipeline combining generator expressions to filter and sum numbers."
            ],
            "completion_goals": [
                "Write clean list, dict, and set comprehensions with conditional filtering.",
                "Articulate the difference between return and yield in technical interviews.",
                "Explain the time and space complexity advantages of generators over lists."
            ]
        },
        {
            "topic": "Functions, Scoping (LEGB Rule), Closures & Decorators",
            "what_you_will_learn": [
                "Variable scope resolution using the LEGB rule (Local, Enclosing, Global, Built-in)",
                "How Python closures encapsulate enclosing function state",
                "Writing custom decorators with @wraps to inspect, log, or time function calls",
                "Positional-only, keyword-only, and *args/**kwargs parameter unpacking"
            ],
            "topic_breakdown": [
                {
                    "name": "LEGB Scope & Closures",
                    "explanation": "Python resolves variable lookups in order: Local -> Enclosing -> Global -> Built-in. Closures retain access to enclosing variables even after the outer function finishes.",
                    "example": "def outer(x): return lambda y: x + y",
                    "use_case": "Factory functions, currying, and encapsulation without classes."
                },
                {
                    "name": "Decorators (@decorator)",
                    "explanation": "A decorator is a higher-order callable that takes a function as input, wraps its execution, and returns a modified function.",
                    "example": "@timer_decorator\ndef execute(): pass",
                    "use_case": "Cross-cutting concerns: authentication, metrics logging, rate limiting, and caching."
                }
            ],
            "learning_steps": [
                "Trace variable resolution across nested functions following the LEGB hierarchy.",
                "Use the nonlocal and global keywords appropriately and understand their pitfalls.",
                "Write a basic decorator that prints 'Starting' and 'Finished' around a function.",
                "Use functools.wraps to preserve docstrings and __name__ metadata on decorated functions.",
                "Build a decorator that accepts custom parameters (e.g., @repeat(num_times=3))."
            ],
            "practical_examples": [
                {
                    "title": "Execution Timer Decorator",
                    "code": "import time\nfrom functools import wraps\n\ndef timing_decorator(func):\n    @wraps(func)\n    def wrapper(*args, **kwargs):\n        start = time.perf_counter()\n        result = func(*args, **kwargs)\n        elapsed = time.perf_counter() - start\n        print(f'{func.__name__} executed in {elapsed:.6f}s')\n        return result\n    return wrapper\n\n@timing_decorator\ndef compute_sum(n):\n    return sum(range(n))\n\nprint('Result:', compute_sum(100000))",
                    "explanation": "Wraps compute_sum with timing instrumentation, prints duration, and returns the original function output.",
                    "output": "compute_sum executed in 0.001842s\nResult: 4999950000",
                    "use_case": "APM profiling, performance monitoring, and micro-benchmarks in production."
                }
            ],
            "practice_activities": [
                "Build a @memoize decorator using a dictionary cache to speed up recursive computations.",
                "Write a function utilizing *args and **kwargs to forward parameters to an underlying API client.",
                "Implement a retry decorator that attempts a failing function up to 3 times before raising an exception."
            ],
            "completion_goals": [
                "Accurately explain the LEGB rule and provide examples of nonlocal variables.",
                "Explain the exact mechanics of decorators and why functools.wraps is required.",
                "Successfully write and test a parameterized decorator from scratch."
            ]
        },
        {
            "topic": "Object-Oriented Programming, Dunder Methods & Inheritance",
            "what_you_will_learn": [
                "Core OOP tenets: Encapsulation, Abstraction, Inheritance, and Polymorphism in Python",
                "Special dunder methods: __init__, __repr__, __str__, __len__, and __eq__",
                "Method Resolution Order (MRO) and the C3 super() linearization algorithm",
                "Properties (@property) for getter, setter, and deleter encapsulation"
            ],
            "topic_breakdown": [
                {
                    "name": "Dunder / Magic Methods",
                    "explanation": "Special double-underscore methods allow custom classes to emulate built-in types, operators, and behavior protocols.",
                    "example": "def __eq__(self, other): return self.id == other.id",
                    "use_case": "Operator overloading, readable string formatting, and collection container protocols."
                },
                {
                    "name": "Method Resolution Order (MRO)",
                    "explanation": "Python's algorithm for determining the lookup order for methods and attributes in multiple inheritance hierarchies.",
                    "example": "ClassName.__mro__ or ClassName.mro()",
                    "use_case": "Safely using super() in complex multi-class enterprise architectures."
                }
            ],
            "learning_steps": [
                "Define a class with instance attributes in __init__ and class-level attributes.",
                "Implement __str__ (user-facing representation) and __repr__ (developer/debugging representation).",
                "Add @property and @setter decorators to validate attribute assignment.",
                "Create a subclass inheriting from a parent class and initialize the parent with super().__init__().",
                "Inspect the inheritance hierarchy using Class.mro()."
            ],
            "practical_examples": [
                {
                    "title": "Custom Class with Dunder & Properties",
                    "code": "class BankAccount:\n    def __init__(self, account_holder, balance=0.0):\n        self.account_holder = account_holder\n        self._balance = max(0.0, float(balance))\n\n    @property\n    def balance(self):\n        return self._balance\n\n    def deposit(self, amount):\n        if amount <= 0:\n            raise ValueError('Deposit amount must be positive')\n        self._balance += amount\n\n    def __repr__(self):\n        return f'BankAccount({self.account_holder!r}, balance={self._balance:.2f})'\n\nacc = BankAccount('Alex', 150.0)\nacc.deposit(50.0)\nprint(acc)\nprint('Current Balance:', acc.balance)",
                    "explanation": "Encapsulates balance behind a read-only property, enforces business logic on deposit, and provides clean __repr__.",
                    "output": "BankAccount('Alex', balance=200.00)\nCurrent Balance: 200.0",
                    "use_case": "Financial account modeling and domain-driven software design."
                }
            ],
            "practice_activities": [
                "Build a Vector2D class that implements __add__, __sub__, and __eq__ for coordinate math.",
                "Implement a class hierarchy for Employee, Manager, and Developer with customized calculate_bonus() methods.",
                "Create a dataclass from the dataclasses module and compare boilerplate savings against standard classes."
            ],
            "completion_goals": [
                "Explain the difference between class attributes and instance attributes.",
                "Explain how Python resolves multiple inheritance conflicts using C3 MRO.",
                "Build clean, encapsulated classes using dunder methods and properties."
            ]
        },
        {
            "topic": "Error Handling, Custom Exceptions & Context Managers",
            "what_you_will_learn": [
                "The try-except-else-finally control flow semantics",
                "Creating domain-specific custom Exception subclasses",
                "The with statement and the context manager protocol (__enter__ and __exit__)",
                "Using contextlib.contextmanager for generator-based resource handling"
            ],
            "topic_breakdown": [
                {
                    "name": "Exception Hierarchy & Handling",
                    "explanation": "Python exceptions inherit from BaseException -> Exception. Catching specific exception types prevents masking unexpected system bugs.",
                    "example": "try: ... except FileNotFoundError as e: ...",
                    "use_case": "Robust production services that fail gracefully without crashing."
                },
                {
                    "name": "Context Managers (with statement)",
                    "explanation": "Guarantees resource acquisition and deterministic cleanup (e.g. closing files or DB connections) even if an unhandled exception occurs.",
                    "example": "with open('file.txt', 'r') as f: data = f.read()",
                    "use_case": "File handling, database transactions, lock acquisition, and temporary directory management."
                }
            ],
            "learning_steps": [
                "Structure comprehensive error blocks with try, except, else, and finally.",
                "Create a custom ApplicationError inheriting from Exception with error codes.",
                "Implement a class containing __enter__ and __exit__ to measure block execution time.",
                "Convert the class context manager into a concise generator function using @contextmanager.",
                "Inspect exception traceback details using the traceback module."
            ],
            "practical_examples": [
                {
                    "title": "Custom Context Manager for Database Transactions",
                    "code": "from contextlib import contextmanager\n\n@contextmanager\ndef fake_db_transaction(transaction_name):\n    print(f'[BEGIN] {transaction_name}')\n    try:\n        yield {'status': 'active'}\n        print(f'[COMMIT] {transaction_name}')\n    except Exception as exc:\n        print(f'[ROLLBACK] {transaction_name} due to: {exc}')\n        raise\n    finally:\n        print(f'[CLOSE] {transaction_name} connection')\n\nwith fake_db_transaction('UserUpdate') as tx:\n    print('Executing update operations inside transaction...')",
                    "explanation": "Guarantees commit on success, rollback on error, and connection closure in the finally block.",
                    "output": "[BEGIN] UserUpdate\nExecuting update operations inside transaction...\n[COMMIT] UserUpdate\n[CLOSE] UserUpdate connection",
                    "use_case": "Database transaction rollbacks, file handles, and thread locking mechanisms."
                }
            ],
            "practice_activities": [
                "Create a custom InsufficientFundsError exception and raise it when a balance goes negative.",
                "Write a context manager that temporarily redirects stdout to a string buffer and restores it afterwards.",
                "Handle multi-exception scenarios catching (KeyError, ValueError) in a single except block."
            ],
            "completion_goals": [
                "Explain the exact execution order of try-except-else-finally.",
                "Implement a custom context manager without using external libraries.",
                "Explain why except Exception: is preferred over bare except:."
            ]
        }
    ]

    tasks = []
    for day in range(1, duration_days + 1):
        tpl_idx = (day - 1) % len(templates)
        base = templates[tpl_idx]
        priority = "Critical" if day <= 2 else ("High" if day <= 5 else "Medium")
        t = {
            "day_number": day,
            "topic": f"{base['topic']}" if duration_days <= len(templates) else f"{base['topic']} (Part {(day-1)//len(templates) + 1})",
            "priority": priority,
            "difficulty": prep_level,
            "estimated_minutes": daily_minutes,
            "what_you_will_learn": base["what_you_will_learn"],
            "topic_breakdown": base["topic_breakdown"],
            "learning_steps": base["learning_steps"],
            "practical_examples": base["practical_examples"],
            "practice_activities": base["practice_activities"],
            "completion_goals": base["completion_goals"],
            "recommended_resources": [
                {"title": "Python Official Documentation & Tutorial", "url": "https://docs.python.org/3/tutorial/index.html", "type": "documentation"},
                {"title": "Real Python: Python In-Depth Guides", "url": "https://realpython.com/", "type": "tutorial"},
                {"title": "LeetCode: Python Technical Coding Problems", "url": "https://leetcode.com/problemset/all/?difficulty=EASY&page=1&search=python", "type": "practice"}
            ],
            "why_recommended": "Core Python mastery is evaluated in all Python backend, data, and software engineering interviews."
        }
        tasks.append(normalize_task_structured_fields(t))

    return tasks


def _build_machine_learning_curriculum(duration_days: int, daily_minutes: int, prep_level: str, is_engineer: bool = False) -> List[Dict[str, Any]]:
    """Generates structured bullet-point curriculum for Machine Learning & ML Engineer."""
    templates = [
        {
            "topic": "ML Foundations, Problem Framing & Data Preprocessing",
            "what_you_will_learn": [
                "Formulating business challenges as supervised, unsupervised, or reinforcement learning tasks",
                "Feature scaling methods: Min-Max Normalization vs Z-Score Standardization",
                "Handling missing values and categorical encoding (One-Hot vs Ordinal)",
                "Data leakage prevention when splitting into train, validation, and test sets"
            ],
            "topic_breakdown": [
                {
                    "name": "Supervised vs Unsupervised Paradigms",
                    "explanation": "Supervised learning learns a mapping function from labeled feature-target pairs (classification, regression). Unsupervised finds hidden patterns in unlabeled data (clustering, PCA).",
                    "example": "Supervised: Spam email classification; Unsupervised: Customer segmentation.",
                    "use_case": "Determining proper model architectures for production business problems."
                },
                {
                    "name": "Feature Scaling & Data Leakage",
                    "explanation": "Distance-based algorithms (KNN, SVM, gradient descent) require standardized features. Fitting scalers on the full dataset before splitting leaks test information into training.",
                    "example": "scaler.fit(X_train); X_train_s = scaler.transform(X_train); X_test_s = scaler.transform(X_test)",
                    "use_case": "Ensures model generalization and prevents overly optimistic validation scores."
                }
            ],
            "learning_steps": [
                "Load a sample tabular dataset using pandas and inspect summary statistics.",
                "Identify missing values and apply imputation strategies (median, mode, or KNN imputer).",
                "Perform train_test_split with stratified sampling for imbalanced target classes.",
                "Fit a StandardScaler exclusively on training data and transform both train and test splits.",
                "Encode categorical columns using OneHotEncoder with handle_unknown='ignore'."
            ],
            "practical_examples": [
                {
                    "title": "Scikit-Learn Pipeline for Preprocessing",
                    "code": "import numpy as np\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.preprocessing import StandardScaler\n\n# Synthetic feature matrix (X) and binary labels (y)\nX = np.array([[25, 50000], [45, 90000], [35, 65000], [50, 120000], [23, 40000], [38, 75000]])\ny = np.array([0, 1, 0, 1, 0, 1])\n\nX_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.33, random_state=42)\nscaler = StandardScaler()\nX_train_scaled = scaler.fit_transform(X_train)\nX_test_scaled = scaler.transform(X_test)\n\nprint('Scaled Train Mean:', np.round(X_train_scaled.mean(axis=0), 2))\nprint('Scaled Train Std:', np.round(X_train_scaled.std(axis=0), 2))",
                    "explanation": "Splits data before scaling to avoid data leakage, fitting the scaler solely on X_train.",
                    "output": "Scaled Train Mean: [0. 0.]\nScaled Train Std: [1. 1.]",
                    "use_case": "Standard data ingestion and normalization pipeline for ML model training."
                }
            ],
            "practice_activities": [
                "Load the Iris or Titanic dataset and impute missing values using Scikit-Learn.",
                "Demonstrate the difference between fit(), transform(), and fit_transform().",
                "Write a function calculating Class Imbalance ratio and apply stratified splitting."
            ],
            "completion_goals": [
                "Explain the severe consequences of data leakage in production ML models.",
                "Describe why gradient descent requires feature scaling while decision trees do not.",
                "Implement an end-to-end data preprocessing pipeline without leakage."
            ]
        },
        {
            "topic": "Supervised Algorithms: Linear Regression, Logistic Regression & Gradient Descent",
            "what_you_will_learn": [
                "Mathematical formulation of Mean Squared Error (MSE) and Binary Cross-Entropy loss",
                "How Gradient Descent iteratively optimizes model weights and biases",
                "The sigmoid activation function and probability calibration in Logistic Regression",
                "Interpreting feature coefficients and p-values for feature importance"
            ],
            "topic_breakdown": [
                {
                    "name": "Loss Functions & Optimization",
                    "explanation": "MSE measures squared prediction error for regression; Cross-Entropy measures divergence between predicted probabilities and binary truth.",
                    "example": "Loss = -[y*log(p) + (1-y)*log(1-p)]",
                    "use_case": "Optimization objective for neural networks and logistic classifiers."
                },
                {
                    "name": "Gradient Descent Mechanics",
                    "explanation": "Computes the partial derivative of the loss function with respect to each weight, stepping in the opposite direction by learning rate alpha.",
                    "example": "w = w - alpha * (dL / dw)",
                    "use_case": "Backpropagation and weight optimization across all deep learning and classical ML."
                }
            ],
            "learning_steps": [
                "Write a simple Python function computing Mean Squared Error between predictions and ground truth.",
                "Implement a 1D gradient descent loop from scratch to find the minimum of f(x) = x^2 - 4x + 4.",
                "Train a LogisticRegression model using scikit-learn on a classification dataset.",
                "Extract and inspect model coefficients (clf.coef_) and intercept (clf.intercept_).",
                "Calculate predicted class probabilities using predict_proba() and adjust decision thresholds."
            ],
            "practical_examples": [
                {
                    "title": "Logistic Regression Classification",
                    "code": "from sklearn.linear_model import LogisticRegression\nimport numpy as np\n\n# Training features (study hours) and labels (passed exam: 0 or 1)\nX_hours = np.array([[1.0], [2.0], [3.0], [4.0], [5.0], [6.0]])\ny_passed = np.array([0, 0, 0, 1, 1, 1])\n\nclf = LogisticRegression().fit(X_hours, y_passed)\nprob_3_5 = clf.predict_proba([[3.5]])[0][1]\nprint(f'Probability of passing with 3.5 study hours: {prob_3_5:.2%}')\nprint(f'Prediction: {clf.predict([[3.5]])[0]}')",
                    "explanation": "Fits a logistic sigmoid curve mapping continuous study hours into pass/fail probability.",
                    "output": "Probability of passing with 3.5 study hours: 50.00%\nPrediction: 0",
                    "use_case": "Customer churn prediction, credit default risk assessment, and lead scoring."
                }
            ],
            "practice_activities": [
                "Implement batch gradient descent versus stochastic gradient descent (SGD) in Python.",
                "Tune learning rate alpha (0.1, 0.01, 0.0001) and visualize convergence speed.",
                "Evaluate model performance on an imbalanced dataset by shifting the classification threshold from 0.5 to 0.3."
            ],
            "completion_goals": [
                "Explain the exact mathematical difference between Linear and Logistic Regression.",
                "Explain why learning rate selection is crucial to prevent divergence or vanishing steps.",
                "Interpret logistic regression odds ratios in an interview setting."
            ]
        },
        {
            "topic": "Tree Models, Ensemble Methods (Random Forest, XGBoost) & Regularization",
            "what_you_will_learn": [
                "How Decision Trees split nodes using Gini Impurity and Entropy Information Gain",
                "Bagging principles and variance reduction in Random Forests",
                "Boosting principles and sequential error reduction in Gradient Boosting / XGBoost",
                "Overfitting mitigation using tree depth limits, min_samples_split, and L1/L2 regularization"
            ],
            "topic_breakdown": [
                {
                    "name": "Bagging vs Boosting",
                    "explanation": "Bagging (Bootstrap Aggregation) trains independent trees in parallel on random subsamples to reduce variance. Boosting trains trees sequentially, weighting previous errors to reduce bias.",
                    "example": "Random Forest = Bagging; XGBoost / LightGBM = Boosting.",
                    "use_case": "High-performing tabular data models in Kaggle and industrial production."
                },
                {
                    "name": "Regularization (L1 Lasso vs L2 Ridge)",
                    "explanation": "L1 adds sum of absolute weights penalizing coefficients to exact zero (feature selection). L2 adds sum of squared weights shrinking coefficients smoothly.",
                    "example": "Loss + lambda * sum(|w|) vs Loss + lambda * sum(w^2)",
                    "use_case": "Prevents complex models from memorizing training noise."
                }
            ],
            "learning_steps": [
                "Calculate Gini impurity by hand for a small binary split with 4 positive and 2 negative samples.",
                "Train a RandomForestClassifier and plot feature importances using feature_importances_.",
                "Train an XGBoost or GradientBoostingClassifier and compare validation accuracy.",
                "Tune hyper-parameters (max_depth, n_estimators, learning_rate) using GridSearchCV.",
                "Inspect decision tree boundaries using export_text() or plot_tree()."
            ],
            "practical_examples": [
                {
                    "title": "Random Forest with Feature Importance",
                    "code": "from sklearn.ensemble import RandomForestClassifier\nimport numpy as np\n\nX = np.array([[20, 1], [25, 2], [40, 5], [55, 10], [60, 12]])\ny = np.array([0, 0, 1, 1, 1])\nfeature_names = ['Age', 'YearsExperience']\n\nrf = RandomForestClassifier(n_estimators=10, max_depth=3, random_state=42)\nrf.fit(X, y)\nfor name, imp in zip(feature_names, rf.feature_importances_):\n    print(f'{name}: {imp:.3f}')",
                    "explanation": "Trains an ensemble of decision trees and outputs relative Gini feature importances.",
                    "output": "Age: 0.468\nYearsExperience: 0.532",
                    "use_case": "Feature importance analysis, credit scoring, and predictive maintenance."
                }
            ],
            "practice_activities": [
                "Compare accuracy, precision, and recall of a Single Decision Tree vs Random Forest vs Gradient Boosting.",
                "Tune max_depth on a synthetic noisy dataset to observe underfitting, optimal fit, and overfitting.",
                "Implement L1 and L2 regularization using Ridge and Lasso regression and observe coefficient decay."
            ],
            "completion_goals": [
                "Clearly articulate the bias-variance trade-off in machine learning.",
                "Explain the algorithmic differences between Random Forest and XGBoost in an interview.",
                "Identify symptoms of overfitting on training vs validation loss curves."
            ]
        },
        {
            "topic": "Model Evaluation Metrics, ROC-AUC, Precision-Recall & Cross-Validation",
            "what_you_will_learn": [
                "Confusion Matrix breakdown: True Positives, False Positives, True Negatives, False Negatives",
                "Why Accuracy is deceptive on imbalanced datasets and when to prioritize Precision vs Recall",
                "The ROC Curve, AUC score, and Precision-Recall Curves",
                "K-Fold and Stratified K-Fold Cross-Validation for robust metric estimation"
            ],
            "topic_breakdown": [
                {
                    "name": "Precision vs Recall Trade-off",
                    "explanation": "Precision = TP / (TP + FP) (minimizing false alarms). Recall = TP / (TP + FN) (minimizing missed positives). F1-Score is their harmonic mean.",
                    "example": "Spam filter prioritizes Precision; Cancer detection prioritizes Recall.",
                    "use_case": "Designing metrics aligned directly with business ROI and risk tolerance."
                },
                {
                    "name": "ROC-AUC & Threshold Calibration",
                    "explanation": "Receiver Operating Characteristic plots True Positive Rate vs False Positive Rate across all possible classification probability thresholds.",
                    "example": "AUC = 0.5 (random guess) to 1.0 (perfect classification)",
                    "use_case": "Threshold-agnostic model ranking and benchmark comparison."
                }
            ],
            "learning_steps": [
                "Generate a confusion matrix using confusion_matrix() from sklearn.metrics.",
                "Compute Precision, Recall, and F1-score for a binary classification test set.",
                "Plot or print the classification_report() highlighting per-class metrics.",
                "Compute ROC-AUC score using roc_auc_score(y_true, y_pred_prob).",
                "Execute 5-fold StratifiedKFold cross-validation to report mean score and standard deviation."
            ],
            "practical_examples": [
                {
                    "title": "Comprehensive Classification Evaluation",
                    "code": "from sklearn.metrics import confusion_matrix, classification_report\nimport numpy as np\n\ny_true = np.array([0, 0, 0, 1, 1, 1, 1, 1])\ny_pred = np.array([0, 0, 1, 0, 1, 1, 1, 1])\n\ncm = confusion_matrix(y_true, y_pred)\nprint('Confusion Matrix:')\nprint(cm)\nprint('\\nMetrics:')\nprint(classification_report(y_true, y_pred, target_names=['Class 0', 'Class 1']))",
                    "explanation": "Generates complete classification diagnostic report with precision, recall, and f1-score.",
                    "output": "Confusion Matrix:\n[[2 1]\n [1 4]]\n\nMetrics:\n              precision    recall  f1-score   support\n\n     Class 0       0.67      0.67      0.67         3\n     Class 1       0.80      0.80      0.80         5",
                    "use_case": "Model validation reporting and production deployment gating."
                }
            ],
            "practice_activities": [
                "Simulate a 99:1 imbalanced dataset and demonstrate why a dummy classifier gets 99% accuracy but 0.0 recall.",
                "Calculate F2-score (which weights recall twice as heavily as precision) on medical test predictions.",
                "Perform 5-fold cross validation using cross_val_score on a RandomForest."
            ],
            "completion_goals": [
                "Explain whether to optimize for Precision or Recall in fraud detection vs recommendation systems.",
                "Explain the exact calculation and meaning of ROC-AUC.",
                "Interpret a multi-class confusion matrix and identify which classes suffer from misclassification."
            ]
        },
        {
            "topic": "MLOps, Model Deployment, Serving APIs & System Architecture",
            "what_you_will_learn": [
                "Serializing and deserializing trained model artifacts using joblib or ONNX",
                "Serving predictions with low latency via FastAPI REST endpoints",
                "Batch prediction vs real-time online inference architectural trade-offs",
                "Monitoring data drift, concept drift, and model performance degradation in production"
            ],
            "topic_breakdown": [
                {
                    "name": "Model Serialization & Serving",
                    "explanation": "Trained model weights and preprocessing pipelines are saved as immutable binary artifacts and loaded into memory on server boot.",
                    "example": "joblib.dump(pipeline, 'model_v1.pkl'); loaded = joblib.load('model_v1.pkl')",
                    "use_case": "Decouples offline training pipelines from online production inference servers."
                },
                {
                    "name": "Data Drift vs Concept Drift",
                    "explanation": "Data drift: input distribution P(X) changes over time. Concept drift: the underlying relationship between inputs and outputs P(Y|X) changes.",
                    "example": "Consumer buying habits changing abruptly during economic shifts.",
                    "use_case": "Triggering automated model retraining and canary alerts."
                }
            ],
            "learning_steps": [
                "Export a trained Scikit-Learn Pipeline to a .joblib file on disk.",
                "Write a FastAPI endpoint with Pydantic request schema validation that accepts features and returns predictions.",
                "Measure inference latency in milliseconds for batch requests vs single requests.",
                "Define a Dockerfile containerizing the FastAPI model serving application.",
                "Design a monitoring checklist for data drift detection (e.g. KS-test, PSI metric)."
            ],
            "practical_examples": [
                {
                    "title": "FastAPI Model Inference Endpoint",
                    "code": "# FastAPI Model Serving Schema & Route Simulation\nclass PredictionRequest:\n    def __init__(self, age: int, income: float):\n        self.age = age\n        self.income = income\n\ndef predict_endpoint(req: PredictionRequest):\n    # Simulate model prediction\n    score = 1.0 if (req.income > 50000 and req.age > 21) else 0.0\n    return {'prediction': score, 'status': 'success', 'latency_ms': 4.2}\n\nres = predict_endpoint(PredictionRequest(age=28, income=75000.0))\nprint('Inference Response:', res)",
                    "explanation": "Simulates a structured REST API inference handler returning predictions with latency telemetry.",
                    "output": "Inference Response: {'prediction': 1.0, 'status': 'success', 'latency_ms': 4.2}",
                    "use_case": "Production deployment of machine learning microservices in cloud clusters."
                }
            ],
            "practice_activities": [
                "Save a trained classifier with joblib and reload it in a fresh Python script to run test predictions.",
                "Write a FastAPI app with /health and /predict endpoints for model serving.",
                "Outline an architectural diagram showing feature store, offline training, model registry, and serving API."
            ],
            "completion_goals": [
                "Explain the architectural differences between batch inference and real-time streaming inference.",
                "Explain how to detect data drift using statistical tests in production.",
                "Design an end-to-end ML system architecture for a technical interview challenge."
            ]
        }
    ]

    tasks = []
    for day in range(1, duration_days + 1):
        tpl_idx = (day - 1) % len(templates)
        base = templates[tpl_idx]
        priority = "Critical" if day <= 2 else ("High" if day <= 5 else "Medium")
        role_label = "Machine Learning Engineering" if is_engineer else "Machine Learning"
        t = {
            "day_number": day,
            "topic": f"{base['topic']}" if duration_days <= len(templates) else f"{base['topic']} (Part {(day-1)//len(templates) + 1})",
            "priority": priority,
            "difficulty": prep_level,
            "estimated_minutes": daily_minutes,
            "what_you_will_learn": base["what_you_will_learn"],
            "topic_breakdown": base["topic_breakdown"],
            "learning_steps": base["learning_steps"],
            "practical_examples": base["practical_examples"],
            "practice_activities": base["practice_activities"],
            "completion_goals": base["completion_goals"],
            "recommended_resources": [
                {"title": "Scikit-Learn Official User Guide & API Documentation", "url": "https://scikit-learn.org/stable/user_guide.html", "type": "documentation"},
                {"title": "Google Machine Learning Crash Course", "url": "https://developers.google.com/machine-learning/crash-course", "type": "tutorial"},
                {"title": "Kaggle: Datasets & Interactive ML Competitions", "url": "https://www.kaggle.com/", "type": "practice"}
            ],
            "why_recommended": f"Core pillar for {role_label} technical interviews and real-world system architecture."
        }
        tasks.append(normalize_task_structured_fields(t))

    return tasks


def _build_generic_topic_curriculum(topic: str, duration_days: int, daily_minutes: int, prep_level: str) -> List[Dict[str, Any]]:
    """Generates structured bullet-point curriculum for any arbitrary topic."""
    t_clean = topic.strip()
    stages = [
        (
            f"{t_clean} Core Fundamentals & Architecture",
            [
                f"What {t_clean} is and the core problem it solves in software systems",
                f"Key architectural components and runtime execution lifecycle of {t_clean}",
                f"Standard syntax, setup, and configuration guidelines",
                f"Common beginner mistakes and how to avoid them"
            ],
            [
                f"Install and verify runtime environment for {t_clean}.",
                f"Write a simple 'Hello World' or proof-of-concept module in {t_clean}.",
                f"Trace data flow from input through execution to output.",
                f"Inspect diagnostic logs and error reporting mechanisms."
            ]
        ),
        (
            f"{t_clean} Essential Mechanics & Data Flow",
            [
                f"Data handling, variables, and type safety in {t_clean}",
                f"Control structures, branching logic, and state management",
                f"Modular organization and reusable components in {t_clean}",
                f"Debugging techniques and inspection tools"
            ],
            [
                f"Break logic into clean, reusable modular units.",
                f"Implement state transitions and handle dynamic inputs.",
                f"Handle edge-case inputs without raising unhandled exceptions.",
                f"Write unit tests to verify expected outputs."
            ]
        ),
        (
            f"{t_clean} Advanced Patterns & Optimization",
            [
                f"Production design patterns commonly applied to {t_clean}",
                f"Performance profiling and latency optimization strategies",
                f"Concurrency, asynchronous handling, or scaling techniques",
                f"Security best practices and vulnerability prevention"
            ],
            [
                f"Identify performance bottlenecks using profiling tools.",
                f"Refactor brute-force logic into idiomatic, optimal patterns.",
                f"Apply caching, connection pooling, or asynchronous calls where appropriate.",
                f"Verify memory footprint and asymptotic complexity."
            ]
        ),
        (
            f"{t_clean} Real-World Interview Challenges & Mock Practice",
            [
                f"High-frequency interview questions asked by top tech firms on {t_clean}",
                f"Structuring verbal technical explanations using the STAR / rule-of-three framework",
                f"Live whiteboard coding problem walkthroughs under timed conditions",
                f"Architectural trade-off discussions (CAP theorem, time vs space complexity)"
            ],
            [
                f"Solve 3 rapid-fire coding questions on {t_clean} without looking at notes.",
                f"Explain design decisions and trade-offs out loud in under 2 minutes.",
                f"Review mistake history and implement corrections.",
                f"Complete full timed mock interview simulation."
            ]
        )
    ]

    tasks = []
    for day in range(1, duration_days + 1):
        stage_idx = (day - 1) % len(stages)
        title, learn_points, steps = stages[stage_idx]
        priority = "Critical" if day <= 2 else ("High" if day % 2 == 0 else "Medium")

        subtopics_list = [
            {
                "name": f"{t_clean} Principle {idx}",
                "explanation": f"Core operational mechanic of {t_clean} ensuring stability, scalability, and code clarity.",
                "example": f"Code/Pattern: import or apply standard {t_clean} construct in production code.",
                "use_case": f"Critical for scalable software engineering and technical interview readiness."
            } for idx in range(1, 3)
        ]

        t = {
            "day_number": day,
            "topic": f"{title} (Day {day})",
            "priority": priority,
            "difficulty": prep_level,
            "estimated_minutes": daily_minutes,
            "what_you_will_learn": learn_points,
            "topic_breakdown": subtopics_list,
            "learning_steps": steps,
            "practical_examples": [
                {
                    "title": f"Practical {t_clean} Implementation",
                    "code": f"# Practical snippet demonstrating {t_clean}\ndef execute_task():\n    print('Executing {t_clean} module...')\n    return True\n\nexecute_task()",
                    "explanation": f"Defines and executes a clean implementation of {t_clean} principles.",
                    "output": f"Executing {t_clean} module...",
                    "use_case": f"Production usage of {t_clean} in modern software architectures."
                }
            ],
            "practice_activities": [
                f"Implement a hands-on project applying the concepts covered in {title}.",
                f"Solve 2 algorithmic or architectural practice questions focused on {t_clean}.",
                f"Review documentation and explain key trade-offs out loud."
            ],
            "completion_goals": [
                f"Successfully write and execute clean code demonstrating {t_clean} without errors.",
                f"Articulate the purpose and mechanics of {t_clean} in simple terms.",
                "Complete all daily practice exercises independently."
            ],
            "recommended_resources": [
                {"title": f"{t_clean} Official Documentation", "url": f"https://www.google.com/search?q={t_clean.replace(' ', '+')}+official+documentation", "type": "documentation"},
                {"title": f"{t_clean} Tutorial & Best Practices", "url": f"https://www.google.com/search?q={t_clean.replace(' ', '+')}+tutorial+interview", "type": "tutorial"}
            ],
            "why_recommended": f"Essential knowledge area required for mastery in {t_clean}."
        }
        tasks.append(normalize_task_structured_fields(t))

    return tasks


def build_structured_topic_curriculum(
    topic: str,
    duration_days: int,
    daily_study_minutes: int,
    preparation_level: str,
    role: str = ""
) -> Dict[str, Any]:
    """
    Main curriculum builder creating structured bullet-point roadmaps for any
    role, subject, concept, or single topic.
    """
    t_clean = topic.strip()
    t_lower = t_clean.lower()

    if "variable" in t_lower:
        tasks = _build_python_variables_curriculum(duration_days, daily_study_minutes, preparation_level)
    elif "sql" in t_lower or "join" in t_lower:
        tasks = _build_sql_joins_curriculum(duration_days, daily_study_minutes, preparation_level)
    elif "machine learning" in t_lower or "ml" in t_lower:
        tasks = _build_machine_learning_curriculum(duration_days, daily_study_minutes, preparation_level, is_engineer=("engineer" in t_lower))
    elif "python" in t_lower:
        tasks = _build_python_fundamentals_curriculum(duration_days, daily_study_minutes, preparation_level)
    else:
        tasks = _build_generic_topic_curriculum(t_clean, duration_days, daily_study_minutes, preparation_level)

    plan_title = f"{duration_days}-Day Targeted {t_clean} Mastery Roadmap"
    summary = f"Structured, progressive {duration_days}-day curriculum specifically focused on mastering {t_clean} at {preparation_level} level."

    return {
        "plan_title": plan_title,
        "summary": summary,
        "focus_areas": [f"{t_clean} Fundamentals", f"{t_clean} Architecture", f"{t_clean} Practical Applications", f"{t_clean} Interview Challenges"],
        "tasks": tasks
    }
