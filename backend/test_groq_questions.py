from services.groq_service import generate_questions

skills = [
    "Python",
    "Machine Learning",
    "Flask"
]

questions = generate_questions(
    role="AI/ML Engineer",
    skills=skills,
    resume_text="Hands-on experience with Python, Machine Learning models and Flask REST APIs."
)

print("\n--- GENERATED QUESTIONS ---")
print(questions)