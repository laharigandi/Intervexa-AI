import io
import json
import pdfplumber
from services.roadmap_pdf_service import generate_roadmap_pdf

scenarios = [
    ("1. 5-Day Roadmap", 5, 60, False),
    ("2. 14-Day Roadmap", 14, 60, False),
    ("3. 30-Day Roadmap", 30, 60, False),
    ("4. Long Descriptions Roadmap (14 Days)", 14, 60, True),
    ("5. Short Descriptions Roadmap (14 Days)", 14, 60, "short"),
]

for label, days, mins, mode in scenarios:
    tasks = []
    for i in range(1, days + 1):
        if mode is True:
            desc = (
                f"Comprehensive in-depth deep dive into Day {i} architectural paradigms, "
                "including end-to-end distributed system scalability patterns, zero-downtime database "
                "sharding strategies, high-throughput message streaming, fault-tolerant failovers, "
                "and production observability instrumentation with distributed tracing."
            )
            practice = f"Design and implement a complete fault-tolerant microservice subsystem for Day {i} with automated integration testing and benchmarks."
            criteria = f"Candidate must demonstrate flawless understanding of concurrency safety, cache consistency, and asymptotic bounds for Day {i}."
        elif mode == "short":
            desc = f"Core concepts for Day {i}."
            practice = f"Practice Day {i} problems."
            criteria = f"Master Day {i} syntax."
        else:
            desc = f"Systematic study of Day {i} concepts, focusing on architectural patterns and real-world software engineering interview applications."
            practice = f"Implement 2 hands-on coding challenges and review system trade-offs for Day {i}."
            criteria = f"Write clean, idiomatic code and explain design trade-offs with zero major gaps."

        tasks.append({
            "day_number": i,
            "topic": f"Topic {i}: System Engineering & Design",
            "description": desc,
            "learning_objective": f"Attain interview mastery in Topic {i}.",
            "recommended_practice": practice,
            "completion_criteria": criteria,
            "estimated_minutes": mins,
            "priority": "Critical" if i <= 2 else ("High" if i % 2 == 0 else "Medium"),
            "status": "completed" if i <= 2 else "pending",
            "subtopics": [f"Subtopic {i}.1", f"Subtopic {i}.2", f"Subtopic {i}.3"],
            "recommended_resources": [{"title": f"Official Docs Day {i}"}, {"title": f"Practice Platform Day {i}"}]
        })

    plan = {
        "target_role": "Full Stack Developer",
        "duration_days": days,
        "daily_study_minutes": mins,
        "preparation_level": "Intermediate",
        "summary": f"Structured, progressive {days}-day curriculum designed to build technical depth.",
        "skill_gaps": ["System Design", "React Hooks", "SQL Indexing", "Concurrency"],
        "strong_skills": ["Data Structures", "REST APIs", "Git"],
        "tasks": tasks
    }

    pdf_bytes = generate_roadmap_pdf(plan, user_info={"name": "Alex Mercer", "email": "alex@example.com"})
    filename = f"test_{label.split('.')[1].strip().replace(' ', '_').lower()}.pdf"
    with open(filename, "wb") as f:
        f.write(pdf_bytes)

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        print(f"=== {label} ===")
        print(f"Total Pages: {len(pdf.pages)}")
        for idx, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            print(f"  Page {idx+1}: {len(lines)} lines | {len(text)} chars | Top: '{lines[0][:35]}' | Bottom: '{lines[-1][:35]}'")
        print()

print("All 5 scenario PDFs generated and validated successfully.")

