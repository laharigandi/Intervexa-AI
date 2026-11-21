import os
import sys
from dotenv import load_dotenv

load_dotenv()
from services.groq_service import _call_groq, _extract_json

print(f"Testing GROQ_MODEL={os.getenv('GROQ_MODEL')}")

prompt = [
    {"role": "user", "content": "Generate 2 interview questions for a Python Developer. Return ONLY a JSON array with objects containing 'question' and 'difficulty'."}
]

try:
    res = _call_groq(prompt, json_mode=False, max_tokens=1024, context="test")
    print("RAW RESPONSE:")
    print(res)
    parsed = _extract_json(res)
    print("PARSED JSON:")
    print(parsed)
except Exception as e:
    print(f"Error: {e}")
