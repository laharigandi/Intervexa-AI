import os
import sys
import json
import sqlite3
import traceback

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
    decode_token,
    verify_jwt_in_request,
)
from dotenv import load_dotenv, find_dotenv

_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(find_dotenv(), override=True)

import uuid
import time
import hashlib
from threading import Lock
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

from services.pdf_service import generate_pdf
from services.roadmap_pdf_service import generate_roadmap_pdf
from services.resume_parser import (
    extract_text_from_pdf,
    PasswordProtectedPDFError,
    ScannedPDFError,
    CorruptPDFError,
)
from services.skill_extractor import extract_skills
from services.ats_scorer import compute_resume_hash, evaluate_ats_score, calculate_jd_alignment
from services.groq_service import (
    generate_questions,
    evaluate_interview,
    generate_overall_summary,
    analyze_resume,
    analyze_jd_match,
    generate_learning_content,
    generate_learning_roadmap,
    _build_fallback_roadmap,
    _safe_print,
)
from services.auth_service import (
    register_user,
    login_user,
    google_login_or_register,
    verify_google_token,
)
from services.history_service import (
    save_interview,
    get_interview_detail,
    get_user_history,
    delete_interview,
)
from services.adaptive_interview_service import (
    start_adaptive_session,
    get_adaptive_session,
    submit_adaptive_answer,
    finish_adaptive_session,
)
from services.interview_memory_service import (
    record_interview_memory,
    get_interview_memory_overview,
    get_weak_areas,
    get_strong_areas,
    get_skill_progress,
    get_recent_improvements,
    get_next_interview_recommendations,
    reset_interview_memory,
    generate_personalized_followup_question,
    extract_topic_from_question,
)
from services.readiness_service import (
    calculate_readiness_score,
    analyze_skill_gaps,
    generate_readiness_recommendations,
    record_readiness_snapshot,
    get_readiness_history,
)
from services.ai_assistant_service import (
    generate_assistant_reply,
    get_conversation_history,
    clear_conversation_history,
    get_contextual_suggested_questions,
)
from database import init_db, get_db_connection, DB_PATH

app = Flask(__name__)
init_db()

_jwt_secret = os.getenv("JWT_SECRET_KEY", "").strip()
if not _jwt_secret:
    # Consistent fallback — must match the value in .env exactly.
    # If you rotate the secret, update both .env and this fallback.
    _jwt_secret = "smart-interview-coach-secret-key-32-bytes-secure"
app.config["JWT_SECRET_KEY"] = _jwt_secret
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)  # 7-day persistent session so interviews never expire mid-session
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB maximum upload limit

jwt = JWTManager(app)


@jwt.invalid_token_loader
def invalid_token_callback(reason):
    return jsonify({
        "success": False,
        "error": "Invalid or expired token",
        "message": f"Invalid or expired token: {reason}"
    }), 401


@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({
        "success": False,
        "error": "Session token has expired. Please sign in again.",
        "message": "Session token has expired. Please sign in again."
    }), 401


@jwt.unauthorized_loader
def missing_token_callback(reason):
    return jsonify({
        "success": False,
        "error": "Authorization token required",
        "message": f"Authorization token required: {reason}"
    }), 401

CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True
)


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, X-Requested-With"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response


@app.errorhandler(413)
def request_entity_too_large(e):
    return jsonify({
        "success": False,
        "error": "File size exceeds the 10MB limit",
        "message": "File size exceeds the 10MB limit. Please upload a smaller PDF."
    }), 413


@app.errorhandler(500)
def internal_error(e):
    err = traceback.format_exc()
    _safe_print("[500 INTERNAL ERROR]:\n", err)
    return jsonify({
        "success": False,
        "message": "An internal server error occurred. Please try again.",
        "error": "An internal server error occurred. Please try again."
    }), 500


UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@app.route("/")
def home():
    return jsonify({
        "status": "success",
        "message": "Smart Interview Coach Backend Running"
    })


@app.route("/upload_resume", methods=["POST", "OPTIONS"])
@app.route("/api/upload_resume", methods=["POST", "OPTIONS"])
def upload_resume():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        if "resume" not in request.files:
            _safe_print("[UPLOAD ERROR] No file part in request.")
            return jsonify({
                "success": False,
                "error": "No file uploaded",
                "message": "No file uploaded"
            }), 400

        file = request.files["resume"]
        if not file or not file.filename:
            _safe_print("[UPLOAD ERROR] Empty filename.")
            return jsonify({
                "success": False,
                "error": "No file selected",
                "message": "No file selected"
            }), 400

        # 1. Sanitize filename with Werkzeug secure_filename
        original_name = file.filename
        safe_name = secure_filename(original_name)
        if not safe_name:
            safe_name = f"resume_{int(time.time())}.pdf"

        # 2. Strict PDF extension validation
        _, ext = os.path.splitext(safe_name)
        if ext.lower() not in ALLOWED_EXTENSIONS:
            _safe_print(f"[UPLOAD ERROR] Invalid file extension: '{ext}'")
            return jsonify({
                "success": False,
                "error": "Invalid file format. Only PDF files (.pdf) are allowed.",
                "message": "Invalid file format. Only PDF files (.pdf) are allowed."
            }), 400

        # 3. Check declared Content-Length if present
        if request.content_length and request.content_length > MAX_FILE_SIZE:
            return jsonify({
                "success": False,
                "error": "File size exceeds the 10MB limit",
                "message": "File size exceeds the 10MB limit. Please upload a smaller PDF."
            }), 413

        # 4. Check PDF magic bytes (%PDF-) to prevent disguised files
        header = file.read(5)
        file.seek(0)
        if not header.startswith(b"%PDF-"):
            _safe_print("[UPLOAD ERROR] PDF magic header check failed.")
            return jsonify({
                "success": False,
                "error": "The uploaded file is not a valid PDF document.",
                "message": "The uploaded file is not a valid PDF document. Valid PDF header missing."
            }), 400

        # 5. Save with unique sanitized prefix to avoid collisions
        unique_prefix = uuid.uuid4().hex[:8]
        stored_filename = f"{unique_prefix}_{safe_name}"
        filepath = os.path.join(UPLOAD_FOLDER, stored_filename)
        file.save(filepath)

        # 6. Check actual saved file size on disk
        file_size = os.path.getsize(filepath)
        if file_size == 0:
            if os.path.exists(filepath):
                os.remove(filepath)
            _safe_print("[UPLOAD ERROR] Uploaded file is empty (0 bytes).")
            return jsonify({
                "success": False,
                "error": "The uploaded PDF file is empty (0 bytes).",
                "message": "The uploaded PDF file is empty (0 bytes)."
            }), 400

        if file_size > MAX_FILE_SIZE:
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({
                "success": False,
                "error": "File size exceeds the 10MB limit",
                "message": "File size exceeds the 10MB limit. Please upload a smaller PDF."
            }), 413

        _safe_print(f"[INFO] Resume securely saved to {filepath} ({file_size} bytes)")

        # 7. Extract text with robust exception handling
        try:
            extracted_text = extract_text_from_pdf(filepath)
        except PasswordProtectedPDFError as pw_err:
            _safe_print(f"[PDF EXTRACTION ERROR]: {pw_err}")
            return jsonify({
                "success": False,
                "error": str(pw_err),
                "message": str(pw_err)
            }), 400
        except ScannedPDFError as scan_err:
            _safe_print(f"[PDF EXTRACTION ERROR]: {scan_err}")
            return jsonify({
                "success": False,
                "error": str(scan_err),
                "message": str(scan_err)
            }), 400
        except CorruptPDFError as corrupt_err:
            _safe_print(f"[PDF EXTRACTION ERROR]: {corrupt_err}")
            return jsonify({
                "success": False,
                "error": str(corrupt_err),
                "message": str(corrupt_err)
            }), 400
        except Exception as parse_err:
            _safe_print(f"[PDF EXTRACTION ERROR]: {parse_err}")
            return jsonify({
                "success": False,
                "error": "Unable to extract text from PDF. The file may be corrupt or encrypted.",
                "message": "Unable to extract text from PDF. The file may be corrupt or encrypted."
            }), 400

        if not extracted_text or not extracted_text.strip():
            _safe_print("[UPLOAD ERROR] PDF extraction yielded no text.")
            return jsonify({
                "success": False,
                "error": "Unable to extract text from PDF. The file may be scanned, image-only, or empty.",
                "message": "Unable to extract text from PDF. The file may be scanned, image-only, or empty."
            }), 400

        resume_hash = compute_resume_hash(extracted_text)
        user_id = _get_optional_user_id()

        # Deterministic Analysis Cache Check:
        # If user previously analyzed an identical resume content, reuse the verified record
        if user_id:
            try:
                conn = get_db_connection()
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, filename, extracted_text, skills, analysis, jd_match, ats_score
                    FROM resumes
                    WHERE user_id = ? AND file_hash = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (user_id, resume_hash)
                )
                cached = cursor.fetchone()
                if cached and cached["analysis"]:
                    c_skills = json.loads(cached["skills"]) if cached["skills"] else []
                    c_analysis = json.loads(cached["analysis"]) if cached["analysis"] else {}
                    c_id = cached["id"]

                    # Only reuse cache if AI feedback was successfully generated
                    # This prevents a previously timed-out AI advisory from sticking forever
                    if c_analysis.get("ai_feedback_status") == "available":
                        # Reactivate this resume record
                        cursor.execute(
                            "UPDATE resumes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                            (user_id,)
                        )
                        cursor.execute(
                            "UPDATE resumes SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                            (c_id,)
                        )
                        conn.commit()
                        conn.close()

                        _safe_print(f"[INFO] Deterministic cache hit for resume #{c_id} (hash={resume_hash[:8]})")
                        return jsonify({
                            "success": True,
                            "message": "Resume uploaded successfully",
                            "resume_id": c_id,
                            "filename": original_name,
                            "text": extracted_text,
                            "skills": c_skills,
                            "analysis": c_analysis,
                            "is_cached": True
                        })
                conn.close()
            except Exception as cache_err:
                _safe_print(f"[CACHE CHECK ERROR]: {cache_err}")

        # Deterministic Skill Extraction
        skills = extract_skills(extracted_text)
        _safe_print(f"[INFO] Detected skills ({len(skills)}): {skills}")

        # Optional Job Description provided during upload
        job_description = request.form.get("job_description") or request.form.get("jd") or ""

        # Deterministic ATS Evaluation & Grounded Insights
        analysis = analyze_resume(extracted_text, job_description=job_description)
        ats_score_val = int(analysis.get("ats_score", 0))

        _safe_print("\n===== RESUME UPLOAD COMPLETED SUCCESSFULLY =====")
        _safe_print(f"Skills found: {len(skills)}")
        _safe_print(f"Deterministic ATS Score: {ats_score_val}")
        _safe_print("================================================\n")

        resume_id = str(uuid.uuid4())

        if user_id:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                # Deactivate all prior resumes for this user so only the newly uploaded resume is active
                cursor.execute(
                    "UPDATE resumes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                    (user_id,)
                )
                cursor.execute(
                    """
                    INSERT INTO resumes (
                        id, user_id, filename, file_path, extracted_text,
                        skills, analysis, file_hash, ats_score, scoring_version, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2.0-deterministic', 1)
                    """,
                    (
                        resume_id,
                        user_id,
                        original_name,
                        filepath,
                        extracted_text,
                        json.dumps(skills),
                        json.dumps(analysis),
                        resume_hash,
                        ats_score_val
                    )
                )
                conn.commit()
                conn.close()
                _safe_print(f"[INFO] Resume #{resume_id} saved as active for user #{user_id} (ATS={ats_score_val})")
            except Exception as db_err:
                _safe_print(f"[DB ERROR saving resume]: {db_err}")

        return jsonify({
            "success": True,
            "message": "Resume uploaded successfully",
            "resume_id": resume_id,
            "filename": original_name,
            "text": extracted_text,
            "skills": skills,
            "analysis": analysis
        })

    except Exception as e:
        _safe_print("[UPLOAD ENDPOINT ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to process resume upload. Please try again.",
            "message": "Failed to process resume upload. Please try again."
        }), 500


