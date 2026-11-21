import re
import json
import sqlite3
import os
import sys
from typing import Dict, List, Any, Optional

try:
    from database import get_db_connection
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from database import get_db_connection

# Canonical skills for each target role in Intervexa AI
ROLE_SKILLS: Dict[str, List[str]] = {
    "Full Stack Developer": [
        "JavaScript",
        "React",
        "HTML & CSS",
        "Backend Development",
        "REST APIs",
        "SQL",
        "System Design",
    ],
    "Frontend Developer": [
        "HTML",
        "CSS",
        "JavaScript",
        "React",
        "Responsive Design",
        "REST API Integration",
        "UI Development",
    ],
    "Backend Developer": [
        "Python",
        "Java",
        "REST APIs",
        "SQL",
        "Database Design",
        "Authentication",
        "Backend Architecture",
    ],
    "Java Developer": [
        "Core Java",
        "OOP",
        "Collections",
        "Exception Handling",
        "Spring Boot",
        "JDBC",
        "SQL",
    ],
    "Software Developer": [
        "Data Structures",
        "Algorithms",
        "System Design",
        "Problem Solving",
        "Clean Code",
        "Debugging",
        "Git",
    ],
    "Python Developer": [
        "Python",
        "Data Structures",
        "OOP",
        "FastAPI / Flask",
        "Asyncio",
        "SQL & ORM",
    ],
    "Software Test Engineer": [
        "Testing Fundamentals",
        "Test Case Design",
        "Regression Testing",
        "API Testing",
        "Automation Testing",
    ],
    "Machine Learning Engineer": [
        "Python",
        "Machine Learning Fundamentals",
        "Statistics",
        "Data Preprocessing",
        "Model Evaluation",
        "Deep Learning",
    ],
    "AI/ML Engineer": [
        "Deep Learning",
        "NLP",
        "Transformers",
        "PyTorch / TensorFlow",
        "LangChain & LLMs",
        "Vector DBs",
    ],
    "Data Analyst": [
        "SQL",
        "Data Analysis",
        "Statistics",
        "Data Visualization",
        "Problem Solving",
    ],
    "Data Scientist": [
        "Statistics",
        "Python",
        "Machine Learning",
        "Data Preprocessing",
        "Feature Engineering",
        "A/B Testing",
        "Model Evaluation",
    ],
    "Cloud Engineer": [
        "AWS / Azure",
        "Docker & Containers",
        "Kubernetes",
        "CI/CD Pipelines",
        "Terraform / IaC",
        "Linux & Networking",
    ],
}

