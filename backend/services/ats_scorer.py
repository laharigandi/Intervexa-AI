"""
Realistic, Deterministic ATS Evaluation & Job Description Alignment Engine for Intervexa AI.
Produces explainable, repeatable, and mathematically verified analysis results.
Differentiates between General Resume Quality Score (when no JD is provided)
and Job-Specific ATS Match Score (when a target JD is provided).
"""
import re
import hashlib
from services.skill_extractor import extract_skills, SKILL_TAXONOMY

# ---------------------------------------------------------------------------
# Skill Domains for Technical Breadth Evaluation
# ---------------------------------------------------------------------------
SKILL_DOMAINS = {
    "Languages": [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "C",
        "Go", "Rust", "PHP", "Ruby", "Kotlin", "Swift", "SQL", "HTML", "CSS"
    ],
    "Frontend": [
        "React", "Next.js", "Redux", "Vue.js", "Angular", "Tailwind CSS",
        "Bootstrap", "Vite", "Webpack"
    ],
    "Backend": [
        "Node.js", "Express.js", "Flask", "Django", "FastAPI", "Spring Boot",
        "ASP.NET", "REST API", "GraphQL", "gRPC", "Kafka", "RabbitMQ"
    ],
    "Databases": [
        "MongoDB", "PostgreSQL", "MySQL", "SQLite", "Redis", "Oracle DB", "DBMS"
    ],
    "Cloud_DevOps": [
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "Git", "Linux", "Terraform"
    ],
    "AI_Data": [
        "Machine Learning", "Deep Learning", "Scikit-learn", "Pandas", "NumPy",
        "XGBoost", "PyTorch", "TensorFlow", "NLP"
    ],
    "CS_Fundamentals": [
        "Data Structures", "Algorithms", "OOP", "Microservices", "System Design",
        "Unit Testing", "Agile"
    ]
}

# ---------------------------------------------------------------------------
# Contact Information Patterns
# ---------------------------------------------------------------------------
EMAIL_PATTERN = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+", re.IGNORECASE)
PHONE_PATTERN = re.compile(
    r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b|"
    r"\b\d{3}[-.\s]\d{4}\b|"
    r"\b(?:\+?\d{10,13})\b|"
    r"\bphone\s*[:\-]?\s*[\d\+\(\)\s\.\-]{7,}\b",
    re.IGNORECASE
)
LINKEDIN_PATTERN = re.compile(r"linkedin\.com\/(?:in|profile)\/[\w\-]+|linkedin\s*:", re.IGNORECASE)
GITHUB_PATTERN = re.compile(r"github\.com\/[\w\-]+|gitlab\.com\/[\w\-]+|portfolio|github\s*:", re.IGNORECASE)
LOCATION_PATTERN = re.compile(
    r"\b[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\b|"
    r"\b[A-Z][a-zA-Z\s]+,\s*India\b|"
    r"\b[A-Z][a-zA-Z\s]+,\s*USA\b|"
    r"\b[A-Z][a-zA-Z\s]+,\s*United States\b|"
    r"\b(?:remote|bangalore|hyderabad|pune|mumbai|delhi|seattle|new york|san francisco|chicago|austin|boston|california|texas|london|toronto)\b",
    re.IGNORECASE
)

# ---------------------------------------------------------------------------
# Section Header Detection Patterns
# ---------------------------------------------------------------------------
SECTION_HEADER_PATTERNS = {
    "experience": [
        r"(?i)\b(?:work\s+experience|professional\s+experience|employment\s+history|experience)\b",
        r"(?i)\b(?:internship[s]?|job\s+history)\b"
    ],
    "education": [
        r"(?i)\b(?:education|academic\s+background|academic\s+profile|qualifications)\b"
    ],
    "skills": [
        r"(?i)\b(?:technical\s+skills|skills\s*(?:&|and)\s*tools|core\s+competencies|technologies|technical\s+proficiencies)\b",
        r"(?i)\b(?:skills|proficiencies|tools)\b"
    ],
    "projects": [
        r"(?i)\b(?:projects?|academic\s+projects|personal\s+projects|key\s+projects|portfolio)\b"
    ],
    "summary": [
        r"(?i)\b(?:professional\s+summary|profile|summary|objective|career\s+objective)\b"
    ]
}

# ---------------------------------------------------------------------------
# Action Verbs (Grouped by Professional Category)
# ---------------------------------------------------------------------------
ACTION_VERBS = [
    r"\b(?:architected|spearheaded|engineered|developed|implemented|designed|built|optimized|led|managed)\b",
    r"\b(?:created|delivered|refactored|deployed|automated|integrated|reduced|increased|boosted|accelerated)\b",
    r"\b(?:scaled|collaborated|resolved|analyzed|established|maintained|improved|programmed|mentored|directed)\b"
]

# ---------------------------------------------------------------------------
# Quantifiable Impact Indicators (Business Results, Percentages, Scale)
# ---------------------------------------------------------------------------
QUANTIFIABLE_METRIC_PATTERNS = [
    r"\b\d+(?:\.\d+)?%(?!\w)",  # Percentages (e.g. 25%, 99.9%)
    r"\b(?:increased|reduced|boosted|saved|cut|accelerated|improved)\s+(?:by\s+)?\d+%(?!\w)",
    r"\b\d+(?:,\d+)*(?:\.\d+)?\+?\s*(?:k|m|million|billion)?\s*(?:users|clients|customers|requests|transactions|events|tps|qps|stars|downloads|dau|mau)\b",  # Scale
    r"\$\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:k|m|million|billion))?\b",  # Revenue / Dollars
    r"\b\d+\s*(?:ms|seconds|minutes|hours)\b(?:\s+(?:latency|reduction|faster))?",  # Performance metrics
    r"\b\d+\s*x\b|\b\d+\s*fold\b",  # Multipliers (e.g. 2x faster, 10-fold)
]

# ---------------------------------------------------------------------------
# Date and Employment Timeline Patterns
# ---------------------------------------------------------------------------
DATE_RANGE_PATTERNS = [
    r"\b(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:(?:19|20)\d{2}|present|current)\b",
    r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:[a-z]*\.?\s*(?:19|20)\d{2}|present|current)\b"
]

# ---------------------------------------------------------------------------
# Education Detection Patterns
# ---------------------------------------------------------------------------
DEGREE_PATTERN = re.compile(
    r"\b(?:b\.?tech|b\.?s|b\.?e|m\.?s|m\.?tech|m\.?c\.?a|b\.?c\.?a|bachelor(?:'s)?|master(?:'s)?|ph\.?d|doctorate|diploma|associate(?:'s)?)\b",
    re.IGNORECASE
)
FIELD_OF_STUDY_PATTERN = re.compile(
    r"\b(?:computer\s+science|information\s+technology|software\s+engineering|data\s+science|"
    r"electrical|electronics|mechanical|civil|mathematics|physics|artificial\s+intelligence|"
    r"machine\s+learning|cyber\s*security|computer\s+engineering)\b",
    re.IGNORECASE
)
INSTITUTION_PATTERN = re.compile(
    r"\b(?:university|college|institute|polytechnic|academy|school\s+of)\b",
    re.IGNORECASE
)


