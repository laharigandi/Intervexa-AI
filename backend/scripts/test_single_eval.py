import os
import sys
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

prompt = """Evaluate candidate answer:
Q: What is a process vs thread?
A: Process has isolated memory; thread shares memory within process.
Return JSON:
{"technical_score": 9, "communication_score": 9, "strengths": "Clear definition.", "mistakes": "None.", "improved_answer": "A process has isolated memory...", "correct_answer": "Process isolates memory..."}"""

print("Testing qwen/qwen3.8-27b with max_tokens=800:")
try:
    r = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
        response_format={"type": "json_object"}
    )
    print("qwen SUCCESS:", r.choices[0].message.content[:100])
except Exception as e:
    print("qwen ERROR:", e)

print("\nTesting openai/gpt-oss-20b with max_tokens=800:")
try:
    r2 = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
        response_format={"type": "json_object"}
    )
    print("gpt-oss-20b SUCCESS:", r2.choices[0].message.content[:100])
    print("reasoning/finish_reason:", getattr(r2.choices[0], "finish_reason", None))
except Exception as e:
    print("gpt-oss-20b ERROR:", e)
