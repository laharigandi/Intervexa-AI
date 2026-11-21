import os
import sys
import time
import json
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
model = "openai/gpt-oss-20b"

sample_5_qa = [
    ("What is the difference between a process and a thread?", "A process is an execution environment with private memory; a thread is a unit of execution within a process that shares memory."),
    ("Explain the ACID properties in database management systems.", "Atomicity means all or nothing. Consistency maintains schema rules. Isolation keeps concurrent transactions independent. Durability ensures committed data survives crashes."),
    ("What is an index in SQL and how does it work?", "An index is a B-tree data structure that speeds up read queries by avoiding full table scans, though it adds write overhead."),
    ("What is the difference between synchronous and asynchronous programming?", "Synchronous blocks execution until a task finishes. Asynchronous allows execution to continue and uses event loops or callbacks for completion."),
    ("Explain RESTful API design principles and HTTP methods.", "REST is stateless and uses standard HTTP methods: GET to read, POST to create, PUT to replace, and DELETE to remove resources.")
]

qa_text = ""
for idx, (q, a) in enumerate(sample_5_qa, 1):
    qa_text += f"\n[Item {idx}]\nQuestion: {q}\nCandidate Answer: {a}\n"

prompt = f"""You are an expert technical interviewer and mentor.
Evaluate each candidate answer against its question.
Return JSON with key "evaluations" containing exactly {len(sample_5_qa)} objects in order:
{{
  "evaluations": [
    {{
      "item": 1,
      "technical_score": 8,
      "communication_score": 8,
      "strengths": "1-2 concise sentences on what was well explained.",
      "mistakes": "1-2 concise sentences on missing details or edge cases.",
      "improved_answer": "2-3 concise sentences demonstrating refined answer.",
      "correct_answer": "2-3 concise sentences of ideal benchmark response.",
      "correct_concepts": ["concept 1", "concept 2"],
      "missing_concepts": ["concept 3"],
      "improvement_suggestions": ["1 actionable tip"],
      "key_takeaways": ["1 core takeaway"],
      "follow_up_questions": ["1 realistic followup question"]
    }}
  ]
}}

Items to Evaluate:
{qa_text}"""

t0 = time.time()
resp = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": prompt}],
    temperature=0.2,
    max_tokens=1500,
    response_format={"type": "json_object"}
)
elapsed = time.time() - t0
parsed = json.loads(resp.choices[0].message.content)
evals = parsed.get("evaluations", [])
print(f"5 Items evaluation time: {elapsed:.2f}s | Returned count: {len(evals)}")
for i, ev in enumerate(evals, 1):
    print(f"Item {i}: tech={ev.get('technical_score')}, comm={ev.get('communication_score')}, strengths={ev.get('strengths')[:50]}...")
