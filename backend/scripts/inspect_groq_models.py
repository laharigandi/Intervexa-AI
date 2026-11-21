import os
from dotenv import load_dotenv

load_dotenv('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/.env')
from groq import Groq

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
try:
    models = client.models.list()
    print("Available Groq models:")
    for m in sorted([m.id for m in models.data]):
        print(f" - {m}")
except Exception as e:
    print(f"Error listing models: {e}")