@app.route("/resume/retry_ai_feedback", methods=["POST", "OPTIONS"])
@app.route("/api/resume/retry_ai_feedback", methods=["POST", "OPTIONS"])
def retry_ai_feedback():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        resume_id = (data.get("resume_id") or "").strip()
        resume_text = (data.get("resume_text") or "").strip()
        job_description = (data.get("job_description") or data.get("jd") or "").strip()

        # If resume_id is provided but no text, retrieve text from database
        user_id = _get_optional_user_id()
        if not resume_text and resume_id:
            try:
                conn = get_db_connection()
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT extracted_text FROM resumes WHERE id = ?", (resume_id,))
                row = cursor.fetchone()
                if row:
                    resume_text = row["extracted_text"]
                conn.close()
            except Exception as e:
                _safe_print(f"[RETRY AI DB LOOKUP ERROR]: {e}")

        if not resume_text:
            return jsonify({
                "success": False,
                "error": "Resume text is required to generate AI feedback.",
                "message": "Resume text is required to generate AI feedback."
            }), 400

        # Execute AI analysis
        analysis = analyze_resume(resume_text, job_description=job_description)

        # Update database record if resume_id is available
        if resume_id:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE resumes SET analysis = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (json.dumps(analysis), resume_id)
                )
                conn.commit()
                conn.close()
            except Exception as db_err:
                _safe_print(f"[RETRY AI DB UPDATE ERROR]: {db_err}")

        return jsonify({
            "success": True,
            "message": "AI feedback generated successfully",
            "analysis": analysis
        }), 200

    except Exception as e:
        _safe_print("[RETRY AI FEEDBACK ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate AI feedback. Please try again.",
            "message": str(e)
        }), 500


@app.route("/resume/active", methods=["GET", "OPTIONS"])
@app.route("/api/resume/active", methods=["GET", "OPTIONS"])
def get_active_resume():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    user_id = _get_optional_user_id()
    if not user_id:
        return jsonify({
            "success": True,
            "has_active_resume": False,
            "resume": None
        }), 200

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, filename, extracted_text, skills, analysis, jd_match, file_hash, ats_score, created_at
            FROM resumes
            WHERE user_id = ? AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user_id,)
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({
                "success": True,
                "has_active_resume": False,
                "resume": None
            }), 200

        try:
            r_skills = json.loads(row["skills"]) if row["skills"] else []
        except Exception:
            r_skills = []
        try:
            r_analysis = json.loads(row["analysis"]) if row["analysis"] else {}
        except Exception:
            r_analysis = {}
        try:
            r_jd = json.loads(row["jd_match"]) if row["jd_match"] else None
        except Exception:
            r_jd = None

        return jsonify({
            "success": True,
            "has_active_resume": True,
            "resume": {
                "resume_id": row["id"],
                "filename": row["filename"],
                "text": row["extracted_text"],
                "skills": r_skills,
                "analysis": r_analysis,
                "jd_match": r_jd,
                "file_hash": row["file_hash"] if "file_hash" in row.keys() else None,
                "ats_score": row["ats_score"] if "ats_score" in row.keys() else r_analysis.get("ats_score"),
                "created_at": row["created_at"]
            }
        }), 200
    except Exception as e:
        _safe_print(f"[ACTIVE RESUME ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/resume/active", methods=["DELETE", "OPTIONS"])
@app.route("/api/resume/active", methods=["DELETE", "OPTIONS"])
@app.route("/upload_resume", methods=["DELETE"])
@app.route("/api/upload_resume", methods=["DELETE"])
def delete_active_resume():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    user_id = _get_optional_user_id()
    if not user_id:
        return jsonify({
            "success": True,
            "message": "No active session to clear."
        }), 200

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE resumes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            (user_id,)
        )
        conn.commit()
        conn.close()
        _safe_print(f"[INFO] Cleared active resume for user #{user_id}")
        return jsonify({
            "success": True,
            "message": "Active resume removed successfully. Dashboard results cleared."
        }), 200
    except Exception as e:
        _safe_print(f"[DELETE RESUME ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


MAX_JD_LENGTH = 10000  # 10,000 characters limit
MAX_RESUME_TEXT_LENGTH = 30000  # 30,000 characters limit


@app.route("/analyze_jd_match", methods=["POST", "OPTIONS"])
@app.route("/api/analyze_jd_match", methods=["POST", "OPTIONS"])
def analyze_job_description_match():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        resume_text = (data.get("resume_text") or "").strip()
        job_description = (data.get("job_description") or data.get("jd") or "").strip()
        resume_id = (data.get("resume_id") or "").strip()

        if not resume_text:
            return jsonify({
                "success": False,
                "error": "Resume text is required",
                "message": "Resume text is required. Please upload a resume first."
            }), 400

        if not job_description:
            return jsonify({
                "success": False,
                "error": "Job description is required",
                "message": "Job Description Match: Not Available – Add a Job Description to evaluate alignment."
            }), 400

        if len(job_description) > MAX_JD_LENGTH:
            return jsonify({
                "success": False,
                "error": f"Job description exceeds maximum length of {MAX_JD_LENGTH} characters",
                "message": f"Job description is too long (maximum {MAX_JD_LENGTH} characters allowed). Received {len(job_description)} characters."
            }), 400

        if len(resume_text) > MAX_RESUME_TEXT_LENGTH:
            return jsonify({
                "success": False,
                "error": f"Resume text exceeds maximum length of {MAX_RESUME_TEXT_LENGTH} characters",
                "message": f"Resume text exceeds allowed length (maximum {MAX_RESUME_TEXT_LENGTH} characters)."
            }), 400

        match_result = analyze_jd_match(resume_text=resume_text, job_description=job_description)

        user_id = _get_optional_user_id()
        target_resume_id = resume_id
        if user_id:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                if not target_resume_id:
                    cursor.execute("SELECT id FROM resumes WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1", (user_id,))
                    active_row = cursor.fetchone()
                    if active_row:
                        target_resume_id = active_row[0]
                if target_resume_id:
                    cursor.execute(
                        """
                        UPDATE resumes
                        SET jd_match = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND user_id = ? AND is_active = 1
                        """,
                        (json.dumps(match_result), target_resume_id, user_id)
                    )
                    conn.commit()
                conn.close()
            except Exception as jd_db_err:
                _safe_print(f"[DB ERROR updating jd_match]: {jd_db_err}")

        return jsonify({
            "success": True,
            "resume_id": target_resume_id or resume_id,
            "available": match_result.get("available", True),
            "match_score": match_result.get("match_score"),
            "matching_skills": match_result.get("matching_skills", []),
            "missing_skills": match_result.get("missing_skills", []),
            "explicit_resume_skills": match_result.get("explicit_resume_skills", []),
            "inferred_skills": match_result.get("inferred_skills", []),
            "relevant_experience": match_result.get("relevant_experience", ""),
            "strengths": match_result.get("strengths", ""),
            "improvement_suggestions": match_result.get("improvement_suggestions", [])
        }), 200

    except Exception as e:
        _safe_print("[JD MATCH ENDPOINT ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to analyze job description match",
            "message": "Failed to analyze job description match. Please try again."
        }), 500


@app.route("/generate_questions", methods=["POST", "OPTIONS"])
@app.route("/api/generate_questions", methods=["POST", "OPTIONS"])
def generate_interview_questions():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        role = data.get("role", "")
        skills = data.get("skills", [])
        resume_text = data.get("resume_text", "")
        job_description = data.get("job_description", "") or data.get("jd", "")
        personality = data.get("personality") or data.get("interviewer_personality") or "technical"

        if not role:
            return jsonify({
                "success": False,
                "error": "Role is required",
                "message": "Role is required"
            }), 400

        questions = generate_questions(role, skills, resume_text, job_description=job_description, personality=personality)
        if not isinstance(questions, list) or len(questions) < 10:
            from services.groq_service import _build_fallback_questions
            fallback_qs = _build_fallback_questions(role, skills)
            if isinstance(questions, list):
                for fq in fallback_qs:
                    if fq not in questions:
                        questions.append(fq)
                    if len(questions) == 10:
                        break
            else:
                questions = fallback_qs

        questions = [str(q).strip() for q in questions if str(q).strip()][:10]

        return jsonify({
            "success": True,
            "questions": questions
        })

    except Exception as e:
        _safe_print("[QUESTION GENERATION FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "message": "AI service is temporarily unavailable. Please try again.",
            "error": "AI service is temporarily unavailable. Please try again."
        }), 500


# Thread-safe in-memory cache for interview evaluation idempotency (prevents double-clicks)
_eval_cache_lock = Lock()
_eval_cache = {}  # cache_key -> {"timestamp": float, "response_data": dict}


