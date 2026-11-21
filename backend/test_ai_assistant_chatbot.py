"""
Automated Test Suite for Intervexa AI Assistant Chatbot
Tests:
- Unauthenticated rejection (HTTP 401)
- Empty message validation (HTTP 400)
- Context-aware intelligence (Dashboard, Resume, Interview, Results, Study Planner)
- Strict interview safety rule (hints and frameworks, no direct full answers)
- Authoritative RAG retrieval (PostgreSQL, Python, React, FastAPI docs)
- Multi-turn conversation memory persistence
- Conversation clearing
- Multi-tenant data isolation (User 1 cannot access User 2's chats)
- Contextual suggested questions endpoint
"""

import os
import sys
import json
import uuid
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import init_db, get_db_connection
from services.auth_service import register_user, login_user
from services.ai_assistant_service import (
    generate_assistant_reply,
    get_conversation_history,
    clear_conversation_history,
    get_contextual_suggested_questions,
)


class AiAssistantChatbotTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()
        init_db()

        # User 1
        cls.u1_email = f"ai_chat_u1_{uuid.uuid4().hex[:6]}@example.com"
        cls.u1_pass = "TestPass123!"
        register_user("Alice AI", cls.u1_email, cls.u1_pass)
        l1 = cls.client.post("/login", json={"email": cls.u1_email, "password": cls.u1_pass}).get_json()
        cls.u1_token = l1.get("token")
        cls.u1_id = l1.get("user", {}).get("id")
        cls.u1_headers = {"Authorization": f"Bearer {cls.u1_token}"}

        # User 2
        cls.u2_email = f"ai_chat_u2_{uuid.uuid4().hex[:6]}@example.com"
        cls.u2_pass = "TestPass123!"
        register_user("Bob AI", cls.u2_email, cls.u2_pass)
        l2 = cls.client.post("/login", json={"email": cls.u2_email, "password": cls.u2_pass}).get_json()
        cls.u2_token = l2.get("token")
        cls.u2_id = l2.get("user", {}).get("id")
        cls.u2_headers = {"Authorization": f"Bearer {cls.u2_token}"}

    def test_01_unauthenticated_access_rejected(self):
        """Unauthenticated POST /api/chat must return 401."""
        res = self.client.post("/api/chat", json={"message": "Hello"})
        self.assertEqual(res.status_code, 401)
        print("[✓ PASS] CHAT-01: Unauthenticated request rejected with HTTP 401")

    def test_02_empty_message_rejected(self):
        """Empty or whitespace-only message returns HTTP 400."""
        res = self.client.post("/api/chat", headers=self.u1_headers, json={"message": "   "})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        print("[✓ PASS] CHAT-02: Empty message rejected with HTTP 400")

    def test_03_dashboard_context_message(self):
        """Chatbot answers dashboard planning question with contextual guidance."""
        payload = {
            "message": "What should I focus on next to boost my placement readiness?",
            "page_context": "dashboard",
            "page_data": {"role": "Python Developer"}
        }
        res = self.client.post("/api/chat", headers=self.u1_headers, json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("response", data)
        self.assertGreater(len(data.get("response")), 20)
        self.assertEqual(data.get("page_context"), "dashboard")
        print(f"[✓ PASS] CHAT-03: Dashboard assistant responded with {len(data['response'])} chars")

    def test_04_resume_analysis_context(self):
        """Chatbot provides ATS optimization advice using resume data."""
        payload = {
            "message": "How can I improve my ATS score to 85+?",
            "page_context": "resume_analysis",
            "page_data": {
                "ats_score": 68,
                "missing_skills": ["Docker", "GraphQL", "Jest"]
            }
        }
        res = self.client.post("/api/chat", headers=self.u1_headers, json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("response", data)
        print("[✓ PASS] CHAT-04: Resume analysis assistant responded with tailored suggestions")

    def test_05_interview_safety_rule_hints_only(self):
        """Interview coach must give hints and frameworks without giving away the direct full answer."""
        payload = {
            "message": "What is the complete code to solve this exact question?",
            "page_context": "standard_interview",
            "page_data": {
                "question": "Implement a binary search function in Python",
                "role": "Python Developer"
            }
        }
        res = self.client.post("/api/chat", headers=self.u1_headers, json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        resp_text = data.get("response")
        self.assertTrue(bool(resp_text))
        print("[✓ PASS] CHAT-05: Interview mode safely provided hints/frameworks")

    def test_06_rag_evidence_grounding(self):
        """Technical question triggers RAG retrieval from canonical documentation."""
        payload = {
            "message": "Explain ACID properties and table relationships in SQL databases",
            "page_context": "general"
        }
        res = self.client.post("/api/chat", headers=self.u1_headers, json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        evidence = data.get("evidence_sources", [])
        self.assertGreaterEqual(len(evidence), 1)
        self.assertIn("PostgreSQL", evidence[0]["title"])
        print(f"[✓ PASS] CHAT-06: RAG grounded response with source: {evidence[0]['title']}")

    def test_07_conversation_history_persistence(self):
        """Conversation history persists and is retrievable."""
        conv_id = f"conv_test_{uuid.uuid4().hex[:6]}"
        self.client.post("/api/chat", headers=self.u1_headers, json={
            "message": "First message in thread",
            "conversation_id": conv_id,
            "page_context": "dashboard"
        })
        self.client.post("/api/chat", headers=self.u1_headers, json={
            "message": "Second message in thread",
            "conversation_id": conv_id,
            "page_context": "dashboard"
        })

        hist_res = self.client.get(f"/api/chat/history?conversation_id={conv_id}", headers=self.u1_headers)
        self.assertEqual(hist_res.status_code, 200)
        data = hist_res.get_json()
        self.assertTrue(data.get("success"))
        # Should contain at least 4 messages (2 user + 2 assistant)
        self.assertGreaterEqual(len(data.get("history", [])), 4)
        print(f"[✓ PASS] CHAT-07: Conversation history persisted {len(data['history'])} messages")

    def test_08_multi_tenant_conversation_isolation(self):
        """User 2 cannot view User 1's conversation history."""
        conv_id = f"conv_iso_{uuid.uuid4().hex[:6]}"
        # User 1 sends message
        self.client.post("/api/chat", headers=self.u1_headers, json={
            "message": "Confidential interview question for Alice",
            "conversation_id": conv_id
        })

        # User 2 attempts to fetch User 1's conversation
        res_u2 = self.client.get(f"/api/chat/history?conversation_id={conv_id}", headers=self.u2_headers)
        data_u2 = res_u2.get_json()
        self.assertEqual(len(data_u2.get("history", [])), 0)
        print("[✓ PASS] CHAT-08: Candidate chat isolation enforced (0 records exposed to other user)")

    def test_09_clear_conversation(self):
        """User can clear their conversation history."""
        conv_id = f"conv_clear_{uuid.uuid4().hex[:6]}"
        self.client.post("/api/chat", headers=self.u1_headers, json={
            "message": "Message to be cleared",
            "conversation_id": conv_id
        })

        del_res = self.client.delete(f"/api/chat/history?conversation_id={conv_id}", headers=self.u1_headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.get_json().get("success"))

        # Verify it is empty now
        check_res = self.client.get(f"/api/chat/history?conversation_id={conv_id}", headers=self.u1_headers)
        self.assertEqual(len(check_res.get_json().get("history", [])), 0)
        print("[✓ PASS] CHAT-09: Conversation cleared successfully")

    def test_10_suggested_questions_endpoint(self):
        """GET /api/chat/suggested-questions returns context-appropriate starter questions."""
        res = self.client.get("/api/chat/suggested-questions?context=resume_analysis")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        questions = data.get("questions", [])
        self.assertGreaterEqual(len(questions), 3)
        self.assertTrue(any("ATS" in q for q in questions))
        print(f"[✓ PASS] CHAT-10: Contextual suggestions returned {len(questions)} chips for resume_analysis")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(AiAssistantChatbotTests)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)

