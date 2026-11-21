import os
import sys
from dotenv import load_dotenv, find_dotenv
from groq import Groq

backend_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(backend_dir, ".env")
if os.path.exists(env_file):
    load_dotenv(dotenv_path=env_file, override=True)
else:
    load_dotenv(find_dotenv(), override=True)

api_key = os.getenv("GROQ_API_KEY")
model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

print("=" * 50)
print("       GROQ CONNECTION & MODEL TEST")
print("=" * 50)

# 1. Verify GROQ_API_KEY exists
if not api_key or not api_key.strip():
    print("[FAIL] 1. GROQ_API_KEY: MISSING from environment (.env).")
    print("       Please set GROQ_API_KEY=your_key in backend/.env")
    sys.exit(1)
else:
    # Safely display masked key indicator without exposing the key
    masked = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "***"
    print(f"[PASS] 1. GROQ_API_KEY: PRESENT (Format: {masked})")

# 2. Verify GROQ_MODEL is loaded
print(f"[PASS] 2. GROQ_MODEL  : {model}")

# 3. Initialize Groq client
try:
    client = Groq(api_key=api_key)
    print("[PASS] 3. GROQ CLIENT : Initialized successfully.")
except Exception as e:
    print(f"[FAIL] 3. GROQ CLIENT : Failed to initialize ({e})")
    sys.exit(1)

# 4. Generate test response with selected model
print(f"\nSending test prompt to model '{model}'...")
try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": "Respond with 'Groq connection successful!' in one short sentence."
            }
        ]
    )
    result_text = response.choices[0].message.content.strip()
    print("[PASS] 4. AI RESPONSE : SUCCESS")
    print(f"       Response: \"{result_text}\"")
    print("\n" + "=" * 50)
    print("  RESULT: Groq AI service is ONLINE and ready!")
    print("=" * 50)
except Exception as e:
    print(f"[FAIL] 4. AI RESPONSE : FAILED")
    print(f"       Error details: {e}")
    print("\n" + "=" * 50)
    print("  DIAGNOSTIC HINT:")
    err_str = str(e).lower()
    if "invalid_api_key" in err_str or "401" in err_str:
        print("  - Your GROQ_API_KEY is invalid, expired, or revoked.")
        print("    Get a fresh API key from https://console.groq.com/keys and update backend/.env")
    elif "model_not_found" in err_str or "404" in err_str:
        print(f"  - The model '{model}' was not found or your tier does not have access.")
        print("    Verify supported models at https://console.groq.com/docs/models")
    elif "429" in err_str or "rate_limit" in err_str:
        print("  - Rate limit reached. Wait a moment or upgrade tier.")
    else:
        print(f"  - Check console error above.")
    print("=" * 50)