def compute_resume_hash(text):
    """Computes a deterministic SHA-256 hash of normalized text."""
    if not text or not isinstance(text, str):
        return ""
    normalized = " ".join(text.strip().split()).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _get_skill_domains(skills):
    """Identifies which distinct technical domains are represented in skills."""
    skills_lower = {s.lower() for s in skills}
    represented = []
    for domain, domain_skills in SKILL_DOMAINS.items():
        if any(ds.lower() in skills_lower for ds in domain_skills):
            represented.append(domain)
    return represented


def _classify_tier(score):
    """Returns official ATS tier based on score."""
    if score >= 80:
        return "Excellent"
    elif score >= 60:
        return "Good"
    elif score >= 40:
        return "Needs Improvement"
    else:
        return "Poor"


def extract_candidate_profile(resume_text, skills=None):
    """
    Extracts structured candidate profile elements:
    - Contact details (Email, Phone, LinkedIn, GitHub, Location)
    - Education (Degrees, Fields of study, Institutions)
    - Experience indicators (Timeline dates, Quantifiable metrics, Seniority level)
    - Certifications (Recognized industry certifications)
    """
    if not resume_text or not isinstance(resume_text, str):
        return {
            "contact_info": {},
            "education": {"detected": False, "degrees": [], "fields_of_study": [], "institutions": []},
            "experience": {"detected": False, "seniority_level": "Entry / Unspecified", "timeline_entries": [], "quantifiable_metrics_count": 0, "sample_metrics": []},
            "certifications": [],
        }

    skills = skills or []

    # 1. Contact details
    email_m = EMAIL_PATTERN.search(resume_text)
    phone_m = PHONE_PATTERN.search(resume_text)
    linkedin_m = LINKEDIN_PATTERN.search(resume_text)
    github_m = GITHUB_PATTERN.search(resume_text)
    loc_m = LOCATION_PATTERN.search(resume_text)

    contact_info = {
        "email": email_m.group(0).strip() if email_m else None,
        "phone": phone_m.group(0).strip() if phone_m else None,
        "linkedin": linkedin_m.group(0).strip() if linkedin_m else None,
        "github": github_m.group(0).strip() if github_m else None,
        "location": loc_m.group(0).strip() if loc_m else None,
    }

    # 2. Education
    degrees = list(dict.fromkeys([m.group(0).strip() for m in DEGREE_PATTERN.finditer(resume_text)]))
    fields_of_study = list(dict.fromkeys([m.group(0).strip() for m in FIELD_OF_STUDY_PATTERN.finditer(resume_text)]))
    institutions = list(dict.fromkeys([m.group(0).strip() for m in INSTITUTION_PATTERN.finditer(resume_text)]))
    education_info = {
        "detected": bool(degrees or fields_of_study or institutions),
        "degrees": degrees,
        "fields_of_study": fields_of_study,
        "institutions": institutions,
    }

    # 3. Work Experience & Impact
    dates = []
    for pat in DATE_RANGE_PATTERNS:
        for m in re.finditer(pat, resume_text, re.IGNORECASE):
            dates.append(m.group(0).strip())
    dates = list(dict.fromkeys(dates))

    metrics = []
    for pat in QUANTIFIABLE_METRIC_PATTERNS:
        for m in re.finditer(pat, resume_text, re.IGNORECASE):
            metrics.append(m.group(0).strip())
    metrics = list(dict.fromkeys(metrics))

    is_senior = bool(re.search(r"\b(?:senior|lead|principal|staff|architect|manager|director)\b", resume_text, re.IGNORECASE))
    is_mid = bool(re.search(r"\b(?:software\s+engineer|developer|consultant|analyst)\b", resume_text, re.IGNORECASE)) and not is_senior
    seniority = "Senior / Lead" if is_senior else ("Mid-Level" if is_mid else "Entry / Associate")

    experience_info = {
        "detected": bool(dates or metrics or is_senior or is_mid),
        "seniority_level": seniority,
        "timeline_entries": dates[:4],
        "quantifiable_metrics_count": len(metrics),
        "sample_metrics": metrics[:3],
    }

    # 4. Certifications
    cert_pattern = re.compile(
        r"\b(?:aws\s+certified|azure\s+certified|google\s+cloud\s+certified|gcp\s+certified|"
        r"pmp|ckad|cka|cissp|scrum\s+master|csm|comptia|ccna|ccnp|solutions\s+architect|"
        r"developer\s+associate|sysops|terraform\s+associate)\b",
        re.IGNORECASE
    )
    certifications = list(dict.fromkeys([m.group(0).strip() for m in cert_pattern.finditer(resume_text)]))

    return {
        "contact_info": contact_info,
        "education": education_info,
        "experience": experience_info,
        "certifications": certifications,
    }


