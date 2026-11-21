import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(frontendDir, "..", "backend");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failedTests++;
  }
}

console.log("===========================================================================");
console.log("INTERVEXA AI — EXACTLY 10 QUESTIONS VERIFICATION SUITE");
console.log("===========================================================================\n");

// 1. Backend Verification
console.log("[BACKEND] 1. Groq Service & Adaptive Engine Limits");
const groqService = fs.readFileSync(path.join(backendDir, "services", "groq_service.py"), "utf-8");
assert(groqService.includes("exactly 10 questions"), "groq_service prompt explicitly enforces exactly 10 questions");
assert(groqService.includes("if len(clean_questions) >= 10:"), "groq_service generate_questions enforces exactly 10 questions");
assert(groqService.includes("_build_fallback_questions"), "groq_service includes robust 10-question fallback pools");

const adaptiveService = fs.readFileSync(path.join(backendDir, "services", "adaptive_interview_service.py"), "utf-8");
assert(adaptiveService.includes("DEFAULT_MAX_QUESTIONS = 10"), "adaptive_interview_service sets DEFAULT_MAX_QUESTIONS = 10");
assert(adaptiveService.includes("max_questions = max(1, min(20, int(max_questions)))"), "adaptive_interview_service allows up to 20 questions with 10 default");

const backendApp = fs.readFileSync(path.join(backendDir, "app.py"), "utf-8");
assert(backendApp.includes('max_questions = int(data.get("max_questions") or 10)'), "app.py /adaptive/start defaults max_questions to 10");
assert(backendApp.includes("[:10]"), "app.py /generate_questions strictly validates and slices to exactly 10 questions");

// 2. Frontend Role & Selection Pages
console.log("\n[FRONTEND] 2. Interview Selection & Role Setup");
const interviewSelection = fs.readFileSync(path.join(frontendDir, "src", "pages", "InterviewSelection.jsx"), "utf-8");
assert(interviewSelection.includes("standard_questions") && interviewSelection.includes("parsed.length === 10"), "InterviewSelection requires exactly 10 questions before launching Standard Interview");
assert(interviewSelection.includes("max_questions: 10"), "InterviewSelection passes max_questions: 10 to /adaptive/start");
assert(!interviewSelection.includes('localStorage.setItem("questions", JSON.stringify([data.session.current_question]))'), "InterviewSelection does NOT overwrite questions array with 1 item on adaptive start");

const selectRole = fs.readFileSync(path.join(frontendDir, "src", "pages", "SelectRole.jsx"), "utf-8");
assert(selectRole.includes("max_questions: 10"), "SelectRole passes max_questions: 10 for adaptive session initialization");
assert(selectRole.includes("standard_questions"), "SelectRole stores standard 10-question set in standard_questions");

// 3. Frontend Interview & Stepper Navigation
console.log("\n[FRONTEND] 3. Interview Page & Full-Screen Stepper");
const interviewPage = fs.readFileSync(path.join(frontendDir, "src", "pages", "Interview.jsx"), "utf-8");
assert(interviewPage.includes("standard_questions"), "Interview.jsx reads standard_questions to prevent cross-session contamination");
assert(interviewPage.includes("Self-healing"), "Interview.jsx contains self-healing check to regenerate exactly 10 questions if cache is incomplete");
assert(interviewPage.includes("Interview Question {activeIndex + 1} of {questionList.length}"), "Interview.jsx displays question counter Interview Question X of 10");
assert(interviewPage.includes("Next Question"), "Interview.jsx provides Next Question button");
assert(interviewPage.includes("Finish & Submit for Evaluation"), "Interview.jsx displays Finish & Submit for Evaluation on final question");
assert(interviewPage.includes("effectiveAdaptiveSession.max_questions || 10"), "Interview.jsx passes max_questions: 10 to adaptive layout");

// 4. Voice Interview Component
console.log("\n[FRONTEND] 4. Voice Interview Component");
const voiceInterview = fs.readFileSync(path.join(frontendDir, "src", "components", "VoiceInterview.jsx"), "utf-8");
assert(voiceInterview.includes("Interview Question {currentIndex + 1} of {questionList.length}"), "VoiceInterview displays Interview Question X of 10");
assert(voiceInterview.includes("Next Question"), "VoiceInterview provides Next Question button");
assert(voiceInterview.includes("Finish & Submit for Evaluation"), "VoiceInterview displays Finish & Submit for Evaluation on question 10");

// 5. Adaptive Interview Component
console.log("\n[FRONTEND] 5. Adaptive Interview Component");
const adaptiveInterview = fs.readFileSync(path.join(frontendDir, "src", "components", "AdaptiveInterview.jsx"), "utf-8");
assert(adaptiveInterview.includes("maxQuestions = session?.max_questions || 10"), "AdaptiveInterview defaults maxQuestions to 10");
assert(adaptiveInterview.includes("Question {questionIndex} of {maxQuestions}"), "AdaptiveInterview displays counter Question X of 10");
assert(adaptiveInterview.includes("Finish Interview & Evaluate"), "AdaptiveInterview displays Finish Interview & Evaluate on question 10");
assert(adaptiveInterview.includes("Submit Answer & Next Question"), "AdaptiveInterview displays Submit Answer & Next Question before question 10");

console.log("\n===========================================================================");
console.log(`TOTAL: ${passedTests} of ${totalTests} verification checks PASSED (${failedTests} failed).`);
console.log("===========================================================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
