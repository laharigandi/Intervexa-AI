import json
import os
import sys

try:
    from database import get_db_connection
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from database import get_db_connection


import sqlite3


def save_interview(
    user_id,
    role,
    avg_score,
    summary,
    results=None,
    overall_summary=None,
    db_path=None,
    interview_mode="standard",
    interview_type="Standard",
    duration_minutes=None,
    status="completed",
    communication_score=None,
    communication_feedback=None,
    interviewer_personality="technical",
    speaking_metrics=None,
    verification_summary=None,
    answer_verifications=None,
    interview_id=None,
):
    """
    Saves an interview summary and all question-by-question evaluation details
    in a single atomic database transaction. Returns the saved interview_id.
    Includes duplicate suppression on quick retries.
    If any error occurs, rolls back the transaction.
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()

        # Deduplication check: if interview_id was not provided, check if an identical
        # submission occurred within the last 15 seconds to prevent duplicate records on retry.
        if interview_id is None and user_id:
            try:
                cursor.execute(
                    """
                    SELECT id FROM interviews 
                    WHERE user_id = ? AND role = ? AND ABS(avg_score - ?) < 0.05
                    AND created_at >= datetime('now', '-15 seconds')
                    ORDER BY id DESC LIMIT 1
                    """,
                    (user_id, role, float(avg_score or 0))
                )
                dup_row = cursor.fetchone()
                if dup_row:
                    dup_id = dup_row[0] if isinstance(dup_row, tuple) else dup_row["id"]
                    return dup_id
            except Exception:
                pass

        recommendation = ""
        strengths = ""
        weaknesses = ""
        advice = ""
        comm_score_val = communication_score
        comm_fb_val = communication_feedback
        personality_val = interviewer_personality or "technical"
        speaking_metrics_val = speaking_metrics
        verif_summary_val = verification_summary

        if isinstance(overall_summary, dict):
            recommendation = str(overall_summary.get("recommendation") or "").strip()
            strengths = str(overall_summary.get("strengths") or "").strip()
            weaknesses = str(overall_summary.get("weaknesses") or "").strip()
            advice = str(overall_summary.get("advice") or "").strip()
            if comm_score_val is None and "communication_score" in overall_summary:
                comm_score_val = overall_summary.get("communication_score")
            if comm_fb_val is None and "communication_feedback" in overall_summary:
                comm_fb_val = overall_summary.get("communication_feedback")
            if (not personality_val or personality_val == "technical") and "interviewer_personality" in overall_summary:
                personality_val = overall_summary.get("interviewer_personality") or "technical"
            if speaking_metrics_val is None and "speaking_metrics" in overall_summary:
                speaking_metrics_val = overall_summary.get("speaking_metrics")
            if verif_summary_val is None and "verification_summary" in overall_summary:
                verif_summary_val = overall_summary.get("verification_summary")
            if not duration_minutes and "duration_minutes" in overall_summary:
                duration_minutes = overall_summary.get("duration_minutes")

        # Normalize communication feedback to JSON string if it is a dict
        if isinstance(comm_fb_val, (dict, list)):
            try:
                comm_fb_str = json.dumps(comm_fb_val)
            except Exception:
                comm_fb_str = ""
        else:
            comm_fb_str = str(comm_fb_val or "")

        # Normalize speaking metrics & verification summary to JSON strings
        speaking_metrics_str = ""
        if isinstance(speaking_metrics_val, (dict, list)):
            try:
                speaking_metrics_str = json.dumps(speaking_metrics_val)
            except Exception:
                speaking_metrics_str = ""
        elif speaking_metrics_val:
            speaking_metrics_str = str(speaking_metrics_val)

        verif_summary_str = ""
        if isinstance(verif_summary_val, (dict, list)):
            try:
                verif_summary_str = json.dumps(verif_summary_val)
            except Exception:
                verif_summary_str = ""
        elif verif_summary_val:
            verif_summary_str = str(verif_summary_val)

        try:
            comm_score_num = float(comm_score_val) if comm_score_val is not None else None
        except (ValueError, TypeError):
            comm_score_num = None

        cursor.execute("PRAGMA table_info(interviews)")
        interview_cols = {row[1] for row in cursor.fetchall()}

        # Build dynamic insert for interviews table based on existing columns
        insert_fields = ["user_id", "role", "avg_score", "summary", "recommendation", "strengths", "weaknesses", "advice"]
        insert_values = [user_id, role, avg_score, summary, recommendation, strengths, weaknesses, advice]

        if "interview_mode" in interview_cols:
            insert_fields.append("interview_mode")
            insert_values.append(interview_mode or "standard")
        if "interview_type" in interview_cols:
            insert_fields.append("interview_type")
            insert_values.append(interview_type or ("Adaptive" if interview_mode == "adaptive" else "Standard"))
        if "duration_minutes" in interview_cols:
            insert_fields.append("duration_minutes")
            insert_values.append(float(duration_minutes) if duration_minutes is not None else 0.0)
        if "status" in interview_cols:
            insert_fields.append("status")
            insert_values.append(status or "completed")
        if "communication_score" in interview_cols:
            insert_fields.append("communication_score")
            insert_values.append(comm_score_num)
        if "communication_feedback" in interview_cols:
            insert_fields.append("communication_feedback")
            insert_values.append(comm_fb_str)
        if "interviewer_personality" in interview_cols:
            insert_fields.append("interviewer_personality")
            insert_values.append(str(personality_val or "technical"))
        if "speaking_metrics" in interview_cols:
            insert_fields.append("speaking_metrics")
            insert_values.append(speaking_metrics_str)
        if "verification_summary" in interview_cols:
            insert_fields.append("verification_summary")
            insert_values.append(verif_summary_str)

        placeholders = ", ".join(["?"] * len(insert_fields))
        columns_str = ", ".join(insert_fields)
        cursor.execute(f"INSERT INTO interviews({columns_str}) VALUES ({placeholders})", tuple(insert_values))
        saved_interview_id = cursor.lastrowid
        interview_id = saved_interview_id

        cursor.execute("PRAGMA table_info(interview_details)")
        detail_cols = {row[1] for row in cursor.fetchall()}
        has_adaptive_meta = "difficulty" in detail_cols
        has_comm_feedback = "communication_feedback" in detail_cols
        has_verification = "verification_result" in detail_cols
        has_speaking = "speaking_metrics" in detail_cols

        extended_concept_cols = [
            "correct_concepts",
            "missing_concepts",
            "improvement_suggestions",
            "key_takeaways",
            "follow_up_questions"
        ]

        if results and isinstance(results, list):
            for idx, item in enumerate(results):
                if not isinstance(item, dict):
                    continue

                q_text = str(item.get("question") or "").strip()
                c_ans = str(item.get("candidate_answer") or item.get("answer") or "").strip()

                t_score = item.get("technical_score", 0)
                try:
                    t_score = float(t_score) if t_score is not None else 0.0
                except (ValueError, TypeError):
                    t_score = 0.0

                c_score = item.get("communication_score", 0)
                try:
                    c_score = float(c_score) if c_score is not None else 0.0
                except (ValueError, TypeError):
                    c_score = 0.0

                st = str(item.get("strengths") or "").strip()
                mis = str(item.get("mistakes") or "").strip()
                imp = str(item.get("improved_answer") or "").strip()
                ideal = str(item.get("ideal_answer") or item.get("correct_answer") or "").strip()

                comm_item_val = item.get("communication_feedback")
                if isinstance(comm_item_val, (dict, list)):
                    try:
                        comm_item_str = json.dumps(comm_item_val)
                    except Exception:
                        comm_item_str = ""
                else:
                    comm_item_str = str(comm_item_val or "")

                d_fields = ["interview_id", "question", "candidate_answer", "technical_score", "communication_score", "strengths", "mistakes", "improved_answer", "ideal_answer"]
                d_values = [interview_id, q_text, c_ans, t_score, c_score, st, mis, imp, ideal]

                if has_adaptive_meta:
                    diff = str(item.get("difficulty") or "medium").strip()
                    top = str(item.get("topic") or "").strip()
                    skill = str(item.get("assesses_skill") or "").strip()
                    reason = str(item.get("reason") or "").strip()
                    d_fields.extend(["difficulty", "topic", "assesses_skill", "reason"])
                    d_values.extend([diff, top, skill, reason])

                if has_comm_feedback:
                    d_fields.append("communication_feedback")
                    d_values.append(comm_item_str)

                # Persist extended feedback concept columns if present in table
                for col in extended_concept_cols:
                    if col in detail_cols:
                        val = item.get(col)
                        if isinstance(val, (list, dict)):
                            try:
                                val_str = json.dumps(val)
                            except Exception:
                                val_str = ""
                        else:
                            val_str = str(val or "")
                        d_fields.append(col)
                        d_values.append(val_str)

                # Persist verification result & speaking metrics
                if has_verification:
                    v_res = item.get("verification_result")
                    v_str = json.dumps(v_res) if isinstance(v_res, (dict, list)) else str(v_res or "")
                    d_fields.append("verification_result")
                    d_values.append(v_str)

                if has_speaking:
                    s_m = item.get("speaking_metrics")
                    s_str = json.dumps(s_m) if isinstance(s_m, (dict, list)) else str(s_m or "")
                    d_fields.append("speaking_metrics")
                    d_values.append(s_str)

                d_placeholders = ", ".join(["?"] * len(d_fields))
                d_columns_str = ", ".join(d_fields)
                cursor.execute(f"INSERT INTO interview_details({d_columns_str}) VALUES ({d_placeholders})", tuple(d_values))

        # Check for answer_verifications table and persist structured verification records
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='answer_verifications'")
        has_verif_table = bool(cursor.fetchone())

        if has_verif_table:
            # Source can be explicit answer_verifications list or extracted from results
            v_records = answer_verifications if isinstance(answer_verifications, list) else []
            if not v_records and results and isinstance(results, list):
                v_records = [r.get("verification_result") for r in results if isinstance(r, dict) and r.get("verification_result")]

            for v_idx, v_item in enumerate(v_records):
                if not isinstance(v_item, dict):
                    continue
                q_text_v = v_item.get("question") or (results[v_idx].get("question") if results and v_idx < len(results) else "")
                ans_text_v = v_item.get("candidate_answer") or (results[v_idx].get("answer") if results and v_idx < len(results) else "")
                c_score = float(v_item.get("correctness_score", 85.0))
                v_status = str(v_item.get("verification_status") or "Correct")
                claims_json = json.dumps(v_item.get("claims", []))
                inc_json = json.dumps(v_item.get("incorrect_statements", []))
                explanation_v = str(v_item.get("explanation") or "")
                corr_ans = str(v_item.get("corrected_answer") or "")
                evidence_json = json.dumps(v_item.get("evidence", []))

                cursor.execute(
                    """
                    INSERT INTO answer_verifications (
                        interview_id, question_index, question, candidate_answer,
                        correctness_score, verification_status, claims_json,
                        incorrect_statements_json, explanation, corrected_answer, evidence_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        interview_id,
                        v_idx,
                        q_text_v,
                        ans_text_v,
                        c_score,
                        v_status,
                        claims_json,
                        inc_json,
                        explanation_v,
                        corr_ans,
                        evidence_json,
                    )
                )

        conn.commit()
        return interview_id

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_interview_detail(interview_id, user_id=None, db_path=None):
    """
    Fetches the interview summary and ordered question details.
    If user_id is provided, enforces that the interview belongs to that user.
    Returns None if nonexistent or if unauthorized.
    """
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT *
            FROM interviews
            WHERE id = ?
            """,
            (interview_id,)
        )
        interview_row = cursor.fetchone()
        if not interview_row:
            return None

        # Verify ownership: reject if user_id is specified and does not match
        if user_id is not None and interview_row["user_id"] != user_id:
            return None

        cursor.execute(
            """
            SELECT *
            FROM interview_details
            WHERE interview_id = ?
            ORDER BY id ASC
            """,
            (interview_id,)
        )
        detail_rows = cursor.fetchall()

        questions = []
        for row in detail_rows:
            q_dict = dict(row)
            # Ensure compatibility keys for answers & ideal answers
            q_dict["answer"] = q_dict.get("candidate_answer", "")
            q_dict["correct_answer"] = q_dict.get("ideal_answer", "")

            # Safely parse JSON communication_feedback if string
            fb_raw = q_dict.get("communication_feedback")
            if isinstance(fb_raw, str) and fb_raw.strip().startswith(("{", "[")):
                try:
                    q_dict["communication_feedback"] = json.loads(fb_raw)
                except Exception:
                    pass

            # Safely parse extended concept lists if stored as JSON
            for key in ["correct_concepts", "missing_concepts", "improvement_suggestions", "key_takeaways", "follow_up_questions"]:
                val = q_dict.get(key)
                if isinstance(val, str) and val.strip().startswith(("[", "{")):
                    try:
                        q_dict[key] = json.loads(val)
                    except Exception:
                        pass

            # Safely parse verification_result & speaking_metrics
            for key in ["verification_result", "speaking_metrics"]:
                v_val = q_dict.get(key)
                if isinstance(v_val, str) and v_val.strip().startswith(("{", "[")):
                    try:
                        q_dict[key] = json.loads(v_val)
                    except Exception:
                        pass

            questions.append(q_dict)

        interview_dict = dict(interview_row)
        fb_overall_raw = interview_dict.get("communication_feedback")
        if isinstance(fb_overall_raw, str) and fb_overall_raw.strip().startswith(("{", "[")):
            try:
                interview_dict["communication_feedback"] = json.loads(fb_overall_raw)
            except Exception:
                pass

        for field_k in ["speaking_metrics", "verification_summary"]:
            f_val = interview_dict.get(field_k)
            if isinstance(f_val, str) and f_val.strip().startswith(("{", "[")):
                try:
                    interview_dict[field_k] = json.loads(f_val)
                except Exception:
                    pass

        # Also retrieve structured answer_verifications
        answer_verifications = []
        try:
            cursor.execute(
                """
                SELECT *
                FROM answer_verifications
                WHERE interview_id = ?
                ORDER BY question_index ASC
                """,
                (interview_id,)
            )
            v_rows = cursor.fetchall()
            for v_r in v_rows:
                v_d = dict(v_r)
                for json_col in ["claims_json", "incorrect_statements_json", "evidence_json"]:
                    val_c = v_d.get(json_col)
                    if isinstance(val_c, str) and val_c.strip().startswith(("[", "{")):
                        try:
                            # Map to friendly key
                            clean_key = json_col.replace("_json", "")
                            v_d[clean_key] = json.loads(val_c)
                        except Exception:
                            v_d[clean_key] = []
                answer_verifications.append(v_d)
        except Exception:
            answer_verifications = []

        return {
            "interview": interview_dict,
            "questions": questions,
            "answer_verifications": answer_verifications,
            "verification_summary": interview_dict.get("verification_summary"),
            "speaking_metrics": interview_dict.get("speaking_metrics"),
            "interviewer_personality": interview_dict.get("interviewer_personality", "technical"),
        }

    finally:
        conn.close()


def get_user_history(user_id, db_path=None):
    """
    Returns all interviews belonging to user_id, ordered newest first.
    Includes question counts, normalized types, and parsed metrics.
    """
    conn = get_db_connection(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT *
            FROM interviews
            WHERE user_id = ? AND (status = 'completed' OR status IS NULL) AND avg_score IS NOT NULL
            ORDER BY id DESC
            """,
            (user_id,)
        )
        rows = cursor.fetchall()
        out = []
        for r in rows:
            d = dict(r)

            # Safely parse JSON communication_feedback
            cf = d.get("communication_feedback")
            if isinstance(cf, str) and cf.strip().startswith(("{", "[")):
                try:
                    d["communication_feedback"] = json.loads(cf)
                except Exception:
                    pass

            # Safely parse JSON speaking_metrics
            sm = d.get("speaking_metrics")
            if isinstance(sm, str) and sm.strip().startswith(("{", "[")):
                try:
                    d["speaking_metrics"] = json.loads(sm)
                except Exception:
                    pass

            # Safely parse JSON verification_summary
            vs = d.get("verification_summary")
            if isinstance(vs, str) and vs.strip().startswith(("{", "[")):
                try:
                    d["verification_summary"] = json.loads(vs)
                except Exception:
                    pass

            # Count total questions evaluated for this session
            cursor.execute("SELECT COUNT(*) FROM interview_details WHERE interview_id = ?", (d["id"],))
            q_cnt_row = cursor.fetchone()
            d["questions_count"] = q_cnt_row[0] if q_cnt_row else 0

            # Normalize interview_type & interview_mode
            if not d.get("interview_type"):
                mode_lower = str(d.get("interview_mode") or "").lower()
                d["interview_type"] = "Adaptive" if mode_lower == "adaptive" else "Standard"

            out.append(d)
        return out
    finally:
        conn.close()