# ===========================================================================
# EVALUATE ATS SCORE (Deterministic Engine)
# ===========================================================================
def evaluate_ats_score(resume_text, explicit_skills=None, job_description=None):
    """
    Evaluates measurable ATS criteria and calculates an authentic score (0-100).
    
    Modes:
    1. General Resume Quality Score: When no job_description is provided.
       Evaluates skills depth, measurable impact, structural completeness & contact,
       credentials, and formatting across 5 standardized factors.
    2. Job-Specific ATS Match Score: When a job_description IS provided.
       Evaluates direct skill match, vocabulary alignment, experience relevance,
       education match, and structural readiness across 5 target factors.
    """
    # Empty / Invalid Document Guard
    if not resume_text or not isinstance(resume_text, str) or not resume_text.strip():
        empty_factors = [
            {
                "name": "Technical Skills & Keywords",
                "score": 0,
                "awarded_points": 0,
                "max_score": 20,
                "max_points": 20,
                "percentage": 0,
                "status": "not_evaluated",
                "not_evaluated": True,
                "description": "Not evaluated. Please upload a valid resume document.",
                "details": "Not evaluated. Please upload a valid resume document.",
                "deductions": ["No resume content detected."],
                "deduction_points": 20,
            },
            {
                "name": "Experience & Quantifiable Impact",
                "score": 0,
                "awarded_points": 0,
                "max_score": 20,
                "max_points": 20,
                "percentage": 0,
                "status": "not_evaluated",
                "not_evaluated": True,
                "description": "Not evaluated. Please upload a valid resume document.",
                "details": "Not evaluated. Please upload a valid resume document.",
                "deductions": ["No resume content detected."],
                "deduction_points": 20,
            },
            {
                "name": "Section Completeness & Structure",
                "score": 0,
                "awarded_points": 0,
                "max_score": 20,
                "max_points": 20,
                "percentage": 0,
                "status": "not_evaluated",
                "not_evaluated": True,
                "description": "Not evaluated. Please upload a valid resume document.",
                "details": "Not evaluated. Please upload a valid resume document.",
                "deductions": ["No resume content detected."],
                "deduction_points": 20,
            },
            {
                "name": "Education & Qualifications",
                "score": 0,
                "awarded_points": 0,
                "max_score": 20,
                "max_points": 20,
                "percentage": 0,
                "status": "not_evaluated",
                "not_evaluated": True,
                "description": "Not evaluated. Please upload a valid resume document.",
                "details": "Not evaluated. Please upload a valid resume document.",
                "deductions": ["No resume content detected."],
                "deduction_points": 20,
            },
            {
                "name": "Formatting & Readability",
                "score": 0,
                "awarded_points": 0,
                "max_score": 20,
                "max_points": 20,
                "percentage": 0,
                "status": "not_evaluated",
                "not_evaluated": True,
                "description": "Not evaluated. Please upload a valid resume document.",
                "details": "Not evaluated. Please upload a valid resume document.",
                "deductions": ["No resume content detected."],
                "deduction_points": 20,
            },
        ]
        return {
            "ats_score": 0,
            "evaluation_type": "general_quality",
            "score_label": "General Resume Quality Score",
            "rating_tier": "Poor",
            "scoring_version": "3.0-realistic-deterministic",
            "factors": empty_factors,
            "factor_breakdown": empty_factors,
            "strengths_summary": [],
            "areas_for_improvement": ["Upload a non-empty text PDF resume."],
            "suggestions": ["Please upload a valid resume document."],
            "strengths": "No text detected in document.",
            "weaknesses": "Empty document. Cannot evaluate content.",
            "missing_skills": "Core technical skills.",
            "target_jd_provided": False,
        }

    skills = explicit_skills if explicit_skills is not None else extract_skills(resume_text)
    
    # If a Job Description is provided, route to Job-Specific Evaluation
    has_target_jd = bool(job_description and isinstance(job_description, str) and job_description.strip())
    if has_target_jd:
        return _evaluate_job_specific_ats(resume_text, skills, job_description.strip())
    else:
        return _evaluate_general_resume_quality(resume_text, skills)