@app.route("/evaluate_answers", methods=["POST", "OPTIONS"])
@app.route("/api/evaluate_answers", methods=["POST", "OPTIONS"])
def evaluate_answers():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    t_request_start = time.time()

    try:
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ", 1)[1].strip()
            if token_str:
                try:
                    decoded = decode_token(token_str)
                    user_id = int(decoded.get("sub"))
                except Exception as token_err:
                    # Fallback decode with allow_expired=True so an active interview session never loses user ID
                    try:
                        decoded_fallback = decode_token(token_str, allow_expired=True)
                        user_id = int(decoded_fallback.get("sub"))
                        _safe_print(f"[AUTH NOTE] Restored expired session token for user #{user_id}")
                    except Exception:
                        _safe_print(f"[AUTH NOTE] Token expired or invalid, proceeding as guest: {token_err}")
                        user_id = None

        data = request.get_json() or {}
        role = data.get("role", "Candidate")
        raw_questions = data.get("questions", [])
        raw_answers = data.get("answers", [])
        personality = data.get("personality") or data.get("interviewer_personality") or "technical"
        interview_mode = data.get("interview_mode") or data.get("mode") or "standard"
        interview_type = data.get("interview_type") or "Standard"
        duration_minutes = data.get("duration_minutes")

        # Normalize questions to list of non-empty strings
        if isinstance(raw_questions, str):
            questions = [q.strip() for q in raw_questions.split("\n") if q.strip()]
        elif isinstance(raw_questions, list):
            questions = [str(q).strip() for q in raw_questions if str(q).strip()]
        else:
            questions = []

        # Normalize answers to list of strings
        if isinstance(raw_answers, str):
            answers = [raw_answers.strip()]
        elif isinstance(raw_answers, list):
            answers = [str(a).strip() for a in raw_answers]
        else:
            answers = []

        if not questions:
            return jsonify({
                "success": False,
                "error": "No questions were provided for evaluation",
                "message": "No questions were provided for evaluation"
            }), 400

        # Pad answers if candidate answered fewer than questions
        while len(answers) < len(questions):
            answers.append("")

        # Extract optional durations (for speaking pace measurement in voice interviews)
        raw_durations = data.get("durations", [])
        durations = []
        if isinstance(raw_durations, list):
            for d in raw_durations:
                try:
                    durations.append(float(d) if d is not None else None)
                except (ValueError, TypeError):
                    durations.append(None)

        # Idempotency / Duplicate Submission Prevention
        sub_fingerprint = hashlib.sha256(
            json.dumps([role, questions, answers, personality], sort_keys=True).encode()
        ).hexdigest()
        cache_key = f"{user_id or 'guest'}:{sub_fingerprint}"

        with _eval_cache_lock:
            cached_entry = _eval_cache.get(cache_key)
            if cached_entry and (time.time() - cached_entry["timestamp"]) < 45.0:
                _safe_print(f"[IDEMPOTENCY] Reused recent evaluation ({sub_fingerprint[:10]}) in 0ms (prevented duplicate evaluation).")
                return jsonify(cached_entry["response_data"]), 200

        _safe_print("\n===== HIGH-SPEED EVALUATION REQUEST =====")
        _safe_print(f"Role: {role}, Total Qs: {len(questions)}, Total As: {len(answers)}, Personality: {personality}")
        _safe_print("=========================================\n")

        # Phase 1: AI Answer Evaluation (Groq LLM)
        t_eval_start = time.time()
        evaluations = evaluate_interview(questions, answers, personality=personality)
        t_eval_dur = time.time() - t_eval_start

        from services.communication_service import (
            analyze_single_answer_communication,
            generate_overall_communication_summary,
            aggregate_session_speaking_metrics,
        )
        from services.answer_verification_service import verify_interview_session

        results = []
        question_comm_feedbacks = []
        for i, (question, answer) in enumerate(zip(questions, answers)):
            eval_item = evaluations[i] if i < len(evaluations) and isinstance(evaluations[i], dict) else {}
            ans_clean = str(answer or "").strip()
            is_empty_ans = len(ans_clean) == 0

            try:
                val = eval_item.get("technical_score")
                tech_score = int(float(val)) if val is not None else (0 if is_empty_ans else 5)
            except Exception:
                tech_score = 0 if is_empty_ans else 5

            try:
                val = eval_item.get("communication_score")
                comm_score = int(float(val)) if val is not None else (0 if is_empty_ans else 5)
            except Exception:
                comm_score = 0 if is_empty_ans else 5

            dur = durations[i] if i < len(durations) else None
            comm_analysis = analyze_single_answer_communication(question, answer, duration_seconds=dur)
            question_comm_feedbacks.append(comm_analysis)

            q_topic = extract_topic_from_question(question, explicit_topic=eval_item.get("topic"))
            from services.skill_performance_service import map_question_to_skills
            mapped_skills = map_question_to_skills(
                question,
                topic=q_topic,
                assesses_skill=eval_item.get("assesses_skill"),
                target_role=role
            )
            q_skill = mapped_skills[0] if mapped_skills else ""

            results.append({
                "question": question,
                "answer": answer,
                "technical_score": max(0, min(10, tech_score)),
                "communication_score": max(0, min(10, comm_score)),
                "topic": q_topic,
                "assesses_skill": q_skill,
                "strengths": str(eval_item.get("strengths", "Solid attempt addressing the question.")),
                "mistakes": str(eval_item.get("mistakes", "Could provide deeper technical detail.")),
                "improved_answer": str(eval_item.get("improved_answer", f"A strong answer for '{question}' covers core principles and concrete examples.")),
                "correct_answer": str(eval_item.get("correct_answer", f"Ideal response explaining {question} with precision.")),
                "correct_concepts": eval_item.get("correct_concepts") or [],
                "missing_concepts": eval_item.get("missing_concepts") or [],
                "improvement_suggestions": eval_item.get("improvement_suggestions") or [],
                "key_takeaways": eval_item.get("key_takeaways") or [],
                "follow_up_questions": eval_item.get("follow_up_questions") or [],
                "communication_feedback": comm_analysis,
            })

        avg_score = 0
        if len(results) > 0:
            avg_score = round(
                sum(item["technical_score"] for item in results) / len(results),
                1
            )

        # Phase 2: Concurrent Overall Summary and Grounded RAG Verification
        t_parallel_start = time.time()
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_summary = executor.submit(generate_overall_summary, results, personality=personality)
            future_verify = executor.submit(verify_interview_session, results)

            try:
                overall_summary = future_summary.result(timeout=35)
            except Exception as sum_err:
                _safe_print(f"[SUMMARY GEN ERROR]: {sum_err}")
                from services.groq_service import _build_fallback_summary
                overall_summary = _build_fallback_summary(results)

            try:
                verification_payload = future_verify.result(timeout=35)
            except Exception as v_err:
                _safe_print(f"[VERIFICATION ERROR]: {v_err}")
                verification_payload = {}
        t_parallel_dur = time.time() - t_parallel_start

        if not isinstance(overall_summary, dict):
            from services.groq_service import _build_fallback_summary
            overall_summary = _build_fallback_summary(results)

        if not isinstance(verification_payload, dict):
            verification_payload = {}

        overall_comm_summary = generate_overall_communication_summary(question_comm_feedbacks)
        overall_summary["communication_feedback"] = overall_comm_summary
        overall_summary["communication_score"] = overall_comm_summary.get("overall_score", 0)
        overall_summary["interviewer_personality"] = personality
        overall_summary["verification_summary"] = verification_payload.get("summary")
        overall_summary["answer_verifications"] = verification_payload.get("verifications", [])
        for i, r in enumerate(results):
            if i < len(verification_payload.get("verifications", [])):
                r["verification_result"] = verification_payload["verifications"][i]

        # Speaking Coach telemetry aggregation
        speaking_metrics = {}
        try:
            speaking_metrics = aggregate_session_speaking_metrics(question_comm_feedbacks)
            overall_summary["speaking_metrics"] = speaking_metrics
        except Exception as s_err:
            _safe_print(f"[SPEAKING AGGREGATION ERROR]: {s_err}")
            overall_summary["speaking_metrics"] = {}

        # Phase 3: Database Storage and Memory Updates
        t_db_start = time.time()
        saved_interview_id = None
        try:
            saved_interview_id = save_interview(
                user_id=user_id,
                role=role,
                avg_score=avg_score,
                summary=overall_summary.get("summary", ""),
                results=results,
                overall_summary=overall_summary,
                interview_mode=interview_mode,
                interview_type=interview_type,
                duration_minutes=duration_minutes,
                communication_score=overall_comm_summary.get("overall_score", 0),
                communication_feedback=overall_comm_summary,
                interviewer_personality=personality,
                speaking_metrics=speaking_metrics,
                verification_summary=overall_summary.get("verification_summary"),
                answer_verifications=overall_summary.get("answer_verifications"),
            )
            _safe_print(f"[INFO] Successfully saved interview #{saved_interview_id} for user #{user_id}")

            if user_id and saved_interview_id:
                # Update AI Interview Memory Engine
                try:
                    record_interview_memory(
                        user_id=user_id,
                        role=role,
                        interview_mode=interview_mode,
                        results=results,
                        overall_summary=overall_summary,
                        interview_id=saved_interview_id,
                    )
                except Exception as mem_err:
                    _safe_print("[MEMORY ERROR]:", mem_err)

                # Record AI Readiness Score Snapshot
                try:
                    record_readiness_snapshot(
                        user_id=user_id,
                        interview_id=saved_interview_id,
                        role=role,
                    )
                except Exception as r_err:
                    _safe_print("[READINESS SNAPSHOT ERROR]:", r_err)

                # Adapt AI Study Plan dynamically after interview
                try:
                    adapt_existing_study_plan(
                        user_id=user_id,
                        reason="new_interview",
                        metadata={"interview_id": saved_interview_id, "role": role}
                    )
                except Exception as p_err:
                    _safe_print("[STUDY PLAN ADAPT ERROR]:", p_err)
        except Exception as db_err:
            _safe_print("[DB ERROR] Failed to save interview history:", db_err)
            saved_interview_id = None
        t_db_dur = time.time() - t_db_start

        t_total_dur = time.time() - t_request_start

        _safe_print("\n" + "=" * 58)
        _safe_print("[EVALUATION PERFORMANCE TIMING REPORT]")
        _safe_print(f"  Total Request Duration:     {t_total_dur:.2f}s")
        _safe_print(f"  AI Answer Evaluation:       {t_eval_dur:.2f}s")
        _safe_print(f"  Parallel Summary & Verify:  {t_parallel_dur:.2f}s")
        _safe_print(f"  Database Storage & Memory:  {t_db_dur:.2f}s")
        _safe_print(f"  Total Questions Evaluated:  {len(questions)}")
        _safe_print("=" * 58 + "\n")

        response_data = {
            "success": True,
            "results": results,
            "summary": overall_summary,
            "communication_feedback": overall_comm_summary,
            "verification_summary": overall_summary.get("verification_summary"),
            "answer_verifications": overall_summary.get("answer_verifications"),
            "speaking_metrics": speaking_metrics,
            "interviewer_personality": personality,
            "evaluation_timings": {
                "total_seconds": round(t_total_dur, 2),
                "evaluation_seconds": round(t_eval_dur, 2),
                "verification_seconds": round(t_parallel_dur, 2),
                "database_seconds": round(t_db_dur, 2),
            }
        }
        if saved_interview_id is not None:
            response_data["interview_id"] = saved_interview_id

        # Update idempotency cache
        with _eval_cache_lock:
            _eval_cache[cache_key] = {
                "timestamp": time.time(),
                "response_data": response_data,
            }
            # Evict stale entries older than 120 seconds
            now = time.time()
            for k in list(_eval_cache.keys()):
                if now - _eval_cache[k]["timestamp"] > 120.0:
                    del _eval_cache[k]

        return jsonify(response_data)

        return jsonify(response_data)

    except Exception as e:
        _safe_print("[EVALUATION FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "message": "AI evaluation service encountered an error. Please try again.",
            "error": str(e)
        }), 500


