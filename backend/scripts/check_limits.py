import os
from dotenv import load_dotenv

load_dotenv('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/.env')
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

test_models = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-safeguard-20b",
    "qwen/qwen3.8-27b",
    "allam-2-7b",
]

for m in test_models:
    try:
        r = client.chat.completions.create(
            model=m,
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10
        )
        print(f"Model {m}: SUCCESS")
    except Exception as e:
        print(f"Model {m}: {e}")