# Skill pattern matchers (case-insensitive regex patterns for each canonical skill)
SKILL_PATTERNS: Dict[str, List[str]] = {
    "JavaScript": [r"\bjavascript\b", r"\bjs\b", r"\bes6\b", r"\bclosure\b", r"\bevent loop\b", r"\bprototype\b", r"\bpromise\b", r"\basync/await\b", r"\bhoisting\b", r"\btypescript\b"],
    "React": [r"\breact\b", r"\bjsx\b", r"\bvirtual dom\b", r"\bhфика\b", r"\bhook\b", r"\buseeffect\b", r"\busestate\b", r"\bcomponent\b", r"\bredux\b", r"\bcontext api\b", r"\breconciliation\b", r"\bhoc\b"],
    "HTML": [r"\bhtml\b", r"\bhtml5\b", r"\bsemantic\b", r"\bdom\b", r"\bdoctype\b"],
    "CSS": [r"\bcss\b", r"\bcss3\b", r"\bflexbox\b", r"\bgrid\b", r"\bbox model\b", r"\btailwind\b", r"\bsass\b", r"\bselector\b"],
    "HTML & CSS": [r"\bhtml\b", r"\bcss\b", r"\bflexbox\b", r"\bgrid\b", r"\bdom\b", r"\bbox model\b"],
    "Responsive Design": [r"\bresponsive\b", r"\bmedia query\b", r"\bbreakpoint\b", r"\bmobile-first\b", r"\bviewport\b", r"\bfluid\b"],
    "REST APIs": [r"\brest\b", r"\bapi\b", r"\bapis\b", r"\bendpoint\b", r"\bhttp\b", r"\bstatus code\b", r"\bcrud\b", r"\bjson\b", r"\bidempotent\b"],
    "REST API Integration": [r"\brest\b", r"\bapi\b", r"\bfetch\b", r"\baxios\b", r"\bendpoint\b", r"\bcors\b", r"\bhttp status\b"],
    "UI Development": [r"\bui\b", r"\buser interface\b", r"\baccessibility\b", r"\bwcag\b", r"\banimation\b", r"\brendering\b", r"\bfrontend performance\b"],
    "Backend Development": [r"\bbackend\b", r"\bserver\b", r"\bapi\b", r"\bflask\b", r"\bnode\b", r"\bexpress\b", r"\bdjango\b", r"\bmicroservice\b"],
    "Backend Architecture": [r"\bbackend architecture\b", r"\bmicroservices?\b", r"\bscalability\b", r"\bdistributed\b", r"\bload balancer\b", r"\bmessage queue\b", r"\bkafka\b", r"\bcelery\b", r"\bcaching\b"],
    "Node.js": [r"\bnode\.?js\b", r"\bexpress\b", r"\bnpm\b", r"\bevent loop\b", r"\bcluster\b"],
    "Python": [r"\bpython\b", r"\bflask\b", r"\bfastapi\b", r"\bdjango\b", r"\bgil\b", r"\bgenerator\b", r"\bdecorator\b", r"\blambda\b", r"\blist comprehension\b"],
    "Java": [r"\bjava\b", r"\bjvm\b", r"\bspring\b", r"\bhibernate\b", r"\bgarbage collect\b", r"\bmultithreading\b"],
    "Core Java": [r"\bcore java\b", r"\bjava\b", r"\bjvm\b", r"\bheap\b", r"\bstack\b", r"\bgarbage collection\b", r"\bmemory model\b"],
    "OOP": [r"\boop\b", r"\bobject oriented\b", r"\binheritance\b", r"\bpolymorphism\b", r"\bencapsulation\b", r"\babstraction\b", r"\binterface\b", r"\bclass\b"],
    "Collections": [r"\bcollection\b", r"\barraylist\b", r"\blinkedlist\b", r"\bhashmap\b", r"\bhashset\b", r"\btreemap\b", r"\biterator\b"],
    "Exception Handling": [r"\bexception\b", r"\btry-catch\b", r"\bchecked exception\b", r"\bunchecked exception\b", r"\bthrow\b", r"\bfinally\b"],
    "Spring Boot": [r"\bspring boot\b", r"\bspring\b", r"\bioc\b", r"\bdependency injection\b", r"\bcontroller\b", r"\bauto-configuration\b"],
    "JDBC": [r"\bjdbc\b", r"\bpreparedstatement\b", r"\bresultset\b", r"\bdrivermanager\b", r"\bconnection pool\b"],
    "SQL": [r"\bsql\b", r"\bquery\b", r"\bjoin\b", r"\bindexing\b", r"\bindex\b", r"\bgroup by\b", r"\bhaving\b", r"\bacid\b", r"\btransaction\b"],
    "Database Design": [r"\bdatabase design\b", r"\brelational\b", r"\bschema\b", r"\bnormalization\b", r"\bforeign key\b", r"\bprimary key\b", r"\ber diagram\b", r"\b1nf\b", r"\b2nf\b", r"\b3nf\b"],
    "SQL & ORM": [r"\bsql\b", r"\borm\b", r"\bsqlalchemy\b", r"\bquery\b", r"\bjoin\b", r"\bmigration\b"],
    "Authentication": [r"\bauth\b", r"\bauthentication\b", r"\bauthorization\b", r"\bjwt\b", r"\boauth\b", r"\btoken\b", r"\bsession\b", r"\bcookie\b", r"\brbac\b", r"\bcsrf\b", r"\bxss\b"],
    "System Design": [r"\bsystem design\b", r"\bscalability\b", r"\barchitecture\b", r"\bload balancer\b", r"\bcaching\b", r"\bredis\b", r"\bcap theorem\b", r"\bmicroservice\b"],
    "Data Structures": [r"\bdata structures?\b", r"\barray\b", r"\blinked list\b", r"\bstack\b", r"\bqueue\b", r"\btree\b", r"\bgraph\b", r"\bhash table\b", r"\bhashmap\b", r"\bheap\b"],
    "Algorithms": [r"\balgorithm\b", r"\bbinary search\b", r"\bsorting\b", r"\bdp\b", r"\bdynamic programming\b", r"\brecursion\b", r"\btime complexity\b", r"\bbig o\b"],
    "Problem Solving": [r"\bproblem solving\b", r"\bapproach\b", r"\btrade-off\b", r"\bstrategy\b", r"\bedge case\b"],
    "Clean Code": [r"\bclean code\b", r"\bsolid\b", r"\brefactor\b", r"\breadability\b", r"\bdesign pattern\b"],
    "Debugging": [r"\bdebug\b", r"\btroubleshoot\b", r"\bbug\b", r"\broot cause\b", r"\blogging\b", r"\bprofiling\b"],
    "Git": [r"\bgit\b", r"\bbranch\b", r"\bmerge\b", r"\brebase\b", r"\bcommit\b", r"\bpull request\b"],
    "FastAPI / Flask": [r"\bflask\b", r"\bfastapi\b", r"\broute\b", r"\brequest\b", r"\bblueprint\b", r"\bpydantic\b"],
    "Asyncio": [r"\basyncio\b", r"\basync\b", r"\bawait\b", r"\bevent loop\b", r"\bcoroutine\b"],
    "Testing Fundamentals": [r"\btesting fundamentals\b", r"\bunit test\b", r"\bintegration test\b", r"\bsystem test\b", r"\bblack box\b", r"\bwhite box\b", r"\bverification\b", r"\bvalidation\b"],
    "Test Case Design": [r"\btest case\b", r"\bboundary value\b", r"\bequivalence partitioning\b", r"\bdecision table\b", r"\btest plan\b"],
    "Regression Testing": [r"\bregression\b", r"\bsmoke test\b", r"\bsanity test\b", r"\bretest\b", r"\btest suite\b"],
    "API Testing": [r"\bapi testing\b", r"\bpostman\b", r"\brest assured\b", r"\bstatus code\b", r"\bjson schema\b"],
    "Automation Testing": [r"\bautomation\b", r"\bselenium\b", r"\bcypress\b", r"\bpage object model\b", r"\bpytest\b", r"\btest framework\b"],
    "Defect Lifecycle": [r"\bdefect\b", r"\bbug lifecycle\b", r"\bseverity\b", r"\bpriority\b", r"\bjira\b", r"\bbug report\b"],
    "Automation": [r"\bautomation\b", r"\bselenium\b", r"\bcypress\b", r"\btest runner\b"],
    "Machine Learning": [r"\bmachine learning\b", r"\bmodel\b", r"\bsupervised\b", r"\bunsupervised\b", r"\bclustering\b", r"\bclassification\b", r"\bregression\b", r"\bscikit-learn\b"],
    "Machine Learning Fundamentals": [r"\bmachine learning\b", r"\bsupervised\b", r"\bunsupervised\b", r"\bbias-variance\b", r"\boverfitting\b", r"\bundrfitting\b", r"\bgradient descent\b"],
    "Statistics": [r"\bstatistic\b", r"\bprobability\b", r"\bhypothesis\b", r"\bp-value\b", r"\bnormal distribution\b", r"\bvariance\b", r"\bstandard deviation\b"],
    "Statistical Analysis": [r"\bstatistical\b", r"\bvariance\b", r"\bstandard deviation\b", r"\bdistribution\b", r"\bcorrelation\b"],
    "Statistical Modeling": [r"\bstatistical model\b", r"\bregression\b", r"\btime series\b", r"\barima\b", r"\bhypothesis test\b"],
    "Data Analysis": [r"\bdata analysis\b", r"\bexploratory\b", r"\beda\b", r"\btrend\b", r"\binsight\b", r"\baggregation\b"],
    "Data Preprocessing": [r"\bpreprocessing\b", r"\bdata cleaning\b", r"\bmissing value\b", r"\boutlier\b", r"\bnormalization\b", r"\bscaling\b", r"\bencoding\b"],
    "Feature Engineering": [r"\bfeature engineering\b", r"\bfeature extraction\b", r"\bone-hot\b", r"\bdimensionality reduction\b", r"\bpca\b"],
    "Model Evaluation": [r"\bmodel evaluation\b", r"\baccuracy\b", r"\bprecision\b", r"\brecall\b", r"\bf1\b", r"\broc\b", r"\bauc\b", r"\bconfusion matrix\b", r"\bcross-validation\b"],
    "Deep Learning": [r"\bdeep learning\b", r"\bneural network\b", r"\bcnn\b", r"\brnn\b", r"\blstm\b", r"\bbackpropagation\b", r"\bactivation function\b", r"\blayer\b"],
    "NLP": [r"\bnlp\b", r"\bnatural language\b", r"\btoken\b", r"\bembedding\b", r"\bbert\b", r"\bword2vec\b", r"\bsentiment\b"],
    "Transformers": [r"\btransformer\b", r"\battention\b", r"\bself-attention\b", r"\bencoder\b", r"\bdecoder\b", r"\bllm\b"],
    "PyTorch / TensorFlow": [r"\bpytorch\b", r"\btensorflow\b", r"\bkeras\b", r"\btensor\b", r"\bautograd\b"],
    "LangChain & LLMs": [r"\blangchain\b", r"\bllm\b", r"\brag\b", r"\bprompt engineering\b", r"\bfine-tuning\b"],
    "Vector DBs": [r"\bvector db\b", r"\bvector\b", r"\bembeddings\b", r"\bpinecone\b", r"\bchroma\b", r"\bfaiss\b"],
    "Data Visualization": [r"\bvisualization\b", r"\bchart\b", r"\bplot\b", r"\bmatplotlib\b", r"\bseaborn\b", r"\bdashboard\b"],
    "Power BI / Tableau": [r"\bpower bi\b", r"\btableau\b", r"\bdax\b", r"\bpower query\b", r"\breport\b"],
    "Excel": [r"\bexcel\b", r"\bvlookup\b", r"\bpivot table\b", r"\bxlookup\b", r"\bmacro\b"],
    "A/B Testing": [r"\ba/b test\b", r"\bexperiment\b", r"\bcontrol\b", r"\bvariant\b", r"\bsample size\b"],
    "Predictive Analytics": [r"\bpredictive\b", r"\bforecast\b", r"\btrend analysis\b"],
    "AWS / Azure": [r"\baws\b", r"\bazure\b", r"\bec2\b", r"\bs3\b", r"\blambda\b", r"\biam\b", r"\bvpc\b"],
    "Cloud Infrastructure": [r"\bcloud\b", r"\binfrastructure\b", r"\baws\b", r"\bazure\b", r"\bgcp\b"],
    "Docker & Containers": [r"\bdocker\b", r"\bcontainer\b", r"\bdockerfile\b", r"\bimage\b", r"\bcompose\b"],
    "Kubernetes": [r"\bkubernetes\b", r"\bk8s\b", r"\bpod\b", r"\bdeployment\b", r"\bservice\b", r"\bhelm\b"],
    "CI/CD Pipelines": [r"\bci/cd\b", r"\bpipeline\b", r"\bgithub actions\b", r"\bjenkins\b", r"\bcontinuous integration\b"],
    "Terraform / IaC": [r"\bterraform\b", r"\biac\b", r"\binfrastructure as code\b", r"\bstate file\b"],
    "Linux & Networking": [r"\blinux\b", r"\bbash\b", r"\bssh\b", r"\bdns\b", r"\btcp/ip\b", r"\bfirewall\b"],
    "Production ML": [r"\bproduction ml\b", r"\bmlops\b", r"\bmodel serving\b", r"\bdrift\b", r"\bmonitoring\b"],
    "NumPy & Pandas": [r"\bnumpy\b", r"\bpandas\b", r"\bdataframe\b", r"\bseries\b", r"\bvectorization\b"],
    "Pandas": [r"\bpandas\b", r"\bdataframe\b", r"\bseries\b", r"\bgroupby\b"],
    "Dashboard Reporting": [r"\bdashboard\b", r"\breporting\b", r"\bkpi\b", r"\bmetrics\b"],
    "Business Insights": [r"\bbusiness insights?\b", r"\broi\b", r"\brevenue\b", r"\bchurn\b"],
    "Data Insights": [r"\bdata insights?\b", r"\banalytics\b", r"\bdecision making\b"],
    "Scalability": [r"\bscalability\b", r"\bscale\b", r"\bthroughput\b", r"\blatency\b", r"\bperformance\b"],
}

