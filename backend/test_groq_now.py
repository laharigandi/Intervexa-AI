import os
import sys
from dotenv import load_dotenv, find_dotenv

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure .env is loaded from the backend directory regardless of current working directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(backend_dir, ".env")
if os.path.exists(env_file):
    load_dotenv(dotenv_path=env_file, override=True)
else:
    load_dotenv(find_dotenv(), override=True)

api_key = os.getenv("GROQ_API_KEY", "").strip()
model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()

print("=" * 60)
print("             GROQ AI DIRECT CONNECTION TEST")
print("=" * 60)
print(f"[INFO] Backend Directory: {backend_dir}")
print(f"[INFO] Target Model     : {model}")

# 1. Verify GROQ_API_KEY exists
if not api_key:
    print("\n[FAIL] 1. GROQ_API_KEY: NOT FOUND in environment or backend/.env.")
    print("       Please add GROQ_API_KEY=your_key in backend/.env")
    print("=" * 60)
    sys.exit(1)

masked_key = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "***"
print(f"[PASS] 1. GROQ_API_KEY  : Present ({masked_key})")

# 2. Check GROQ SDK installation
try:
    from groq import (
        Groq,
        AuthenticationError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
        APITimeoutError,
        APIConnectionError,
        BadRequestError,
        APIStatusError,
    )
    import groq
    print(f"[PASS] 2. GROQ SDK      : Installed (Version: {getattr(groq, '__version__', 'unknown')})")
except ImportError as e:
    print(f"\n[FAIL] 2. GROQ SDK      : Import Error ({e})")
    print("       Run: pip install -U groq")
    print("=" * 60)
    sys.exit(1)

# 3. Initialize Groq client
try:
    client = Groq(api_key=api_key)
    print("[PASS] 3. GROQ CLIENT   : Initialized successfully")
except Exception as e:
    print(f"\n[FAIL] 3. GROQ CLIENT   : Initialization failed: {e}")
    print("=" * 60)
    sys.exit(1)

# 4. Test Chat Completion Call
print(f"\n[INFO] Sending test prompt to model '{model}'...")
try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": "Respond with exactly 'Groq connection successful!' and nothing else."
            }
        ],
    )
    reply = (response.choices[0].message.content or "").strip()
    print("[PASS] 4. AI RESPONSE   : SUCCESS")
    print(f"       AI Message: \"{reply}\"")
    print("\n" + "=" * 60)
    print(" >>> RESULT: Groq AI service is ONLINE and ready! <<<")
    print("=" * 60)

except AuthenticationError as e:
    print(f"\n[FAIL] 4. AUTHENTICATION ERROR (401)")
    print(f"       Details : Invalid or revoked API key.")
    print(f"       Action  : Check/replace GROQ_API_KEY in backend/.env with a valid key from https://console.groq.com/keys")
    print(f"       Raw Msg : {getattr(e, 'message', str(e))}")
    print("=" * 60)

except NotFoundError as e:
    print(f"\n[FAIL] 4. MODEL NOT FOUND (404)")
    print(f"       Details : The model '{model}' was not found or is not accessible with this account.")
    print(f"       Action  : Check model name in backend/.env or verify available models at https://console.groq.com/docs/models")
    print(f"       Raw Msg : {getattr(e, 'message', str(e))}")
    print("=" * 60)

except PermissionDeniedError as e:
    print(f"\n[FAIL] 4. PERMISSION DENIED (403)")
    print(f"       Details : Access forbidden for model '{model}'.")
    print(f"       Raw Msg : {getattr(e, 'message', str(e))}")
    print("=" * 60)

except RateLimitError as e:
    print(f"\n[FAIL] 4. RATE LIMIT EXCEEDED (429)")
    print(f"       Details : Requests quota exceeded.")
    print(f"       Raw Msg : {getattr(e, 'message', str(e))}")
    print("=" * 60)

except APITimeoutError as e:
    print(f"\n[FAIL] 4. REQUEST TIMEOUT")
    print(f"       Details : Request to Groq API timed out.")
    print("=" * 60)

except APIConnectionError as e:
    print(f"\n[FAIL] 4. CONNECTION ERROR")
    print(f"       Details : Could not connect to Groq API servers. Check internet connection.")
    print("=" * 60)

except BadRequestError as e:
    print(f"\n[FAIL] 4. BAD REQUEST (400)")
    print(f"       Details : Malformed request payload.")
    print(f"       Raw Msg : {getattr(e, 'message', str(e))}")
    print("=" * 60)

except Exception as e:
    print(f"\n[FAIL] 4. UNEXPECTED ERROR ({type(e).__name__})")
    print(f"       Details : {e}")
    print("=" * 60)