def _get_optional_user_id():
    """Extract authenticated user_id from Bearer token if present and valid, otherwise return None."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header and auth_header.startswith("Bearer "):
        token_str = auth_header.split(" ", 1)[1].strip()
        if token_str:
            try:
                decoded = decode_token(token_str)
                return int(decoded.get("sub"))
            except Exception:
                try:
                    decoded_fallback = decode_token(token_str, allow_expired=True)
                    return int(decoded_fallback.get("sub"))
                except Exception:
                    return None
    return None


@app.route("/adaptive/start", methods=["POST", "OPTIONS"])
@app.route("/api/adaptive/start", methods=["POST", "OPTIONS"])
def adaptive_start():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        data = request.get_json() or {}
        role = str(data.get("role") or "Candidate").strip()
        skills = data.get("skills", [])
        resume_text = str(data.get("resume_text") or "")
        job_description = str(data.get("job_description") or "")
        max_questions = int(data.get("max_questions") or 10)
        initial_difficulty = str(data.get("initial_difficulty") or "medium")
        personalized = bool(data.get("personalized", True))
        personality = str(data.get("personality") or data.get("interviewer_personality") or "technical").strip()

        if not role:
            return jsonify({
                "success": False,
                "error": "Target role is required to start an adaptive interview.",
                "message": "Target role is required."
            }), 400

        session_dict = start_adaptive_session(
            user_id=user_id,
            role=role,
            skills=skills,
            resume_text=resume_text,
            job_description=job_description,
            max_questions=max_questions,
            initial_difficulty=initial_difficulty,
            personalized=personalized,
            personality=personality,
        )

        return jsonify({
            "success": True,
            "session": session_dict
        }), 200

    except Exception as e:
        _safe_print("[ADAPTIVE START ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to start adaptive interview session.",
            "message": str(e)
        }), 500


@app.route("/adaptive/answer", methods=["POST", "OPTIONS"])
@app.route("/api/adaptive/answer", methods=["POST", "OPTIONS"])
def adaptive_answer():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        data = request.get_json() or {}
        session_id = str(data.get("session_id") or "").strip()
        answer = str(data.get("answer") or "").strip()

        if not session_id:
            return jsonify({
                "success": False,
                "error": "session_id is required.",
                "message": "session_id is required."
            }), 400

        if not answer:
            return jsonify({
                "success": False,
                "error": "Answer cannot be empty.",
                "code": "EMPTY_ANSWER"
            }), 400

        session = get_adaptive_session(session_id, user_id=user_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "Adaptive session not found or unauthorized.",
                "code": "SESSION_NOT_FOUND"
            }), 404

        result = session.submit_answer(answer)
        if "error" in result and not result.get("success"):
            return jsonify({
                "success": False,
                "error": result["error"],
                "code": result.get("code"),
                "session": result.get("session")
            }), 400

        return jsonify(result), 200

    except Exception as e:
        _safe_print("[ADAPTIVE ANSWER ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to evaluate adaptive answer.",
            "message": str(e)
        }), 500


@app.route("/adaptive/session/<session_id>", methods=["GET", "OPTIONS"])
@app.route("/api/adaptive/session/<session_id>", methods=["GET", "OPTIONS"])
def adaptive_get_session_endpoint(session_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        session = get_adaptive_session(session_id, user_id=user_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "Adaptive session not found or unauthorized.",
                "code": "SESSION_NOT_FOUND"
            }), 404

        return jsonify({
            "success": True,
            "session": session.to_dict()
        }), 200

    except Exception as e:
        _safe_print("[ADAPTIVE GET SESSION ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/adaptive/finish", methods=["POST", "OPTIONS"])
@app.route("/api/adaptive/finish", methods=["POST", "OPTIONS"])
def adaptive_finish_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        data = request.get_json() or {}
        session_id = str(data.get("session_id") or "").strip()

        if not session_id:
            return jsonify({
                "success": False,
                "error": "session_id is required."
            }), 400

        session = get_adaptive_session(session_id, user_id=user_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "Adaptive session not found or unauthorized.",
                "code": "SESSION_NOT_FOUND"
            }), 404

        result = finish_adaptive_session(session_id, user_id=user_id)
        return jsonify(result), 200

    except Exception as e:
        _safe_print("[ADAPTIVE FINISH ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to complete adaptive interview session.",
            "message": str(e)
        }), 500


@app.route("/interview_results/<int:interview_id>", methods=["GET", "OPTIONS"])
@app.route("/api/interview_results/<int:interview_id>", methods=["GET", "OPTIONS"])
def get_interview_results_endpoint(interview_id):
    """
    Public / optional-auth endpoint to fetch evaluated interview results by ID.
    Enables page refresh survival, link sharing, and instant review recovery.
    """
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        data = get_interview_detail(interview_id=interview_id, user_id=None)
        if not data:
            return jsonify({
                "success": False,
                "error": "Interview session not found",
                "message": "Interview session not found"
            }), 404

        interview_dict = data.get("interview") or {}
        interview_owner = interview_dict.get("user_id")
        if interview_owner and user_id and interview_owner != user_id:
            return jsonify({
                "success": False,
                "error": "Unauthorized access to interview results.",
                "message": "Unauthorized access to interview results."
            }), 403

        # Transform database question records into results format expected by Results page
        results = []
        for q in data.get("questions", []):
            results.append({
                "question": q.get("question", ""),
                "answer": q.get("candidate_answer") or q.get("answer") or "",
                "technical_score": q.get("technical_score", 0),
                "communication_score": q.get("communication_score", 0),
                "topic": q.get("topic") or "",
                "assesses_skill": q.get("assesses_skill") or "",
                "strengths": q.get("strengths") or "",
                "mistakes": q.get("mistakes") or "",
                "improved_answer": q.get("improved_answer") or "",
                "correct_answer": q.get("ideal_answer") or q.get("correct_answer") or "",
                "correct_concepts": q.get("correct_concepts") or [],
                "missing_concepts": q.get("missing_concepts") or [],
                "improvement_suggestions": q.get("improvement_suggestions") or [],
                "key_takeaways": q.get("key_takeaways") or [],
                "follow_up_questions": q.get("follow_up_questions") or [],
                "communication_feedback": q.get("communication_feedback") or {},
                "verification_result": q.get("verification_result"),
                "difficulty": q.get("difficulty", "medium"),
            })

        summary = {
            "summary": interview_dict.get("summary", ""),
            "recommendation": interview_dict.get("recommendation", ""),
            "strengths": interview_dict.get("strengths", ""),
            "weaknesses": interview_dict.get("weaknesses", ""),
            "advice": interview_dict.get("advice", ""),
            "avg_score": interview_dict.get("avg_score", 0),
            "role": interview_dict.get("role", "Candidate"),
            "interview_mode": interview_dict.get("interview_mode", "standard"),
            "interview_type": interview_dict.get("interview_type", "Standard"),
            "communication_score": interview_dict.get("communication_score", 0),
            "communication_feedback": interview_dict.get("communication_feedback") or {},
            "speaking_metrics": data.get("speaking_metrics") or {},
            "verification_summary": data.get("verification_summary"),
            "answer_verifications": data.get("answer_verifications", []),
            "interviewer_personality": interview_dict.get("interviewer_personality", "technical"),
            "created_at": interview_dict.get("created_at"),
        }

        return jsonify({
            "success": True,
            "interview_id": interview_id,
            "results": results,
            "summary": summary,
            "interview": interview_dict,
        }), 200

    except Exception as e:
        _safe_print("[INTERVIEW RESULTS GET FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch interview results",
            "message": str(e)
        }), 500


@app.route("/history/<int:interview_id>", methods=["GET", "OPTIONS"])
@app.route("/api/history/<int:interview_id>", methods=["GET", "OPTIONS"])
@jwt_required()
def get_interview_detail_endpoint(interview_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())

        data = get_interview_detail(interview_id=interview_id, user_id=user_id)
        if not data:
            return jsonify({
                "success": False,
                "error": "Interview session not found",
                "message": "Interview session not found"
            }), 404

        return jsonify({
            "success": True,
            "interview": data["interview"],
            "details": data["questions"],
            "questions": data["questions"],
            "answer_verifications": data.get("answer_verifications", []),
            "verification_summary": data.get("verification_summary"),
            "speaking_metrics": data.get("speaking_metrics"),
            "interviewer_personality": data.get("interviewer_personality", "technical"),
        }), 200

    except Exception as e:
        _safe_print("[HISTORY DETAIL FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch interview details",
            "message": "Failed to fetch interview details"
        }), 500


@app.route("/history/<int:interview_id>", methods=["DELETE", "OPTIONS"])
@app.route("/api/history/<int:interview_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_interview_endpoint(interview_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        deleted = delete_interview(interview_id=interview_id, user_id=user_id)
        if not deleted:
            return jsonify({
                "success": False,
                "error": "Interview session not found or unauthorized",
                "message": "Interview session not found or you do not have permission to delete it."
            }), 404

        return jsonify({
            "success": True,
            "message": "Interview session permanently deleted.",
            "deleted_id": interview_id
        }), 200

    except Exception as e:
        _safe_print("[HISTORY DELETE FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to delete interview",
            "message": str(e)
        }), 500


# ==========================================
# ADVANCED AI FEATURES ENDPOINTS
# ==========================================

@app.route("/api/interviewer-personalities", methods=["GET", "OPTIONS"])
def get_personalities_endpoint():
    """Returns the catalog of AI interviewer personalities and panel mode."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    try:
        from services.interviewer_personality_service import get_available_personalities
        return jsonify({
            "success": True,
            "personalities": get_available_personalities()
        }), 200
    except Exception as e:
        _safe_print(f"[PERSONALITY CATALOG ERROR]: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/verification/analyze", methods=["POST", "OPTIONS"])
def analyze_single_verification():
    """Performs technical claim extraction, hallucination check, and evidence retrieval for an answer."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    try:
        data = request.get_json(silent=True) or {}
        question = str(data.get("question") or "").strip()
        answer = str(data.get("answer") or "").strip()
        expected = str(data.get("expected_answer") or data.get("correct_answer") or "").strip()

        if not question or not answer:
            return jsonify({"success": False, "error": "question and answer are required"}), 400

        from services.answer_verification_service import verify_interview_answer
        res = verify_interview_answer(question, answer, expected)
        return jsonify({"success": True, "verification": res}), 200
    except Exception as e:
        _safe_print(f"[VERIFICATION ANALYZE ERROR]: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/verification/<int:interview_id>", methods=["GET", "OPTIONS"])
def get_interview_verification_endpoint(interview_id):
    """Fetches stored answer verification and grounding results for an interview."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    try:
        user_id = _get_optional_user_id()
        data = get_interview_detail(interview_id=interview_id, user_id=user_id)
        if not data:
            return jsonify({"success": False, "error": "Interview not found"}), 404

        return jsonify({
            "success": True,
            "interview_id": interview_id,
            "verification_summary": data.get("verification_summary"),
            "answer_verifications": data.get("answer_verifications", []),
        }), 200
    except Exception as e:
        _safe_print(f"[GET VERIFICATION ERROR]: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/speaking-analysis", methods=["POST", "OPTIONS"])
def analyze_speaking_telemetry_endpoint():
    """Analyzes real-time speaking metrics (WPM, pause count, fillers, pace category, clarity)."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    try:
        data = request.get_json(silent=True) or {}
        text = str(data.get("transcript") or data.get("answer") or "")
        duration = float(data.get("duration_seconds") or 0.0)
        pause_count = int(data.get("pause_count") or 0)
        pause_duration = float(data.get("pause_duration") or 0.0)

        from services.communication_service import analyze_speaking_coach_metrics
        metrics = analyze_speaking_coach_metrics(text, duration, pause_count, pause_duration)
        return jsonify({"success": True, "metrics": metrics}), 200
    except Exception as e:
        _safe_print(f"[SPEAKING ANALYSIS ERROR]: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/speaking-analysis/<int:interview_id>", methods=["GET", "OPTIONS"])
def get_interview_speaking_analysis_endpoint(interview_id):
    """Fetches stored speaking coach metrics for an interview."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    try:
        user_id = _get_optional_user_id()
        data = get_interview_detail(interview_id=interview_id, user_id=user_id)
        if not data:
            return jsonify({"success": False, "error": "Interview not found"}), 404

        return jsonify({
            "success": True,
            "interview_id": interview_id,
            "speaking_metrics": data.get("speaking_metrics"),
            "communication_feedback": data.get("interview", {}).get("communication_feedback"),
        }), 200
    except Exception as e:
        _safe_print(f"[GET SPEAKING METRICS ERROR]: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/history", methods=["GET", "OPTIONS"])
@app.route("/api/history", methods=["GET", "OPTIONS"])
@jwt_required()
def get_history():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        history = get_user_history(user_id)
        return jsonify(history)

    except Exception as e:
        _safe_print("[HISTORY FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch interview history",
            "message": "Failed to fetch interview history"
        }), 500