# ===========================================================================
# 1. GENERAL RESUME QUALITY EVALUATION (No Target JD)
# ===========================================================================
def _evaluate_general_resume_quality(resume_text, skills):
    """
    Evaluates resume quality across 5 realistic, measurable dimensions (0-100 pts).
    1. Technical Skills & Keywords: 20 points
    2. Experience & Quantifiable Impact: 20 points
    3. Section Completeness & Structure: 20 points
    4. Education & Qualifications: 20 points
    5. Formatting & Readability: 20 points
    Total: 100 points (each factor exactly 20 points, sum equals ats_score).
    """
    factors = []
    strengths_summary = []
    areas_for_improvement = []

    # -------------------------------------------------------------------------
    # Factor 1: Technical Skills & Keywords (20 points)
    # Volume (12 pts) + Domain Diversity (8 pts)
    # -------------------------------------------------------------------------
    skill_count = len(skills)
    skill_domains = _get_skill_domains(skills)
    domain_count = len(skill_domains)
    factor1_deductions = []

    # Volume (12 pts)
    if skill_count >= 16:
        vol_score = 12
    elif skill_count >= 12:
        vol_score = 10
        factor1_deductions.append("Skill volume is moderate (12-15 skills); top tech resumes typically list 16+ competencies (-2 pts)")
    elif skill_count >= 9:
        vol_score = 8
        factor1_deductions.append("Found 9-11 skills; expanding technical keywords improves enterprise ATS parsing (-4 pts)")
    elif skill_count >= 6:
        vol_score = 5
        factor1_deductions.append("Limited skill count (6-8 skills detected); add additional relevant libraries and tools (-7 pts)")
    elif skill_count >= 3:
        vol_score = 3
        factor1_deductions.append("Very low skill density (only 3-5 skills); keyword presence is weak for automated screening (-9 pts)")
    elif skill_count >= 1:
        vol_score = 1
        factor1_deductions.append("Critically low technical keywords (only 1-2 skills detected) (-11 pts)")
    else:
        vol_score = 0
        factor1_deductions.append("No industry technical skills recognized in parsed text (-12 pts)")

    # Domain Diversity (8 pts)
    if domain_count >= 4:
        dom_score = 8
        strengths_summary.append(f"Strong technical breadth across {domain_count} distinct tech domains ({', '.join(skill_domains[:4])}).")
    elif domain_count == 3:
        dom_score = 6
        factor1_deductions.append(f"Skills span 3 domains ({', '.join(skill_domains)}); adding cloud/DevOps or testing expands breadth (-2 pts)")
    elif domain_count == 2:
        dom_score = 4
        factor1_deductions.append(f"Skills are concentrated in only 2 domains ({', '.join(skill_domains)}); lacks full-stack or infrastructure breadth (-4 pts)")
    elif domain_count == 1:
        dom_score = 2
        factor1_deductions.append("Skills span only a single domain; missing complementary databases, frameworks, or developer tools (-6 pts)")
    else:
        dom_score = 0
        factor1_deductions.append("No technical skill domains recognized (-8 pts)")

    # Specific stack checks
    has_db = "Databases" in skill_domains
    has_tools = any(s.lower() in [sk.lower() for sk in skills] for s in ["Git", "Docker", "CI/CD", "Linux"])
    if not has_db and skill_count > 0:
        factor1_deductions.append("No database competencies detected (e.g., PostgreSQL, MongoDB, SQL, Redis)")
    if not has_tools and skill_count > 0:
        factor1_deductions.append("No version control or developer tooling detected (e.g., Git, Docker, CI/CD)")

    f1_score = max(0, min(20, vol_score + dom_score))
    if f1_score >= 17:
        f1_status = "Optimal"
        f1_exp = f"Verified {skill_count} technical competencies across {domain_count} distinct technology domains."
    elif f1_score >= 12:
        f1_status = "Good"
        f1_exp = f"Found {skill_count} skills across {domain_count} domains with solid foundational coverage."
    elif f1_score >= 7:
        f1_status = "Needs Improvement"
        f1_exp = f"Detected {skill_count} skills; expand technical keywords across additional frameworks and tools."
        areas_for_improvement.append("Incorporate additional specialized tools, frameworks, and databases to broaden keyword density.")
    elif skill_count == 0:
        f1_status = "Critical"
        f1_exp = "No industry technical skills recognized in the parsed resume text."
        areas_for_improvement.append("Include an explicit Technical Skills section listing programming languages, frameworks, and tools.")
    else:
        f1_status = "Critical"
        f1_exp = f"Very low skill density ({skill_count} detected); include dedicated programming, framework, and tooling keywords."
        areas_for_improvement.append("Include an explicit Technical Skills section listing programming languages, frameworks, and tools.")

    factors.append({
        "name": "Technical Skills & Keywords",
        "score": f1_score,
        "awarded_points": f1_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f1_score / 20) * 100)),
        "status": f1_status,
        "description": f1_exp,
        "details": f1_exp,
        "deductions": factor1_deductions,
        "deduction_points": 20 - f1_score
    })

    # -------------------------------------------------------------------------
    # Factor 2: Experience & Quantifiable Impact (20 points)
    # Metrics (8 pts) + Action Verbs (6 pts) + Chronology & Titles (6 pts)
    # -------------------------------------------------------------------------
    factor2_deductions = []

    # Quantifiable Metrics (8 pts)
    quant_count = 0
    for pat in QUANTIFIABLE_METRIC_PATTERNS:
        quant_count += len(re.findall(pat, resume_text, re.IGNORECASE))

    if quant_count >= 4:
        metric_score = 8
        strengths_summary.append(f"Strong quantifiable impact with {quant_count} measurable outcome indicators (%, $, scale).")
    elif quant_count >= 2:
        metric_score = 5
        factor2_deductions.append(f"Found {quant_count} quantifiable metrics; aim for 4+ bullet points with measurable outcomes (%, $, latency, scale) (-3 pts)")
    elif quant_count == 1:
        metric_score = 3
        factor2_deductions.append("Only 1 quantifiable metric detected; bullet points appear predominantly task-oriented rather than outcome-oriented (-5 pts)")
        areas_for_improvement.append("Quantify accomplishments in bullet points (e.g., 'reduced latency by 35%', 'scaled to 50k users').")
    else:
        metric_score = 0
        factor2_deductions.append("No quantifiable metrics (%, $, user scale, or speedups) detected in accomplishments (-8 pts)")
        areas_for_improvement.append("Add measurable metrics (percentages, dollar amounts, performance gains) to project and work bullets.")

    # Action Verbs (6 pts)
    action_verb_count = 0
    for pat in ACTION_VERBS:
        action_verb_count += len(re.findall(pat, resume_text, re.IGNORECASE))

    if action_verb_count >= 8:
        verb_score = 6
    elif action_verb_count >= 4:
        verb_score = 4
        factor2_deductions.append(f"Moderate action verb frequency ({action_verb_count} found); strengthen bullet openers with impactful verbs (-2 pts)")
    elif action_verb_count >= 2:
        verb_score = 2
        factor2_deductions.append(f"Limited action verbs ({action_verb_count} found); phrasing lacks strong active voice (-4 pts)")
    else:
        verb_score = 0
        factor2_deductions.append("Minimal action verbs detected; start bullet points with strong verbs like 'architected', 'spearheaded', 'engineered' (-6 pts)")

    # Chronology & Career Dates (6 pts)
    has_date_ranges = any(re.search(pat, resume_text, re.IGNORECASE) for pat in DATE_RANGE_PATTERNS)
    has_single_years = bool(re.search(r"\b(?:19|20)\d{2}\b", resume_text))
    has_job_titles = bool(re.search(r"\b(?:engineer|developer|architect|lead|analyst|intern|manager|specialist|consultant)\b", resume_text, re.IGNORECASE))

    if has_date_ranges and has_job_titles:
        chrono_score = 6
    elif has_single_years and has_job_titles:
        chrono_score = 4
        factor2_deductions.append("Dates are indicated by single years rather than clear tenure date ranges (e.g., '2021 - 2023') (-2 pts)")
    elif has_job_titles or has_single_years:
        chrono_score = 2
        factor2_deductions.append("Incomplete employment chronology; ensure job titles, companies, and date ranges are clearly stated (-4 pts)")
    else:
        chrono_score = 0
        factor2_deductions.append("No clear professional titles or employment date ranges detected (-6 pts)")

    f2_score = max(0, min(20, metric_score + verb_score + chrono_score))
    if f2_score >= 16:
        f2_status = "Optimal"
        f2_exp = f"Strong quantifiable impact with {quant_count} metric indicators and active accomplishment phrasing."
    elif f2_score >= 11:
        f2_status = "Good"
        f2_exp = f"Good action verbs ({action_verb_count} found); adding more metrics (%, scale) will elevate credibility."
    elif f2_score >= 6:
        f2_status = "Needs Improvement"
        f2_exp = "Found limited action verbs and measurable metrics; content is primarily task-oriented."
    else:
        f2_status = "Critical"
        f2_exp = "Missing quantifiable achievements, strong action verbs, and clear professional chronology."

    factors.append({
        "name": "Experience & Quantifiable Impact",
        "score": f2_score,
        "awarded_points": f2_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f2_score / 20) * 100)),
        "status": f2_status,
        "description": f2_exp,
        "details": f2_exp,
        "deductions": factor2_deductions,
        "deduction_points": 20 - f2_score
    })

    # -------------------------------------------------------------------------
    # Factor 3: Section Completeness & Structure (20 points)
    # Contact Header (8 pts) + Structural Sections (12 pts)
    # -------------------------------------------------------------------------
    factor3_deductions = []
    sec_score = 0

    # Contact Details (8 pts: Email 2.5, Phone 2.5, LinkedIn/GitHub 1.5, Location 1.5)
    has_email = bool(EMAIL_PATTERN.search(resume_text))
    has_phone = bool(PHONE_PATTERN.search(resume_text))
    has_linkedin = bool(LINKEDIN_PATTERN.search(resume_text))
    has_github = bool(GITHUB_PATTERN.search(resume_text))
    has_location = bool(LOCATION_PATTERN.search(resume_text))

    contact_pts = 0
    if has_email:
        contact_pts += 2.5
    else:
        factor3_deductions.append("Missing primary email address (-2.5 pts)")

    if has_phone:
        contact_pts += 2.5
    else:
        factor3_deductions.append("Missing phone number (-2.5 pts)")

    if has_linkedin or has_github:
        contact_pts += 1.5
    else:
        factor3_deductions.append("Missing professional online links (LinkedIn or GitHub profile) (-1.5 pts)")
        areas_for_improvement.append("Include links to your LinkedIn profile and GitHub repository.")

    if has_location:
        contact_pts += 1.5
    else:
        factor3_deductions.append("Missing location/city information for recruiter geographic matching (-1.5 pts)")

    # Check structural sections (12 pts: Exp 3, Edu 3, Skills 3, Projects 3)
    def _has_section(sec_key):
        for pat in SECTION_HEADER_PATTERNS.get(sec_key, []):
            if re.search(pat, resume_text):
                return True
        return False

    has_exp_sec = _has_section("experience")
    has_edu_sec = _has_section("education")
    has_skills_sec = _has_section("skills")
    has_proj_sec = _has_section("projects")

    body_sec_pts = 0
    if has_exp_sec:
        body_sec_pts += 3
    else:
        factor3_deductions.append("Missing dedicated 'Work Experience' or 'Employment History' section header (-3 pts)")
        areas_for_improvement.append("Add a standard 'Work Experience' section header.")

    if has_edu_sec:
        body_sec_pts += 3
    else:
        factor3_deductions.append("Missing dedicated 'Education' section header (-3 pts)")
        areas_for_improvement.append("Add a clear 'Education' section header.")

    if has_skills_sec:
        body_sec_pts += 3
    else:
        factor3_deductions.append("Missing dedicated 'Skills' section header (-3 pts)")
        areas_for_improvement.append("Create a dedicated 'Technical Skills' section.")

    if has_proj_sec:
        body_sec_pts += 3
    else:
        factor3_deductions.append("Missing dedicated 'Projects' or 'Portfolio' section header (-3 pts)")

    sec_score = int(round(contact_pts + body_sec_pts))
    sec_score = max(0, min(20, sec_score))

    if sec_score >= 17:
        f3_status = "Optimal"
        f3_exp = "All core standard resume sections and primary recruiter contact details verified."
        strengths_summary.append("Standard, well-structured layout with verified contact details adhering to ATS parsing conventions.")
    elif sec_score >= 12:
        f3_status = "Good"
        f3_exp = "Most core sections detected; ensure all standard headers and online profile links are present."
    elif sec_score >= 7:
        f3_status = "Needs Improvement"
        f3_exp = "Multiple standard resume sections or contact details are missing."
    else:
        f3_status = "Critical"
        f3_exp = "Resume lacks standard structural section headers, impeding automated parsing."

    factors.append({
        "name": "Section Completeness & Structure",
        "score": sec_score,
        "awarded_points": sec_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((sec_score / 20) * 100)),
        "status": f3_status,
        "description": f3_exp,
        "details": f3_exp,
        "deductions": factor3_deductions,
        "deduction_points": 20 - sec_score
    })

    # -------------------------------------------------------------------------
    # Factor 4: Education & Qualifications (20 points)
    # Degree Level (8 pts), Major / Field (5 pts), Institution (4 pts), Certifications (3 pts)
    # -------------------------------------------------------------------------
    factor4_deductions = []
    has_degree = bool(DEGREE_PATTERN.search(resume_text))
    is_advanced_deg = bool(re.search(r"\b(?:master(?:'s)?|m\.?s|m\.?tech|m\.?c\.?a|ph\.?d|doctorate)\b", resume_text, re.IGNORECASE))
    has_field = bool(FIELD_OF_STUDY_PATTERN.search(resume_text))
    has_institution = bool(INSTITUTION_PATTERN.search(resume_text))
    cert_pattern = re.compile(
        r"\b(?:aws\s+certified|azure\s+certified|google\s+cloud\s+certified|gcp\s+certified|"
        r"pmp|ckad|cka|cissp|scrum\s+master|csm|comptia|ccna|ccnp|solutions\s+architect|"
        r"developer\s+associate|sysops|terraform\s+associate)\b",
        re.IGNORECASE
    )
    has_certs = bool(cert_pattern.search(resume_text))

    if is_advanced_deg:
        deg_pts = 8
    elif has_degree:
        deg_pts = 6
        factor4_deductions.append("Undergraduate credentials detected; postgraduate/specialized degrees elevate technical standing (-2 pts)")
    else:
        deg_pts = 0
        factor4_deductions.append("Degree title not clearly stated (e.g. B.Tech, B.S., Bachelor's, Master's) (-8 pts)")
        areas_for_improvement.append("Explicitly specify your degree title (e.g., 'Bachelor of Technology').")

    if has_field:
        field_pts = 5
    else:
        field_pts = 0
        factor4_deductions.append("Field of study or major not clearly recognized (e.g. Computer Science, Engineering) (-5 pts)")

    if has_institution:
        inst_pts = 4
    else:
        inst_pts = 0
        factor4_deductions.append("Academic institution name not recognized with standard keyword (University, College, Institute) (-4 pts)")

    if has_certs:
        cert_pts = 3
        strengths_summary.append("Verified industry certifications supporting continuous professional development.")
    else:
        cert_pts = 0
        factor4_deductions.append("No industry certifications detected (e.g., AWS, Azure, PMP, CKAD) (-3 pts)")
        areas_for_improvement.append("Consider earning and featuring recognized certifications to validate technical specialization.")

    f4_score = max(0, min(20, deg_pts + field_pts + inst_pts + cert_pts))
    if f4_score >= 16:
        f4_status = "Optimal"
        f4_exp = "Degree title, specialization/major, and academic institution clearly verified."
        strengths_summary.append("Accredited degree credentials aligned with technical role expectations.")
    elif f4_score >= 11:
        f4_status = "Good"
        f4_exp = "Degree and institution identified; verify field of study is explicitly stated."
    elif f4_score >= 6:
        f4_status = "Needs Improvement"
        f4_exp = "Incomplete educational credentials detected. Clarify degree, institution, and major."
    else:
        f4_status = "Critical"
        f4_exp = "Degree title, major, and institution are missing or not clearly recognized."

    factors.append({
        "name": "Education & Qualifications",
        "score": f4_score,
        "awarded_points": f4_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f4_score / 20) * 100)),
        "status": f4_status,
        "description": f4_exp,
        "details": f4_exp,
        "deductions": factor4_deductions,
        "deduction_points": 20 - f4_score
    })

    # -------------------------------------------------------------------------
    # Factor 5: Formatting & Readability (20 points)
    # Word Count (8 pts) + Bullet Structure (8 pts) + Clean Text (4 pts)
    # -------------------------------------------------------------------------
    factor5_deductions = []
    words = re.findall(r"\b[A-Za-z0-9\-\+\#\.]+\b", resume_text)
    word_count = len(words)

    # Word Count (8 pts)
    if 450 <= word_count <= 850:
        wc_score = 8
        wc_exp = f"Ideal resume length ({word_count} words). Optimal for standard 1-2 page ATS screening."
    elif 300 <= word_count < 450 or 851 <= word_count <= 1050:
        wc_score = 5
        wc_exp = f"Acceptable length ({word_count} words); ideal range is 450-850 words."
        factor5_deductions.append(f"Length ({word_count} words) is slightly outside ideal 450-850 word density (-3 pts)")
    elif 150 <= word_count < 300:
        wc_score = 3
        wc_exp = f"Resume is brief ({word_count} words). Lacks depth in accomplishment descriptions."
        factor5_deductions.append(f"Resume is very brief ({word_count} words); add detailed project and responsibility bullets (-5 pts)")
        areas_for_improvement.append("Expand resume descriptions with additional detail (target: 450-800 words).")
    elif word_count > 1050:
        wc_score = 3
        wc_exp = f"Resume is verbose ({word_count} words). Consider condensing to 1-2 pages."
        factor5_deductions.append(f"Resume is excessively long ({word_count} words); condense to 1-2 pages (-5 pts)")
    else:
        wc_score = 1
        wc_exp = f"Critically short document ({word_count} words)."
        factor5_deductions.append("Critically low word count (< 150 words); content is incomplete for screening (-7 pts)")

    # Bullet point structure (8 pts)
    bullet_count = len(re.findall(r"(?m)^\s*[•\-\*\u2022\u2023\u25E6]\s+", resume_text))
    if bullet_count >= 8:
        bullet_score = 8
    elif bullet_count >= 4:
        bullet_score = 5
        factor5_deductions.append(f"Found {bullet_count} bullet points; expanding to 8+ structured bullets improves ATS section parsing (-3 pts)")
    elif bullet_count >= 2:
        bullet_score = 2
        factor5_deductions.append("Limited bullet points; use structured bullet lists for job and project descriptions (-6 pts)")
    else:
        bullet_score = 0
        factor5_deductions.append("No standard bullet points detected; avoid dense paragraph blocks for ATS parsers (-8 pts)")

    # Text Cleanliness (4 pts)
    has_corrupt = "\ufffd" in resume_text or resume_text.count("?") > 25
    clean_score = 1 if has_corrupt else 4
    if has_corrupt:
        factor5_deductions.append("Document text contains special encoding artifacts or unparsed symbols (-3 pts)")

    f5_score = max(0, min(20, wc_score + bullet_score + clean_score))
    factors.append({
        "name": "Formatting & Readability",
        "score": f5_score,
        "awarded_points": f5_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f5_score / 20) * 100)),
        "status": "Optimal" if f5_score >= 16 else "Good" if f5_score >= 11 else "Needs Improvement" if f5_score >= 6 else "Critical",
        "description": wc_exp,
        "details": wc_exp,
        "deductions": factor5_deductions,
        "deduction_points": 20 - f5_score
    })

    # -------------------------------------------------------------------------
    # Final Score Calculation (Exact integer 0 - 100, exactly sum of 5 factors)
    # -------------------------------------------------------------------------
    raw_total = f1_score + f2_score + sec_score + f4_score + f5_score
    ats_score = max(0, min(100, int(round(raw_total))))
    rating_tier = _classify_tier(ats_score)

    # Actionable suggestions derived from deductions
    suggestions = []
    if areas_for_improvement:
        for area in areas_for_improvement[:4]:
            suggestions.append(f"Action: {area}")
    else:
        suggestions.append("Action: Maintain your strong profile with continuous project updates and metrics.")

    # High-value industry skills for general gaps
    common_priority = ["Docker", "Kubernetes", "AWS", "CI/CD", "System Design", "TypeScript", "PostgreSQL", "Redis"]
    missing_tech = [s for s in common_priority if s.lower() not in {sk.lower() for sk in skills}]
    missing_skills_str = ", ".join(missing_tech[:4]) if missing_tech else "None detected"

    candidate_profile = extract_candidate_profile(resume_text, skills)

    return {
        "ats_score": ats_score,
        "evaluation_type": "general_quality",
        "score_label": "General Resume Quality Score",
        "score_description": "Evaluated based on standard resume quality factors: keyword depth, structural completeness, quantifiable impact, credentials, and readability. For job-specific ATS matching, add a target Job Description below.",
        "rating_tier": rating_tier,
        "scoring_version": "3.0-realistic-deterministic",
        "factors": factors,
        "factor_breakdown": factors,
        "strengths_summary": strengths_summary,
        "areas_for_improvement": areas_for_improvement,
        "suggestions": suggestions,
        "strengths": "\n".join([f"• {s}" for s in strengths_summary]) if strengths_summary else "Standard baseline formatting.",
        "weaknesses": "\n".join([f"• {w}" for w in areas_for_improvement]) if areas_for_improvement else "No critical formatting flaws detected.",
        "missing_skills": missing_skills_str,
        "target_jd_provided": False,
        "candidate_profile": candidate_profile,
    }