def delete_interview(interview_id, user_id, db_path=None):
    """
    Permanently deletes an interview and all associated question details,
    answer verifications, and performance records for the authenticated user_id.
    Strictly verifies ownership: users can only delete their own interviews.
    Returns True if successfully deleted, False if not found or unauthorized.
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()

        # Enforce user ownership
        cursor.execute("SELECT id, user_id FROM interviews WHERE id = ?", (interview_id,))
        row = cursor.fetchone()
        if not row:
            return False

        owner_id = row[1] if isinstance(row, tuple) else row["user_id"]
        if int(owner_id) != int(user_id):
            return False

        # Execute cascading deletion in a single atomic database transaction
        cursor.execute("DELETE FROM answer_verifications WHERE interview_id = ?", (interview_id,))
        cursor.execute("DELETE FROM topic_performance_history WHERE interview_id = ?", (interview_id,))
        cursor.execute("DELETE FROM readiness_history WHERE interview_id = ?", (interview_id,))
        cursor.execute("DELETE FROM personalized_question_history WHERE interview_id = ?", (interview_id,))
        cursor.execute("DELETE FROM interview_details WHERE interview_id = ?", (interview_id,))
        cursor.execute("DELETE FROM interviews WHERE id = ? AND user_id = ?", (interview_id, user_id))

        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