@app.route("/dashboard", methods=["GET", "OPTIONS"])
@jwt_required()
def dashboard():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())

        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Verify user account exists
        cursor.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            conn.close()
            return jsonify({
                "success": False,
                "error": "User account not found",
                "message": "User account not found or has been deleted."
            }), 401

        created_at = user_row["created_at"]

        cursor.execute(
            """
            SELECT COUNT(*) as total, AVG(avg_score) as average, MAX(avg_score) as best
            FROM interviews
            WHERE user_id = ? AND (status = 'completed' OR status IS NULL) AND avg_score IS NOT NULL
            """,
            (user_id,)
        )
        row = cursor.fetchone()
        total = row["total"] or 0
        average = round(float(row["average"]), 1) if (row and row["average"] is not None) else None
        best = round(float(row["best"]), 1) if (row and row["best"] is not None) else None

        # Fetch all user evaluated interviews for analytics & score trends
        cursor.execute(
            """
            SELECT id, role, avg_score, communication_score, interview_mode, interview_type, created_at
            FROM interviews
            WHERE user_id = ? AND (status = 'completed' OR status IS NULL) AND avg_score IS NOT NULL
            ORDER BY created_at ASC
            """,
            (user_id,)
        )
        interview_rows = [dict(r) for r in cursor.fetchall()]

        score_trends = []
        role_counts = {}
        comm_scores = []
        for idx, inv in enumerate(interview_rows):
            role_name = inv.get("role") or "Software Engineer"
            role_counts[role_name] = role_counts.get(role_name, 0) + 1

            c_score = inv.get("communication_score")
            norm_c = None
            if c_score is not None:
                try:
                    c_val = float(c_score)
                    norm_c = round(c_val / 10, 1) if c_val > 10 else round(c_val, 1)
                    comm_scores.append(norm_c)
                except Exception:
                    pass

            score_val = round(float(inv.get("avg_score") or 0), 1)
            score_trends.append({
                "id": inv["id"],
                "index": idx + 1,
                "session": f"Session {idx + 1}",
                "role": role_name,
                "score": score_val,
                "score_pct": int(round(score_val * 10)),
                "technical_score": score_val,
                "communication_score": norm_c if norm_c is not None else score_val,
                "created_at": inv.get("created_at"),
            })

        latest_interview = None
        if interview_rows:
            last_inv = interview_rows[-1]
            last_score = round(float(last_inv.get("avg_score") or 0), 1)
            inv_type_raw = last_inv.get("interview_type") or last_inv.get("interview_mode") or "Standard"
            latest_interview = {
                "id": last_inv["id"],
                "role": last_inv.get("role") or "Software Engineer",
                "score": last_score,
                "score_pct": int(round(last_score * 10)),
                "created_at": last_inv.get("created_at"),
                "interview_type": "Adaptive" if "adaptive" in str(inv_type_raw).lower() else "Standard",
            }

        most_practiced_role = max(role_counts, key=role_counts.get) if role_counts else "Software Engineer"
        avg_comm = round(sum(comm_scores) / len(comm_scores), 1) if comm_scores else (average if total > 0 else 0.0)

        # Topic breakdown from interview_details
        cursor.execute(
            """
            SELECT d.topic, AVG(d.technical_score) as avg_score, COUNT(*) as count
            FROM interview_details d
            JOIN interviews i ON d.interview_id = i.id
            WHERE i.user_id = ? AND d.topic IS NOT NULL AND d.topic != ''
            GROUP BY d.topic
            ORDER BY count DESC, avg_score DESC
            LIMIT 10
            """,
            (user_id,)
        )
        topic_rows = cursor.fetchall()
        topic_breakdown = []
        strong_skills = []
        weak_skills = []
        for tr in topic_rows:
            t_name = tr["topic"]
            t_avg = round(tr["avg_score"] or 0.0, 1)
            t_count = tr["count"]
            topic_breakdown.append({
                "topic": t_name,
                "score": t_avg,
                "count": t_count,
            })
            if t_avg >= 7.0:
                strong_skills.append(t_name)
            else:
                weak_skills.append(t_name)

        # Structured top 3 skill improvements from actual evaluations
        skill_improvements = []
        sorted_by_need = sorted(topic_breakdown, key=lambda x: (x["score"], -x["count"]))
        for item in sorted_by_need:
            if len(skill_improvements) >= 3:
                break
            t_title = str(item["topic"]).strip()
            if not t_title:
                continue
            t_score = item["score"]
            if t_score < 4.0:
                rec = f"Focus on core definitions and syntax mechanisms for {t_title}."
            elif t_score < 7.0:
                rec = f"Practice implementation edge cases and trade-off analysis in {t_title}."
            else:
                rec = f"Reinforce production scalability and performance patterns for {t_title}."

            skill_improvements.append({
                "skill": t_title,
                "score": t_score,
                "score_display": f"{t_score} / 10",
                "percentage": int(round(t_score * 10)),
                "recommendation": rec,
            })

        if total > 0 and avg_comm < 7.0 and len(skill_improvements) < 3:
            skill_improvements.append({
                "skill": "Technical Communication",
                "score": avg_comm,
                "score_display": f"{avg_comm} / 10",
                "percentage": int(round(avg_comm * 10)),
                "recommendation": "Practice structuring answers with Definition -> Mechanism -> Trade-offs.",
            })

        # AI Readiness Score Calculation (0-100):
        # 60% technical competence (scaled to 100) + 40% communication clarity (scaled to 100)
        if total > 0:
            tech_pct = min(100, max(0, int(average * 10)))
            comm_pct = min(100, max(0, int(avg_comm * 10)))
            readiness_score = int(round(tech_pct * 0.6 + comm_pct * 0.4))
        else:
            tech_pct = 0
            comm_pct = 0
            readiness_score = 0

        # Active resume lookup for this user (Strictly resume-specific dashboard association)
        cursor.execute(
            """
            SELECT id, filename, extracted_text, skills, analysis, jd_match, created_at
            FROM resumes
            WHERE user_id = ? AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user_id,)
        )
        active_res_row = cursor.fetchone()
        active_resume_data = None
        if active_res_row:
            try:
                res_skills = json.loads(active_res_row["skills"]) if active_res_row["skills"] else []
            except Exception:
                res_skills = []
            try:
                res_analysis = json.loads(active_res_row["analysis"]) if active_res_row["analysis"] else {}
            except Exception:
                res_analysis = {}
            try:
                res_jd = json.loads(active_res_row["jd_match"]) if active_res_row["jd_match"] else None
            except Exception:
                res_jd = None

            active_resume_data = {
                "resume_id": active_res_row["id"],
                "filename": active_res_row["filename"],
                "ats_score": res_analysis.get("ats_score"),
                "skills": res_skills,
                "analysis": res_analysis,
                "jd_match": res_jd,
                "created_at": active_res_row["created_at"],
            }

        conn.close()

        # Structured, role-aligned skill performance calculation
        from services.skill_performance_service import calculate_user_skill_performance
        requested_role = (request.args.get("role") or "").strip()
        target_role_for_skills = requested_role or most_practiced_role
        skill_perf = calculate_user_skill_performance(
            user_id=user_id,
            target_role=target_role_for_skills,
        )

        latest_score = score_trends[-1]["score"] if score_trends else 0.0

        return jsonify({
            "total": total,
            "average": average,
            "best": best,
            "latest_score": latest_score,
            "latest_interview": latest_interview,
            "created_at": created_at,
            "readiness_score": readiness_score,
            "technical_pct": tech_pct,
            "communication_pct": comm_pct,
            "most_practiced_role": most_practiced_role,
            "target_role": skill_perf.get("target_role", target_role_for_skills),
            "avg_communication": avg_comm,
            "score_trends": score_trends,
            "topic_breakdown": topic_breakdown,
            "strong_skills": [s["skill"] for s in skill_perf.get("strong_skills", [])],
            "weak_skills": [s["skill"] for s in skill_perf.get("weak_skills", [])],
            "active_resume": active_resume_data,
            "has_active_resume": bool(active_resume_data),
            "skill_improvements": skill_perf.get("weak_skills", [])[:3] if skill_perf.get("weak_skills") else skill_improvements,
            "skill_performance": skill_perf,
        })

    except Exception as e:
        _safe_print("[DASHBOARD FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch dashboard metrics",
            "message": "Failed to fetch dashboard metrics"
        }), 500


@app.route("/roadmap", methods=["GET", "OPTIONS"])
def get_roadmap():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        role = request.args.get("role") or ""

        if not user_id:
            fallback_role = role or "Software Engineer"
            roadmap = _build_fallback_roadmap(fallback_role, [])
            return jsonify({
                "success": True,
                "roadmap": roadmap,
                "completed_tasks": [],
                "is_guest": True,
            })

        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if role:
            cursor.execute(
                """
                SELECT id, role, roadmap_data, completed_tasks, updated_at
                FROM learning_roadmaps
                WHERE user_id = ? AND LOWER(role) = LOWER(?)
                ORDER BY updated_at DESC, id DESC
                LIMIT 1
                """,
                (user_id, role.strip())
            )
        else:
            cursor.execute(
                """
                SELECT id, role, roadmap_data, completed_tasks, updated_at
                FROM learning_roadmaps
                WHERE user_id = ?
                ORDER BY updated_at DESC, id DESC
                LIMIT 1
                """,
                (user_id,)
            )

        row = cursor.fetchone()

        if row:
            roadmap_data = json.loads(row["roadmap_data"])
            completed = json.loads(row["completed_tasks"] or "[]")
            conn.close()
            return jsonify({
                "success": True,
                "roadmap_id": row["id"],
                "role": row["role"],
                "roadmap": roadmap_data,
                "completed_tasks": completed,
                "updated_at": row["updated_at"],
            })

        # No saved roadmap yet: inspect latest interview to find weak skills and role
        cursor.execute(
            """
            SELECT role
            FROM interviews
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (user_id,)
        )
        inv_row = cursor.fetchone()
        target_role = role or (inv_row["role"] if inv_row else "Full Stack Developer")

        cursor.execute(
            """
            SELECT d.topic
            FROM interview_details d
            JOIN interviews i ON d.interview_id = i.id
            WHERE i.user_id = ? AND d.technical_score < 7.0 AND d.topic IS NOT NULL AND d.topic != ''
            LIMIT 5
            """,
            (user_id,)
        )
        weak_topics = [r["topic"] for r in cursor.fetchall()]

        roadmap = generate_learning_roadmap(target_role, weak_skills=weak_topics)

        cursor.execute(
            """
            INSERT INTO learning_roadmaps (user_id, role, roadmap_data, completed_tasks)
            VALUES (?, ?, ?, '[]')
            """,
            (user_id, target_role, json.dumps(roadmap))
        )
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()

        return jsonify({
            "success": True,
            "roadmap_id": new_id,
            "role": target_role,
            "roadmap": roadmap,
            "completed_tasks": [],
        })

    except Exception as e:
        _safe_print("[GET ROADMAP FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to load learning roadmap",
            "message": str(e)
        }), 500


@app.route("/roadmap/generate", methods=["POST", "OPTIONS"])
def generate_roadmap_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        data = request.get_json() or {}
        role = str(data.get("role") or "Software Engineer").strip()
        weak_skills = data.get("weak_skills") or []
        resume_skills = data.get("resume_skills") or []
        missing_skills = data.get("missing_skills") or []

        roadmap = generate_learning_roadmap(
            role=role,
            weak_skills=weak_skills,
            resume_skills=resume_skills,
            missing_skills=missing_skills
        )

        saved_id = None
        if user_id:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO learning_roadmaps (user_id, role, roadmap_data, completed_tasks)
                VALUES (?, ?, ?, '[]')
                """,
                (user_id, role, json.dumps(roadmap))
            )
            conn.commit()
            saved_id = cursor.lastrowid
            conn.close()

        return jsonify({
            "success": True,
            "roadmap_id": saved_id,
            "role": role,
            "roadmap": roadmap,
            "completed_tasks": [],
        })

    except Exception as e:
        _safe_print("[GENERATE ROADMAP FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate learning roadmap",
            "message": str(e)
        }), 500


@app.route("/roadmap/toggle_task", methods=["POST", "OPTIONS"])
def toggle_roadmap_task():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        data = request.get_json() or {}
        task_id = str(data.get("task_id") or "").strip()
        completed = bool(data.get("completed"))
        roadmap_id = data.get("roadmap_id")

        if not task_id:
            return jsonify({"success": False, "message": "task_id is required"}), 400

        if not user_id:
            return jsonify({"success": True, "task_id": task_id, "completed": completed, "is_guest": True})

        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if roadmap_id:
            cursor.execute(
                "SELECT id, completed_tasks FROM learning_roadmaps WHERE id = ? AND user_id = ?",
                (roadmap_id, user_id)
            )
        else:
            cursor.execute(
                "SELECT id, completed_tasks FROM learning_roadmaps WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
                (user_id,)
            )

        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"success": False, "message": "Roadmap not found"}), 404

        target_roadmap_id = row["id"]
        try:
            tasks_list = json.loads(row["completed_tasks"] or "[]")
            if not isinstance(tasks_list, list):
                tasks_list = []
        except Exception:
            tasks_list = []

        if completed:
            if task_id not in tasks_list:
                tasks_list.append(task_id)
        else:
            tasks_list = [t for t in tasks_list if t != task_id]

        cursor.execute(
            """
            UPDATE learning_roadmaps
            SET completed_tasks = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (json.dumps(tasks_list), target_roadmap_id)
        )
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "roadmap_id": target_roadmap_id,
            "completed_tasks": tasks_list,
        })

    except Exception as e:
        _safe_print("[TOGGLE TASK FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to update task completion",
            "message": str(e)
        }), 500


@app.route("/profile", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user_profile():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, name, email, created_at FROM users WHERE id = ?",
            (user_id,)
        )
        user_row = cursor.fetchone()
        conn.close()

        if not user_row:
            return jsonify({
                "success": False,
                "error": "User not found",
                "message": "User not found"
            }), 404

        return jsonify({
            "success": True,
            "user": {
                "id": user_row[0],
                "name": user_row[1],
                "email": user_row[2],
                "created_at": user_row[3]
            }
        }), 200

    except Exception as e:
        _safe_print("[PROFILE FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch user profile",
            "message": "Failed to fetch user profile"
        }), 500


