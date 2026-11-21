import os
import sys
import json
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))
from app import app

with app.test_client() as client:
    res = client.post("/learning", json={
        "role": "Frontend Developer",
        "weak_skills": ["React Hooks & State", "System Design"]
    })
    print(f"Status: {res.status_code}")
    data = res.get_json()
    print(f"Success: {data.get('success')}")
    print(f"Topics: {len(data.get('topics', []))}")
    print(f"Resources: {len(data.get('resources', []))}")
    if data.get('resources'):
        print("Sample resource:", data['resources'][0])
