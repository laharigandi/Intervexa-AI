import os
import sys
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(backend_dir, '.env'))
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

for m in ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]:
    try:
        r = client.chat.completions.create(
            model=m,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=2200
        )
        print(f"Model {m}: SUCCESS with max_tokens=2200")
    except Exception as e:
        print(f"Model {m}: {e}")
