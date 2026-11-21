import sys
sys.path.insert(0, "D:/Smart-Interview-Coach/Smart-Interview-Coach/backend")
from services.ats_scorer import evaluate_ats_score, calculate_jd_alignment

# 1. Weak Resume
weak_resume = """
John Doe
Email: john@gmail.com
Technical Skills: Python, HTML
Experience:
Worked on basic web development tasks and helped fix bugs.
Education:
College
"""

# 2. Average Resume
average_resume = """
Jordan Lee - Junior Data Analyst
Email: jordan.lee@example.com | Phone: 555-0288 | Location: Chicago, IL
Technical Skills: Python, SQL, Pandas, NumPy, Scikit-learn
Work Experience:
Data Analyst Intern - Analytics Lab (2022 - 2023)
- Analyzed customer datasets using SQL and Pandas to generate weekly reports.
- Cleaned and preprocessed unstructured sales data for marketing team.
Education:
Bachelor of Science in Mathematics from City College (2018 - 2022)
Projects:
Customer Churn Prediction - Built classification models using Scikit-learn and Pandas.
"""

# 3. Strong Resume
strong_resume = """
Alex Morgan - Senior Full Stack Engineer
Email: alex.morgan@example.com | Phone: 555-0199 | Location: San Francisco, CA
LinkedIn: linkedin.com/in/alexmorgan | GitHub: github.com/alexmorgan
Professional Summary:
Dedicated software architect with 6 years experience building distributed, fault-tolerant web systems and cloud infrastructure.
Technical Skills:
Languages: Python, TypeScript, JavaScript, SQL, HTML, CSS
Frameworks: React, Node.js, FastAPI, Next.js, Redux
Databases & Cloud: PostgreSQL, Redis, Docker, AWS, CI/CD, Git
Core: Microservices, System Design, REST API, GraphQL
Work Experience:
Lead Software Engineer - CloudScale Corp (2020 - Present)
- Architected microservices with Python and FastAPI, increasing throughput by 35% and saving $40,000 annually.
- Implemented responsive client dashboards using React and TypeScript for 100,000 active users.
- Reduced deployment latency by 50% using Docker containers and automated CI/CD pipelines.
Senior Software Engineer - DataFlow Inc (2018 - 2020)
- Engineered high-throughput data ingestion pipeline handling 10M daily events with Redis and PostgreSQL.
- Mentored a team of 4 junior developers and led weekly agile sprint reviews.
Education:
B.Tech in Computer Science from State University (2014 - 2018)
Projects:
Enterprise Task Orchestrator - Built scalable distributed task runner using Python, Redis, and PostgreSQL with 99.9% uptime.
"""

# 4. Target JD: Senior DevOps Engineer
devops_jd = """
We are hiring a Senior DevOps Engineer.
Required Skills: Kubernetes, Terraform, Docker, AWS, CI/CD, Linux, Python.
Responsibilities:
- Build and maintain multi-region Kubernetes clusters.
- Automate cloud infrastructure using Terraform and CI/CD pipelines.
- Ensure 99.99% system availability and security compliance.
Requirements:
- Bachelor's degree in Computer Science or related field.
- 5+ years of DevOps/SRE experience.
"""

# 5. Unrelated Resume: Finance / Accounting
unrelated_resume = """
Jane Smith - Certified Public Accountant (CPA)
Email: jane.smith@finance.com | Phone: 555-9876 | Location: New York, NY
LinkedIn: linkedin.com/in/janesmithcpa
Professional Summary:
Detail-oriented accountant with 5 years experience in financial auditing, GAAP compliance, and corporate tax reporting.
Core Skills:
Financial Modeling, QuickBooks, GAAP, Corporate Tax, Excel, SAP, Auditing, Accounts Payable
Work Experience:
Senior Accountant - FinCorp LLC (2020 - Present)
- Managed quarterly financial audits across 12 business units, reducing accounting discrepancies by 20%.
- Streamlined accounts payable processing, saving $60,000 in late fees and operational costs.
Education:
Bachelor of Business Administration in Accounting from Fordham University (2015 - 2019)
Certifications:
Certified Public Accountant (CPA) - New York State Board
"""

print("===============================================================")
print("  ATS SCORING ENGINE EVALUATION ACROSS MULTIPLE RESUMES")
print("===============================================================\n")

res_weak = evaluate_ats_score(weak_resume)
print(f"1. WEAK RESUME: Score = {res_weak['ats_score']} / 100 ({res_weak['rating_tier']})")
print(f"   Label: {res_weak['score_label']}")
for f in res_weak['factors']:
    print(f"   - {f['name']}: {f['score']}/{f['max_score']} pts | Deductions: {len(f['deductions'])}")
    for d in f['deductions']:
        print(f"       * {d}")

print()
res_avg = evaluate_ats_score(average_resume)
print(f"2. AVERAGE RESUME: Score = {res_avg['ats_score']} / 100 ({res_avg['rating_tier']})")
print(f"   Label: {res_avg['score_label']}")
for f in res_avg['factors']:
    print(f"   - {f['name']}: {f['score']}/{f['max_score']} pts | Deductions: {len(f['deductions'])}")
    for d in f['deductions']:
        print(f"       * {d}")

print()
res_strong = evaluate_ats_score(strong_resume)
print(f"3. STRONG RESUME: Score = {res_strong['ats_score']} / 100 ({res_strong['rating_tier']})")
print(f"   Label: {res_strong['score_label']}")
for f in res_strong['factors']:
    print(f"   - {f['name']}: {f['score']}/{f['max_score']} pts | Deductions: {len(f['deductions'])}")
    for d in f['deductions']:
        print(f"       * {d}")

print("\n---------------------------------------------------------------")
print("  JOB-SPECIFIC ATS EVALUATION AGAINST DEVOPS JD")
print("---------------------------------------------------------------")

res_strong_devops = evaluate_ats_score(strong_resume, job_description=devops_jd)
print(f"3b. STRONG RESUME vs DEVOPS JD: Match Score = {res_strong_devops['ats_score']} / 100 ({res_strong_devops['rating_tier']})")
print(f"    Label: {res_strong_devops['score_label']}")
for f in res_strong_devops['factors']:
    print(f"    - {f['name']}: {f['score']}/{f['max_score']} pts | Deductions: {len(f['deductions'])}")
    for d in f['deductions']:
        print(f"        * {d}")

print()
res_unrelated_devops = evaluate_ats_score(unrelated_resume, job_description=devops_jd)
print(f"4. UNRELATED RESUME (Accountant) vs DEVOPS JD: Match Score = {res_unrelated_devops['ats_score']} / 100 ({res_unrelated_devops['rating_tier']})")
print(f"   Label: {res_unrelated_devops['score_label']}")
for f in res_unrelated_devops['factors']:
    print(f"   - {f['name']}: {f['score']}/{f['max_score']} pts | Deductions: {len(f['deductions'])}")
    for d in f['deductions']:
        print(f"       * {d}")

print("\nJD Alignment Deep-Dive for Unrelated:")
jd_unrelated = calculate_jd_alignment(unrelated_resume, devops_jd)
print(f"   Match Score: {jd_unrelated['match_score']}%")
print(f"   Matching Skills: {jd_unrelated['matching_skills']}")
print(f"   Missing Skills: {jd_unrelated['missing_skills']}")
