import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app import app

client = app.test_client()

res = client.post("/resume/retry_ai_feedback", json={
    "resume_text": "Jordan Lee\nAustin, TX\nPython, SQL, Pandas\nProjects: Sales Data Analysis using Pandas",
    "job_description": "Junior Data Analyst with SQL and Python skills"
})

print(f"Status: {res.status_code}")
data = res.get_json()
print("Success:", data.get("success"))
print("AI Status:", data.get("analysis", {}).get("ai_feedback_status"))
print("Summary Preview:", data.get("analysis", {}).get("summary")[:60] if data.get("analysis", {}).get("summary") else "None")
assert res.status_code == 200
assert data.get("success") is True
print("RETRY ENDPOINT TEST PASSED!")
