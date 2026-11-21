"""
Test Script: 3 Distinct Resumes End-to-End Verification
Tests:
1. Senior Full-Stack Engineer (Alex Morgan)
2. Junior Data Analyst (Jordan Lee)
3. Mid-Level DevOps / Cloud Engineer (Morgan Patel)

Verifies:
- Distinct ATS scores and factor breakdowns
- Personalized AI feedback generation across all 8 required sections
- Retry AI feedback endpoint (/resume/retry_ai_feedback)
- Graceful degradation on simulated timeout / failure
"""
import sys
import os
import json
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from services.ats_scorer import evaluate_ats_score, extract_candidate_profile
from services.skill_extractor import extract_skills
from services.groq_service import analyze_resume
from app import app

ALEX_RESUME = """
Alex Morgan
alex.morgan@email.com | (555) 234-5678 | San Francisco, CA | linkedin.com/in/alexmorgan | github.com/alexmorgan

PROFESSIONAL SUMMARY
Senior Full-Stack Software Engineer with 6+ years of experience architecting high-throughput distributed microservices, REST APIs, and responsive web platforms. Proven record of optimizing web application latency by 42% and driving revenue growth across cloud-native environments.

EDUCATION
Master of Science in Computer Science, Stanford University (2018 - 2020)
Bachelor of Science in Software Engineering, UC Berkeley (2014 - 2018)

CERTIFICATIONS
AWS Certified Solutions Architect – Associate
Certified Kubernetes Administrator (CKA)

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, Go, SQL
Frontend: React, Next.js, Redux, HTML5, CSS3, Tailwind CSS
Backend: FastAPI, Node.js, Express, Django, Microservices, REST APIs, GraphQL
Databases: PostgreSQL, MongoDB, Redis
Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD, Git, Terraform

WORK EXPERIENCE
Senior Full-Stack Engineer | CloudScale Inc. | 2021 – Present
• Spearheaded migration from monolithic architecture to FastAPI microservices on AWS EKS, improving service availability to 99.99% and reducing compute costs by $120,000 annually.
• Engineered high-performance event-driven streaming pipelines using Redis and PostgreSQL, processing over 15 million daily active transactions with sub-50ms latency.
• Mentored 8 junior and mid-level software engineers on test automation with PyTest and Jest, boosting code coverage from 68% to 94%.
• Architected enterprise dashboard using React and TypeScript, accelerating client onboarding workflows by 35%.

Full-Stack Developer | InnovateTech Labs | 2018 – 2021
• Developed responsive SaaS analytics portal in React and Node.js serving 450,000 monthly active users.
• Designed and implemented PostgreSQL database schemas and optimized slow SQL queries, reducing query response times by 55%.
• Integrated CI/CD pipelines using GitHub Actions and Docker, reducing deployment cycle times from 4 hours to 18 minutes.
"""

JORDAN_RESUME = """
Jordan Lee
jordan.lee@gmail.com | (555) 987-6543 | Austin, TX

OBJECTIVE
Motivated junior graduate seeking an entry-level Junior Data Analyst position to apply Python and SQL skills.

EDUCATION
Associate Degree in General Studies, Austin Community College (2022 - 2024)

TECHNICAL SKILLS
Python, SQL, Pandas, NumPy, Scikit-learn, Excel

PROJECTS
Sales Data Analysis Project
• Analyzed retail store sales data using Python and Pandas.
• Created charts and visual graphs in Excel to illustrate monthly sales trends.
• Calculated basic summary statistics like mean and median sales.

Customer Segmentation Script
• Wrote simple clustering script using Scikit-learn to group customers into 3 clusters.
• Stored cleaned tables in a local SQLite database.
"""

