import sys
import os
import unittest

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.ats_scorer import evaluate_ats_score
from services.skill_extractor import extract_skills
from services.groq_service import analyze_resume

# Resume 1: Strong Technical Skills & Rich Work Experience
STRONG_RESUME = """
Alex Morgan
alex.morgan@email.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/alexmorgan | github.com/alexmorgan

PROFESSIONAL SUMMARY
Senior Full-Stack Software Engineer with 6+ years of experience architecting high-scale distributed systems, microservices, and modern web applications. Proven track record leading technical teams and optimizing cloud infrastructure.

EDUCATION
Master of Science in Computer Science, Stanford University (2016 – 2018)
Bachelor of Science in Computer Engineering, UC Berkeley (2012 – 2016)

CERTIFICATIONS
AWS Certified Solutions Architect – Associate

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, Go, SQL, HTML, CSS
Frameworks: React, Next.js, FastAPI, Django, Node.js, Redux, Tailwind CSS
Databases: PostgreSQL, MongoDB, Redis
DevOps & Cloud: AWS, Docker, Kubernetes, Terraform, CI/CD, Git, Linux
Testing & Architecture: Unit Testing, Microservices, REST API, GraphQL

WORK EXPERIENCE
Senior Full-Stack Engineer | CloudScale Inc. | Jan 2021 – Present
• Architected and deployed scalable microservices in Python and TypeScript, handling over 10M daily API requests with 99.99% uptime.
• Reduced cloud infrastructure costs by 32% ($45,000 annually) by containerizing workloads using Docker and Kubernetes on AWS.
• Spearheaded migration from legacy monolith to Next.js and FastAPI, improving frontend page load performance by 45%.
• Mentored a team of 5 junior and mid-level software engineers, conducting rigorous code reviews and establishing automated CI/CD pipelines.

Software Engineer | FinTech Systems | Jun 2018 – Dec 2020
• Engineered real-time fraud detection pipeline using Python, PostgreSQL, and Redis, decreasing unauthorized transactions by 24%.
• Developed responsive client dashboards with React and Redux, serving over 150,000 active financial users.
• Optimized database queries and index strategies in PostgreSQL, cutting median query latency by 60%.

PROJECTS
OpenSource Distributed Task Queue | github.com/alexmorgan/dist-queue
• Built a fault-tolerant distributed job runner in Go and Redis with automatic worker reassignment and exponential backoff retry.
• Gained 1,200+ GitHub stars and 180 community forks.
"""

# Resume 2: Limited Skills & Junior Work Experience
LIMITED_RESUME = """
Jordan Lee
jordan.lee@example.com | (555) 987-6543 | Austin, TX

SUMMARY
Junior Data Analyst and aspiring software developer with beginner knowledge in Python and data visualization.

EDUCATION
Associate Degree in Information Technology, Austin Community College (2020)

SKILLS
Python, SQL, SQLite, Pandas, NumPy, Scikit-learn

WORK EXPERIENCE
Data Entry Clerk | Retail Solutions | 2021 – 2022
• Entered product inventory records into Excel sheets.
• Assisted team with monthly reporting.

PROJECTS
Customer Segmentation Script
• Wrote simple clustering script using Scikit-learn to group customers into 3 clusters.
• Stored cleaned tables in a local SQLite database.
"""

# Resume 3: Incomplete Sections (Missing Standard Headers, Contact Links, Experience Header)
INCOMPLETE_SECTIONS_RESUME = """
Casey Taylor

Developer who worked on web apps and basic programming tasks.
Knows HTML, CSS, JavaScript, React.

Some past work:
Worked at local shop doing website updates in 2022.
Created a small web page for product catalog.

Finished school in 2019 studying math.
"""


