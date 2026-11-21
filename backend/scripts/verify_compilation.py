import py_compile
import sys

for path in [
    'd:/Smart-Interview-Coach/Smart-Interview-Coach/backend/app.py',
    'd:/Smart-Interview-Coach/Smart-Interview-Coach/backend/services/groq_service.py',
    'd:/Smart-Interview-Coach/Smart-Interview-Coach/backend/services/answer_verification_service.py',
]:
    try:
        py_compile.compile(path, doraise=True)
        print(f"PASS: {path}")
    except Exception as e:
        print(f"FAIL: {path} - {e}")
        sys.exit(1)
