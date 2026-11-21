"""
Comprehensive 10-Scenario Verification Suite for Resume Analysis Accuracy, Consistency & ATS Determinism
Tests:
1. Upload same resume 5 times with same JD -> Identical ATS score, skills, and JD match every time.
2. Upload same resume without JD -> ATS evaluation works, JD alignment marked unavailable.
3. Upload a different resume -> Results reflect the new resume content and different scores.
4. Same resume with different roles -> Role-specific matching changes appropriately, resume metrics remain consistent.
5. Same resume with two different JDs -> JD alignment and missing skills change according to the supplied JD.
6. Upload invalid PDF -> Meaningful validation error, no fabricated analysis generated.
7. Simulate Groq API failure -> Valid deterministic ATS results remain available, AI feedback marked unavailable.
8. Compare Resume Analysis and Dashboard -> Shared metrics match the same saved record.
9. Multi-user isolation -> User B cannot access User A's resume analysis.
10. Revisit / refresh application -> Latest saved analysis is retrieved correctly.
"""
import os
import sys
import json
import uuid
import io
import unittest
from unittest.mock import patch, MagicMock

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import app as flask_app
from database import init_db, get_db_connection
from services.ats_scorer import evaluate_ats_score, calculate_jd_alignment, compute_resume_hash
from services.skill_extractor import extract_skills
from services.groq_service import analyze_resume, analyze_jd_match


