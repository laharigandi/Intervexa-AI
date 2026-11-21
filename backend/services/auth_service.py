import os
import sys
import sqlite3

try:
    from database import get_db_connection
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from database import get_db_connection

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


def _safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except Exception:
        pass


def verify_google_token(credential, clock_skew_seconds=None):
    """
    Verifies a Google ID token cryptographically using google-auth library.
    Returns (True, user_dict) or (False, error_message).
    Never prints or logs the raw token or secret values.
    Supports a bounded clock skew tolerance to handle minor time synchronization
    differences between Google's auth servers and the backend system clock.
    """
    if not credential or not isinstance(credential, str) or not credential.strip():
        return False, "Google credential token is missing or empty"

    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        return False, "Server configuration error: GOOGLE_CLIENT_ID is not configured"

    # Default to 60 seconds of bounded clock skew tolerance (configurable via GOOGLE_OAUTH_CLOCK_SKEW_SECONDS)
    # Bounded safely between 5 and 300 seconds to prevent accepting tokens from the distant future
    if clock_skew_seconds is None:
        try:
            clock_skew_seconds = int(os.getenv("GOOGLE_OAUTH_CLOCK_SKEW_SECONDS", "60"))
        except (ValueError, TypeError):
            clock_skew_seconds = 60
    clock_skew_seconds = max(5, min(clock_skew_seconds, 300))

    try:
        # Cryptographic signature and claim verification against Google's public certificates
        try:
            idinfo = id_token.verify_oauth2_token(
                credential.strip(),
                google_requests.Request(),
                client_id,
                clock_skew_in_seconds=clock_skew_seconds
            )
        except ValueError as val_err:
            # If rejected strictly because token was used too early (clock drift between client and Google)
            # and initial skew was below 120s, attempt a safe bounded check up to 120s skew
            if "Token used too early" in str(val_err) and clock_skew_seconds < 120:
                _safe_print(f"[AUTH TIMING] Token used too early with skew={clock_skew_seconds}s. Retrying with bounded leeway (120s)...")
                idinfo = id_token.verify_oauth2_token(
                    credential.strip(),
                    google_requests.Request(),
                    client_id,
                    clock_skew_in_seconds=120
                )
            else:
                raise val_err
        except TypeError:
            # Fallback for older google-auth signatures without clock_skew_in_seconds parameter
            idinfo = id_token.verify_oauth2_token(
                credential.strip(),
                google_requests.Request(),
                client_id
            )

        # 1. Strict issuer verification
        issuer = idinfo.get("iss", "")
        if issuer not in ["accounts.google.com", "https://accounts.google.com"]:
            _safe_print(f"[AUTH SECURITY] Google token rejected due to invalid issuer: {issuer}")
            return False, f"Invalid token issuer: {issuer}"

        # 2. Strict audience verification (already verified by id_token.verify_oauth2_token, double-check)
        aud = idinfo.get("aud", "")
        if aud != client_id:
            _safe_print(f"[AUTH SECURITY] Google token rejected due to audience mismatch.")
            return False, "Invalid token audience"

        # 3. Strict email verification
        if not idinfo.get("email_verified", False):
            _safe_print("[AUTH SECURITY] Google token rejected: email is not verified.")
            return False, "Google account email is not verified"

        email = idinfo.get("email")
        if not email:
            _safe_print("[AUTH SECURITY] Google token rejected: missing email claim.")
            return False, "No email address found in Google token claims"

        name = idinfo.get("name") or email.split("@")[0]

        user = google_login_or_register(name, email)
        return True, user

    except ValueError as e:
        err_msg = str(e)
        _safe_print(f"[AUTH ERROR] Google token validation failed: {err_msg}")
        if "Token used too early" in err_msg:
            return False, "Google token validation timing issue. Your system clock may be slightly out of sync. Please verify your system clock or try again."
        if "Token expired" in err_msg:
            return False, "Google credential token has expired. Please sign in again."
        if "wrong audience" in err_msg.lower() or "audience" in err_msg.lower():
            return False, "Google credential audience mismatch. Unrecognized client ID."
        return False, f"Invalid or expired Google credential: {err_msg}"
    except Exception as e:
        _safe_print(f"[AUTH ERROR] Google token verification error: {type(e).__name__}: {e}")
        return False, f"Google token verification failed: {type(e).__name__}"


def google_login_or_register(name, email):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (name, email, "")
        )
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

    conn.close()
    return {"id": user[0], "name": user[1], "email": user[2]}


def register_user(
    name,
    email,
    password
):

    conn = get_db_connection()

    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email,)
    )

    existing_user = cursor.fetchone()

    if existing_user:

        conn.close()

        return False, "Email already exists"

    hashed_password = (
        generate_password_hash(
            password
        )
    )

    cursor.execute(
        """
        INSERT INTO users
        (
            name,
            email,
            password
        )
        VALUES (?, ?, ?)
        """,
        (
            name,
            email,
            hashed_password
        )
    )

    conn.commit()

    conn.close()

    return True, "User registered successfully"


def login_user(
    email,
    password
):

    conn = get_db_connection()

    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email,)
    )

    user = cursor.fetchone()

    conn.close()

    if not user:

        return None

    stored_password = user[3]

    if check_password_hash(
        stored_password,
        password
    ):

        return {
            "id": user[0],
            "name": user[1],
            "email": user[2]
        }

    return None