# Curated feedback and guidance tailored for each skill
SKILL_DESCRIPTIONS: Dict[str, Dict[str, str]] = {
    "Python": {
        "needs_improvement": "Practice Python fundamentals, functions, collections, generators, and problem-solving.",
        "strong": "Solid grasp of Python data models, syntax idioms, and standard libraries.",
        "unrated": "Practice Python questions covering core syntax, data structures, and async programming.",
    },
    "JavaScript": {
        "needs_improvement": "Practice JavaScript closures, event loop microtask queuing, scoping, and async/await.",
        "strong": "Clear command of ES6+ features, asynchronous flow, and modern JavaScript engines.",
        "unrated": "Practice JavaScript questions covering closures, prototypes, event loops, and async patterns.",
    },
    "React": {
        "needs_improvement": "Improve component design, hooks, state management, and React architecture.",
        "strong": "Solid proficiency in component architecture, state management, and Virtual DOM reconciliation.",
        "unrated": "Practice React questions covering component architecture, hooks, and state management.",
    },
    "HTML": {
        "needs_improvement": "Strengthen semantic HTML structure, accessibility standards (ARIA), and DOM hierarchy.",
        "strong": "Demonstrates strong understanding of semantic HTML5 elements and document accessibility.",
        "unrated": "Practice questions on semantic markup, document structure, and accessibility.",
    },
    "CSS": {
        "needs_improvement": "Practice CSS Box Model, Flexbox, Grid layouts, and responsive CSS architecture.",
        "strong": "Proficient in modern CSS layout techniques, selector specificity, and responsive styling.",
        "unrated": "Practice CSS layout questions covering Flexbox, Grid, and cascade fundamentals.",
    },
    "HTML & CSS": {
        "needs_improvement": "Focus on semantic HTML5 structure, modern CSS layouts (Flexbox/Grid), and styling.",
        "strong": "Solid understanding of semantic markup and responsive CSS layout architecture.",
        "unrated": "Practice HTML & CSS questions on semantic structure, styling, and layouts.",
    },
    "Responsive Design": {
        "needs_improvement": "Strengthen mobile-first layouts, flexible media queries, and responsive viewport units.",
        "strong": "Consistently applies adaptive breakpoints and fluid layout principles across screen sizes.",
        "unrated": "Practice responsive design questions covering media queries, fluid units, and breakpoints.",
    },
    "REST APIs": {
        "needs_improvement": "Review RESTful HTTP methods, status code semantics, pagination, and error responses.",
        "strong": "Demonstrates clean REST API design, idempotent methods, and consistent response formats.",
        "unrated": "Practice REST API questions covering HTTP methods, endpoints, status codes, and idempotency.",
    },
    "REST API Integration": {
        "needs_improvement": "Work on data fetching, error boundaries, async state handling, and CORS troubleshooting.",
        "strong": "Seamlessly integrates REST endpoints with robust loading states and error handling.",
        "unrated": "Practice REST API integration questions covering fetch/axios, headers, and async states.",
    },
    "UI Development": {
        "needs_improvement": "Improve UI component accessibility, interactive animations, and frontend rendering performance.",
        "strong": "High visual precision, accessible UI patterns, and efficient rendering practices.",
        "unrated": "Practice UI development questions covering component design, WCAG, and user flows.",
    },
    "SQL": {
        "needs_improvement": "Strengthen joins, aggregation, query optimization, and database concepts.",
        "strong": "Demonstrates solid query optimization, indexing strategies, and relational data modeling.",
        "unrated": "Practice SQL questions on relational design, joins, indexing, and query optimization.",
    },
    "Database Design": {
        "needs_improvement": "Review database normalization (1NF-3NF), foreign key constraints, and indexing trade-offs.",
        "strong": "Solid relational schema modeling with well-considered indexing and constraint integrity.",
        "unrated": "Practice database design questions on normalization, schemas, and relational integrity.",
    },
    "Authentication": {
        "needs_improvement": "Strengthen JWT lifecycle management, secure cookie storage, and CSRF/XSS mitigations.",
        "strong": "Solid grasp of token-based authentication, RBAC, and secure session management.",
        "unrated": "Practice authentication questions covering JWTs, cookies, OAuth, and security best practices.",
    },
    "Backend Development": {
        "needs_improvement": "Work on server-side architecture, request routing, middleware, and database connectivity.",
        "strong": "Demonstrates dependable backend service architecture, request validation, and persistence.",
        "unrated": "Practice backend questions on server runtimes, routing, middleware, and databases.",
    },
    "Backend Architecture": {
        "needs_improvement": "Practice distributed system trade-offs, caching invalidation, and async message processing.",
        "strong": "Solid grasp of backend scalability, microservices boundaries, and caching architectures.",
        "unrated": "Practice backend architecture questions on caching, microservices, and load balancing.",
    },
    "Core Java": {
        "needs_improvement": "Reinforce Java memory model (Heap/Stack), Garbage Collection, and OOP encapsulation.",
        "strong": "Clear understanding of JVM internals, memory management, and clean Java class design.",
        "unrated": "Practice Core Java questions covering JVM internals, data types, and threading.",
    },
    "OOP": {
        "needs_improvement": "Practice applying the 4 pillars of OOP, SOLID design principles, and clean interfaces.",
        "strong": "Demonstrates clean object-oriented abstractions, inheritance hierarchies, and polymorphism.",
        "unrated": "Practice OOP questions on encapsulation, inheritance, polymorphism, and abstraction.",
    },
    "Collections": {
        "needs_improvement": "Review Java Collections time complexities, internal HashMap mechanics, and thread safety.",
        "strong": "Accurately selects and applies appropriate Java Collection data structures and iterators.",
        "unrated": "Practice Java Collections questions covering List, Set, and Map implementations.",
    },
    "Exception Handling": {
        "needs_improvement": "Practice checked vs unchecked exception hierarchies and try-with-resources patterns.",
        "strong": "Disciplined exception handling with clear error boundaries and resource cleanup.",
        "unrated": "Practice exception handling questions on custom exceptions and recovery patterns.",
    },
    "Spring Boot": {
        "needs_improvement": "Strengthen Spring Dependency Injection (IoC), bean lifecycles, and auto-configuration.",
        "strong": "Proficient in Spring Boot application setup, REST controllers, and dependency management.",
        "unrated": "Practice Spring Boot questions on IoC containers, annotations, and configuration.",
    },
    "JDBC": {
        "needs_improvement": "Review connection pooling, SQL injection prevention via PreparedStatement, and transaction rollbacks.",
        "strong": "Solid database persistence using JDBC connection management and transaction isolation.",
        "unrated": "Practice JDBC questions on prepared statements, transactions, and connection pools.",
    },
    "System Design": {
        "needs_improvement": "Strengthen architectural trade-offs, caching layers (Redis), database sharding, and CAP theorem.",
        "strong": "Demonstrates mature full-stack system architecture, scalability, and bottleneck mitigation.",
        "unrated": "Practice system design questions on caching, distributed data, and high-availability.",
    },
    "Data Structures": {
        "needs_improvement": "Practice core data structures (arrays, linked lists, trees, hash tables) and their trade-offs.",
        "strong": "Consistently identifies and implements optimal data structures for given constraints.",
        "unrated": "Practice data structure questions on arrays, trees, hash tables, and graphs.",
    },
    "Algorithms": {
        "needs_improvement": "Work on binary search, recursion, sorting complexities, and Big-O time/space analysis.",
        "strong": "Solid analytical ability in algorithm design, complexity bounds, and edge-case handling.",
        "unrated": "Practice algorithm questions on searching, sorting, and dynamic programming.",
    },
    "Testing Fundamentals": {
        "needs_improvement": "Review testing levels (unit, integration, system), verification vs validation, and test strategies.",
        "strong": "Clear conceptual mastery of QA levels, testing objectives, and defect prevention.",
        "unrated": "Practice QA fundamentals questions covering testing levels, principles, and verification.",
    },
    "Test Case Design": {
        "needs_improvement": "Practice boundary value analysis (BVA), equivalence class partitioning, and edge-case testing.",
        "strong": "Systematically covers positive and boundary edge cases using structured test design methods.",
        "unrated": "Practice test case design questions on boundary values and equivalence partitioning.",
    },
    "Regression Testing": {
        "needs_improvement": "Work on test suite prioritization, sanity vs smoke testing, and regression scope selection.",
        "strong": "Effective regression prioritization ensuring zero regressions across deployment cycles.",
        "unrated": "Practice regression testing questions on test prioritization and smoke test strategies.",
    },
    "API Testing": {
        "needs_improvement": "Practice REST API testing with Postman/RestAssured, payload validation, and HTTP headers.",
        "strong": "Comprehensive API test design covering status codes, JSON response schemas, and latency.",
        "unrated": "Practice API testing questions on status codes, payload assertions, and headers.",
    },
    "Automation Testing": {
        "needs_improvement": "Strengthen Page Object Model (POM), locator strategies, and flaky test mitigation.",
        "strong": "Solid test automation design with robust locators, clean POM patterns, and CI execution.",
        "unrated": "Practice test automation questions on Selenium/Cypress, POM, and assertion libraries.",
    },
    "Machine Learning Fundamentals": {
        "needs_improvement": "Review bias-variance tradeoff, overfitting mitigation (regularization), and cross-validation.",
        "strong": "Solid intuition on ML algorithm selection, regularization techniques, and training loss curves.",
        "unrated": "Practice ML fundamentals questions on supervised/unsupervised learning and loss functions.",
    },
    "Statistics": {
        "needs_improvement": "Practice statistical foundations, hypothesis testing, p-values, distributions, and variance.",
        "strong": "Solid command of statistical inference, hypothesis formulation, and distribution metrics.",
        "unrated": "Practice statistics questions covering probability, distributions, and hypothesis tests.",
    },
    "Data Preprocessing": {
        "needs_improvement": "Work on missing value imputation, outlier detection, scaling (MinMax vs Standard), and encoding.",
        "strong": "Demonstrates disciplined data cleaning pipelines and feature scaling practices.",
        "unrated": "Practice preprocessing questions on data cleaning, scaling, and categorical encoding.",
    },
    "Model Evaluation": {
        "needs_improvement": "Practice metric selection for imbalanced data (Precision, Recall, F1, ROC-AUC vs Accuracy).",
        "strong": "Accurately interprets confusion matrices, ROC curves, and precision-recall trade-offs.",
        "unrated": "Practice model evaluation questions on metrics, ROC-AUC, and validation splits.",
    },
    "Deep Learning": {
        "needs_improvement": "Review backpropagation, activation functions, neural network architectures, and vanishing gradients.",
        "strong": "Solid command of deep neural architectures, optimization algorithms, and gradient flow.",
        "unrated": "Practice deep learning questions on backpropagation, CNNs/RNNs, and activations.",
    },
    "Data Analysis": {
        "needs_improvement": "Practice exploratory data analysis, metric formulation, and data-driven insight extraction.",
        "strong": "Strong analytical acumen identifying meaningful trends, anomalies, and business KPIs.",
        "unrated": "Practice data analysis questions on EDA, aggregations, and business metrics.",
    },
    "Data Visualization": {
        "needs_improvement": "Improve chart type selection, metric readability, and dashboard storytelling principles.",
        "strong": "Delivers intuitive, readable visualizations tailored to specific analytical questions.",
        "unrated": "Practice visualization questions on chart selection, storytelling, and clarity.",
    },
    "Problem Solving": {
        "needs_improvement": "Work on structured problem breakdown, clarifying requirements, and evaluating trade-offs.",
        "strong": "Demonstrates structured logical decomposition and sound engineering trade-off evaluation.",
        "unrated": "Practice problem-solving questions on edge cases, requirements, and trade-offs.",
    },
}