@app.route("/profile", methods=["PUT", "OPTIONS"])
@jwt_required()
def update_user_profile():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()

        if not name:
            return jsonify({
                "success": False,
                "error": "Name cannot be empty",
                "message": "Full name is required"
            }), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        conn.commit()

        cursor.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"success": False, "error": "User not found"}), 404

        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "user": {
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "created_at": row[3]
            }
        }), 200

    except Exception as e:
        _safe_print("[PROFILE UPDATE FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to update profile",
            "message": str(e)
        }), 500


@app.route("/change_password", methods=["POST", "OPTIONS"])
@jwt_required()
def change_user_password():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        current_password = data.get("current_password", "")
        new_password = data.get("new_password", "")

        if not new_password or len(new_password) < 6:
            return jsonify({
                "success": False,
                "error": "Password length error",
                "message": "New password must be at least 6 characters long"
            }), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            return jsonify({"success": False, "error": "User not found"}), 404

        stored_hash = row[0]
        # Verify current password if user has a standard hashed password
        if stored_hash and not check_password_hash(stored_hash, current_password):
            conn.close()
            return jsonify({
                "success": False,
                "error": "Invalid password",
                "message": "Current password does not match"
            }), 400

        new_hash = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_hash, user_id))
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Password changed successfully"
        }), 200

    except Exception as e:
        _safe_print("[CHANGE PASSWORD FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to change password",
            "message": str(e)
        }), 500


@app.route("/download_report", methods=["POST", "OPTIONS"])
@app.route("/api/download_report", methods=["POST", "OPTIONS"])
def download_report():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        results = data.get("results", [])
        summary = data.get("summary", {})

        filename = generate_pdf(results, summary)
        return send_file(filename, as_attachment=True, download_name="Interview_Report.pdf")

    except Exception as e:
        _safe_print("[PDF REPORT FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate PDF report",
            "message": "Failed to generate PDF report"
        }), 500


@app.route("/signup", methods=["POST", "OPTIONS"])
def signup():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "")

        if not name or not email or not password:
            return jsonify({
                "success": False,
                "error": "All fields are required",
                "message": "All fields are required"
            }), 400

        success, message = register_user(name, email, password)
        if not success:
            return jsonify({
                "success": False,
                "error": message,
                "message": message
            }), 400

        user = login_user(email, password)
        token = None
        if user:
            token = create_access_token(identity=str(user["id"]))

        return jsonify({
            "success": True,
            "message": message,
            "user": user,
            "token": token
        })

    except Exception as e:
        _safe_print("[SIGNUP FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Registration failed. Please try again.",
            "message": "Registration failed. Please try again."
        }), 500


@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        email = data.get("email", "").strip()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({
                "success": False,
                "error": "Email and password are required",
                "message": "Email and password are required"
            }), 400

        user = login_user(email, password)
        if not user:
            return jsonify({
                "success": False,
                "error": "Invalid email or password",
                "message": "Invalid email or password"
            }), 401

        token = create_access_token(identity=str(user["id"]))

        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        })

    except Exception as e:
        _safe_print("[LOGIN FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Login failed. Please try again.",
            "message": "Login failed. Please try again."
        }), 500


@app.route("/auth/verify", methods=["GET", "OPTIONS"])
@app.route("/api/auth/verify", methods=["GET", "OPTIONS"])
def verify_auth_token_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        verify_jwt_in_request()
        raw_identity = get_jwt_identity()
        if not raw_identity:
            return jsonify({
                "success": False,
                "error": "No identity found in token",
                "message": "Session token lacks identity."
            }), 401

        user_id = int(raw_identity)
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        conn.close()

        if not user_row:
            return jsonify({
                "success": False,
                "error": "User account no longer exists",
                "message": "User account no longer exists or was deleted."
            }), 401

        return jsonify({
            "success": True,
            "user": {
                "id": user_row["id"],
                "name": user_row["name"],
                "email": user_row["email"]
            }
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Session token verification failed",
            "message": str(e)
        }), 401


@app.route("/learning", methods=["GET", "POST", "OPTIONS"])
@app.route("/api/learning", methods=["GET", "POST", "OPTIONS"])
@app.route("/learning/resources", methods=["GET", "POST", "OPTIONS"])
@app.route("/api/learning/resources", methods=["GET", "POST", "OPTIONS"])
def learning():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ", 1)[1].strip()
            if token_str:
                try:
                    decoded = decode_token(token_str)
                    user_id = int(decoded.get("sub"))
                except Exception as token_err:
                    _safe_print(f"[AUTH NOTE] Token expired or invalid on /learning, proceeding as guest: {token_err}")
                    user_id = None

        if request.method == "GET":
            role = (request.args.get("role") or "Software Engineer").strip()
            raw_skills = (
                request.args.get("skill")
                or request.args.get("course")
                or request.args.get("q")
                or request.args.get("query")
                or request.args.get("weak_skills")
                or request.args.get("skills")
                or request.args.get("topics")
                or ""
            )
            level = (
                request.args.get("level")
                or request.args.get("difficulty")
                or request.args.get("preparation_level")
                or None
            )
        else:
            data = request.get_json(silent=True) or {}
            role = (data.get("role") or "Software Engineer").strip()
            raw_skills = (
                data.get("skill")
                or data.get("course")
                or data.get("q")
                or data.get("query")
                or data.get("weak_skills")
                or data.get("skills")
                or data.get("topics")
                or []
            )
            level = (
                data.get("level")
                or data.get("difficulty")
                or data.get("preparation_level")
                or None
            )

        # Normalize weak_skills to list of strings
        if isinstance(raw_skills, str):
            weak_skills = [s.strip() for s in raw_skills.split(",") if s.strip()]
        elif isinstance(raw_skills, list):
            weak_skills = [str(s).strip() for s in raw_skills if str(s).strip()]
        else:
            weak_skills = []

        if not role:
            role = "Software Engineer"

        if not weak_skills:
            return jsonify({
                "success": False,
                "error": "At least one skill is required",
                "message": "At least one skill is required"
            }), 400

        from services.learning_resources_service import get_curated_learning_resources
        content = get_curated_learning_resources(role, weak_skills, level=level)
        topics = content.get("topics", [])
        resources = content.get("resources", [])

        return jsonify({
            "success": True,
            "role": role,
            "topics": topics,
            "resources": resources
        })

    except Exception as e:
        _safe_print("[LEARNING FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "message": "Failed to generate learning content. Please try again.",
            "error": str(e)
        }), 500


@app.route("/google-login", methods=["POST", "OPTIONS"])
@app.route("/api/google-login", methods=["POST", "OPTIONS"])
def google_login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json(silent=True) or {}
        credential = data.get("credential") or data.get("token") or data.get("id_token")

        if not credential:
            _safe_print("[AUTH ERROR] Missing credential token in /google-login request.")
            return jsonify({
                "success": False,
                "error": "Google credential token is required",
                "message": "Google credential token is required"
            }), 400

        # Verify Google token securely on the server
        success, result = verify_google_token(credential)
        if not success:
            _safe_print(f"[AUTH ERROR] Google token verification rejected: {result}")
            return jsonify({
                "success": False,
                "error": result,
                "message": result
            }), 401

        user = result
        token = create_access_token(identity=str(user["id"]))

        return jsonify({
            "success": True,
            "token": token,
            "user": user
        })

    except Exception as e:
        _safe_print("[GOOGLE LOGIN FAILURE]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Google login failed. Please try again.",
            "message": "Google login failed. Please try again."
        }), 401



# =============================================================================
# AI INTERVIEW MEMORY & PERSONALIZED FOLLOW-UP ENGINE ENDPOINTS
# =============================================================================

@app.route("/interview-memory/overview", methods=["GET", "OPTIONS"])
@app.route("/api/interview-memory/overview", methods=["GET", "OPTIONS"])
@jwt_required()
def interview_memory_overview():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        overview = get_interview_memory_overview(user_id=user_id)
        return jsonify({
            "success": True,
            "overview": overview
        }), 200
    except Exception as e:
        _safe_print("[MEMORY OVERVIEW ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch interview memory overview.",
            "message": str(e)
        }), 500


@app.route("/interview-memory/weak-areas", methods=["GET", "OPTIONS"])
@app.route("/api/interview-memory/weak-areas", methods=["GET", "OPTIONS"])
@jwt_required()
def interview_memory_weak_areas():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        limit = int(request.args.get("limit", 10))
        weak_areas = get_weak_areas(user_id=user_id, limit=limit)
        return jsonify({
            "success": True,
            "weak_areas": weak_areas
        }), 200
    except Exception as e:
        _safe_print("[MEMORY WEAK AREAS ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch candidate weak areas.",
            "message": str(e)
        }), 500


@app.route("/interview-memory/strong-areas", methods=["GET", "OPTIONS"])
@app.route("/api/interview-memory/strong-areas", methods=["GET", "OPTIONS"])
@jwt_required()
def interview_memory_strong_areas():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        limit = int(request.args.get("limit", 10))
        strong_areas = get_strong_areas(user_id=user_id, limit=limit)
        return jsonify({
            "success": True,
            "strong_areas": strong_areas
        }), 200
    except Exception as e:
        _safe_print("[MEMORY STRONG AREAS ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch candidate strong areas.",
            "message": str(e)
        }), 500


@app.route("/interview-memory/progress", methods=["GET", "OPTIONS"])
@app.route("/api/interview-memory/progress", methods=["GET", "OPTIONS"])
@jwt_required()
def interview_memory_progress():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        progress = get_skill_progress(user_id=user_id)
        improvements = get_recent_improvements(user_id=user_id, limit=6)
        return jsonify({
            "success": True,
            "progress": progress,
            "improvements": improvements
        }), 200
    except Exception as e:
        _safe_print("[MEMORY PROGRESS ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch candidate skill progress.",
            "message": str(e)
        }), 500


@app.route("/interview-memory/recommendations", methods=["GET", "OPTIONS"])
@app.route("/api/interview-memory/recommendations", methods=["GET", "OPTIONS"])
@jwt_required()
def interview_memory_recommendations():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        role = request.args.get("role") or None
        data = get_next_interview_recommendations(user_id=user_id, role=role)
        return jsonify({
            "success": True,
            "recommendations": data
        }), 200
    except Exception as e:
        _safe_print("[MEMORY RECOMMENDATIONS ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate next interview recommendations.",
            "message": str(e)
        }), 500


@app.route("/interview-memory/update", methods=["POST", "OPTIONS"])
@app.route("/api/interview-memory/update", methods=["POST", "OPTIONS"])
@jwt_required()
def interview_memory_update():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        role = str(data.get("role") or "Candidate").strip()
        interview_mode = str(data.get("interview_mode") or "standard").strip()
        results = data.get("results") or []
        overall_summary = data.get("overall_summary") or {}
        interview_id = data.get("interview_id")

        if not results:
            return jsonify({
                "success": False,
                "error": "Results array is required to update interview memory."
            }), 400

        updated = record_interview_memory(
            user_id=user_id,
            role=role,
            interview_mode=interview_mode,
            results=results,
            overall_summary=overall_summary,
            interview_id=interview_id,
        )

        return jsonify({
            "success": updated,
            "message": "Interview memory updated successfully." if updated else "Could not update memory."
        }), 200
    except Exception as e:
        _safe_print("[MEMORY UPDATE ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to update interview memory.",
            "message": str(e)
        }), 500


@app.route("/interview-memory/personalized-questions", methods=["POST", "OPTIONS"])
@app.route("/api/interview-memory/personalized-questions", methods=["POST", "OPTIONS"])
@jwt_required()
def interview_memory_personalized_questions():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        role = str(data.get("role") or "Software Developer").strip()
        skills = data.get("skills") or []
        job_description = str(data.get("job_description") or "")
        difficulty = str(data.get("difficulty") or "medium")
        previous_questions = data.get("previous_questions") or []

        question_obj = generate_personalized_followup_question(
            user_id=user_id,
            role=role,
            skills=skills,
            job_description=job_description,
            difficulty=difficulty,
            previous_questions=previous_questions,
        )

        return jsonify({
            "success": True,
            "question": question_obj
        }), 200
    except Exception as e:
        _safe_print("[PERSONALIZED QUESTION ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate personalized interview question.",
            "message": str(e)
        }), 500


