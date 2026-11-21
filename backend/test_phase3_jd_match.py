import os
import sys
import json
import unittest
from unittest.mock import patch, MagicMock

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import app as flask_app
from services.groq_service import (
    analyze_jd_match,
    _build_fallback_jd_match,
    generate_questions,
    _call_groq,
)
from services.skill_extractor import extract_skills


class Phase3JDMatchTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        flask_app.app.config["TESTING"] = True
        cls.client = flask_app.app.test_client()

    # -------------------------------------------------------------------------
    # TEST 1: Valid JD Match Analysis Returns Complete Structured Contract
    # -------------------------------------------------------------------------
    def test_01_valid_jd_match_analysis_contract(self):
        print("\n[TEST 1] Valid Job Description Match Analysis Contract:")
        resume_text = """
        John Doe - Software Engineer
        Skills: Python, Flask, React, SQL, Git, Machine Learning.
        Experience: Developed REST APIs using Flask and PostgreSQL. Built interactive dashboards using React.
        """
        job_description = """
        Senior Python Developer
        Requirements:
        - Strong proficiency in Python and Flask
        - Experience with SQL and relational databases
        - Familiarity with React and front-end development
        - Desired: AWS cloud and Docker containerization
        """

        mock_ai_response = json.dumps({
            "match_score": 82,
            "matching_skills": ["Python", "Flask", "SQL", "React"],
            "missing_skills": ["AWS", "Docker"],
            "explicit_resume_skills": ["Python", "Flask", "React", "SQL", "Git", "Machine Learning"],
            "inferred_skills": ["RESTful API Architecture", "Full-Stack Development"],
            "relevant_experience": "Candidate has hands-on experience building Flask APIs and React dashboards with SQL databases.",
            "strengths": "Solid direct alignment with the core backend and frontend requirements of the role.",
            "improvement_suggestions": [
                "Gain experience with Docker containerization.",
                "Highlight any cloud deployment experience on AWS.",
                "Add quantifiable performance metrics to Flask project descriptions."
            ]
        })

        with patch("services.groq_service._call_groq", return_value=mock_ai_response):
            res = self.client.post(
                "/analyze_jd_match",
                json={
                    "resume_text": resume_text,
                    "job_description": job_description,
                }
            )

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))

        # Verify all required structured fields
        self.assertIn("match_score", data)
        self.assertIsInstance(data["match_score"], int)
        self.assertEqual(data["match_score"], 82)

        self.assertIn("matching_skills", data)
        self.assertIsInstance(data["matching_skills"], list)
        self.assertIn("Python", data["matching_skills"])

        self.assertIn("missing_skills", data)
        self.assertIsInstance(data["missing_skills"], list)
        self.assertIn("AWS", data["missing_skills"])

        self.assertIn("explicit_resume_skills", data)
        self.assertIsInstance(data["explicit_resume_skills"], list)

        self.assertIn("inferred_skills", data)
        self.assertIsInstance(data["inferred_skills"], list)

        self.assertIn("relevant_experience", data)
        self.assertIsInstance(data["relevant_experience"], str)

        self.assertIn("strengths", data)
        self.assertIsInstance(data["strengths"], str)

        self.assertIn("improvement_suggestions", data)
        self.assertIsInstance(data["improvement_suggestions"], list)
        self.assertGreater(len(data["improvement_suggestions"]), 0)

        print(f"  Match Score: {data['match_score']}% [PASS]")
        print(f"  Matching Skills ({len(data['matching_skills'])}): {data['matching_skills']} [PASS]")
        print(f"  Missing Skills ({len(data['missing_skills'])}): {data['missing_skills']} [PASS]")
        print("  -> [PASS] Structured JD match contract verified.")

    # -------------------------------------------------------------------------
    # TEST 2: Clear Distinction Between Explicit and Inferred Skills
    # -------------------------------------------------------------------------
    def test_02_distinguishes_explicit_and_inferred_skills(self):
        print("\n[TEST 2] Verifying Explicit vs Inferred Skills Distinction:")
        resume_text = "Proficient in Python, SQL, and HTML. Built a data pipeline for analytics."
        job_description = "Data Engineer with Python, SQL, Apache Spark, and Cloud Data Warehouse experience."

        mock_response = json.dumps({
            "match_score": 60,
            "matching_skills": ["Python", "SQL"],
            "missing_skills": ["Apache Spark", "Cloud Data Warehouse"],
            "explicit_resume_skills": ["Python", "SQL", "HTML"],
            "inferred_skills": ["Data Pipeline Engineering", "ETL Architecture"],
            "relevant_experience": "Demonstrated data pipeline construction using Python and SQL.",
            "strengths": "Foundational data querying and script automation abilities.",
            "improvement_suggestions": ["Learn distributed frameworks like Spark."]
        })

        with patch("services.groq_service._call_groq", return_value=mock_response):
            result = analyze_jd_match(resume_text, job_description)

        # Explicit skills must contain what was in resume
        self.assertIn("Python", result["explicit_resume_skills"])
        self.assertIn("SQL", result["explicit_resume_skills"])

        # Inferred skills must be distinct and not duplicate explicit skills
        for inf in result["inferred_skills"]:
            self.assertNotIn(inf, result["explicit_resume_skills"])

        print(f"  Explicit Skills: {result['explicit_resume_skills']}")
        print(f"  Inferred Skills: {result['inferred_skills']}")
        print("  -> [PASS] Explicit skills strictly distinguished from AI-inferred skills.")

    # -------------------------------------------------------------------------
    # TEST 3: Validation & Empty Input Rejection (HTTP 400)
    # -------------------------------------------------------------------------
    def test_03_empty_input_rejected_with_http_400(self):
        print("\n[TEST 3] Validation - Empty and Missing Inputs Rejected:")

        # Case 3A: Missing job description
        res = self.client.post("/analyze_jd_match", json={"resume_text": "Python developer"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Job description is required", res.get_json().get("error", ""))
        print("  Case 3A: Missing job_description returns HTTP 400 [PASS]")

        # Case 3B: Empty whitespace job description
        res = self.client.post("/analyze_jd_match", json={"resume_text": "Python developer", "job_description": "   "})
        self.assertEqual(res.status_code, 400)
        print("  Case 3B: Whitespace job_description returns HTTP 400 [PASS]")

        # Case 3C: Missing resume text
        res = self.client.post("/analyze_jd_match", json={"job_description": "We need a Python dev."})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Resume text is required", res.get_json().get("error", ""))
        print("  Case 3C: Missing resume_text returns HTTP 400 [PASS]")

        # Case 3D: Empty body
        res = self.client.post("/analyze_jd_match", json={})
        self.assertEqual(res.status_code, 400)
        print("  Case 3D: Empty JSON body returns HTTP 400 [PASS]")

        print("  -> [PASS] Input validation enforces required fields.")

    # -------------------------------------------------------------------------
    # TEST 4: Oversized Input Rejection (HTTP 400)
    # -------------------------------------------------------------------------
    def test_04_oversized_input_rejected_with_http_400(self):
        print("\n[TEST 4] Boundary Checks - Oversized Inputs Rejected:")

        # Oversized JD (> 10,000 characters)
        oversized_jd = "Senior Developer Role requirements: " + ("x" * 10050)
        res = self.client.post(
            "/analyze_jd_match",
            json={
                "resume_text": "Valid resume content with Python and SQL.",
                "job_description": oversized_jd
            }
        )
        self.assertEqual(res.status_code, 400)
        err = res.get_json().get("error", "")
        self.assertIn("exceeds maximum length", err)
        print("  Case 4A: Oversized job description (> 10,000 chars) returns HTTP 400 [PASS]")

        # Oversized Resume (> 30,000 characters)
        oversized_resume = "Resume: " + ("y" * 30050)
        res = self.client.post(
            "/analyze_jd_match",
            json={
                "resume_text": oversized_resume,
                "job_description": "Standard job posting"
            }
        )
        self.assertEqual(res.status_code, 400)
        print("  Case 4B: Oversized resume text (> 30,000 chars) returns HTTP 400 [PASS]")
        print("  -> [PASS] Input length limits strictly enforced.")

    # -------------------------------------------------------------------------
    # TEST 5: Malformed AI Output Normalization
    # -------------------------------------------------------------------------
    def test_05_malformed_ai_output_normalization(self):
        print("\n[TEST 5] Resilience - Malformed AI Output Normalization:")
        resume_text = "Experienced in Python and JavaScript."
        job_description = "Looking for a Python backend engineer."

        # Case 5A: String score, comma-separated lists, markdown wrapper
        malformed_ai = """```json
        {
            "match_score": "72.5",
            "matching_skills": "Python, JavaScript",
            "missing_skills": "PostgreSQL, Docker",
            "explicit_resume_skills": ["Python", "JavaScript"],
            "inferred_skills": "Backend Scripting",
            "relevant_experience": "Hands-on coding experience.",
            "strengths": "Language familiarity.",
            "improvement_suggestions": "Learn Docker and database indexing."
        }
        ```"""

        with patch("services.groq_service._call_groq", return_value=malformed_ai):
            result = analyze_jd_match(resume_text, job_description)

        self.assertIsInstance(result["match_score"], int)
        self.assertEqual(result["match_score"], 72)
        self.assertIsInstance(result["matching_skills"], list)
        self.assertIn("Python", result["matching_skills"])
        self.assertIsInstance(result["missing_skills"], list)
        self.assertIsInstance(result["inferred_skills"], list)
        self.assertIsInstance(result["improvement_suggestions"], list)
        print("  Case 5A: String scores and comma-separated lists normalized correctly [PASS]")

        print("  -> [PASS] Malformed AI responses normalized safely.")

    # -------------------------------------------------------------------------
    # TEST 6: Groq Failure Activates Deterministic Fallback JD Match
    # -------------------------------------------------------------------------
    def test_06_groq_failure_triggers_fallback(self):
        print("\n[TEST 6] Fallback Mechanism - Deterministic Offline JD Match:")
        resume_text = "Proficient in Python, React, Flask, and SQL."
        job_description = "Seeking a developer skilled in Python, SQL, and Docker."

        # Simulate Groq API exception
        with patch("services.groq_service._call_groq", side_effect=Exception("Groq API 503 Service Unavailable")):
            result = analyze_jd_match(resume_text, job_description)

        self.assertIsInstance(result, dict)
        self.assertIn("match_score", result)
        self.assertGreaterEqual(result["match_score"], 0)
        self.assertLessEqual(result["match_score"], 100)
        self.assertIn("Python", result["matching_skills"])
        self.assertIn("SQL", result["matching_skills"])
        self.assertIn("Docker", result["missing_skills"])
        self.assertGreater(len(result["improvement_suggestions"]), 0)

        print(f"  Fallback Match Score: {result['match_score']}% [PASS]")
        print(f"  Fallback Matched: {result['matching_skills']}, Missing: {result['missing_skills']} [PASS]")
        print("  -> [PASS] AI failure triggers robust deterministic fallback without crashing.")

    # -------------------------------------------------------------------------
    # TEST 7: Resume-Only Workflow Still Works (Backward Compatibility)
    # -------------------------------------------------------------------------
    def test_07_resume_only_workflow_preserved(self):
        print("\n[TEST 7] Workflow Compatibility - Resume-Only Generation Unaffected:")

        mock_questions = [
            "Explain how Python manages memory.",
            "What are Python generators and decorators?",
            "How do indexes work in SQL?",
            "Explain the difference between SQL and NoSQL.",
            "What is the event loop in JavaScript?",
            "How does React manage virtual DOM diffing?",
            "What are REST status codes 200, 201, 400, 404?",
            "How do processes differ from threads?",
            "Describe your most technically challenging project.",
            "How do you approach debugging production issues?"
        ]

        with patch("services.groq_service._call_groq", return_value=json.dumps({"questions": mock_questions})):
            res = self.client.post(
                "/generate_questions",
                json={
                    "role": "Python Developer",
                    "skills": ["Python", "SQL"],
                    "resume_text": "Experienced Python developer"
                    # Note: No job_description supplied!
                }
            )

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(len(data.get("questions", [])), 10)
        print("  Successfully generated 10 questions without job_description [PASS]")
        print("  -> [PASS] Resume-only workflow completely preserved.")

    # -------------------------------------------------------------------------
    # TEST 8: Job-Specific Questions Generated with JD Context
    # -------------------------------------------------------------------------
    def test_08_job_specific_questions_use_jd_context(self):
        print("\n[TEST 8] Job-Specific Context - Questions Tailored to Job Description:")
        captured_messages = []

        def mock_call(messages, **kwargs):
            captured_messages.extend(messages)
            return json.dumps({
                "questions": [
                    "How have you used Kubernetes in cloud deployments?",
                    "Explain Kafka message partitioning strategies.",
                    "How do you design scalable Flask microservices?",
                    "What SQL optimization techniques do you apply?",
                    "How do you configure CI/CD pipelines with GitHub Actions?",
                    "Explain horizontal vs vertical scaling in AWS.",
                    "Describe your experience with distributed transactions.",
                    "How do you monitor microservice health using Prometheus?",
                    "Walk me through a production outage you investigated.",
                    "Why are you interested in this specific Cloud Engineering role?"
                ]
            })

        with patch("services.groq_service._call_groq", side_effect=mock_call):
            res = self.client.post(
                "/generate_questions",
                json={
                    "role": "Cloud Engineer",
                    "skills": ["Python", "Flask", "SQL"],
                    "resume_text": "Python developer with Flask experience.",
                    "job_description": "We need a Cloud Engineer experienced with Kubernetes, Kafka, and AWS microservices."
                }
            )

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(len(data["questions"]), 10)

        # Verify the prompt sent to Groq contains the job description
        prompt_content = captured_messages[0]["content"] if captured_messages else ""
        self.assertIn("Kubernetes", prompt_content)
        self.assertIn("Kafka", prompt_content)
        self.assertIn("Target Job Description", prompt_content)

        print("  Job description correctly incorporated into Groq prompt [PASS]")
        print("  -> [PASS] Job-specific questions generated with JD context.")


def run_tests():
    print("=" * 65)
    print("      PHASE 3 RESUME TO JD MATCHING & SKILL GAP TEST SUITE")
    print("=" * 65)

    suite = unittest.TestLoader().loadTestsFromTestCase(Phase3JDMatchTestSuite)
    runner = unittest.TextTestRunner(verbosity=1)
    result = runner.run(suite)

    print("\n" + "=" * 65)
    print(f"  TOTAL TESTS RUN: {result.testsRun}")
    print(f"  PASSED         : {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"  FAILURES       : {len(result.failures)}")
    print(f"  ERRORS         : {len(result.errors)}")
    print("=" * 65)

    return len(result.failures) == 0 and len(result.errors) == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
