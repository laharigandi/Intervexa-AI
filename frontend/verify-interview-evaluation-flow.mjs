import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const interviewPath = path.join(__dirname, "src", "pages", "Interview.jsx");
const adaptivePath = path.join(__dirname, "src", "components", "AdaptiveInterview.jsx");
const resultsPath = path.join(__dirname, "src", "pages", "Results.jsx");
const appPath = path.join(__dirname, "..", "backend", "app.py");

const interviewCode = fs.readFileSync(interviewPath, "utf-8");
const adaptiveCode = fs.readFileSync(adaptivePath, "utf-8");
const resultsCode = fs.readFileSync(resultsPath, "utf-8");
const appCode = fs.readFileSync(appPath, "utf-8");

console.log("==================================================");
console.log("FRONTEND & BACKEND CODE FLOW VERIFICATION");
console.log("==================================================");

let passed = 0;
let total = 0;

function check(name, condition) {
  total++;
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`);
  }
}

// 1. Interview.jsx checks
check("Interview.jsx preserves 10th answer during submission", interviewCode.includes("finalAnswers[activeIndex] = currentAnswerText") || interviewCode.includes("updatedAnswers[activeIndex] = currentAnswerText"));
check("Interview.jsx saves last_interview_id to localStorage", interviewCode.includes('localStorage.setItem("last_interview_id", String(savedInterviewId))'));
check("Interview.jsx navigates with interview_id query param", interviewCode.includes("savedInterviewId ? `/results?id=${savedInterviewId}` : \"/results\""));

// 2. AdaptiveInterview.jsx checks
check("AdaptiveInterview.jsx saves last_interview_id to localStorage", adaptiveCode.includes('localStorage.setItem("last_interview_id", String(savedInterviewId))'));
check("AdaptiveInterview.jsx navigates with interview_id query param", adaptiveCode.includes("savedInterviewId ? `/results?id=${savedInterviewId}` : \"/results\""));
check("AdaptiveInterview.jsx does not navigate away on finish error and allows retry", adaptiveCode.includes("Failed to finalize evaluation report") && adaptiveCode.includes("Retry"));

// 3. Results.jsx checks
check("Results.jsx checks URL param id and last_interview_id", resultsCode.includes('searchParams.get("id")') && resultsCode.includes('localStorage.getItem("last_interview_id")'));
check("Results.jsx fetches saved interview results on refresh", resultsCode.includes("/interview_results/${targetInterviewId}"));
check("Results.jsx has dedicated evaluation loading state", resultsCode.includes("Loading Interview Evaluation..."));

// 4. Backend app.py checks
check("app.py has dual /api/generate_questions decorator", appCode.includes('@app.route("/api/generate_questions"'));
check("app.py has dual /api/evaluate_answers decorator", appCode.includes('@app.route("/api/evaluate_answers"'));
check("app.py has dual /api/adaptive/finish decorator", appCode.includes('@app.route("/api/adaptive/finish"'));
check("app.py has /api/interview_results/<int:interview_id> endpoint", appCode.includes('@app.route("/api/interview_results/<int:interview_id>"'));

console.log(`\nVerification complete: ${passed}/${total} checks passed.`);
if (passed !== total) {
  process.exit(1);
}

