"""
Deterministic, High-Accuracy Technical Skill Extractor for Intervexa AI.
Uses strict regex word-boundary matching and comprehensive synonym/alias mapping.
"""
import re

# Canonical skill taxonomy with synonyms and aliases
SKILL_TAXONOMY = {
    # Core Languages
    "Python": [r"\bpython\b", r"\bpython3\b"],
    "JavaScript": [r"\bjavascript\b", r"\bjs\b", r"\bes6\b"],
    "TypeScript": [r"\btypescript\b", r"\bts\b"],
    "Java": [r"\bjava\b", r"\bcore java\b", r"\bj2ee\b"],
    "C++": [r"\bc\+\+\b", r"\bcpp\b"],
    "C#": [r"\bc#\b", r"\bcsharp\b"],
    "C": [r"\bc\b(?!\+\+|#)"],  # C as standalone language
    "Go": [r"\bgolang\b", r"\bgo language\b"],
    "Rust": [r"\brust\b"],
    "PHP": [r"\bphp\b"],
    "Ruby": [r"\bruby\b"],
    "Kotlin": [r"\bkotlin\b"],
    "Swift": [r"\bswift\b"],
    "SQL": [r"\bsql\b", r"\bpl\/sql\b", r"\bt-sql\b"],
    "HTML": [r"\bhtml\b", r"\bhtml5\b"],
    "CSS": [r"\bcss\b", r"\bcss3\b"],

    # Frontend Technologies
    "React": [r"\breact\b", r"\breactjs\b", r"\breact\.js\b"],
    "Next.js": [r"\bnext\.?js\b", r"\bnextjs\b"],
    "Redux": [r"\bredux\b", r"\bredux toolkit\b"],
    "Vue.js": [r"\bvue\b", r"\bvue\.?js\b", r"\bvuejs\b"],
    "Angular": [r"\bangular\b", r"\bangularjs\b"],
    "Tailwind CSS": [r"\btailwind\b", r"\btailwindcss\b"],
    "Bootstrap": [r"\bbootstrap\b"],
    "Vite": [r"\bvite\b"],
    "Webpack": [r"\bwebpack\b"],

    # Backend Technologies & Frameworks
    "Node.js": [r"\bnode\.?js\b", r"\bnodejs\b"],
    "Express.js": [r"\bexpress\.?js\b", r"\bexpressjs\b", r"\bexpress\b(?=\s+framework|\s+server|\s+backend)"],
    "Flask": [r"\bflask\b"],
    "Django": [r"\bdjango\b"],
    "FastAPI": [r"\bfastapi\b"],
    "Spring Boot": [r"\bspring boot\b", r"\bspringboot\b", r"\bspring framework\b"],
    "ASP.NET": [r"\basp\.net\b", r"\b\.net core\b", r"\bdotnet\b"],
    "REST API": [r"\brest\b(?:\s+api[s]?)?", r"\brestful\b(?:\s+api[s]?)?"],
    "GraphQL": [r"\bgraphql\b"],
    "gRPC": [r"\bgrpc\b"],
    "Kafka": [r"\bkafka\b", r"\bapache kafka\b"],
    "RabbitMQ": [r"\brabbitmq\b"],

    # Databases & Storage
    "MongoDB": [r"\bmongodb\b", r"\bmongo\b"],
    "PostgreSQL": [r"\bpostgresql\b", r"\bpostgres\b"],
    "MySQL": [r"\bmysql\b"],
    "SQLite": [r"\bsqlite\b", r"\bsqlite3\b"],
    "Redis": [r"\bredis\b"],
    "Oracle DB": [r"\boracle db\b", r"\boracle database\b"],
    "DBMS": [r"\bdbms\b", r"\brdbms\b"],

    # Cloud, DevOps & Tools
    "Docker": [r"\bdocker\b", r"\bcontainerization\b"],
    "Kubernetes": [r"\bkubernetes\b", r"\bk8s\b"],
    "AWS": [r"\baws\b", r"\bamazon web services\b"],
    "Azure": [r"\bazure\b", r"\bmicrosoft azure\b"],
    "GCP": [r"\bgcp\b", r"\bgoogle cloud\b", r"\bgoogle cloud platform\b"],
    "CI/CD": [r"\bci\/cd\b", r"\bcontinuous integration\b", r"\bcontinuous deployment\b"],
    "Git": [r"\bgit\b", r"\bgithub\b", r"\bgitlab\b"],
    "Linux": [r"\blinux\b", r"\bunix\b", r"\bubuntu\b"],
    "Terraform": [r"\bterraform\b"],

    # AI, ML & Data Science
    "Machine Learning": [r"\bmachine learning\b", r"\bml\b(?=\s+models?|\s+algorithms?)"],
    "Deep Learning": [r"\bdeep learning\b"],
    "Scikit-learn": [r"\bscikit-learn\b", r"\bsklearn\b"],
    "Pandas": [r"\bpandas\b"],
    "NumPy": [r"\bnumpy\b"],
    "XGBoost": [r"\bxgboost\b"],
    "PyTorch": [r"\bpytorch\b"],
    "TensorFlow": [r"\btensorflow\b"],
    "NLP": [r"\bnlp\b", r"\bnatural language processing\b"],

    # Core CS & Architecture
    "Data Structures": [r"\bdata structures\b", r"\bdsa\b"],
    "Algorithms": [r"\balgorithms?\b"],
    "OOP": [r"\boop\b", r"\boops\b", r"\bobject oriented programming\b"],
    "Microservices": [r"\bmicroservices\b", r"\bmicroservice architecture\b"],
    "System Design": [r"\bsystem design\b"],
    "Unit Testing": [r"\bunit testing\b", r"\bjest\b", r"\bpytest\b", r"\bmock testing\b"],
    "Agile": [r"\bagile\b", r"\bscrum\b"],
}

# Precompile regex patterns for performance and deterministic execution
COMPILED_PATTERNS = {
    skill: [re.compile(p, re.IGNORECASE) for p in patterns]
    for skill, patterns in SKILL_TAXONOMY.items()
}


def extract_skills(text):
    """
    Deterministically extracts technical skills from text using regex word-boundary patterns.
    Returns a sorted list of unique canonical skill names.
    Guaranteed: identical text produces the identical skill list every time.
    """
    if not text or not isinstance(text, str):
        return []

    found = set()
    for canonical_name, pattern_list in COMPILED_PATTERNS.items():
        for pat in pattern_list:
            if pat.search(text):
                found.add(canonical_name)
                break

    # Return deterministically sorted list
    return sorted(list(found))