# ===========================================================================
# 2. JOB-SPECIFIC ATS EVALUATION (When Target JD is Provided)
# ===========================================================================
def _evaluate_job_specific_ats(resume_text, resume_skills, job_description):
    """
    Evaluates Resume alignment directly against a Target Job Description (0-100 pts across 5 factors of 20 pts each).
    1. Target Skill Alignment: 20 points
    2. Job Description Keyword Match: 20 points
    3. Relevant Experience & Impact: 20 points
    4. Education & Qualifications: 20 points
    5. Formatting & Readability: 20 points
    Total: 100 points (sum of 5 factors matches ats_score).
    """
    factors = []
    strengths_summary = []
    areas_for_improvement = []

    # Extract JD skills
    jd_skills = extract_skills(job_description)
    resume_skills_lower = {s.lower(): s for s in resume_skills}
    matching_skills = [s for s in jd_skills if s.lower() in resume_skills_lower]
    missing_skills = [s for s in jd_skills if s.lower() not in resume_skills_lower]

    matching_skills.sort()
    missing_skills.sort()

    # -------------------------------------------------------------------------
    # Factor 1: Target Skill Alignment (20 points)
    # -------------------------------------------------------------------------
    f1_deductions = []
    if jd_skills:
        skill_ratio = len(matching_skills) / len(jd_skills)
        f1_score = int(round(skill_ratio * 20))
        if missing_skills:
            top_missing = missing_skills[:4]
            f1_deductions.append(f"Missing {len(missing_skills)} required JD skills: {', '.join(top_missing)} (-{20 - f1_score} pts)")
            areas_for_improvement.append(f"Acquire or highlight hands-on experience in missing JD skills: {', '.join(top_missing)}.")
        if matching_skills:
            strengths_summary.append(f"Matched {len(matching_skills)} of {len(jd_skills)} required technical skills ({', '.join(matching_skills[:3])}).")
    else:
        skill_ratio = min(1.0, len(resume_skills) / 10.0)
        f1_score = int(round(skill_ratio * 20))
        if len(resume_skills) < 8:
            f1_deductions.append(f"General technical skill count ({len(resume_skills)}) is below role baseline (-{20 - f1_score} pts)")

    f1_score = max(0, min(20, f1_score))
    f1_exp = f"Matched {len(matching_skills)} of {len(jd_skills)} skills specified in the target job description." if jd_skills else f"Found {len(resume_skills)} technical skills relevant to technical roles."
    factors.append({
        "name": "Target Skill Alignment",
        "score": f1_score,
        "awarded_points": f1_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f1_score / 20) * 100)),
        "status": "Optimal" if f1_score >= 16 else "Good" if f1_score >= 11 else "Needs Improvement" if f1_score >= 6 else "Critical",
        "description": f1_exp,
        "details": f1_exp,
        "deductions": f1_deductions,
        "deduction_points": 20 - f1_score
    })

    # -------------------------------------------------------------------------
    # Factor 2: Job Description Keyword Match (20 points)
    # -------------------------------------------------------------------------
    f2_deductions = []
    def _clean_tokens(txt):
        words = re.findall(r"\b[A-Za-z]{3,}\b", txt.lower())
        stopwords = {
            "the", "and", "for", "with", "that", "this", "from", "have", "will",
            "are", "about", "your", "candidate", "role", "team", "experience",
            "skills", "work", "responsibilities", "requirements", "including",
            "looking", "should", "must", "years", "knowledge", "working", "strong"
        }
        return set(w for w in words if w not in stopwords)

    jd_tokens = _clean_tokens(job_description)
    resume_tokens = _clean_tokens(resume_text)
    overlap_tokens = jd_tokens & resume_tokens

    if jd_tokens:
        overlap_ratio = len(overlap_tokens) / len(jd_tokens)
        f2_score = int(round(min(1.0, overlap_ratio * 1.5) * 20))
    else:
        overlap_ratio = 0.5
        f2_score = 10

    f2_score = max(0, min(20, f2_score))
    if f2_score < 14:
        f2_deductions.append(f"Keyword overlap with JD is {int(overlap_ratio * 100)}%; incorporate domain-specific terminology from job post (-{20 - f2_score} pts)")
        areas_for_improvement.append("Align your resume vocabulary with the terminology used in the job description.")
    else:
        strengths_summary.append("High vocabulary overlap with role responsibilities and domain terminology.")

    f2_exp = f"Vocabulary overlap is {int(overlap_ratio * 100)}% ({len(overlap_tokens)} shared technical keywords)."
    factors.append({
        "name": "Job Description Keyword Match",
        "score": f2_score,
        "awarded_points": f2_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f2_score / 20) * 100)),
        "status": "Optimal" if f2_score >= 15 else "Good" if f2_score >= 10 else "Needs Improvement",
        "description": f2_exp,
        "details": f2_exp,
        "deductions": f2_deductions,
        "deduction_points": 20 - f2_score
    })

    # -------------------------------------------------------------------------
    # Factor 3: Relevant Experience & Impact (20 points)
    # Date Ranges (6 pts) + Quantifiable Metrics (8 pts) + Seniority Match (6 pts)
    # -------------------------------------------------------------------------
    f3_deductions = []
    target_senior = any(w in job_description.lower() for w in ["senior", "lead", "staff", "principal", "architect"])
    candidate_senior = any(w in resume_text.lower() for w in ["senior", "lead", "staff", "principal", "architect"])
    
    quant_count = sum(len(re.findall(pat, resume_text, re.IGNORECASE)) for pat in QUANTIFIABLE_METRIC_PATTERNS)
    has_date_ranges = any(re.search(pat, resume_text, re.IGNORECASE) for pat in DATE_RANGE_PATTERNS)

    exp_pts = 0
    if has_date_ranges:
        exp_pts += 6
    else:
        f3_deductions.append("Lacks clear employment chronology with date ranges (-6 pts)")

    if quant_count >= 3:
        exp_pts += 8
    elif quant_count >= 1:
        exp_pts += 4
        f3_deductions.append(f"Only {quant_count} quantifiable metrics detected; role requires proven business results (-4 pts)")
    else:
        f3_deductions.append("No quantifiable outcome metrics (%, scale, latency) detected (-8 pts)")

    if target_senior and not candidate_senior:
        exp_pts += 2
        f3_deductions.append("Target job specifies Senior/Lead seniority; candidate profile does not reflect senior title (-4 pts)")
    else:
        exp_pts += 6

    f3_score = max(0, min(20, exp_pts))
    f3_exp = f"Evaluated career chronology, title alignment, and measurable accomplishments ({quant_count} metrics)."
    factors.append({
        "name": "Relevant Experience & Impact",
        "score": f3_score,
        "awarded_points": f3_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f3_score / 20) * 100)),
        "status": "Optimal" if f3_score >= 16 else "Good" if f3_score >= 10 else "Needs Improvement",
        "description": f3_exp,
        "details": f3_exp,
        "deductions": f3_deductions,
        "deduction_points": 20 - f3_score
    })

    # -------------------------------------------------------------------------
    # Factor 4: Education & Qualifications (20 points)
    # Degree (8 pts) + Field (6 pts) + Institution (6 pts)
    # -------------------------------------------------------------------------
    f4_deductions = []
    has_degree = bool(DEGREE_PATTERN.search(resume_text))
    has_field = bool(FIELD_OF_STUDY_PATTERN.search(resume_text))
    has_institution = bool(INSTITUTION_PATTERN.search(resume_text))

    edu_pts = (8 if has_degree else 0) + (6 if has_field else 0) + (6 if has_institution else 0)
    if not has_degree:
        f4_deductions.append("Degree title not clearly stated for qualification screening (-8 pts)")
    if not has_field:
        f4_deductions.append("Field of study or technical major not identified (-6 pts)")
    if not has_institution:
        f4_deductions.append("Academic institution name not recognized (-6 pts)")

    f4_score = max(0, min(20, edu_pts))
    f4_exp = "Educational credentials evaluated against role qualification benchmarks."
    factors.append({
        "name": "Education & Qualifications",
        "score": f4_score,
        "awarded_points": f4_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f4_score / 20) * 100)),
        "status": "Optimal" if f4_score >= 16 else "Good" if f4_score >= 10 else "Needs Improvement",
        "description": f4_exp,
        "details": f4_exp,
        "deductions": f4_deductions,
        "deduction_points": 20 - f4_score
    })

    # -------------------------------------------------------------------------
    # Factor 5: Formatting & Readability (20 points)
    # Word Count (10 pts) + Contact Parsability (10 pts)
    # -------------------------------------------------------------------------
    f5_deductions = []
    words = re.findall(r"\b[A-Za-z0-9\-\+\#\.]+\b", resume_text)
    word_count = len(words)
    has_email = bool(EMAIL_PATTERN.search(resume_text))
    has_phone = bool(PHONE_PATTERN.search(resume_text))

    fmt_pts = 0
    if 350 <= word_count <= 900:
        fmt_pts += 10
    elif 200 <= word_count < 350 or 901 <= word_count <= 1200:
        fmt_pts += 6
        f5_deductions.append(f"Suboptimal word count ({word_count} words); target 400-800 words (-4 pts)")
    else:
        fmt_pts += 2
        f5_deductions.append(f"Document length ({word_count} words) is too brief or excessively verbose (-8 pts)")

    if has_email and has_phone:
        fmt_pts += 10
    elif has_email or has_phone:
        fmt_pts += 5
        f5_deductions.append("Incomplete contact details (missing phone or email) (-5 pts)")
    else:
        f5_deductions.append("Missing primary contact details (email and phone) (-10 pts)")

    f5_score = max(0, min(20, fmt_pts))
    f5_exp = f"Document length ({word_count} words) and contact parsability evaluated."
    factors.append({
        "name": "Formatting & Readability",
        "score": f5_score,
        "awarded_points": f5_score,
        "max_score": 20,
        "max_points": 20,
        "percentage": int(round((f5_score / 20) * 100)),
        "status": "Optimal" if f5_score >= 16 else "Good" if f5_score >= 10 else "Needs Improvement",
        "description": f5_exp,
        "details": f5_exp,
        "deductions": f5_deductions,
        "deduction_points": 20 - f5_score
    })

    # Total Score
    raw_total = f1_score + f2_score + f3_score + f4_score + f5_score
    ats_score = max(0, min(100, int(round(raw_total))))
    rating_tier = _classify_tier(ats_score)

    suggestions = []
    if missing_skills:
        suggestions.append(f"Action: Prioritize learning or featuring projects in {', '.join(missing_skills[:3])}.")
    suggestions.append("Action: Tailor your experience bullet points using the exact verbs and keywords in the job posting.")
    if areas_for_improvement:
        for area in areas_for_improvement[:2]:
            suggestions.append(f"Action: {area}")

    candidate_profile = extract_candidate_profile(resume_text, resume_skills)

    return {
        "ats_score": ats_score,
        "evaluation_type": "job_specific",
        "score_label": "Job-Specific ATS Match Score",
        "score_description": "Calculated specifically against the provided target job description requirements, skill overlap, and role expectations.",
        "rating_tier": rating_tier,
        "scoring_version": "3.0-realistic-deterministic",
        "factors": factors,
        "factor_breakdown": factors,
        "strengths_summary": strengths_summary,
        "areas_for_improvement": areas_for_improvement,
        "suggestions": suggestions,
        "strengths": "\n".join([f"• {s}" for s in strengths_summary]) if strengths_summary else "General baseline technical alignment.",
        "weaknesses": "\n".join([f"• {w}" for w in areas_for_improvement]) if areas_for_improvement else "No critical skill gaps detected for this role.",
        "missing_skills": ", ".join(missing_skills[:5]) if missing_skills else "None detected",
        "matching_skills": matching_skills,
        "target_jd_provided": True,
        "candidate_profile": candidate_profile,
    }


