import os
import sys
import time
import json
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(backend_dir, '.env'))
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

test_chunk = [
    {"q": "What is the difference between a process and a thread?", "a": "A process has isolated memory, threads share process memory."},
    {"q": "Explain ACID properties.", "a": "Atomicity, Consistency, Isolation, Durability for reliable transactions."},
    {"q": "What is an index in SQL?", "a": "A B-tree structure that accelerates data retrieval queries."},
    {"q": "What is sync vs async?", "a": "Sync blocks execution until done, async delegates and handles tasks concurrently."},
    {"q": "Explain RESTful API principles.", "a": "Stateless, client-server architecture using standard HTTP verbs."}
]

prompt = f"""Evaluate these 5 interview answers. Return JSON:
{{"evaluations": [
  {{
    "question": "string",
    "answer": "string",
    "technical_score": 8,
    "communication_score": 8,
    "feedback": "string",
    "strengths": "string",
    "mistakes": "string",
    "improved_answer": "string"
  }}
]}}

Q&A:
{json.dumps(test_chunk, indent=2)}"""

for model, max_tok in [("openai/gpt-oss-20b", 3000), ("qwen/qwen3.8-27b", 950)]:
    t0 = time.time()
    try:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=max_tok,
            temperature=0.2
        )
        dt = time.time() - t0
        msg = res.choices[0].message.content
        finish = res.choices[0].finish_reason
        parsed = json.loads(msg)
        items = parsed.get("evaluations", [])
        print(f"Model {model} (max_tokens={max_tok}): {dt:.2f}s | finish_reason={finish} | returned {len(items)} items")
    except Exception as e:
        print(f"Model {model} (max_tokens={max_tok}): ERROR {e}")