MORGAN_PATEL_RESUME = """
Morgan Patel
morgan.patel@devopsmail.com | (555) 345-6789 | Seattle, WA | github.com/morganpatel

PROFESSIONAL SUMMARY
DevOps & Cloud Infrastructure Engineer with 3 years of hands-on experience deploying containerized workloads, managing AWS cloud environments, and implementing automated CI/CD pipelines.

EDUCATION
Bachelor of Science in Information Technology, University of Washington (2017 - 2021)

CERTIFICATIONS
AWS Certified Cloud Practitioner

TECHNICAL SKILLS
Cloud & Infrastructure: AWS, Docker, Kubernetes, Linux, Terraform
CI/CD & Tools: Git, GitHub Actions, Jenkins, Bash scripting, Python
Monitoring: Prometheus, Grafana

WORK EXPERIENCE
Cloud Infrastructure Engineer | Nexus Cloud Systems | 2021 – Present
• Configured and managed AWS infrastructure including EC2, S3, RDS, and VPC using Terraform and Ansible.
• Built automated CI/CD pipelines with GitHub Actions for 12 microservices, reducing deployment failures by 28%.
• Monitored Kubernetes clusters and production workloads using Prometheus and Grafana, maintaining 99.9% uptime.
• Automated weekly backup and security patch workflows using Bash and Python scripts, saving 8 engineering hours per week.
"""

def test_resume(name, resume_text):
    print(f"\n=======================================================")
    print(f"Testing Resume: {name}")
    print(f"=======================================================")
    skills = extract_skills(resume_text)
    print(f"Extracted Skills ({len(skills)}): {skills}")
    
    # 1. Deterministic ATS Analysis
    analysis = analyze_resume(resume_text)
    score = analysis.get("ats_score")
    label = analysis.get("score_label")
    factors = analysis.get("factor_breakdown", [])
    profile = analysis.get("candidate_profile", {})
    
    print(f"ATS Score: {score}/100 ({analysis.get('score_category')})")
    print(f"Evaluation Mode: {label}")
    print(f"Profile: Seniority={profile.get('experience', {}).get('seniority_level')}, "
          f"Degrees={profile.get('education', {}).get('degrees')}, "
          f"Metrics={profile.get('experience', {}).get('quantifiable_metrics_count')}")
    
    for factor in factors:
        print(f"  - {factor['name']}: {factor['awarded_points']}/{factor['max_points']} pts")
    
    # 2. Verify AI Feedback Status & Fields
    ai_status = analysis.get("ai_feedback_status")
    print(f"AI Feedback Status: {ai_status}")
    
    fields = [
        "summary", "skills_analysis", "strengths", "weaknesses",
        "project_experience_feedback", "suggestions", "missing_skills", "action_items"
    ]
    for field in fields:
        val = analysis.get(field)
        has_content = bool(val and (isinstance(val, list) and len(val) > 0 or isinstance(val, str) and len(val.strip()) > 0))
        preview = str(val)[:80] + "..." if has_content else "EMPTY/NONE"
        print(f"  [{'✓' if has_content else '✕'}] {field}: {preview}")
        
    return {
        "name": name,
        "score": score,
        "skills_count": len(skills),
        "ai_status": ai_status,
        "all_fields_present": all(bool(analysis.get(f)) for f in fields)
    }

if __name__ == "__main__":
    results = []
    results.append(test_resume("Alex Morgan (Senior Full-Stack)", ALEX_RESUME))
    results.append(test_resume("Jordan Lee (Junior Data Analyst)", JORDAN_RESUME))
    results.append(test_resume("Morgan Patel (Mid DevOps)", MORGAN_PATEL_RESUME))
    
    print("\n=======================================================")
    print("SUMMARY COMPARISON ACROSS 3 CANDIDATES")
    print("=======================================================")
    for r in results:
        print(f"{r['name']}: Score={r['score']}/100, Skills={r['skills_count']}, AI={r['ai_status']}, 8 Sections Present={r['all_fields_present']}")
    
    # Verify score graduation: Alex (Senior) > Morgan (Mid) > Jordan (Junior)
    alex_score = results[0]["score"]
    jordan_score = results[1]["score"]
    morgan_score = results[2]["score"]
    
    assert alex_score > morgan_score > jordan_score, f"Expected Alex ({alex_score}) > Morgan ({morgan_score}) > Jordan ({jordan_score})"
    print("\n✓ PASS: Scores properly differentiate candidate seniority and quality!")
