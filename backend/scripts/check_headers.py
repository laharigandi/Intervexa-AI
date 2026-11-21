import os
import requests
from dotenv import load_dotenv

load_dotenv('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/.env')
api_key = os.getenv('GROQ_API_KEY')

url = "https://api.groq.com/openai/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

for m in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
    data = {
        "model": m,
        "messages": [{"role": "user", "content": "hello"}],
        "max_tokens": 10
    }
    resp = requests.post(url, headers=headers, json=data)
    print(f"\nModel: {m}")
    for k, v in resp.headers.items():
        if "ratelimit" in k.lower():
            print(f"  {k}: {v}")
