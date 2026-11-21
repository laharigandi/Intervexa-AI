import os
import sys
from dotenv import load_dotenv

load_dotenv()
from services.groq_service import _call_groq, _extract_json

print(f"Testing GROQ_MODEL={os.getenv('GROQ_MODEL')} with json_mode=True")

prompt = [
    {"role": "user", "content": "Generate 2 interview questions for a Python Developer. Return ONLY a JSON object with key 'questions' containing a list of objects with 'question' and 'difficulty'."}
]

try:
    res = _call_groq(prompt, json_mode=True, max_tokens=1024, context="test_json_mode")
    print("RAW RESPONSE:")
    print(res)
    parsed = _extract_json(res)
    print("PARSED JSON:")
    print(parsed)
except Exception as e:
    print(f"Error: {e}")
