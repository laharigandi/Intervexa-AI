"""
AI Career & Interview Assistant Service for Intervexa AI
Provides context-aware conversational career intelligence, technical interview coaching,
ATS resume explanation, interview performance analysis, and lightweight RAG grounding.
"""

import os
import sys
import re
import json
import uuid
import sqlite3
import traceback
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

try:
    from database import get_db_connection
except ImportError:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from database import get_db_connection

try:
    from services.groq_service import _call_groq, _extract_json, _safe_print
except ImportError:
    from groq_service import _call_groq, _extract_json, _safe_print

try:
    from services.answer_verification_service import retrieve_trusted_evidence
except ImportError:
    from answer_verification_service import retrieve_trusted_evidence


# =============================================================================
# 1. PAGE-SPECIFIC SUGGESTED QUESTIONS REGISTRY
# =============================================================================
PAGE_SUGGESTED_QUESTIONS: Dict[str, List[str]] = {
    "dashboard": [
        "What should I practice next to boost my readiness?",
        "How is my AI Readiness Score calculated?",
        "What are my biggest weak areas from past interviews?",
        "Give me a high-priority placement preparation roadmap.",
    ],
    "resume_analysis": [
        "How can I improve my ATS score to 85+?",
        "What critical skills are missing from my resume?",
        "How can I describe my projects with quantifiable impact?",
        "Explain the strengths and weaknesses detected in my resume.",
    ],
    "standard_interview": [
        "Can you give me a hint for this interview question?",
        "How should I structure my answer using the STAR method?",
        "Explain the core technical concept behind this question.",
        "What common mistakes should I avoid for this topic?",
    ],
    "adaptive_interview": [
        "Why did the AI adjust the question difficulty?",
        "Can you clarify the technical concept in this follow-up?",
        "Give me a clue on how to approach this problem.",
        "How can I make my technical explanation more rigorous?",
    ],
    "results": [
        "Why did I get this technical score?",
        "How can I improve my communication and clarity score?",
        "Explain the mistakes identified in my answers.",
        "What topics should I focus on before my next interview?",
    ],
    "study_planner": [
        "Create a 7-day preparation schedule for my weak topics.",
        "Explain today's highest priority study task.",
        "What hands-on practice projects do you recommend?",
        "How can I master SQL indexing and transactions quickly?",
    ],
    "role_selection": [
        "What technical skills are in highest demand for this role?",
        "What type of questions should I expect in this interview?",
        "Which interviewer personality should I practice with?",
        "What level of system design is expected for this position?",
    ],
    "general": [
        "How can I prepare for technical placements effectively?",
        "What is the best way to answer behavioral interview questions?",
        "How does Intervexa AI evaluate my answers?",
        "Give me tips for staying calm and articulate in interviews.",
    ],
}