# ===========================================================================
# 3. JOB DESCRIPTION ALIGNMENT (Dedicated Deep-Dive for JD section)
# ===========================================================================
def calculate_jd_alignment(resume_text, job_description, explicit_skills=None):
    """
    Deterministically evaluates alignment between Resume and Job Description (JD).
    Returns a mathematically consistent match score (0-100), matching skills, and missing skills.
    Guaranteed: identical resume + JD produces the exact same result every time.
    """
    resume_text = (resume_text or "").strip()
    job_description = (job_description or "").strip()

    if not resume_text:
        return {
            "available": False,
            "match_score": None,
            "message": "Resume text is missing. Upload a resume first.",
            "matching_skills": [],
            "missing_skills": [],
            "explicit_resume_skills": [],
            "inferred_skills": [],
            "relevant_experience": "No resume text available.",
            "strengths": "",
            "improvement_suggestions": [],
        }

    # If no JD is provided, clearly mark unavailable
    if not job_description:
        resume_skills = explicit_skills if explicit_skills is not None else extract_skills(resume_text)
        return {
            "available": False,
            "match_score": None,
            "message": "Job Description Match: Not Available – Add a Job Description to evaluate alignment.",
            "matching_skills": [],
            "missing_skills": [],
            "explicit_resume_skills": resume_skills,
            "inferred_skills": [],
            "relevant_experience": "Job Description matching requires providing a target JD.",
            "strengths": "Upload a target JD to evaluate specific keyword alignment.",
            "improvement_suggestions": ["Paste a target Job Description to identify matched competencies and skill gaps."],
        }

    # Extract skills from both documents deterministically
    resume_skills = explicit_skills if explicit_skills is not None else extract_skills(resume_text)
    jd_skills = extract_skills(job_description)

    resume_skills_lower = {s.lower(): s for s in resume_skills}
    matching_skills = []
    missing_skills = []

    for s in jd_skills:
        if s.lower() in resume_skills_lower:
            matching_skills.append(s)
        else:
            missing_skills.append(s)

    matching_skills.sort()
    missing_skills.sort()

    # Deterministic Skill Match Ratio
    if jd_skills:
        skill_ratio = len(matching_skills) / len(jd_skills)
    else:
        skill_ratio = 0.5

    # Token-level keyword overlap (excluding stopwords)
    def _get_clean_tokens(txt):
        words = re.findall(r"\b[A-Za-z]{3,}\b", txt.lower())
        stopwords = {
            "the", "and", "for", "with", "that", "this", "from", "have", "will",
            "are", "about", "your", "candidate", "role", "team", "experience",
            "skills", "work", "responsibilities", "requirements", "including",
            "looking", "should", "must", "years", "knowledge", "working", "strong"
        }
        return set(w for w in words if w not in stopwords)

    jd_tokens = _get_clean_tokens(job_description)
    resume_tokens = _get_clean_tokens(resume_text)

    token_overlap_ratio = (
        len(jd_tokens & resume_tokens) / len(jd_tokens)
        if jd_tokens else 0.5
    )

    # 70% skill match weight + 30% keyword vocabulary overlap weight
    raw_score = (skill_ratio * 0.70 + token_overlap_ratio * 0.30) * 100
    match_score = max(0, min(100, int(round(raw_score))))

    # Inferred competencies based on verified technical pairs
    inferred_competencies = []
    if any(s in resume_skills for s in ["React", "JavaScript", "HTML", "CSS", "TypeScript"]):
        inferred_competencies.append("Frontend Architecture")
    if any(s in resume_skills for s in ["Python", "Flask", "Django", "FastAPI", "Node.js", "Express.js", "Java", "Spring Boot"]):
        inferred_competencies.append("RESTful Backend Services")
    if any(s in resume_skills for s in ["SQL", "PostgreSQL", "MySQL", "MongoDB"]):
        inferred_competencies.append("Database Management & Querying")
    if any(s in resume_skills for s in ["Docker", "Kubernetes", "AWS", "CI/CD"]):
        inferred_competencies.append("Cloud & Containerization Deployment")

    # Dynamic suggestions based on missing skills
    suggestions = []
    if missing_skills:
        priority_missing = missing_skills[:2]
        suggestions.append(f"Target Skill Gap: Prioritize hands-on projects or certifications in {', '.join(priority_missing)}.")
    suggestions.append("Align your project bullet points to mirror key architectural terms mentioned in the job description.")
    suggestions.append("Highlight measurable business impact and scale metrics matching the target role expectations.")

    relevant_exp = (
        f"Candidate background evidences competencies in {', '.join(matching_skills[:3])} aligning with target job requirements."
        if matching_skills
        else "Candidate demonstrates general engineering fundamentals; specific JD requirements require closer alignment."
    )

    strengths_text = (
        f"Verified alignment across {len(matching_skills)} target skills: {', '.join(matching_skills[:3])}."
        if matching_skills
        else "General software engineering background present."
    )

    return {
        "available": True,
        "match_score": match_score,
        "matching_skills": matching_skills,
        "missing_skills": missing_skills,
        "explicit_resume_skills": resume_skills,
        "inferred_skills": inferred_competencies,
        "relevant_experience": relevant_exp,
        "strengths": strengths_text,
        "improvement_suggestions": suggestions,
    }
