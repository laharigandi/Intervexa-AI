import os
import time
import json
from dotenv import load_dotenv

load_dotenv('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/.env')
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

models_to_test = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

prompt = """Evaluate this interview answer:
Question: What is the difference between a process and a thread in an operating system?
Candidate Answer: A process is an independent executing program with its own memory space, while a thread is a lightweight unit of execution within a process that shares memory with other threads in that process. Context switching between threads is faster than between processes.

Return JSON:
{
  "technical_score": 9,
  "communication_score": 9,
  "strengths": "Clear definition of memory isolation and thread sharing.",
  "mistakes": "Could mention IPC vs synchronization.",
  "improved_answer": "Concise improved answer.",
  "correct_answer": "Ideal benchmark answer."
}"""

for m in models_to_test:
    t0 = time.time()
    try:
        resp = client.chat.completions.create(
            model=m,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=500,
            response_format={"type": "json_object"}
        )
        elapsed = time.time() - t0
        content = resp.choices[0].message.content
        print(f"\n--- Model: {m} ---")
        print(f"Time: {elapsed:.2f}s")
        print(f"Output snippet: {content[:150]}...")
    except Exception as e:
        elapsed = time.time() - t0
        print(f"\n--- Model: {m} --- FAILED in {elapsed:.2f}s: {e}")