@app.route("/interview-memory/reset", methods=["POST", "OPTIONS"])
@app.route("/api/interview-memory/reset", methods=["POST", "OPTIONS"])
@jwt_required()
def interview_memory_reset():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        success = reset_interview_memory(user_id=user_id)
        return jsonify({
            "success": success,
            "message": "AI interview memory has been reset successfully. Interview history remains preserved."
        }), 200
    except Exception as e:
        _safe_print("[MEMORY RESET ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to reset interview memory.",
            "message": str(e)
        }), 500


# =============================================================================
# AI INTERVIEW READINESS PREDICTION & SKILL GAP RADAR ENDPOINTS
# =============================================================================

@app.route("/readiness/overview", methods=["GET", "OPTIONS"])
@app.route("/api/readiness/overview", methods=["GET", "OPTIONS"])
@jwt_required()
def readiness_overview():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        role = request.args.get("role") or None
        resume_match_raw = request.args.get("resume_match_score")
        resume_match_score = float(resume_match_raw) if resume_match_raw is not None else None

        # Verify active resume in SQLite: if resume is removed, never allow stale resume score
        try:
            conn = get_db_connection()
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute(
                "SELECT jd_match FROM resumes WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1",
                (user_id,)
            )
            active_res = cur.fetchone()
            conn.close()

            if not active_res:
                resume_match_score = None
            elif resume_match_score is None and active_res["jd_match"]:
                parsed_jd = json.loads(active_res["jd_match"])
                resume_match_score = parsed_jd.get("match_score")
        except Exception:
            pass

        readiness_data = calculate_readiness_score(
            user_id=user_id,
            role=role,
            resume_match_score=resume_match_score
        )
        return jsonify({
            "success": True,
            "readiness": readiness_data
        }), 200
    except Exception as e:
        _safe_print("[READINESS OVERVIEW ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to calculate interview readiness score.",
            "message": str(e)
        }), 500


@app.route("/readiness/skill-gaps", methods=["GET", "OPTIONS"])
@app.route("/api/readiness/skill-gaps", methods=["GET", "OPTIONS"])
@jwt_required()
def readiness_skill_gaps():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        role = request.args.get("role") or None
        gaps_data = analyze_skill_gaps(user_id=user_id, role=role)
        return jsonify({
            "success": True,
            "skill_gaps": gaps_data
        }), 200
    except Exception as e:
        _safe_print("[SKILL GAPS ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to analyze candidate skill gaps.",
            "message": str(e)
        }), 500


@app.route("/readiness/recommendations", methods=["GET", "OPTIONS"])
@app.route("/api/readiness/recommendations", methods=["GET", "OPTIONS"])
@jwt_required()
def readiness_recommendations():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        role = request.args.get("role") or None
        recs = generate_readiness_recommendations(user_id=user_id, role=role)
        return jsonify({
            "success": True,
            "recommendations": recs
        }), 200
    except Exception as e:
        _safe_print("[READINESS RECOMMENDATIONS ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate readiness recommendations.",
            "message": str(e)
        }), 500


@app.route("/readiness/history", methods=["GET", "OPTIONS"])
@app.route("/api/readiness/history", methods=["GET", "OPTIONS"])
@jwt_required()
def readiness_history():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        limit = int(request.args.get("limit", 10))
        history_rows = get_readiness_history(user_id=user_id, limit=limit)
        return jsonify({
            "success": True,
            "history": history_rows
        }), 200
    except Exception as e:
        _safe_print("[READINESS HISTORY ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch readiness history.",
            "message": str(e)
        }), 500


# =============================================================================
# AI PERSONALIZED STUDY PLANNER ENDPOINTS
# =============================================================================
from services.study_planner_service import (
    generate_study_plan,
    get_study_plan_overview,
    delete_study_plan,
    update_task_status,
    reschedule_study_task,
    generate_ai_learning_content,
    record_learning_activity,
    adapt_existing_study_plan,
    get_calendar_schedule,
    get_learning_progress,
)


@app.route("/study-planner/generate", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/generate", methods=["POST", "OPTIONS"])
@jwt_required()
def generate_study_plan_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        topic = str(data.get("topic") or data.get("topics") or "").strip()
        target_role = str(data.get("target_role") or data.get("role") or "").strip()

        # Validate that at least a topic or target role is provided
        if not topic and not target_role:
            return jsonify({
                "success": False,
                "error": "Topic is required. Please enter at least one topic (e.g. Python, SQL, React).",
                "message": "Topic is required. Please enter at least one topic (e.g. Python, SQL, React)."
            }), 400

        duration_days = int(data.get("duration_days") or 14)
        daily_study_minutes = int(data.get("daily_study_minutes") or 60)
        preparation_level = str(data.get("preparation_level") or "Intermediate").strip()
        resume_text = str(data.get("resume_text") or "")
        job_description = str(data.get("job_description") or "")
        resume_skills = data.get("resume_skills") or []

        overview = generate_study_plan(
            user_id=user_id,
            target_role=target_role or (f"{topic} Specialist" if topic else "Full Stack Developer"),
            topic=topic,
            duration_days=duration_days,
            daily_study_minutes=daily_study_minutes,
            preparation_level=preparation_level,
            resume_text=resume_text,
            job_description=job_description,
            resume_skills=resume_skills
        )

        return jsonify({
            "success": True,
            "message": "Personalized study plan created successfully.",
            "plan": overview
        }), 200
    except Exception as e:
        _safe_print("[STUDY PLAN GENERATE ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate personalized study plan.",
            "message": str(e)
        }), 500


@app.route("/study-planner/overview", methods=["GET", "OPTIONS"])
@app.route("/api/study-planner/overview", methods=["GET", "OPTIONS"])
@jwt_required()
def get_study_plan_overview_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        plan_id_arg = request.args.get("plan_id")
        plan_id = int(plan_id_arg) if plan_id_arg else None

        overview = get_study_plan_overview(user_id=user_id, plan_id=plan_id)
        return jsonify({
            "success": True,
            "data": overview
        }), 200
    except Exception as e:
        _safe_print("[STUDY PLAN OVERVIEW ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to retrieve study plan overview.",
            "message": str(e)
        }), 500


@app.route("/study-planner/tasks", methods=["GET", "OPTIONS"])
@app.route("/api/study-planner/tasks", methods=["GET", "OPTIONS"])
@jwt_required()
def get_study_tasks_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        task_date = request.args.get("date")
        plan_id_arg = request.args.get("plan_id")
        plan_id = int(plan_id_arg) if plan_id_arg else None

        overview = get_study_plan_overview(user_id=user_id, plan_id=plan_id)
        if not overview.get("has_active_plan"):
            return jsonify({
                "success": True,
                "tasks": [],
                "has_active_plan": False
            }), 200

        all_tasks = overview.get("tasks", [])
        if task_date:
            filtered = [t for t in all_tasks if t["task_date"] == task_date]
        else:
            filtered = all_tasks

        return jsonify({
            "success": True,
            "tasks": filtered,
            "has_active_plan": True
        }), 200
    except Exception as e:
        _safe_print("[STUDY TASKS ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to fetch study tasks.",
            "message": str(e)
        }), 500