def normalize_role_name(role: Optional[str]) -> str:
    """Matches any arbitrary role string to the canonical 12 roles."""
    if not role or not str(role).strip():
        return "Full Stack Developer"
    r = str(role).strip().lower()
    if "front" in r:
        return "Frontend Developer"
    if "back" in r:
        return "Backend Developer"
    if "java" in r:
        return "Java Developer"
    if "full" in r or "stack" in r:
        return "Full Stack Developer"
    if "test" in r or "qa" in r or "quality" in r:
        return "Software Test Engineer"
    if "analyst" in r:
        return "Data Analyst"
    if "scientist" in r:
        return "Data Scientist"
    if "deep learning" in r or "ai/ml" in r or "ai & ml" in r:
        return "AI/ML Engineer"
    if "machine learning" in r or "ml" in r:
        return "Machine Learning Engineer"
    if "cloud" in r or "devops" in r:
        return "Cloud Engineer"
    if "python" in r:
        return "Python Developer"
    if "software" in r or "engineer" in r or "developer" in r:
        return "Software Developer"
    return "Full Stack Developer"

def map_question_to_skills(
    question: str,
    topic: Optional[str] = None,
    assesses_skill: Optional[str] = None,
    target_role: Optional[str] = None,
) -> List[str]:
    """
    Deterministically maps a question to one or more skills in the target role's canonical skill set.
    """
    canonical_role = normalize_role_name(target_role)
    role_skills = ROLE_SKILLS.get(canonical_role, ROLE_SKILLS["Full Stack Developer"])

    combined_text = f"{question or ''} {topic or ''} {assesses_skill or ''}".strip().lower()
    matched_skills = []

    # 1. Exact match against explicit assesses_skill or topic
    for skill in role_skills:
        skill_lower = skill.lower()
        if assesses_skill and (skill_lower == str(assesses_skill).strip().lower() or skill_lower in str(assesses_skill).strip().lower()):
            if skill not in matched_skills:
                matched_skills.append(skill)
        elif topic and (skill_lower == str(topic).strip().lower() or skill_lower in str(topic).strip().lower()):
            if skill not in matched_skills:
                matched_skills.append(skill)

    # 2. Regex pattern matching against question text + topic
    for skill in role_skills:
        patterns = SKILL_PATTERNS.get(skill, [])
        for pat in patterns:
            if re.search(pat, combined_text, re.IGNORECASE):
                if skill not in matched_skills:
                    matched_skills.append(skill)
                break

    # 3. If no match within target role skills, check alias/cross-domain mappings
    if not matched_skills:
        # Cross-skill mapping table
        cross_map = {
            "Core Technical Concepts": role_skills[0] if role_skills else "JavaScript",
            "Data Structures & Algorithms": "Data Structures" if "Data Structures" in role_skills else ("Algorithms" if "Algorithms" in role_skills else role_skills[0]),
            "React & Frontend Architecture": "React" if "React" in role_skills else ("JavaScript" if "JavaScript" in role_skills else role_skills[0]),
            "REST APIs & Web Services": "REST APIs" if "REST APIs" in role_skills else ("REST API Integration" if "REST API Integration" in role_skills else role_skills[0]),
            "SQL & Database Design": "SQL" if "SQL" in role_skills else ("Database Design" if "Database Design" in role_skills else role_skills[0]),
            "Python Fundamentals": "Python" if "Python" in role_skills else role_skills[0],
            "Software Testing & QA": "Testing Fundamentals" if "Testing Fundamentals" in role_skills else role_skills[0],
        }
        if topic and topic in cross_map and cross_map[topic] in role_skills:
            matched_skills.append(cross_map[topic])

    # If still no match, assign to closest primary skill for that role
    if not matched_skills and role_skills:
        matched_skills.append(role_skills[0])

    return matched_skills