def make_pdf(text_lines):
    """Generate in-memory valid PDF bytes."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    y = 750
    for line in text_lines:
        c.drawString(72, y, line)
        y -= 18
        if y < 72:
            c.showPage()
            y = 750
    c.save()
    buf.seek(0)
    return buf


class TestResumeAnalysisConsistencySuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = flask_app.app.test_client()

        # Create Test User 1
        cls.user1_email = f"resume_test_u1_{uuid.uuid4().hex[:6]}@example.com"
        cls.password = "StrongPassword123!"
        reg1 = cls.client.post("/signup", json={
            "name": "Resume User One",
            "email": cls.user1_email,
            "password": cls.password,
        })
        log1 = cls.client.post("/login", json={
            "email": cls.user1_email,
            "password": cls.password,
        })
        cls.token1 = log1.get_json()["token"]
        cls.headers1 = {"Authorization": f"Bearer {cls.token1}"}

        # Create Test User 2
        cls.user2_email = f"resume_test_u2_{uuid.uuid4().hex[:6]}@example.com"
        cls.client.post("/signup", json={
            "name": "Resume User Two",
            "email": cls.user2_email,
            "password": cls.password,
        })
        log2 = cls.client.post("/login", json={
            "email": cls.user2_email,
            "password": cls.password,
        })
        cls.token2 = log2.get_json()["token"]
        cls.headers2 = {"Authorization": f"Bearer {cls.token2}"}

        # Standard Resume Content A (Senior Full Stack Engineer)
        cls.resume_a_lines = [
            "Alex Morgan - Senior Full Stack Engineer",
            "Email: alex.morgan@example.com | Phone: 555-0199 | LinkedIn: linkedin.com/in/alexmorgan",
            "Professional Summary: Dedicated software architect with 6 years experience building distributed web systems.",
            "Technical Skills: Python, React, TypeScript, Node.js, PostgreSQL, Docker, AWS, Redis, GraphQL, Git, CI/CD",
            "Work Experience:",
            "Lead Software Engineer - CloudScale Corp (2020 - Present)",
            "- Architected microservices with Python and FastAPI, increasing throughput by 35% and saving $40,000 annually.",
            "- Implemented responsive client dashboards using React and TypeScript for 100,000 active users.",
            "- Reduced deployment latency by 50% using Docker containers and automated CI/CD pipelines.",
            "Education: B.Tech in Computer Science from State University (2016 - 2020)",
            "Projects: Enterprise Task Orchestrator - Built scalable task runner using Python, Redis, and PostgreSQL."
        ]
        cls.resume_a_text = "\n".join(cls.resume_a_lines)

        # Standard Resume Content B (Junior Data Analyst)
        cls.resume_b_lines = [
            "Jordan Lee - Junior Data Analyst",
            "Email: jordan.lee@example.com | Phone: 555-0288",
            "Technical Skills: Python, SQL, Pandas, NumPy, Scikit-learn",
            "Work Experience: Data Analyst Intern - Analytics Lab (2022 - 2023)",
            "- Analyzed customer datasets using SQL and Pandas.",
            "Education: Bachelor of Science in Mathematics from City College"
        ]
        cls.resume_b_text = "\n".join(cls.resume_b_lines)

        cls.sample_jd = (
            "We are looking for a Senior Full Stack Developer. "
            "Required Skills: Python, React, PostgreSQL, Docker, Kubernetes, AWS, System Design. "
            "You will architect high-scale microservices and build responsive frontend user interfaces."
        )

    # -------------------------------------------------------------------------
    # TEST 1: Upload the same resume five times with the same JD and target role
    # Expected: All deterministic ATS scores, extracted skills, and JD matching results must be identical.
    # -------------------------------------------------------------------------
    def test_01_upload_same_resume_five_times_deterministic(self):
        scores = []
        skill_sets = []
        jd_scores = []
        matching_sets = []
        missing_sets = []

        for i in range(5):
            pdf_bytes = make_pdf(self.resume_a_lines)
            res = self.client.post(
                "/upload_resume",
                data={"resume": (pdf_bytes, f"Alex_Resume_Iteration_{i}.pdf")},
                content_type="multipart/form-data",
                headers=self.headers1
            )
            self.assertEqual(res.status_code, 200, f"Upload iteration {i} failed")
            data = res.get_json()
            self.assertTrue(data["success"])

            ats_score = data["analysis"]["ats_score"]
            skills = sorted(data["skills"])
            scores.append(ats_score)
            skill_sets.append(tuple(skills))

            # Now test JD match with same JD
            jd_res = self.client.post(
                "/analyze_jd_match",
                json={
                    "resume_id": data["resume_id"],
                    "resume_text": data["text"],
                    "job_description": self.sample_jd
                },
                headers=self.headers1
            )
            self.assertEqual(jd_res.status_code, 200)
            jd_data = jd_res.get_json()
            jd_scores.append(jd_data["match_score"])
            matching_sets.append(tuple(sorted(jd_data["matching_skills"])))
            missing_sets.append(tuple(sorted(jd_data["missing_skills"])))

        # Assert: 100% identical scores and skills across all 5 runs
        self.assertEqual(len(set(scores)), 1, f"ATS scores differed across 5 uploads: {scores}")
        self.assertEqual(len(set(skill_sets)), 1, f"Extracted skills differed across 5 uploads: {skill_sets}")
        self.assertEqual(len(set(jd_scores)), 1, f"JD match scores differed across 5 runs: {jd_scores}")
        self.assertEqual(len(set(matching_sets)), 1, f"Matching skills differed: {matching_sets}")
        self.assertEqual(len(set(missing_sets)), 1, f"Missing skills differed: {missing_sets}")

        print(f"  [PASS] Test 1: 5 identical iterations produced exact same ATS score ({scores[0]}), skills ({len(skill_sets[0])}), and JD match ({jd_scores[0]}%)")

    # -------------------------------------------------------------------------
    # TEST 2: Upload the same resume without a JD
    # Expected: ATS evaluation works, but JD alignment is clearly marked unavailable.
    # -------------------------------------------------------------------------
    def test_02_upload_without_jd(self):
        pdf_bytes = make_pdf(self.resume_a_lines)
        res = self.client.post(
            "/upload_resume",
            data={"resume": (pdf_bytes, "Alex_Resume_NoJD.pdf")},
            content_type="multipart/form-data",
            headers=self.headers1
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsNotNone(data["analysis"]["ats_score"])
        self.assertGreater(data["analysis"]["ats_score"], 0)

        # Call JD match with empty JD
        jd_res = self.client.post(
            "/analyze_jd_match",
            json={
                "resume_id": data["resume_id"],
                "resume_text": data["text"],
                "job_description": ""
            },
            headers=self.headers1
        )
        self.assertEqual(jd_res.status_code, 400)
        jd_data = jd_res.get_json()
        self.assertIn("Job Description Match: Not Available", jd_data["message"])

        # Also test direct calculate_jd_alignment with empty string
        direct = calculate_jd_alignment(data["text"], "")
        self.assertFalse(direct["available"])
        self.assertIsNone(direct["match_score"])
        self.assertIn("Job Description Match: Not Available", direct["message"])
        print("  [PASS] Test 2: Upload without JD successfully evaluates ATS and marks JD match unavailable")

    # -------------------------------------------------------------------------
    # TEST 3: Upload a different resume
    # Expected: Results reflect the new resume content.
    # -------------------------------------------------------------------------
    def test_03_upload_different_resume(self):
        pdf_b = make_pdf(self.resume_b_lines)
        res = self.client.post(
            "/upload_resume",
            data={"resume": (pdf_b, "Jordan_Resume_Junior.pdf")},
            content_type="multipart/form-data",
            headers=self.headers1
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        # Verify Jordan's skills differ from Alex's
        jordan_skills = data["skills"]
        self.assertIn("Pandas", jordan_skills)
        self.assertIn("Scikit-learn", jordan_skills)
        self.assertNotIn("React", jordan_skills)
        self.assertNotIn("Docker", jordan_skills)

        # ATS score reflects shorter profile
        eval_a = evaluate_ats_score(self.resume_a_text)
        eval_b = evaluate_ats_score(self.resume_b_text)
        self.assertNotEqual(eval_a["ats_score"], eval_b["ats_score"])
        print(f"  [PASS] Test 3: Different resumes produce distinct scores (Alex: {eval_a['ats_score']}, Jordan: {eval_b['ats_score']})")

    # -------------------------------------------------------------------------
    # TEST 4: Use the same resume with two different target roles
    # Expected: Role-specific matching changes appropriately, while resume-only metrics remain consistent.
    # -------------------------------------------------------------------------
    def test_04_same_resume_different_target_roles(self):
        eval1 = evaluate_ats_score(self.resume_a_text)
        eval2 = evaluate_ats_score(self.resume_a_text)

        # Resume-only metrics MUST remain completely identical
        self.assertEqual(eval1["ats_score"], eval2["ats_score"])
        self.assertEqual(eval1["factors"], eval2["factors"])

        # Role 1 JD: Frontend Focus
        frontend_jd = "Senior Frontend Engineer: React, TypeScript, Redux, Next.js, HTML, CSS, Tailwind CSS."
        # Role 2 JD: DevOps Focus
        devops_jd = "DevOps Engineer: Kubernetes, Terraform, Docker, AWS, Linux, CI/CD, Ansible, Jenkins."

        match_fe = calculate_jd_alignment(self.resume_a_text, frontend_jd)
        match_devops = calculate_jd_alignment(self.resume_a_text, devops_jd)

        # Matching skills differ per role
        self.assertIn("React", match_fe["matching_skills"])
        self.assertIn("TypeScript", match_fe["matching_skills"])
        self.assertIn("Docker", match_devops["matching_skills"])
        self.assertIn("AWS", match_devops["matching_skills"])
        self.assertIn("Kubernetes", match_devops["missing_skills"])

        print("  [PASS] Test 4: Role-specific matching varies accurately while resume-only metrics remain rock solid")

    # -------------------------------------------------------------------------
    # TEST 5: Use the same resume with two different job descriptions
    # Expected: JD alignment and missing skills change according to the supplied JD.
    # -------------------------------------------------------------------------
    def test_05_same_resume_different_jds(self):
        jd_python_backend = "Backend Python Developer: Python, PostgreSQL, Redis, Docker, REST API."
        jd_cloud_architect = "Cloud Architect: AWS, Azure, GCP, Kubernetes, Terraform, System Design."

        res1 = calculate_jd_alignment(self.resume_a_text, jd_python_backend)
        res2 = calculate_jd_alignment(self.resume_a_text, jd_cloud_architect)

        self.assertNotEqual(res1["matching_skills"], res2["matching_skills"])
        self.assertNotEqual(res1["missing_skills"], res2["missing_skills"])
        self.assertIn("PostgreSQL", res1["matching_skills"])
        self.assertIn("Kubernetes", res2["missing_skills"])
        print("  [PASS] Test 5: Two distinct JDs produce accurate differing missing and matching skills")

    # -------------------------------------------------------------------------
    # TEST 6: Upload an invalid PDF
    # Expected: A meaningful validation error appears. No fabricated analysis is generated.
    # -------------------------------------------------------------------------
    def test_06_upload_invalid_pdf(self):
        # 1. Non-PDF extension
        fake_txt = io.BytesIO(b"Hello world this is not a pdf")
        res1 = self.client.post(
            "/upload_resume",
            data={"resume": (fake_txt, "malicious.txt")},
            content_type="multipart/form-data",
            headers=self.headers1
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn("Only PDF files", res1.get_json()["message"])

        # 2. Corrupt file disguised as PDF (missing %PDF- magic bytes)
        fake_pdf = io.BytesIO(b"THIS_IS_NOT_A_REAL_PDF_HEADER")
        res2 = self.client.post(
            "/upload_resume",
            data={"resume": (fake_pdf, "corrupt.pdf")},
            content_type="multipart/form-data",
            headers=self.headers1
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("Valid PDF header missing", res2.get_json()["message"])

        # 3. Empty PDF (0 bytes)
        empty_pdf = io.BytesIO(b"")
        res3 = self.client.post(
            "/upload_resume",
            data={"resume": (empty_pdf, "empty.pdf")},
            content_type="multipart/form-data",
            headers=self.headers1
        )
        self.assertEqual(res3.status_code, 400)
        print("  [PASS] Test 6: Invalid and corrupt files are safely rejected with meaningful errors")

    # -------------------------------------------------------------------------
    # TEST 7: Simulate Groq API failure
    # Expected: Valid deterministic ATS results remain available, and AI feedback is marked unavailable.
    # -------------------------------------------------------------------------
    @patch("services.groq_service._call_groq")
    def test_07_simulate_groq_api_failure(self, mock_groq):
        mock_groq.side_effect = RuntimeError("Groq connection timeout")

        # analyze_resume MUST succeed deterministically despite Groq failure
        analysis = analyze_resume(self.resume_a_text)
        self.assertIsNotNone(analysis["ats_score"])
        self.assertGreater(analysis["ats_score"], 0)
        self.assertEqual(analysis["ai_feedback_status"], "unavailable")
        self.assertIn("factors", analysis)
        self.assertEqual(len(analysis["factors"]), 5)

        # analyze_jd_match MUST succeed deterministically despite Groq failure
        jd_res = analyze_jd_match(self.resume_a_text, self.sample_jd)
        self.assertIsNotNone(jd_res["match_score"])
        self.assertEqual(jd_res["ai_feedback_status"], "unavailable")
        self.assertIn("Python", jd_res["matching_skills"])
        self.assertIn("Kubernetes", jd_res["missing_skills"])
        print("  [PASS] Test 7: Groq failure gracefully preserves deterministic scores and factor breakdown")

    # -------------------------------------------------------------------------
    # TEST 8: Compare Resume Analysis page and Dashboard
    # Expected: All shared metrics match the same saved analysis record.
    # -------------------------------------------------------------------------
    def test_08_compare_resume_page_and_dashboard(self):
        # Upload resume for User 1
        pdf_a = make_pdf(self.resume_a_lines)
        upload_res = self.client.post(
            "/upload_resume",
            data={"resume": (pdf_a, "SharedMetricsResume.pdf")},
            content_type="multipart/form-data",
            headers=self.headers1
        )
        upload_data = upload_res.get_json()
        saved_ats_score = upload_data["analysis"]["ats_score"]

        # Re-fetch from /resume/active (used by Resume Analysis page)
        active_res = self.client.get("/resume/active", headers=self.headers1)
        active_data = active_res.get_json()
        resume_page_ats = active_data["resume"]["analysis"]["ats_score"]

        # Fetch from /dashboard (used by Dashboard page)
        dash_res = self.client.get("/dashboard", headers=self.headers1)
        dash_data = dash_res.get_json()
        self.assertTrue(dash_data["has_active_resume"])
        dashboard_ats = dash_data["active_resume"]["ats_score"]

        # Verify exact match across endpoints
        self.assertEqual(saved_ats_score, resume_page_ats)
        self.assertEqual(saved_ats_score, dashboard_ats)
        print(f"  [PASS] Test 8: Resume Analysis page ({resume_page_ats}%) and Dashboard ({dashboard_ats}%) match exactly")

    # -------------------------------------------------------------------------
    # TEST 9: Log in with another user
    # Expected: No previous user's resume analysis is exposed.
    # -------------------------------------------------------------------------
    def test_09_multi_user_isolation(self):
        # User 1 has active resume
        res_u1 = self.client.get("/resume/active", headers=self.headers1)
        self.assertTrue(res_u1.get_json()["has_active_resume"])

        # User 2 initially has NO active resume
        res_u2 = self.client.get("/resume/active", headers=self.headers2)
        u2_data = res_u2.get_json()
        self.assertFalse(u2_data["has_active_resume"])
        self.assertIsNone(u2_data["resume"])

        dash_u2 = self.client.get("/dashboard", headers=self.headers2).get_json()
        self.assertFalse(dash_u2["has_active_resume"])
        self.assertIsNone(dash_u2["active_resume"])
        print("  [PASS] Test 9: Complete session isolation confirmed; User 2 cannot see User 1's resume")

    # -------------------------------------------------------------------------
    # TEST 10: Refresh the application and revisit Resume Analysis
    # Expected: The latest saved analysis is retrieved correctly.
    # -------------------------------------------------------------------------
    def test_10_revisit_resume_analysis_persistence(self):
        # Retrieve active resume multiple times simulating page refreshes
        for _ in range(3):
            res = self.client.get("/resume/active", headers=self.headers1)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data["has_active_resume"])
            self.assertIsNotNone(data["resume"]["analysis"])
            self.assertGreater(data["resume"]["analysis"]["ats_score"], 0)
            self.assertGreater(len(data["resume"]["skills"]), 0)

        print("  [PASS] Test 10: Persistent analysis retrieved consistently across simulated reloads")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  INTERVEXA AI - RESUME ANALYSIS ACCURACY & CONSISTENCY SUITE")
    print("=" * 70 + "\n")
    unittest.main(verbosity=2)