@app.route("/study-planner/tasks/<int:task_id>", methods=["PATCH", "OPTIONS"])
@app.route("/api/study-planner/tasks/<int:task_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_study_task_endpoint(task_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        status = str(data.get("status") or "").strip().lower()
        skip_reason = data.get("skip_reason")

        if not status:
            return jsonify({"success": False, "error": "status is required."}), 400

        res = update_task_status(user_id=user_id, task_id=task_id, status=status, skip_reason=skip_reason)
        return jsonify(res), 200
    except Exception as e:
        _safe_print(f"[STUDY TASK UPDATE ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400


@app.route("/study-planner/tasks/<int:task_id>/reschedule", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/tasks/<int:task_id>/reschedule", methods=["POST", "OPTIONS"])
@jwt_required()
def reschedule_study_task_endpoint(task_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        new_date = str(data.get("new_date") or "").strip()

        if not new_date:
            return jsonify({"success": False, "error": "new_date is required (YYYY-MM-DD)."}), 400

        res = reschedule_study_task(user_id=user_id, task_id=task_id, new_date=new_date)
        return jsonify(res), 200
    except Exception as e:
        _safe_print(f"[STUDY TASK RESCHEDULE ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400


@app.route("/study-planner/calendar", methods=["GET", "OPTIONS"])
@app.route("/api/study-planner/calendar", methods=["GET", "OPTIONS"])
@jwt_required()
def get_study_calendar_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        view_mode = request.args.get("view_mode", "week")
        plan_id_arg = request.args.get("plan_id")
        plan_id = int(plan_id_arg) if plan_id_arg else None

        cal = get_calendar_schedule(user_id=user_id, plan_id=plan_id, view_mode=view_mode)
        return jsonify({
            "success": True,
            "calendar": cal
        }), 200
    except Exception as e:
        _safe_print(f"[STUDY CALENDAR ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/study-planner/practice", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/practice", methods=["POST", "OPTIONS"])
@jwt_required()
def study_planner_practice_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        topic = str(data.get("topic") or "Core Technical Concepts").strip()
        role = str(data.get("role") or "Full Stack Developer").strip()
        content_type = str(data.get("content_type") or "explain").strip()
        user_answer = data.get("user_answer")
        question_id = data.get("question_id")

        result = generate_ai_learning_content(
            topic=topic,
            role=role,
            content_type=content_type,
            user_answer=user_answer,
            question_id=question_id
        )
        return jsonify(result), 200
    except Exception as e:
        _safe_print(f"[STUDY PRACTICE ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/study-planner/activity", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/activity", methods=["POST", "OPTIONS"])
@jwt_required()
def record_study_activity_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        task_id = data.get("task_id")
        topic = str(data.get("topic") or "General Preparation").strip()
        activity_type = str(data.get("activity_type") or "practice").strip()
        practice_score = float(data.get("practice_score") or 75.0)
        total_questions = int(data.get("total_questions") or 0)
        correct_answers = int(data.get("correct_answers") or 0)
        activity_data = data.get("activity_data") or {}

        res = record_learning_activity(
            user_id=user_id,
            task_id=task_id,
            topic=topic,
            activity_type=activity_type,
            practice_score=practice_score,
            total_questions=total_questions,
            correct_answers=correct_answers,
            activity_data=activity_data
        )
        return jsonify(res), 200
    except Exception as e:
        _safe_print(f"[RECORD ACTIVITY ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/study-planner/progress", methods=["GET", "OPTIONS"])
@app.route("/api/study-planner/progress", methods=["GET", "OPTIONS"])
@jwt_required()
def get_study_progress_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        prog = get_learning_progress(user_id=user_id)
        return jsonify({
            "success": True,
            "progress": prog
        }), 200
    except Exception as e:
        _safe_print(f"[STUDY PROGRESS ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/study-planner/regenerate", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/regenerate", methods=["POST", "OPTIONS"])
@jwt_required()
def regenerate_study_plan_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        target_role = str(data.get("target_role") or "Full Stack Developer").strip()
        duration_days = int(data.get("duration_days") or 14)
        daily_study_minutes = int(data.get("daily_study_minutes") or 60)
        preparation_level = str(data.get("preparation_level") or "Intermediate").strip()

        overview = generate_study_plan(
            user_id=user_id,
            target_role=target_role,
            duration_days=duration_days,
            daily_study_minutes=daily_study_minutes,
            preparation_level=preparation_level
        )
        return jsonify({
            "success": True,
            "message": "Study plan regenerated successfully.",
            "plan": overview
        }), 200
    except Exception as e:
        _safe_print(f"[STUDY REGENERATE ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/study-planner/adapt", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/adapt", methods=["POST", "OPTIONS"])
@jwt_required()
def adapt_study_plan_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        reason = str(data.get("reason") or "performance")
        metadata = data.get("metadata") or {}

        res = adapt_existing_study_plan(user_id=user_id, reason=reason, metadata=metadata)
        return jsonify(res), 200
    except Exception as e:
        _safe_print(f"[STUDY ADAPT ERROR]: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/study-planner/plan", methods=["DELETE", "OPTIONS"])
@app.route("/api/study-planner/plan", methods=["DELETE", "OPTIONS"])
@app.route("/study-planner/plan/<int:plan_id>", methods=["DELETE", "OPTIONS"])
@app.route("/api/study-planner/plan/<int:plan_id>", methods=["DELETE", "OPTIONS"])
@app.route("/roadmap/plan/<int:plan_id>", methods=["DELETE", "OPTIONS"])
@app.route("/api/roadmap/plan/<int:plan_id>", methods=["DELETE", "OPTIONS"])
@app.route("/roadmap/<int:plan_id>", methods=["DELETE", "OPTIONS"])
@app.route("/api/roadmap/<int:plan_id>", methods=["DELETE", "OPTIONS"])
def delete_study_plan_endpoint(plan_id=None):
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        if not user_id:
            try:
                jwt_sub = get_jwt_identity()
                if jwt_sub:
                    user_id = int(jwt_sub)
            except Exception:
                pass

        if not user_id:
            _safe_print("[STUDY PLANNER DELETE]: Unauthorized - no valid token found")
            return jsonify({
                "success": False,
                "error": "Unauthorized",
                "message": "Authentication required. Please sign in to delete your roadmap."
            }), 401

        target_plan_id = plan_id
        if target_plan_id is None:
            # Check query parameters
            arg_id = request.args.get("plan_id") or request.args.get("id")
            if arg_id:
                try:
                    target_plan_id = int(arg_id)
                except ValueError:
                    return jsonify({
                        "success": False,
                        "error": "Invalid roadmap ID.",
                        "message": "Roadmap ID must be a valid positive integer."
                    }), 400
            else:
                # Check JSON body
                body_data = request.get_json(silent=True) or {}
                body_id = body_data.get("plan_id") or body_data.get("id")
                if body_id:
                    try:
                        target_plan_id = int(body_id)
                    except ValueError:
                        return jsonify({
                            "success": False,
                            "error": "Invalid roadmap ID.",
                            "message": "Roadmap ID must be a valid positive integer."
                        }), 400

        # Validate ID if provided
        if target_plan_id is not None and target_plan_id <= 0:
            return jsonify({
                "success": False,
                "error": "Invalid roadmap ID.",
                "message": "Roadmap ID must be a positive integer."
            }), 400

        _safe_print(f"[STUDY PLANNER DELETE] User #{user_id} executing deletion for plan #{target_plan_id}")
        result = delete_study_plan(user_id=user_id, plan_id=target_plan_id)
        _safe_print(f"[STUDY PLANNER DELETE RESULT]: {result}")
        if not result.get("success"):
            status_code = 403 if result.get("code") == "FORBIDDEN" else 404
            return jsonify(result), status_code

        return jsonify(result), 200

    except Exception as e:
        _safe_print("[STUDY PLANNER DELETE ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to delete study roadmap",
            "message": str(e)
        }), 500


# =============================================================================
# DAILY QUIZ PREPARATION SYSTEM ENDPOINTS
# =============================================================================

@app.route("/study-planner/daily-quiz", methods=["GET", "OPTIONS"])
@app.route("/api/study-planner/daily-quiz", methods=["GET", "OPTIONS"])
def get_daily_quiz_endpoint():
    """Retrieves or generates the daily quiz for a specific day in the learning plan."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ", 1)[1].strip()
            if token_str:
                try:
                    decoded = decode_token(token_str)
                    user_id = int(decoded.get("sub"))
                except Exception:
                    pass
        if not user_id:
            try:
                user_id = int(get_jwt_identity())
            except Exception:
                pass

        if not user_id:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        plan_id_arg = request.args.get("plan_id")
        day_number_arg = request.args.get("day_number") or request.args.get("day")
        force_arg = request.args.get("force_regenerate") or request.args.get("retake")

        plan_id = int(plan_id_arg) if plan_id_arg else None
        day_number = int(day_number_arg) if day_number_arg else None
        force_regenerate = str(force_arg).lower() in ("true", "1", "yes")

        from services.daily_quiz_service import get_or_generate_daily_quiz
        result = get_or_generate_daily_quiz(
            user_id=user_id,
            plan_id=plan_id,
            day_number=day_number,
            force_regenerate=force_regenerate
        )

        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    except Exception as e:
        _safe_print("[DAILY QUIZ GET ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to load daily quiz",
            "message": str(e)
        }), 500


@app.route("/study-planner/daily-quiz/submit", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/daily-quiz/submit", methods=["POST", "OPTIONS"])
def submit_daily_quiz_endpoint():
    """Submits answers for a daily quiz, calculates score, and updates learning progress."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ", 1)[1].strip()
            if token_str:
                try:
                    decoded = decode_token(token_str)
                    user_id = int(decoded.get("sub"))
                except Exception:
                    pass
        if not user_id:
            try:
                user_id = int(get_jwt_identity())
            except Exception:
                pass

        if not user_id:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        data = request.get_json(silent=True) or {}
        plan_id = int(data.get("plan_id") or 0)
        day_number = int(data.get("day_number") or 1)
        user_answers = data.get("user_answers") or data.get("answers") or {}

        if not plan_id:
            from services.daily_quiz_service import _get_active_study_plan
            active_plan = _get_active_study_plan(user_id)
            if active_plan:
                plan_id = active_plan["id"]
            else:
                return jsonify({"success": False, "error": "Valid plan_id is required"}), 400

        from services.daily_quiz_service import submit_daily_quiz
        result = submit_daily_quiz(
            user_id=user_id,
            plan_id=plan_id,
            day_number=day_number,
            user_answers=user_answers
        )

        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    except Exception as e:
        _safe_print("[DAILY QUIZ SUBMIT ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to submit daily quiz",
            "message": str(e)
        }), 500


@app.route("/study-planner/daily-quiz/overview", methods=["GET", "OPTIONS"])
@app.route("/api/study-planner/daily-quiz/overview", methods=["GET", "OPTIONS"])
def get_daily_quizzes_overview_endpoint():
    """Returns overview of all daily quizzes (completed vs pending) for the study plan."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ", 1)[1].strip()
            if token_str:
                try:
                    decoded = decode_token(token_str)
                    user_id = int(decoded.get("sub"))
                except Exception:
                    pass
        if not user_id:
            try:
                user_id = int(get_jwt_identity())
            except Exception:
                pass

        if not user_id:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        plan_id_arg = request.args.get("plan_id")
        plan_id = int(plan_id_arg) if plan_id_arg else None

        from services.daily_quiz_service import get_daily_quizzes_overview
        result = get_daily_quizzes_overview(user_id=user_id, plan_id=plan_id)
        return jsonify(result), 200

    except Exception as e:
        _safe_print("[DAILY QUIZ OVERVIEW ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to load daily quizzes overview",
            "message": str(e)
        }), 500


@app.route("/study-planner/daily-quiz/generate", methods=["POST", "OPTIONS"])
@app.route("/api/study-planner/daily-quiz/generate", methods=["POST", "OPTIONS"])
def generate_new_daily_quiz_endpoint():
    """Generates a fresh new daily quiz (e.g. retake with new questions)."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ", 1)[1].strip()
            if token_str:
                try:
                    decoded = decode_token(token_str)
                    user_id = int(decoded.get("sub"))
                except Exception:
                    pass
        if not user_id:
            try:
                user_id = int(get_jwt_identity())
            except Exception:
                pass

        if not user_id:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        data = request.get_json(silent=True) or {}
        plan_id = int(data.get("plan_id") or 0) if data.get("plan_id") else None
        day_number = int(data.get("day_number") or 1)

        from services.daily_quiz_service import get_or_generate_daily_quiz
        result = get_or_generate_daily_quiz(
            user_id=user_id,
            plan_id=plan_id,
            day_number=day_number,
            force_regenerate=True
        )

        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    except Exception as e:
        _safe_print("[DAILY QUIZ GENERATE ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate daily quiz",
            "message": str(e)
        }), 500


@app.route("/study-planner/pdf", methods=["GET", "POST", "OPTIONS"])
@app.route("/api/study-planner/pdf", methods=["GET", "POST", "OPTIONS"])
@app.route("/roadmap/pdf", methods=["GET", "POST", "OPTIONS"])
@app.route("/api/roadmap/pdf", methods=["GET", "POST", "OPTIONS"])
def download_roadmap_pdf_endpoint():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = _get_optional_user_id()
        data = request.get_json(silent=True) or {}

        # User details if available
        user_info = {}
        if user_id:
            try:
                conn = get_db_connection()
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute("SELECT name, email FROM users WHERE id = ?", (user_id,))
                u_row = c.fetchone()
                if u_row:
                    user_info = {"name": u_row["name"], "email": u_row["email"]}
                conn.close()
            except Exception:
                pass

        # Look for plan/roadmap data
        plan_data = data.get("plan") or data.get("roadmap") or (data if ("tasks" in data or "days" in data) else None)

        # If no full plan passed in body, fetch active plan from database
        if not plan_data or (not plan_data.get("tasks") and not plan_data.get("days")):
            if user_id:
                overview = get_study_plan_overview(user_id=user_id)
                if overview and overview.get("has_active_plan"):
                    plan_data = overview

        if not plan_data or (not plan_data.get("has_active_plan") and not plan_data.get("tasks") and not plan_data.get("days")):
            return jsonify({
                "success": False,
                "error": "No active study plan or roadmap found to generate PDF."
            }), 404

        import io
        pdf_bytes = generate_roadmap_pdf(plan_data, user_info=user_info)

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="Intervexa_AI_Learning_Roadmap.pdf"
        )
    except Exception as e:
        _safe_print("[ROADMAP PDF ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to generate roadmap PDF.",
            "message": str(e)
        }), 500


# =============================================================================
# AI CAREER & INTERVIEW ASSISTANT CHATBOT ROUTES
# =============================================================================
@app.route("/api/chat", methods=["POST", "OPTIONS"])
@jwt_required(optional=False)
def ai_chat_message():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        data = request.get_json(silent=True) or {}

        message = str(data.get("message") or "").strip()
        page_context = str(data.get("page_context") or "general").strip().lower()
        page_data = data.get("page_data") or {}
        conversation_id = data.get("conversation_id")

        if not message:
            return jsonify({
                "success": False,
                "error": "Message is required and cannot be empty.",
                "message": "Message is required."
            }), 400

        result = generate_assistant_reply(
            user_id=user_id,
            message=message,
            page_context=page_context,
            page_data=page_data,
            conversation_id=conversation_id,
        )

        return jsonify(result), 200

    except Exception as e:
        _safe_print("[CHAT API ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to process chat message.",
            "message": "The AI assistant is temporarily unavailable. Please try again."
        }), 500


@app.route("/api/chat/history", methods=["GET", "DELETE", "OPTIONS"])
@jwt_required(optional=False)
def ai_chat_history():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        user_id = int(get_jwt_identity())
        conv_id = request.args.get("conversation_id")

        if request.method == "DELETE":
            success = clear_conversation_history(user_id=user_id, conversation_id=conv_id)
            return jsonify({
                "success": success,
                "message": "Conversation history cleared successfully."
            }), 200

        # GET method
        limit = min(50, max(5, int(request.args.get("limit", 30))))
        history = get_conversation_history(user_id=user_id, conversation_id=conv_id, limit=limit)
        return jsonify({
            "success": True,
            "history": history,
            "total_messages": len(history)
        }), 200

    except Exception as e:
        _safe_print("[CHAT HISTORY API ERROR]:\n", traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to retrieve conversation history.",
            "message": str(e)
        }), 500


@app.route("/api/chat/suggested-questions", methods=["GET", "OPTIONS"])
def ai_chat_suggested_questions():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    context = request.args.get("context", "general").strip().lower()
    questions = get_contextual_suggested_questions(page_context=context)
    return jsonify({
        "success": True,
        "context": context,
        "questions": questions
    }), 200


if __name__ == "__main__":
    init_db()
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )