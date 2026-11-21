"""
Curated Learning Resources Service for Intervexa AI.
Provides verified, authentic, high-quality learning resources (courses, tutorials,
videos, documentation, practice) categorized by skill, difficulty level, and career track.
"""

import re
from typing import Dict, List, Any, Optional

# Curated repository of verified learning resources with authentic URLs
CURATED_RESOURCE_CATALOG: Dict[str, List[Dict[str, Any]]] = {
    "python": [
        {
            "id": "py_doc_1",
            "title": "Python 3 Official Tutorial & Language Reference",
            "description": "Comprehensive official reference covering standard types, control flow, data structures, modules, and the standard library.",
            "topic": "Python",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "Python Software Foundation",
            "url": "https://docs.python.org/3/tutorial/index.html",
            "tags": ["python", "basics", "syntax", "standard-library", "beginner"],
        },
        {
            "id": "py_vid_1",
            "title": "Python for Beginners – Full Programming Course",
            "description": "Practical step-by-step video tutorial covering variables, loops, functions, lists, dictionaries, and object-oriented fundamentals.",
            "topic": "Python",
            "type": "Video",
            "level": "Beginner",
            "provider": "freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=eWRfhZUzrSE",
            "tags": ["python", "fundamentals", "video", "beginner", "coding"],
        },
        {
            "id": "py_tut_1",
            "title": "Real Python – Python Basics & Practical Learning Path",
            "description": "Interactive developer tutorial path focusing on Pythonic idioms, code organization, debugging, and foundational development.",
            "topic": "Python",
            "type": "Tutorial",
            "level": "Beginner",
            "provider": "Real Python",
            "url": "https://realpython.com/learning-paths/python-basics/",
            "tags": ["python", "tutorial", "hands-on", "beginner"],
        },
        {
            "id": "py_crs_1",
            "title": "Complete Python Developer Bootcamp: Zero to Mastery",
            "description": "End-to-end Python curriculum covering object-oriented programming, file I/O, error handling, web scraping, and database integration.",
            "topic": "Python",
            "type": "Course",
            "level": "Intermediate",
            "provider": "Udemy",
            "url": "https://www.udemy.com/course/complete-python-bootcamp/",
            "tags": ["python", "oop", "bootcamp", "intermediate", "full-stack"],
        },
        {
            "id": "py_tut_2",
            "title": "Intermediate Python: Decorators, Generators & Context Managers",
            "description": "In-depth guide exploring Python internals, iterators, generators, custom decorators, and memory-efficient coding patterns.",
            "topic": "Python",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "Real Python",
            "url": "https://realpython.com/learning-paths/python-intermediate/",
            "tags": ["python", "decorators", "generators", "intermediate", "clean-code"],
        },
        {
            "id": "py_prac_1",
            "title": "LeetCode Python Coding Challenges & Problem Solving",
            "description": "Hands-on practice solving core algorithmic and data manipulation problems in idiomatic Python.",
            "topic": "Python",
            "type": "Practice",
            "level": "Intermediate",
            "provider": "LeetCode",
            "url": "https://leetcode.com/problemset/all/?difficulty=EASY&page=1",
            "tags": ["python", "practice", "algorithms", "interview-prep", "intermediate"],
        },
        {
            "id": "py_doc_2",
            "title": "Python AsyncIO & Concurrency Architecture Guide",
            "description": "Authoritative documentation for high-throughput asynchronous programming, coroutines, event loops, and task scheduling in Python.",
            "topic": "Python",
            "type": "Documentation",
            "level": "Advanced",
            "provider": "Python Software Foundation",
            "url": "https://docs.python.org/3/library/asyncio.html",
            "tags": ["python", "asyncio", "concurrency", "advanced", "performance"],
        },
        {
            "id": "py_crs_2",
            "title": "Python 3 Programming Specialization",
            "description": "Rigorous academic curriculum covering advanced data structures, APIs, third-party libraries, and software engineering in Python.",
            "topic": "Python",
            "type": "Course",
            "level": "Advanced",
            "provider": "Coursera",
            "url": "https://www.coursera.org/specializations/python-3-programming",
            "tags": ["python", "advanced", "specialization", "architecture"],
        },
    ],
    "java": [
        {
            "id": "java_doc_1",
            "title": "The Java Tutorials: Getting Started with Java SE",
            "description": "Official Oracle guide covering Java language basics, class definitions, object lifecycle, inheritance, and packages.",
            "topic": "Java",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "Oracle Java Docs",
            "url": "https://docs.oracle.com/javase/tutorial/getStarted/index.html",
            "tags": ["java", "core-java", "oop", "beginner", "syntax"],
        },
        {
            "id": "java_vid_1",
            "title": "Java Programming Full Course for Beginners",
            "description": "Comprehensive video breakdown of object-oriented principles, JVM fundamentals, interfaces, abstract classes, and exception handling.",
            "topic": "Java",
            "type": "Video",
            "level": "Beginner",
            "provider": "freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=A74TOX803D0",
            "tags": ["java", "video", "fundamentals", "beginner"],
        },
        {
            "id": "java_tut_1",
            "title": "Baeldung: Core Java Tutorials for Software Engineers",
            "description": "Industry-standard developer tutorials on Java Collections Framework, Streams API, Optional, and modern Java syntax (11/17/21).",
            "topic": "Java",
            "type": "Tutorial",
            "level": "Beginner",
            "provider": "Baeldung",
            "url": "https://www.baeldung.com/get-started-with-java-series",
            "tags": ["java", "baeldung", "collections", "beginner", "streams"],
        },
        {
            "id": "java_crs_1",
            "title": "Java Programming Masterclass with Spring Boot",
            "description": "Complete enterprise curriculum covering modern Java, SOLID design principles, JUnit 5 unit testing, and Spring Boot REST services.",
            "topic": "Java",
            "type": "Course",
            "level": "Intermediate",
            "provider": "Udemy",
            "url": "https://www.udemy.com/course/java-the-complete-java-developer-course/",
            "tags": ["java", "spring-boot", "intermediate", "enterprise", "backend"],
        },
        {
            "id": "java_tut_2",
            "title": "Building Production Enterprise Apps with Spring Boot & JPA",
            "description": "Comprehensive guide to relational data persistence, Hibernate mappings, transaction management, and microservice integration.",
            "topic": "Java",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "Baeldung",
            "url": "https://www.baeldung.com/spring-boot",
            "tags": ["java", "spring-boot", "jpa", "hibernate", "intermediate"],
        },
        {
            "id": "java_prac_1",
            "title": "HackerRank Java Track – Coding Challenges",
            "description": "Practice problem-solving in Java covering string manipulation, BigInteger, generics, comparator sorting, and collections.",
            "topic": "Java",
            "type": "Practice",
            "level": "Intermediate",
            "provider": "HackerRank",
            "url": "https://www.hackerrank.com/domains/java",
            "tags": ["java", "practice", "challenges", "interview-prep", "intermediate"],
        },
        {
            "id": "java_doc_2",
            "title": "Oracle HotSpot Virtual Machine & Garbage Collection Tuning",
            "description": "In-depth JVM performance guide on memory layout, ZGC / G1GC collectors, heap sizing, and low-latency thread tuning.",
            "topic": "Java",
            "type": "Documentation",
            "level": "Advanced",
            "provider": "Oracle",
            "url": "https://docs.oracle.com/en/java/javase/17/gctuning/",
            "tags": ["java", "jvm", "garbage-collection", "performance", "advanced"],
        },
        {
            "id": "java_crs_2",
            "title": "Java Multithreading, Concurrency & Performance Optimization",
            "description": "Master atomic variables, locks, volatile semantics, thread pooling, fork-join, and non-blocking concurrent data structures in Java.",
            "topic": "Java",
            "type": "Course",
            "level": "Advanced",
            "provider": "Udemy",
            "url": "https://www.udemy.com/course/java-multithreading-concurrency-performance-optimization/",
            "tags": ["java", "concurrency", "multithreading", "advanced", "performance"],
        },
    ],
    "react": [
        {
            "id": "react_doc_1",
            "title": "React Official Documentation – Quick Start & Tutorial",
            "description": "The definitive interactive guide by the React core team on JSX, components, props, state, and rendering UI cleanly.",
            "topic": "React",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "React.dev",
            "url": "https://react.dev/learn",
            "tags": ["react", "jsx", "components", "beginner", "frontend"],
        },
        {
            "id": "react_vid_1",
            "title": "React JS Full Course – Complete Modern Guide",
            "description": "Comprehensive video course covering modern React concepts, component composition, hooks, and clean state flow.",
            "topic": "React",
            "type": "Video",
            "level": "Beginner",
            "provider": "freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=bMknfKXIFA8",
            "tags": ["react", "video", "components", "beginner"],
        },
        {
            "id": "react_tut_1",
            "title": "Thinking in React – Component Architecture & Hierarchy",
            "description": "Master how to break UI wireframes into reusable component hierarchies, identify single sources of truth, and lift state.",
            "topic": "React",
            "type": "Tutorial",
            "level": "Beginner",
            "provider": "React Official",
            "url": "https://react.dev/learn/thinking-in-react",
            "tags": ["react", "architecture", "component-hierarchy", "beginner"],
        },
        {
            "id": "react_tut_2",
            "title": "Managing State & Custom Hooks in React Applications",
            "description": "Deep dive into useState, useReducer, context composition, and writing clean, reusable custom hooks without race conditions.",
            "topic": "React",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "React Official",
            "url": "https://react.dev/learn/managing-state",
            "tags": ["react", "hooks", "state-management", "intermediate"],
        },
        {
            "id": "react_crs_1",
            "title": "The Ultimate React Course: React, Redux & Modern Frontend",
            "description": "Production-grade React curriculum covering Redux Toolkit, React Query, form handling, routing, and performance profiling.",
            "topic": "React",
            "type": "Course",
            "level": "Intermediate",
            "provider": "Udemy",
            "url": "https://www.udemy.com/course/the-ultimate-react-course/",
            "tags": ["react", "redux", "course", "intermediate", "web-dev"],
        },
        {
            "id": "react_prac_1",
            "title": "GreatFrontEnd React Component Coding Challenges",
            "description": "Realistic frontend coding challenges to build accessible, performant React components asked in top tech company interviews.",
            "topic": "React",
            "type": "Practice",
            "level": "Intermediate",
            "provider": "GreatFrontEnd",
            "url": "https://www.greatfrontend.com/questions/react",
            "tags": ["react", "practice", "interview-prep", "intermediate", "frontend"],
        },
        {
            "id": "react_doc_2",
            "title": "React Hooks API Reference & Escape Hatches",
            "description": "Complete documentation for useCallback, useMemo, useRef, useLayoutEffect, and avoiding infinite re-render loops.",
            "topic": "React",
            "type": "Documentation",
            "level": "Advanced",
            "provider": "React Official Docs",
            "url": "https://react.dev/reference/react",
            "tags": ["react", "hooks-reference", "usememo", "usecallback", "advanced"],
        },
        {
            "id": "react_tut_3",
            "title": "React Performance Optimization & Re-render Prevention",
            "description": "Advanced guide to component memoization, virtualization, code-splitting with Suspense, and optimizing large application trees.",
            "topic": "React",
            "type": "Tutorial",
            "level": "Advanced",
            "provider": "Kent C. Dodds",
            "url": "https://kentcdodds.com/blog/usememo-and-usecallback",
            "tags": ["react", "performance", "optimization", "advanced"],
        },
    ],
    "sql": [
        {
            "id": "sql_doc_1",
            "title": "PostgreSQL Tutorial & Relational Database Fundamentals",
            "description": "Official guide covering database creation, table schemas, queries, JOIN clauses, constraints, and transactions.",
            "topic": "SQL",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "PostgreSQL Official Docs",
            "url": "https://www.postgresql.org/docs/current/tutorial.html",
            "tags": ["sql", "database", "postgres", "beginner", "queries"],
        },
        {
            "id": "sql_tut_1",
            "title": "SQLBolt – Interactive SQL Lessons & Exercises",
            "description": "Self-paced interactive browser-based lessons on SELECT queries, aggregate functions, GROUP BY, and multi-table filtering.",
            "topic": "SQL",
            "type": "Tutorial",
            "level": "Beginner",
            "provider": "SQLBolt",
            "url": "https://sqlbolt.com",
            "tags": ["sql", "interactive", "tutorial", "beginner", "queries"],
        },
        {
            "id": "sql_vid_1",
            "title": "SQL Tutorial – Full Database Course for Beginners",
            "description": "Comprehensive video course covering SQL schema design, relational modeling, CRUD operations, and nested subqueries.",
            "topic": "SQL",
            "type": "Video",
            "level": "Beginner",
            "provider": "freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=HXV3zeQKqGY",
            "tags": ["sql", "video", "database", "beginner"],
        },
        {
            "id": "sql_crs_1",
            "title": "The Complete SQL Bootcamp: Go from Zero to Hero",
            "description": "Hands-on PostgreSQL course covering string/math functions, timestamps, window functions, conditional CASE statements, and views.",
            "topic": "SQL",
            "type": "Course",
            "level": "Intermediate",
            "provider": "Udemy",
            "url": "https://www.udemy.com/course/the-complete-sql-bootcamp/",
            "tags": ["sql", "postgres", "intermediate", "course", "data-analysis"],
        },
        {
            "id": "sql_tut_2",
            "title": "Use The Index, Luke! – SQL Indexing & Query Tuning Guide",
            "description": "The definitive developer tutorial on B-Tree indexes, composite indexes, query plans, table scans, and JOIN algorithms.",
            "topic": "SQL",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "Use The Index, Luke!",
            "url": "https://use-the-index-luke.com",
            "tags": ["sql", "indexing", "performance", "query-tuning", "intermediate"],
        },
        {
            "id": "sql_prac_1",
            "title": "LeetCode Top SQL 50 Study Plan & Challenges",
            "description": "50 essential SQL interview problems covering joins, aggregation, subqueries, and window functions asked by top companies.",
            "topic": "SQL",
            "type": "Practice",
            "level": "Intermediate",
            "provider": "LeetCode",
            "url": "https://leetcode.com/studyplan/top-sql-50/",
            "tags": ["sql", "practice", "leetcode", "interview-prep", "intermediate"],
        },
        {
            "id": "sql_doc_2",
            "title": "PostgreSQL Performance Optimization & EXPLAIN ANALYZE",
            "description": "Authoritative guide on reading query execution plans, understanding cost estimates, index scans vs bitmap scans, and vacuum tuning.",
            "topic": "SQL",
            "type": "Documentation",
            "level": "Advanced",
            "provider": "PostgreSQL Official Docs",
            "url": "https://www.postgresql.org/docs/current/performance-tips.html",
            "tags": ["sql", "explain-analyze", "optimization", "advanced", "postgres"],
        },
        {
            "id": "sql_tut_3",
            "title": "Advanced SQL Execution Plans & Locking In-Depth",
            "description": "Detailed guide on relational engine execution trees, lock escalations, deadlock mitigation, and table partitioning strategies.",
            "topic": "SQL",
            "type": "Tutorial",
            "level": "Advanced",
            "provider": "Use The Index, Luke!",
            "url": "https://use-the-index-luke.com/sql/explain-plan",
            "tags": ["sql", "execution-plans", "locks", "advanced", "tuning"],
        },
    ],
    "machine learning": [
        {
            "id": "ml_tut_1",
            "title": "Google Machine Learning Crash Course",
            "description": "Fast-paced, practical Google engineering curriculum covering loss functions, gradient descent, overfitting, and classification metrics.",
            "topic": "Machine Learning",
            "type": "Tutorial",
            "level": "Beginner",
            "provider": "Google Developers",
            "url": "https://developers.google.com/machine-learning/crash-course",
            "tags": ["machine-learning", "google", "beginner", "foundations", "ai"],
        },
        {
            "id": "ml_doc_1",
            "title": "Scikit-Learn Getting Started & Core Concepts Guide",
            "description": "Official documentation covering estimator conventions, pipelines, feature preprocessing, cross-validation, and metrics.",
            "topic": "Machine Learning",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "Scikit-Learn Docs",
            "url": "https://scikit-learn.org/stable/getting_started.html",
            "tags": ["machine-learning", "scikit-learn", "python", "beginner", "modeling"],
        },
        {
            "id": "ml_vid_1",
            "title": "StatQuest: Machine Learning Fundamentals Visualized",
            "description": "Visual, intuitive video breakdowns explaining Linear Regression, Logistic Regression, Decision Trees, ROC curves, and Bias-Variance tradeoff.",
            "topic": "Machine Learning",
            "type": "Video",
            "level": "Beginner",
            "provider": "StatQuest",
            "url": "https://www.youtube.com/c/joshstarmer",
            "tags": ["machine-learning", "statquest", "video", "beginner", "statistics"],
        },
        {
            "id": "ml_crs_1",
            "title": "Machine Learning Specialization by Andrew Ng",
            "description": "The world-famous foundational specialization covering supervised learning, neural networks, decision trees, and recommendation systems.",
            "topic": "Machine Learning",
            "type": "Course",
            "level": "Intermediate",
            "provider": "Coursera",
            "url": "https://www.coursera.org/specializations/machine-learning-introduction",
            "tags": ["machine-learning", "andrew-ng", "deeplearning-ai", "intermediate", "course"],
        },
        {
            "id": "ml_prac_1",
            "title": "Kaggle: Intro to Machine Learning Practice Micro-Course",
            "description": "Hands-on Jupyter notebook course training Random Forests, evaluating mean absolute error, and participating in Kaggle competitions.",
            "topic": "Machine Learning",
            "type": "Practice",
            "level": "Intermediate",
            "provider": "Kaggle",
            "url": "https://www.kaggle.com/learn/intro-to-machine-learning",
            "tags": ["machine-learning", "kaggle", "practice", "hands-on", "intermediate"],
        },
        {
            "id": "ml_doc_2",
            "title": "Scikit-Learn Supervised & Unsupervised Learning User Guide",
            "description": "Comprehensive reference covering SVMs, ensemble methods (Random Forest, Gradient Boosting), clustering, and hyperparameter tuning.",
            "topic": "Machine Learning",
            "type": "Documentation",
            "level": "Intermediate",
            "provider": "Scikit-Learn Docs",
            "url": "https://scikit-learn.org/stable/supervised_learning.html",
            "tags": ["machine-learning", "scikit-learn", "ensembles", "intermediate"],
        },
        {
            "id": "ml_crs_2",
            "title": "Deep Learning Specialization: Neural Networks & Backprop",
            "description": "In-depth specialization on deep feedforward networks, CNNs, sequence models (RNN/Transformers), and hyperparameter optimization.",
            "topic": "Machine Learning",
            "type": "Course",
            "level": "Advanced",
            "provider": "Coursera",
            "url": "https://www.coursera.org/specializations/deep-learning",
            "tags": ["machine-learning", "deep-learning", "neural-networks", "advanced"],
        },
        {
            "id": "ml_tut_2",
            "title": "PyTorch Official Deep Learning & Tensor Architecture Tutorials",
            "description": "Production guides on building custom neural network layers, autograd mechanics, GPU training pipelines, and model deployment.",
            "topic": "Machine Learning",
            "type": "Tutorial",
            "level": "Advanced",
            "provider": "PyTorch Official",
            "url": "https://pytorch.org/tutorials/",
            "tags": ["machine-learning", "pytorch", "deep-learning", "advanced", "tensors"],
        },
    ],
    "system design": [
        {
            "id": "sd_doc_1",
            "title": "System Design Primer – Comprehensive Architectural Patterns",
            "description": "Open-source standard covering load balancing, caching strategies, database sharding, replication, and distributed system design.",
            "topic": "System Design",
            "type": "Documentation",
            "level": "Intermediate",
            "provider": "GitHub / Donne Martin",
            "url": "https://github.com/donnemartin/system-design-primer",
            "tags": ["system-design", "architecture", "scalability", "intermediate"],
        },
        {
            "id": "sd_tut_1",
            "title": "High Scalability – Real-World Production Case Studies",
            "description": "Deep-dive architectural case studies explaining how Netflix, Uber, Twitter, and Amazon build resilient, high-throughput systems.",
            "topic": "System Design",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "High Scalability",
            "url": "https://highscalability.com",
            "tags": ["system-design", "case-studies", "architecture", "intermediate"],
        },
        {
            "id": "sd_vid_1",
            "title": "System Design Interview – Step-by-Step Architectural Framework",
            "description": "Visual video breakdown on structuring technical architecture interviews, throughput estimation, and single points of failure.",
            "topic": "System Design",
            "type": "Video",
            "level": "Intermediate",
            "provider": "YouTube",
            "url": "https://www.youtube.com/watch?v=bUHFg8CZFCA",
            "tags": ["system-design", "interview-prep", "video", "intermediate"],
        },
        {
            "id": "sd_crs_1",
            "title": "Software Architecture & Large-Scale Distributed Systems",
            "description": "Structured curriculum covering CAP theorem, distributed consensus, message queues, and microservice decomposition.",
            "topic": "System Design",
            "type": "Course",
            "level": "Advanced",
            "provider": "Coursera",
            "url": "https://www.coursera.org/learn/software-architecture",
            "tags": ["system-design", "distributed-systems", "advanced", "course"],
        },
    ],
    "data structures": [
        {
            "id": "dsa_doc_1",
            "title": "GeeksforGeeks – Data Structures Master Reference Guide",
            "description": "Curated explanations, time/space complexity analysis, and implementation guides for Arrays, Linked Lists, Trees, Graphs, and Heaps.",
            "topic": "Data Structures",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "GeeksforGeeks",
            "url": "https://www.geeksforgeeks.org/data-structures/",
            "tags": ["data-structures", "dsa", "complexity", "beginner"],
        },
        {
            "id": "dsa_tut_1",
            "title": "NeetCode DSA Roadmap – Visual Problem Solving Guide",
            "description": "Interactive problem roadmap categorizing core patterns (Two Pointers, Sliding Window, DFS/BFS, Dynamic Programming) for technical interviews.",
            "topic": "Data Structures",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "NeetCode.io",
            "url": "https://neetcode.io/roadmap",
            "tags": ["data-structures", "algorithms", "neetcode", "intermediate", "interview-prep"],
        },
        {
            "id": "dsa_prac_1",
            "title": "LeetCode Top Interview 150 Study Plan",
            "description": "Carefully curated classic 150 interview problems covering trees, graphs, binary search, and dynamic programming.",
            "topic": "Data Structures",
            "type": "Practice",
            "level": "Intermediate",
            "provider": "LeetCode",
            "url": "https://leetcode.com/studyplan/top-interview-150/",
            "tags": ["data-structures", "algorithms", "leetcode", "practice", "interview-prep"],
        },
        {
            "id": "dsa_crs_1",
            "title": "Algorithms Specialization by Stanford University",
            "description": "Rigorous academic curriculum covering divide-and-conquer, randomized algorithms, graph search, and greedy optimization.",
            "topic": "Data Structures",
            "type": "Course",
            "level": "Advanced",
            "provider": "Coursera",
            "url": "https://www.coursera.org/specializations/algorithms",
            "tags": ["data-structures", "algorithms", "stanford", "advanced"],
        },
    ],
    "rest apis": [
        {
            "id": "api_doc_1",
            "title": "MDN Web Docs – REST API Architecture & HTTP Standards",
            "description": "Mozilla developer reference explaining stateless client-server communication, HTTP verbs (GET, POST, PUT, DELETE, PATCH), and status codes.",
            "topic": "REST APIs",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "Mozilla MDN",
            "url": "https://developer.mozilla.org/en-US/docs/Glossary/REST",
            "tags": ["rest-apis", "http", "mdn", "beginner", "api"],
        },
        {
            "id": "api_tut_1",
            "title": "RESTful API Design Best Practices & Standards Guide",
            "description": "Practical guide on URL resource naming, versioning, filtering, pagination, HATEOAS, and idempotency guarantees.",
            "topic": "REST APIs",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "REST API Tutorial",
            "url": "https://restfulapi.net",
            "tags": ["rest-apis", "api-design", "best-practices", "intermediate"],
        },
        {
            "id": "api_vid_1",
            "title": "REST APIs Concepts, Architecture and Live Examples",
            "description": "Clear visual video walkthrough detailing request/response cycles, header authentication, status codes, and JSON schemas.",
            "topic": "REST APIs",
            "type": "Video",
            "level": "Beginner",
            "provider": "Web Dev Simplified",
            "url": "https://www.youtube.com/watch?v=-mN3VyJuCjM",
            "tags": ["rest-apis", "video", "tutorial", "beginner"],
        },
        {
            "id": "api_crs_1",
            "title": "REST APIs with Flask and Python: Complete Course",
            "description": "Build production-ready RESTful APIs with Python, Flask-SMC, SQLAlchemy, JWT token authentication, and Docker deployment.",
            "topic": "REST APIs",
            "type": "Course",
            "level": "Intermediate",
            "provider": "Udemy",
            "url": "https://www.udemy.com/course/rest-api-flask-and-python/",
            "tags": ["rest-apis", "flask", "python", "intermediate", "course"],
        },
    ],
    "microservices": [
        {
            "id": "ms_doc_1",
            "title": "Microservices Architecture Patterns & Best Practices",
            "description": "Chris Richardson's definitive pattern language covering API Gateway, Saga pattern, Database-per-Service, and Event Sourcing.",
            "topic": "Microservices",
            "type": "Documentation",
            "level": "Intermediate",
            "provider": "Microservices.io",
            "url": "https://microservices.io/patterns/index.html",
            "tags": ["microservices", "patterns", "architecture", "intermediate"],
        },
        {
            "id": "ms_tut_1",
            "title": "Martin Fowler on Microservices – Architectural Foundations",
            "description": "The seminal architectural article defining microservices boundaries, decentralized governance, and resilient integration.",
            "topic": "Microservices",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "Martin Fowler",
            "url": "https://martinfowler.com/articles/microservices.html",
            "tags": ["microservices", "martin-fowler", "architecture", "intermediate"],
        },
        {
            "id": "ms_vid_1",
            "title": "Microservices Architecture & System Design Deep Dive",
            "description": "Video walkthrough explaining inter-service communication (REST vs gRPC vs Kafka), fault tolerance, and circuit breakers.",
            "topic": "Microservices",
            "type": "Video",
            "level": "Intermediate",
            "provider": "freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=1xo-0gCVhTU",
            "tags": ["microservices", "video", "architecture", "intermediate"],
        },
        {
            "id": "ms_crs_1",
            "title": "Building Scalable Microservices with Spring Boot and Spring Cloud",
            "description": "Production microservice development course with service discovery, centralized configuration, resilient routing, and observability.",
            "topic": "Microservices",
            "type": "Course",
            "level": "Advanced",
            "provider": "Udemy",
            "url": "https://www.udemy.com/course/microservices-with-spring-boot-and-spring-cloud/",
            "tags": ["microservices", "spring-boot", "spring-cloud", "advanced", "course"],
        },
    ],
    "javascript": [
        {
            "id": "js_doc_1",
            "title": "MDN Web Docs – JavaScript Guide & Reference",
            "description": "Comprehensive Mozilla documentation covering syntax, objects, functions, closures, promises, and the modern DOM API.",
            "topic": "JavaScript",
            "type": "Documentation",
            "level": "Beginner",
            "provider": "Mozilla MDN",
            "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
            "tags": ["javascript", "mdn", "beginner", "frontend", "web"],
        },
        {
            "id": "js_tut_1",
            "title": "The Modern JavaScript Tutorial (javascript.info)",
            "description": "From basics to advanced topics: prototypes, classes, promises, async/await, generators, and event loops.",
            "topic": "JavaScript",
            "type": "Tutorial",
            "level": "Intermediate",
            "provider": "javascript.info",
            "url": "https://javascript.info",
            "tags": ["javascript", "tutorial", "intermediate", "async"],
        },
        {
            "id": "js_vid_1",
            "title": "JavaScript Full Course for Beginners",
            "description": "Complete beginner tutorial covering core syntax, array methods, DOM manipulation, and asynchronous programming.",
            "topic": "JavaScript",
            "type": "Video",
            "level": "Beginner",
            "provider": "freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=PkZNo7MFNFg",
            "tags": ["javascript", "video", "beginner", "coding"],
        },
    ],
}


def resolve_canonical_skill(query: str) -> Optional[str]:
    """
    Resolves a user-provided search term or skill name to an exact canonical catalog key.
    Uses strict regex word-boundary matching to prevent cross-contamination
    (e.g., prevents 'java' from matching 'javascript').
    Returns canonical key or None if no high-quality curated match exists.
    """
    if not query:
        return None
        
    q = query.strip().lower()
    
    # 1. Exact catalog key check
    if q in CURATED_RESOURCE_CATALOG:
        return q

    # 2. Strict word boundary rules
    # JavaScript check FIRST so 'java' doesn't match 'javascript'
    if re.search(r'\b(javascript|js|ecmascript|es6)\b', q):
        return "javascript"

    # Java check (strict word boundary, explicitly excludes javascript)
    if re.search(r'\b(java|spring|springboot|spring-boot|hibernate|jvm|jdk)\b', q) and not re.search(r'\b(javascript|js)\b', q):
        return "java"

    # Python check
    if re.search(r'\b(python|python3|django|flask|fastapi|pandas|numpy)\b', q):
        return "python"

    # React check
    if re.search(r'\b(react|reactjs|react\.js|redux|react hooks)\b', q):
        return "react"

    # SQL check
    if re.search(r'\b(sql|postgres|postgresql|mysql|sqlite|database query|indexing)\b', q):
        return "sql"

    # Machine Learning check
    if re.search(r'\b(machine learning|machine-learning|ml|scikit|scikit-learn|deep learning|neural network|tensorflow|pytorch)\b', q):
        return "machine learning"

    # System Design check
    if re.search(r'\b(system design|distributed system|scalability|software architecture)\b', q):
        return "system design"

    # Data Structures check
    if re.search(r'\b(data structures|data structure|dsa|algorithm|algorithms|neetcode|leetcode)\b', q):
        return "data structures"

    # REST APIs check
    if re.search(r'\b(rest api|rest apis|restful|api design|http methods)\b', q):
        return "rest apis"

    # Microservices check
    if re.search(r'\b(microservices|microservice|service mesh|saga pattern)\b', q):
        return "microservices"

    return None


def get_curated_learning_resources(
    role: str,
    topics: List[str],
    level: Optional[str] = None
) -> Dict[str, Any]:
    """
    Retrieves verified, authentic learning resources for the requested skills and role.
    Optionally filters by level ('Beginner', 'Intermediate', 'Advanced', or 'All').
    
    Guarantees:
    - 100% relevant resources matching the exact queried skills.
    - Zero unrelated technologies mixed in.
    - Authentic, working external URLs (no fake links, no Google search links).
    - If a topic has no relevant resources in the curated repository, returns empty list
      so the user interface displays 'No relevant resources found for this skill.'
    """
    clean_role = (role or "Software Engineer").strip()
    
    # Clean input topics list
    clean_topics: List[str] = []
    for t in (topics or []):
        st = str(t).strip()
        if st and st not in clean_topics:
            clean_topics.append(st)

    target_level = (level or "").strip().lower() if level else None
    if target_level in ("all", "", "any"):
        target_level = None

    all_resources: List[Dict[str, Any]] = []
    topics_summary: List[Dict[str, Any]] = []
    seen_ids = set()

    for topic_query in clean_topics:
        canonical_key = resolve_canonical_skill(topic_query)
        matched_items: List[Dict[str, Any]] = []

        if canonical_key and canonical_key in CURATED_RESOURCE_CATALOG:
            raw_catalog_items = CURATED_RESOURCE_CATALOG[canonical_key]

            # Filter by difficulty level if requested
            for item in raw_catalog_items:
                if target_level:
                    item_level = (item.get("level") or "").strip().lower()
                    if item_level != target_level:
                        continue

                item_copy = dict(item)
                # Keep canonical skill label or user query representation
                if item_copy["id"] not in seen_ids:
                    seen_ids.add(item_copy["id"])
                    matched_items.append(item_copy)
                    all_resources.append(item_copy)

            # Generate structured topic summary for backward compatibility
            topics_summary.append({
                "skill": canonical_key.title(),
                "requested_query": topic_query,
                "total_matched": len(matched_items),
                "summary": f"Targeted learning curriculum for {canonical_key.title()}, essential for {clean_role} roles.",
                "key_concepts": [
                    f"{canonical_key.title()} Core Architecture & Syntax",
                    f"{canonical_key.title()} Design Patterns & Best Practices",
                    f"Performance Optimization and Latency Tuning in {canonical_key.title()}",
                    f"Production Troubleshooting & Enterprise Standards",
                ],
            })
        else:
            # Skill not found in verified catalog:
            # DO NOT generate fake courses or Google search links.
            # Return empty match for this skill so UI accurately reports no matching resources found.
            topics_summary.append({
                "skill": topic_query,
                "requested_query": topic_query,
                "total_matched": 0,
                "summary": f"No verified resources currently cataloged for '{topic_query}'.",
                "key_concepts": [],
            })

    return {
        "success": True,
        "role": clean_role,
        "topics": topics_summary,
        "resources": all_resources,
    }
