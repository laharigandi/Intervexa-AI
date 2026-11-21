from services.groq_service import evaluate_interview

questions = [
    "What is supervised learning?"
]

answers = [
    "Supervised learning is a type of machine learning where models are trained using labeled datasets."
]

results = evaluate_interview(
    questions,
    answers
)

print("\n--- EVALUATION RESULTS ---")
print(results)