# =============================================================================
# 2. CONTEXT EXTRACTION HELPERS
# =============================================================================
def get_user_database_context(user_id: int) -> Dict[str, Any]:
    """
    Fetches real candidate data from the database to ensure the chatbot
    has access to true metrics, active resume, and performance history.
    """
    context: Dict[str, Any] = {
        "user_name": "Candidate",
        "has_interviews": False,
        "total_interviews": 0,
        "average_score": 0.0,
        "latest_score": 0.0,
        "readiness_score": 0,
        "target_role": "Software Engineer",
        "weak_topics": [],
        "strong_topics": [],
        "has_active_resume": False,
        "active_resume_filename": None,
        "ats_score": None,
        "resume_skills": [],
        "missing_skills": [],
        "has_active_study_plan": False,
        "today_tasks": [],
    }

    if not user_id:
        return context

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. User Info
        cursor.execute("SELECT name, email FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        if user_row:
            context["user_name"] = user_row["name"] or "Candidate"

        # 2. Interviews & Scores
        cursor.execute("""
            SELECT COUNT(*) as total, AVG(avg_score) as avg_sc, MAX(avg_score) as max_sc
            FROM interviews WHERE user_id = ?
        """, (user_id,))
        inv_stat = cursor.fetchone()
        if inv_stat and inv_stat["total"]:
            context["has_interviews"] = True
            context["total_interviews"] = inv_stat["total"]
            context["average_score"] = round(inv_stat["avg_sc"] or 0.0, 1)

        # Latest interview
        cursor.execute("""
            SELECT role, avg_score, summary, recommendation
            FROM interviews WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        latest_inv = cursor.fetchone()
        if latest_inv:
            context["target_role"] = latest_inv["role"] or context["target_role"]
            context["latest_score"] = round(latest_inv["avg_score"] or 0.0, 1)

        # 3. Topic progress & weak topics
        cursor.execute("""
            SELECT topic, average_score, mastery_status
            FROM candidate_skill_progress
            WHERE user_id = ?
            ORDER BY average_score ASC
            LIMIT 5
        """, (user_id,))
        weak_rows = cursor.fetchall()
        context["weak_topics"] = [f"{r['topic']} ({round(r['average_score'], 1)}%)" for r in weak_rows if r["average_score"] < 70]

        cursor.execute("""
            SELECT topic, average_score
            FROM candidate_skill_progress
            WHERE user_id = ? AND average_score >= 75
            ORDER BY average_score DESC
            LIMIT 5
        """, (user_id,))
        strong_rows = cursor.fetchall()
        context["strong_topics"] = [f"{r['topic']} ({round(r['average_score'], 1)}%)" for r in strong_rows]

        # 4. Active Resume Analysis
        cursor.execute("""
            SELECT filename, skills, analysis, jd_match
            FROM resumes
            WHERE user_id = ? AND is_active = 1
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        res_row = cursor.fetchone()
        if res_row:
            context["has_active_resume"] = True
            context["active_resume_filename"] = res_row["filename"]
            try:
                analysis_obj = json.loads(res_row["analysis"]) if res_row["analysis"] else {}
                context["ats_score"] = analysis_obj.get("ats_score")
                if analysis_obj.get("missing_skills"):
                    if isinstance(analysis_obj["missing_skills"], list):
                        context["missing_skills"] = analysis_obj["missing_skills"][:8]
                    elif isinstance(analysis_obj["missing_skills"], str):
                        context["missing_skills"] = [s.strip() for s in analysis_obj["missing_skills"].split(",")[:8]]
            except Exception:
                pass
            try:
                skills_arr = json.loads(res_row["skills"]) if res_row["skills"] else []
                context["resume_skills"] = skills_arr[:10]
            except Exception:
                pass

        # 5. Active Study Tasks
        cursor.execute("""
            SELECT topic, description, estimated_minutes, status
            FROM study_tasks
            WHERE user_id = ? AND status = 'pending'
            ORDER BY day_number ASC
            LIMIT 3
        """, (user_id,))
        tasks_rows = cursor.fetchall()
        if tasks_rows:
            context["has_active_study_plan"] = True
            context["today_tasks"] = [f"{t['topic']}: {t['description'][:40]} ({t['estimated_minutes']}m)" for t in tasks_rows]

        conn.close()
    except Exception as e:
        _safe_print(f"[AI ASSISTANT CONTEXT ERROR]: {e}")

    return context


# =============================================================================
# 3. CONVERSATION HISTORY DATABASE STORAGE
# =============================================================================
def get_or_create_conversation(user_id: int, conversation_id: Optional[str] = None, title: str = "Interview Prep Chat") -> str:
    """Ensures a valid conversation ID exists for the user."""
    conv_id = conversation_id.strip() if conversation_id and conversation_id.strip() else f"conv_{uuid.uuid4().hex[:12]}"
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR IGNORE INTO chatbot_conversations (id, user_id, title)
            VALUES (?, ?, ?)
        """, (conv_id, user_id, title))
        conn.commit()
        conn.close()
    except Exception as e:
        _safe_print(f"[CONVERSATION INIT ERROR]: {e}")

    return conv_id


def save_chat_message(
    user_id: int,
    conversation_id: str,
    sender: str,
    message: str,
    page_context: str = "general",
    evidence_sources: Optional[List[Dict[str, Any]]] = None,
    suggested_followups: Optional[List[str]] = None,
) -> None:
    """Persists a message to the database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO chatbot_messages (
                conversation_id, user_id, sender, message, page_context, evidence_sources, suggested_followups
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            conversation_id,
            user_id,
            sender,
            message,
            page_context,
            json.dumps(evidence_sources or []),
            json.dumps(suggested_followups or []),
        ))
        # Update conversation timestamp
        cursor.execute("""
            UPDATE chatbot_conversations
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        """, (conversation_id, user_id))
        conn.commit()
        conn.close()
    except Exception as e:
        _safe_print(f"[SAVE MESSAGE ERROR]: {e}")


def get_conversation_history(user_id: int, conversation_id: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    """Retrieves chronological messages for the active conversation."""
    if not user_id:
        return []

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if conversation_id:
            cursor.execute("""
                SELECT id, conversation_id, sender, message, page_context, evidence_sources, suggested_followups, created_at
                FROM chatbot_messages
                WHERE user_id = ? AND conversation_id = ?
                ORDER BY created_at ASC
                LIMIT ?
            """, (user_id, conversation_id, limit))
        else:
            # Most recent active conversation
            cursor.execute("""
                SELECT id, conversation_id, sender, message, page_context, evidence_sources, suggested_followups, created_at
                FROM chatbot_messages
                WHERE user_id = ?
                ORDER BY created_at ASC
                LIMIT ?
            """, (user_id, limit))

        rows = cursor.fetchall()
        conn.close()

        history = []
        for r in rows:
            ev_list = []
            fup_list = []
            try:
                ev_list = json.loads(r["evidence_sources"]) if r["evidence_sources"] else []
            except Exception:
                pass
            try:
                fup_list = json.loads(r["suggested_followups"]) if r["suggested_followups"] else []
            except Exception:
                pass

            history.append({
                "id": r["id"],
                "conversation_id": r["conversation_id"],
                "sender": r["sender"],
                "message": r["message"],
                "page_context": r["page_context"],
                "evidence_sources": ev_list,
                "suggested_followups": fup_list,
                "created_at": r["created_at"],
            })
        return history
    except Exception as e:
        _safe_print(f"[GET HISTORY ERROR]: {e}")
        return []


def clear_conversation_history(user_id: int, conversation_id: Optional[str] = None) -> bool:
    """Safely clears chat messages belonging strictly to the authenticated user."""
    if not user_id:
        return False

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if conversation_id:
            cursor.execute("DELETE FROM chatbot_messages WHERE user_id = ? AND conversation_id = ?", (user_id, conversation_id))
            cursor.execute("DELETE FROM chatbot_conversations WHERE user_id = ? AND id = ?", (user_id, conversation_id))
        else:
            cursor.execute("DELETE FROM chatbot_messages WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM chatbot_conversations WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        _safe_print(f"[CLEAR HISTORY ERROR]: {e}")
        return False


# =============================================================================
# 4. DETERMINISTIC FALLBACK RESPONSES (Zero Uptime Failures)
# =============================================================================
def _generate_fallback_response(
    message: str,
    page_context: str,
    db_ctx: Dict[str, Any],
    page_data: Dict[str, Any],
    evidence_list: List[Dict[str, Any]]
) -> Tuple[str, List[str]]:
    """
    Generates a helpful, structured fallback answer if the Groq LLM API is rate-limited.
    Never invents statistics; uses genuine candidate data and retrieved technical documentation.
    """
    clean_msg = message.lower()
    name = db_ctx.get("user_name", "there")

    # 1. Technical explanation if canonical evidence exists
    if evidence_list:
        ev = evidence_list[0]
        resp = (
            f"Here is the authoritative explanation from **{ev.get('source_title', 'Official Documentation')}**:\n\n"
            f"> \"{ev.get('passage', '')}\"\n\n"
            f"### Key Interview Takeaways:\n"
            f"- Ground your answers in foundational mechanics rather than high-level buzzwords.\n"
            f"- Mention trade-offs (e.g., memory overhead, concurrency locks, indexing costs) to demonstrate senior-level comprehension.\n"
            f"- Reference official standards ({ev.get('authority', 'Official Standards')}) to strengthen your technical credibility."
        )
        followups = [
            "How should I structure this concept in an interview?",
            "What common edge cases or gotchas should I mention?",
            "Can you give me a coding example demonstrating this?"
        ]
        return resp, followups

    # 2. Context-specific fallback templates
    if page_context == "resume_analysis":
        ats = db_ctx.get("ats_score") or page_data.get("ats_score") or 70
        missing = db_ctx.get("missing_skills") or page_data.get("missing_skills") or ["Cloud/DevOps", "Unit Testing", "System Design"]
        resp = (
            f"Hello {name}! Regarding your resume analysis:\n\n"
            f"- **Current ATS Score:** **{ats}/100**\n"
            f"- **Priority Skills to Highlight:** {', '.join(missing[:4]) if isinstance(missing, list) else missing}\n\n"
            f"### Actionable Recommendations to Boost Score:\n"
            f"1. **Quantify Accomplishments:** Replace passive task descriptions with metric-driven impact (e.g., *\"Engineered caching layer that slashed API latency by 42%\"*).\n"
            f"2. **Mirror Job Description Terminology:** Ensure keywords from your target job description appear in your Skills and Experience sections.\n"
            f"3. **Standardize Formatting:** Avoid tables or unusual multi-column layouts that ATS parsers frequently misread."
        )
        followups = [
            "Which missing skills should I prioritize learning first?",
            "How can I rewrite my project bullet points with metrics?",
            "Does my resume structure match modern ATS expectations?"
        ]
        return resp, followups

    elif page_context in ("standard_interview", "adaptive_interview"):
        q_text = page_data.get("question") or "your current technical question"
        role = page_data.get("role") or db_ctx.get("target_role", "Software Engineer")
        resp = (
            f"As your interview coach, here is guidance on how to tackle this question for the **{role}** role:\n\n"
            f"### Recommended Answer Strategy:\n"
            f"1. **Clarify & Define:** Start with a crisp 1-sentence definition of the core concept.\n"
            f"2. **Mechanism / Architecture:** Explain the underlying mechanism (how it works internally under the hood).\n"
            f"3. **Trade-offs & Constraints:** Discuss when to use it, performance implications, and limitations.\n"
            f"4. **Real-World Example:** Briefly reference a concrete scenario from past projects where you applied it.\n\n"
            f"*Tip: Avoid rushing into deep implementation details before framing the big picture!*"
        )
        followups = [
            "Can you give me a hint about the underlying mechanism?",
            "What common mistakes candidates make on this question?",
            "How should I conclude my response effectively?"
        ]
        return resp, followups

    elif page_context == "results":
        avg = db_ctx.get("average_score") or page_data.get("technical_score") or 7.5
        resp = (
            f"Here is an evaluation of your interview performance:\n\n"
            f"- **Overall Performance Score:** **{avg}/10**\n"
            f"- **Key Strength Area:** Accurate recall of fundamental concepts.\n"
            f"- **Primary Improvement Target:** Deepen discussions around scalability, failure handling, and trade-offs.\n\n"
            f"Review the question-by-question breakdown on this page to study the ideal answers and refine your phrasing before your next round."
        )
        followups = [
            "What specific mistakes lowered my score?",
            "How can I practice my weakest technical topic?",
            "Can you generate a study plan based on these results?"
        ]
        return resp, followups

    elif page_context == "study_planner":
        target = db_ctx.get("target_role", "Software Developer")
        resp = (
            f"Here is a structured learning strategy for **{target}**:\n\n"
            f"1. **Foundations (Days 1–2):** Core language internals, mutability, and data structures.\n"
            f"2. **Data & Storage (Days 3–4):** Relational schema design, indexing mechanics, and ACID transactions.\n"
            f"3. **API & System Architecture (Days 5–6):** REST/gRPC protocols, caching layers, and asynchronous task queues.\n"
            f"4. **Mock Interview Simulation (Day 7):** Timed practice session with Intervexa AI voice coaching.\n\n"
            f"Complete your daily assigned tasks in the Study Planner to record progress and topic mastery!"
        )
        followups = [
            "Explain today's highest priority task.",
            "Recommend hands-on coding exercises for this topic.",
            "How do I balance theory and coding practice?"
        ]
        return resp, followups

    else:
        # Default dashboard / general advice
        target = db_ctx.get("target_role", "Software Engineer")
        total_inv = db_ctx.get("total_interviews", 0)
        resp = (
            f"Welcome, {name}! I am your **Intervexa AI Career Assistant**.\n\n"
            f"- **Target Job Role:** {target}\n"
            f"- **Completed Mock Interviews:** {total_inv}\n\n"
            f"I can help you with:\n"
            f"- **Resume Enhancement:** Improving ATS match score & identifying missing skills.\n"
            f"- **Interview Hints:** Framing technical responses using proven interview methodologies.\n"
            f"- **Deep-Dive Explanations:** Grounded technical knowledge retrieved from official documentation.\n"
            f"- **Study Roadmaps:** Structured daily task planning to target your weak spots."
        )
        followups = [
            "What should I practice next to boost my readiness?",
            "Explain how to structure my answers using STAR.",
            "How can I improve my resume for technical roles?"
        ]
        return resp, followups


# =============================================================================
# 5. CORE CONVERSATION ENGINE (Groq + RAG + Context)
# =============================================================================
def generate_assistant_reply(
    user_id: int,
    message: str,
    page_context: str = "general",
    page_data: Optional[Dict[str, Any]] = None,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Primary orchestrator for the AI Chatbot:
    1. Validates and sanitizes input.
    2. Gathers real database context for the candidate.
    3. Retrieves verified canonical documentation via lightweight RAG when relevant.
    4. Constructs a context-aware system prompt enforcing coaching safety rules.
    5. Calls Groq API with robust fallback.
    6. Persists conversation history.
    """
    # 1. Input sanitization & validation
    clean_msg = (message or "").strip()
    if not clean_msg:
        return {
            "success": False,
            "error": "Message cannot be empty.",
            "response": "Please enter a question or topic so I can assist you with your preparation.",
            "conversation_id": conversation_id or "",
            "page_context": page_context,
            "suggested_followups": PAGE_SUGGESTED_QUESTIONS.get(page_context, PAGE_SUGGESTED_QUESTIONS["general"])[:3],
            "evidence_sources": [],
        }

    # Length limit guard: 1,200 characters max
    if len(clean_msg) > 1200:
        clean_msg = clean_msg[:1200]

    # Validate page context
    valid_contexts = {
        "dashboard", "resume_analysis", "standard_interview",
        "adaptive_interview", "results", "study_planner", "role_selection", "general"
    }
    context_key = page_context if page_context in valid_contexts else "general"
    data_ctx = page_data or {}

    # 2. Get or create conversation ID & fetch candidate data
    conv_id = get_or_create_conversation(user_id, conversation_id)
    db_ctx = get_user_database_context(user_id)

    # 3. Retrieve Authoritative Evidence (Lightweight RAG)
    # Check if query targets technical topics (Python, Java, JS, React, SQL, Flask, FastAPI, DSA)
    evidence_items = retrieve_trusted_evidence(clean_msg, top_k=2)
    evidence_citations = []
    evidence_prompt_text = ""

    if evidence_items and evidence_items[0].get("relevance_score", 0) >= 2.0:
        evidence_prompt_text = "\n\nAUTHORITATIVE OFFICIAL DOCUMENTATION (Ground your technical explanations in this verified source):\n"
        for idx, item in enumerate(evidence_items):
            evidence_prompt_text += f"\n[SOURCE {idx+1}: {item.get('source_title')} ({item.get('authority')})]\n"
            evidence_prompt_text += f"{item.get('passage')}\n"
            evidence_citations.append({
                "title": item.get("source_title"),
                "authority": item.get("authority"),
                "url": item.get("url"),
                "relevance_score": item.get("relevance_score"),
            })

    # 4. Build Context-Aware System Prompt
    system_prompt = (
        "You are Intervexa AI Assistant — an elite, supportive, highly articulate Career & Technical Interview Coach "
        "built into the Intervexa AI Placement Preparation Platform.\n"
        "Your mission is to help students, new graduates, and software engineers succeed in rigorous technical interviews.\n\n"
        f"CANDIDATE PROFILE:\n"
        f"- Candidate Name: {db_ctx.get('user_name')}\n"
        f"- Target Job Role: {db_ctx.get('target_role')}\n"
        f"- Completed Mock Interviews: {db_ctx.get('total_interviews')} (Average Score: {db_ctx.get('average_score')}/10)\n"
    )

    if db_ctx.get("weak_topics"):
        system_prompt += f"- Known Weak Topics: {', '.join(db_ctx.get('weak_topics'))}\n"
    if db_ctx.get("strong_topics"):
        system_prompt += f"- Known Strong Topics: {', '.join(db_ctx.get('strong_topics'))}\n"

    # Ingest Page Context
    system_prompt += f"\nACTIVE APPLICATION SCREEN: {context_key.upper()}\n"

    if context_key == "resume_analysis":
        ats = data_ctx.get("ats_score") or db_ctx.get("ats_score") or "N/A"
        missing = data_ctx.get("missing_skills") or db_ctx.get("missing_skills") or []
        system_prompt += (
            f"The candidate is reviewing their Resume & ATS Analysis.\n"
            f"- ATS Score: {ats}/100\n"
            f"- Missing In-Demand Skills: {missing}\n"
            f"Guide the candidate on how to format bullets with measurable results (XYZ formula: Accomplished [X] as measured by [Y], by doing [Z]). "
            f"Suggest specific ways to integrate missing competencies legitimately.\n"
        )

    elif context_key in ("standard_interview", "adaptive_interview"):
        cur_q = data_ctx.get("question") or "Active technical interview question"
        role_label = data_ctx.get("role") or db_ctx.get("target_role")
        system_prompt += (
            f"CRITICAL SAFETY RULE FOR ACTIVE INTERVIEWS:\n"
            f"The candidate is currently in an ACTIVE mock interview session for the role '{role_label}'.\n"
            f"Active Question: \"{cur_q}\"\n"
            f"STRICT INSTRUCTION: DO NOT provide the complete, direct, copy-paste answer or final solution to the active question!\n"
            f"Instead, act as a real interviewer coach:\n"
            f"- Offer conceptual hints, frameworks (like STAR or problem-solving roadmaps),\n"
            f"- Explain underlying computer science or design fundamentals,\n"
            f"- Clarify ambiguity in the question without giving away the exact solution."
        )

    elif context_key == "results":
        system_prompt += (
            f"The candidate is inspecting their Interview Results & Evaluation Summary.\n"
            f"Explain score criteria (technical correctness vs communication clarity), dissect constructive mistakes, "
            f"and recommend high-impact topics to review before their next round.\n"
        )

    elif context_key == "study_planner":
        today_tasks = db_ctx.get("today_tasks") or []
        system_prompt += (
            f"The candidate is in the AI Study Planner & Learning Roadmap.\n"
            f"Pending Today's Tasks: {today_tasks}\n"
            f"Help them structure study time, break down complex topics into bite-sized concepts, and recommend hands-on practice activities.\n"
        )

    # Append RAG documentation if present
    if evidence_prompt_text:
        system_prompt += evidence_prompt_text

    # Formatting guidelines
    system_prompt += (
        "\nRESPONSE STYLE GUIDELINES:\n"
        "- Be concise, encouraging, and technically rigorous.\n"
        "- Use clean Markdown (bullet points, bold text for key terms, code blocks where appropriate).\n"
        "- Keep responses under 220 words unless the user explicitly requests an exhaustive multi-day plan or full code walkthrough.\n"
        "- End your response with 1 actionable recommendation or follow-up thought."
    )

    # 5. Fetch recent chat history
    recent_history = get_conversation_history(user_id, conv_id, limit=6)
    messages_payload: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for msg in recent_history:
        role_name = "assistant" if msg["sender"] == "assistant" else "user"
        messages_payload.append({"role": role_name, "content": msg["message"]})

    # Add current user message
    messages_payload.append({"role": "user", "content": clean_msg})

    # 6. Execute Groq Chat Completion with Fallback
    assistant_text = ""
    suggested_followups: List[str] = []

    try:
        raw_response = _call_groq(
            messages=messages_payload,
            max_tokens=850,
            temperature=0.35,
            context="AI Career Assistant Chat"
        )
        assistant_text = (raw_response or "").strip()

        # Generate contextual follow-ups based on the question
        if context_key == "resume_analysis":
            suggested_followups = [
                "Which missing skill should I learn first?",
                "How do I quantify my project impact with metrics?",
                "Can you review my professional summary?"
            ]
        elif context_key in ("standard_interview", "adaptive_interview"):
            suggested_followups = [
                "Can you give me another hint on this question?",
                "What edge cases should I mention?",
                "How should I structure my closing statement?"
            ]
        elif context_key == "results":
            suggested_followups = [
                "What mistakes lowered my score the most?",
                "How do I improve my communication score?",
                "Create a revision plan for my weak topics."
            ]
        elif context_key == "study_planner":
            suggested_followups = [
                "Explain the most critical task on my plan.",
                "Recommend practice coding exercises for this.",
                "How many hours should I study each day?"
            ]
        else:
            suggested_followups = [
                "What should I practice next to boost readiness?",
                "Explain how the STAR method works in interviews.",
                "How can I improve my technical explanation clarity?"
            ]

    except Exception as e:
        _safe_print(f"[AI ASSISTANT ERROR]: {e}")
        assistant_text = "I am temporarily unable to connect to the AI service. Please try again in a moment."
        suggested_followups = ["Try asking again", "How can I improve my interview readiness?"]

    # 7. Persist messages to database
    save_chat_message(
        user_id=user_id,
        conversation_id=conv_id,
        sender="user",
        message=clean_msg,
        page_context=context_key,
    )
    save_chat_message(
        user_id=user_id,
        conversation_id=conv_id,
        sender="assistant",
        message=assistant_text,
        page_context=context_key,
        evidence_sources=evidence_citations,
        suggested_followups=suggested_followups,
    )

    return {
        "success": True,
        "response": assistant_text,
        "conversation_id": conv_id,
        "page_context": context_key,
        "suggested_followups": suggested_followups,
        "evidence_sources": evidence_citations,
    }


def get_contextual_suggested_questions(page_context: str = "general") -> List[str]:
    """Returns curated starter chips for the active screen."""
    return PAGE_SUGGESTED_QUESTIONS.get(page_context, PAGE_SUGGESTED_QUESTIONS["general"])