class TestAtsScoringFactors(unittest.TestCase):
    REQUIRED_FACTORS = [
        "Technical Skills & Keywords",
        "Experience & Quantifiable Impact",
        "Section Completeness & Structure",
        "Education & Qualifications",
        "Formatting & Readability",
    ]

    def test_strong_resume_factor_breakdown(self):
        """Verify strong resume produces high factor scores, sum equals ats_score, and all fields exist."""
        analysis = analyze_resume(STRONG_RESUME)
        ats_score = analysis.get("ats_score")
        factors = analysis.get("factors", [])
        breakdown = analysis.get("factor_breakdown", [])

        self.assertIsNotNone(ats_score)
        self.assertGreaterEqual(ats_score, 80, f"Strong resume score should be >= 80, got {ats_score}")
        self.assertEqual(len(factors), 5, "Must have exactly 5 factors")
        self.assertEqual(len(breakdown), 5, "factor_breakdown must also have 5 factors")

        sum_awarded = 0
        factor_names = []
        for factor in factors:
            name = factor.get("name")
            factor_names.append(name)
            awarded = factor.get("awarded_points")
            score = factor.get("score")
            max_pts = factor.get("max_points")
            max_sc = factor.get("max_score")
            desc = factor.get("description")
            details = factor.get("details")

            self.assertEqual(awarded, score, f"awarded_points ({awarded}) must equal score ({score})")
            self.assertEqual(max_pts, 20, f"max_points must be 20, got {max_pts}")
            self.assertEqual(max_sc, 20, f"max_score must be 20, got {max_sc}")
            self.assertGreaterEqual(awarded, 0)
            self.assertLessEqual(awarded, 20)
            self.assertTrue(bool(desc and desc.strip()), f"Factor '{name}' must have a non-empty description")
            self.assertEqual(desc, details, "description and details should be aligned")

            sum_awarded += awarded

        self.assertEqual(sum_awarded, ats_score, f"Sum of factors ({sum_awarded}) must match ats_score ({ats_score})")
        for req_name in self.REQUIRED_FACTORS:
            self.assertIn(req_name, factor_names, f"Factor '{req_name}' must be present")

    def test_limited_resume_factor_breakdown(self):
        """Verify limited resume has lower factor scores, but still valid and sums to overall score."""
        analysis = analyze_resume(LIMITED_RESUME)
        ats_score = analysis.get("ats_score")
        factors = analysis.get("factors", [])

        self.assertIsNotNone(ats_score)
        self.assertLess(ats_score, 70, f"Limited resume score should be < 70, got {ats_score}")
        self.assertGreater(ats_score, 30, f"Limited resume score should be > 30, got {ats_score}")

        sum_awarded = sum(f["awarded_points"] for f in factors)
        self.assertEqual(sum_awarded, ats_score, f"Sum of factors ({sum_awarded}) must match ats_score ({ats_score})")

        # Specific check: Technical Skills should be lower than strong resume
        strong_eval = evaluate_ats_score(STRONG_RESUME)
        strong_skills_f = next(f for f in strong_eval["factors"] if f["name"] == "Technical Skills & Keywords")
        limited_skills_f = next(f for f in factors if f["name"] == "Technical Skills & Keywords")
        self.assertGreater(strong_skills_f["awarded_points"], limited_skills_f["awarded_points"])

    def test_incomplete_sections_factor_breakdown(self):
        """Verify incomplete resume loses points heavily on Section Completeness & Education."""
        analysis = analyze_resume(INCOMPLETE_SECTIONS_RESUME)
        ats_score = analysis.get("ats_score")
        factors = analysis.get("factors", [])

        self.assertIsNotNone(ats_score)
        self.assertLess(ats_score, 50, f"Incomplete resume should score < 50, got {ats_score}")

        sum_awarded = sum(f["awarded_points"] for f in factors)
        self.assertEqual(sum_awarded, ats_score)

        # Factor 3: Section Completeness & Structure should be penalized
        sec_f = next(f for f in factors if f["name"] == "Section Completeness & Structure")
        self.assertLessEqual(sec_f["awarded_points"], 8, "Section Completeness should be heavily penalized for missing headers")

        # Factor 4: Education & Qualifications should also be low
        edu_f = next(f for f in factors if f["name"] == "Education & Qualifications")
        self.assertLessEqual(edu_f["awarded_points"], 6, "Education should be penalized when no clear degree title is stated")

    def test_factor_scores_differentiation(self):
        """Verify distinct resumes produce proper score differences across every factor."""
        eval_strong = evaluate_ats_score(STRONG_RESUME)
        eval_limited = evaluate_ats_score(LIMITED_RESUME)
        eval_incomplete = evaluate_ats_score(INCOMPLETE_SECTIONS_RESUME)

        score_strong = eval_strong["ats_score"]
        score_limited = eval_limited["ats_score"]
        score_incomplete = eval_incomplete["ats_score"]

        self.assertGreater(score_strong, score_limited, f"Strong ({score_strong}) must outscore Limited ({score_limited})")
        self.assertGreater(score_limited, score_incomplete, f"Limited ({score_limited}) must outscore Incomplete ({score_incomplete})")

        # All 3 resumes must sum to their exact ats_score
        for name, ev in [("Strong", eval_strong), ("Limited", eval_limited), ("Incomplete", eval_incomplete)]:
            f_sum = sum(f["awarded_points"] for f in ev["factors"])
            self.assertEqual(f_sum, ev["ats_score"], f"{name} sum ({f_sum}) != ats_score ({ev['ats_score']})")

    def test_empty_resume_shows_not_evaluated(self):
        """Verify empty resume returns factors with status 'not_evaluated' and not_evaluated True."""
        eval_empty = evaluate_ats_score("")
        self.assertEqual(eval_empty["ats_score"], 0)
        factors = eval_empty.get("factors", [])
        self.assertEqual(len(factors), 5)
        for f in factors:
            self.assertEqual(f["status"], "not_evaluated")
            self.assertTrue(f["not_evaluated"])
            self.assertIn("Not evaluated", f["description"])


if __name__ == "__main__":
    unittest.main()