def calculate_user_skill_performance(
    user_id: int,
    target_role: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes rigorous, role-aligned skill performance for a user based strictly
    on completed interview evaluations. Never fabricates scores or returns false 0%.
    """
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1. Fetch completed interviews for this user
        cursor.execute(
            """
            SELECT id, role, avg_score, communication_score, interview_mode, interview_type, status, created_at
            FROM interviews
            WHERE user_id = ? AND (status = 'completed' OR status IS NULL) AND avg_score IS NOT NULL
            ORDER BY created_at DESC
            """,
            (user_id,)
        )
        completed_interviews = [dict(r) for r in cursor.fetchall()]

        # 2. Determine target role
        if not target_role or not str(target_role).strip():
            if completed_interviews:
                target_role = completed_interviews[0].get("role") or "Full Stack Developer"
            else:
                target_role = "Full Stack Developer"

        canonical_role = normalize_role_name(target_role)
        role_skills = ROLE_SKILLS.get(canonical_role, ROLE_SKILLS["Full Stack Developer"])

        if not completed_interviews:
            # User has no completed interviews: return "Not Evaluated" state for all skills
            skills_payload = []
            for sk in role_skills:
                unrated_text = SKILL_DESCRIPTIONS.get(sk, {}).get(
                    "unrated", f"Complete interview questions on {sk} to evaluate conceptual and implementation proficiency."
                )
                skills_payload.append({
                    "skill": sk,
                    "name": sk,
                    "score": None,
                    "score_pct": None,
                    "percentage": None,
                    "score_display": "Not evaluated yet",
                    "count": 0,
                    "status": "not_evaluated",
                    "status_label": "Not Evaluated",
                    "needs_improvement": False,
                    "is_strong": False,
                    "is_evaluated": False,
                    "insufficient_data": False,
                    "progress_width": 0,
                    "recommendation": unrated_text,
                    "feedback": unrated_text,
                })

            return {
                "success": True,
                "target_role": canonical_role,
                "skills": skills_payload,
                "strong_skills": [],
                "weak_skills": [],
                "not_evaluated_skills": [s["skill"] for s in skills_payload],
                "insufficient_data_skills": [],
                "total_skills": len(role_skills),
                "evaluated_count": 0,
                "average_skill_score": None,
                "has_evaluations": False,
            }

        # 3. Fetch all evaluated questions for this user's completed interviews
        completed_ids = [inv["id"] for inv in completed_interviews]
        placeholders = ",".join("?" for _ in completed_ids)
        cursor.execute(
            f"""
            SELECT d.id, d.interview_id, d.question, d.candidate_answer,
                   d.technical_score, d.communication_score, d.topic, d.assesses_skill,
                   d.strengths, d.mistakes, d.improvement_suggestions,
                   i.role as interview_role, i.created_at
            FROM interview_details d
            JOIN interviews i ON d.interview_id = i.id
            WHERE d.interview_id IN ({placeholders})
              AND d.technical_score IS NOT NULL
            ORDER BY d.id ASC
            """,
            completed_ids
        )
        evaluated_questions = [dict(r) for r in cursor.fetchall()]

        # 4. Map questions to canonical skills of target role
        skill_buckets: Dict[str, List[Dict[str, Any]]] = {sk: [] for sk in role_skills}

        for q_item in evaluated_questions:
            # Map question to one or more skills in this role
            matched = map_question_to_skills(
                question=q_item.get("question") or "",
                topic=q_item.get("topic"),
                assesses_skill=q_item.get("assesses_skill"),
                target_role=canonical_role,
            )
            for m_sk in matched:
                if m_sk in skill_buckets:
                    skill_buckets[m_sk].append(q_item)

        # 5. Build skill performance models
        skills_payload = []
        strong_list = []
        weak_list = []
        not_eval_list = []
        insuff_list = []
        evaluated_scores = []

        for sk in role_skills:
            items = skill_buckets.get(sk, [])
            count = len(items)

            if count == 0:
                unrated_text = SKILL_DESCRIPTIONS.get(sk, {}).get(
                    "unrated", f"Complete interview questions on {sk} to evaluate proficiency."
                )
                skill_obj = {
                    "skill": sk,
                    "name": sk,
                    "score": None,
                    "score_pct": None,
                    "percentage": None,
                    "score_display": "Not evaluated yet",
                    "count": 0,
                    "status": "not_evaluated",
                    "status_label": "Not Evaluated",
                    "needs_improvement": False,
                    "is_strong": False,
                    "is_evaluated": False,
                    "insufficient_data": False,
                    "progress_width": 0,
                    "recommendation": unrated_text,
                    "feedback": unrated_text,
                }
                skills_payload.append(skill_obj)
                not_eval_list.append(sk)

            elif count == 1:
                single_score = float(items[0]["technical_score"])
                single_pct = round((single_score / 10.0) * 100, 1)
                pct_int = int(round(single_pct))
                evaluated_scores.append(single_pct)

                rec = f"1 question evaluated ({pct_int}%). Complete more questions on {sk} for a reliable assessment."
                skill_obj = {
                    "skill": sk,
                    "name": sk,
                    "score": round(single_score, 1),
                    "score_pct": single_pct,
                    "percentage": pct_int,
                    "score_display": f"{pct_int}%",
                    "count": 1,
                    "status": "insufficient_data",
                    "status_label": "Limited Data (1 question)",
                    "needs_improvement": single_pct < 70.0,
                    "is_strong": single_pct >= 70.0,
                    "is_evaluated": True,
                    "insufficient_data": True,
                    "progress_width": pct_int,
                    "recommendation": rec,
                    "feedback": rec,
                }
                skills_payload.append(skill_obj)
                insuff_list.append(sk)
                if single_pct >= 70.0:
                    strong_list.append(skill_obj)
                else:
                    weak_list.append(skill_obj)

            else:
                total_tech = sum(float(it["technical_score"]) for it in items)
                skill_pct = round((total_tech / (count * 10.0)) * 100, 1)
                pct_int = int(round(skill_pct))
                skill_avg = round(total_tech / count, 1)
                evaluated_scores.append(skill_pct)

                is_strong = skill_pct >= 70.0
                status = "strong" if is_strong else "needs_improvement"
                status_label = "Strong Area" if is_strong else "Needs Focus"

                if is_strong:
                    rec = SKILL_DESCRIPTIONS.get(sk, {}).get(
                        "strong", f"Demonstrates solid proficiency in production {sk} patterns."
                    )
                else:
                    rec = SKILL_DESCRIPTIONS.get(sk, {}).get(
                        "needs_improvement", f"Practice {sk} implementation edge cases, trade-offs, and core concepts."
                    )

                skill_obj = {
                    "skill": sk,
                    "name": sk,
                    "score": skill_avg,
                    "score_pct": skill_pct,
                    "percentage": pct_int,
                    "score_display": f"{pct_int}%",
                    "count": count,
                    "status": status,
                    "status_label": status_label,
                    "needs_improvement": not is_strong,
                    "is_strong": is_strong,
                    "is_evaluated": True,
                    "insufficient_data": False,
                    "progress_width": pct_int,
                    "recommendation": rec,
                    "feedback": rec,
                }
                skills_payload.append(skill_obj)
                if is_strong:
                    strong_list.append(skill_obj)
                else:
                    weak_list.append(skill_obj)

        avg_score = round(sum(evaluated_scores) / len(evaluated_scores), 1) if evaluated_scores else None

        return {
            "success": True,
            "target_role": canonical_role,
            "skills": skills_payload,
            "strong_skills": strong_list,
            "weak_skills": weak_list,
            "not_evaluated_skills": not_eval_list,
            "insufficient_data_skills": insuff_list,
            "total_skills": len(role_skills),
            "evaluated_count": len(evaluated_scores),
            "average_skill_score": avg_score,
            "has_evaluations": len(evaluated_scores) > 0,
        }

    finally:
        conn.close()
