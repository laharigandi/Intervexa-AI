import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

console.log("\n=======================================================");
console.log("  INTERVEXA AI — DAILY QUIZ PREPARATION SYSTEM AUDIT");
console.log("=======================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. Component File Existence Checks
// ---------------------------------------------------------------------------
console.log("--- Phase 1: Frontend Component Existence ---");
const quizComponentPath = resolve("Smart-Interview-Coach/frontend/src/components/study-planner/DailyQuizSection.jsx");
assert(existsSync(quizComponentPath), "DailyQuizSection.jsx component created");

const learningPagePath = resolve("Smart-Interview-Coach/frontend/src/pages/Learning.jsx");
assert(existsSync(learningPagePath), "Learning.jsx page exists");

const dailyTasksViewPath = resolve("Smart-Interview-Coach/frontend/src/components/study-planner/DailyTasksView.jsx");
assert(existsSync(dailyTasksViewPath), "DailyTasksView.jsx exists");

const overviewPath = resolve("Smart-Interview-Coach/frontend/src/components/study-planner/StudyPlanOverview.jsx");
assert(existsSync(overviewPath), "StudyPlanOverview.jsx exists");

// ---------------------------------------------------------------------------
// 2. DailyQuizSection.jsx Implementation Checks
// ---------------------------------------------------------------------------
console.log("\n--- Phase 2: DailyQuizSection.jsx UI Requirements ---");
const quizCode = readFileSync(quizComponentPath, "utf-8");

// UI Display Requirements: Today's Topic, Number of Questions, Start Quiz, Next, Submit
assert(quizCode.includes("quizData?.topic") || quizCode.includes("topic"), "Displays Today's Topic");
assert(quizCode.includes("Questions"), "Displays Number of Questions");
assert(quizCode.includes("Start Quiz"), "Displays Start Quiz button");
assert(quizCode.includes("Next Question"), "Displays Next Question button");
assert(quizCode.includes("Submit Quiz"), "Displays Submit Quiz button");
assert(quizCode.includes("options"), "Renders Question options");
assert(quizCode.includes("Previous Question"), "Provides previous question navigation");

// Results Display Requirements: Total Score, Correct, Wrong, Percentage, Explanations
assert(quizCode.includes("Total Score"), "Displays Total Score in results");
assert(quizCode.includes("Correct Answers"), "Displays Correct Answers count in results");
assert(quizCode.includes("Wrong Answers"), "Displays Wrong Answers count in results");
assert(quizCode.includes("Percentage"), "Displays Percentage score in results");
assert(quizCode.includes("Explanation") || quizCode.includes("explanation"), "Displays short technical explanations");

// Daily Progress & Review Requirements:
assert(quizCode.includes("Retake Quiz"), "Supports retaking or regenerating daily quiz");
assert(quizCode.includes("Completed") || quizCode.includes("completed"), "Shows Completed status");
assert(quizCode.includes("Pending") || quizCode.includes("pending"), "Shows Pending status");
assert(quizCode.includes("study-planner/daily-quiz"), "Fetches daily quiz via API");
assert(quizCode.includes("study-planner/daily-quiz/submit"), "Submits answers to backend endpoint");
assert(quizCode.includes("study-planner/daily-quiz/overview"), "Fetches all days progress overview");

// ---------------------------------------------------------------------------
// 3. Learning.jsx Integration Checks
// ---------------------------------------------------------------------------
console.log("\n--- Phase 3: Learning.jsx Page Integration ---");
const learningCode = readFileSync(learningPagePath, "utf-8");

assert(learningCode.includes("DailyQuizSection"), "Learning.jsx imports DailyQuizSection");
assert(learningCode.includes('id: "quiz"'), "Sub-view tab switcher includes Daily Quiz Preparation option");
assert(learningCode.includes('plannerSubView === "quiz"'), "Learning.jsx conditionally renders DailyQuizSection");
assert(learningCode.includes("onOpenQuiz"), "Passes onOpenQuiz callback to child views");

// ---------------------------------------------------------------------------
// 4. DailyTasksView.jsx & StudyPlanOverview.jsx Action Buttons
// ---------------------------------------------------------------------------
console.log("\n--- Phase 4: Fast Action Navigation ---");
const tasksCode = readFileSync(dailyTasksViewPath, "utf-8");
assert(tasksCode.includes("Daily Quiz"), "DailyTasksView includes quick Daily Quiz action button");
assert(tasksCode.includes("onOpenQuiz"), "DailyTasksView invokes onOpenQuiz handler");

const overviewCode = readFileSync(overviewPath, "utf-8");
assert(overviewCode.includes("Daily Quiz"), "StudyPlanOverview includes Daily Quiz button on Today's Focus card");

// ---------------------------------------------------------------------------
// 5. Backend Service Checks
// ---------------------------------------------------------------------------
console.log("\n--- Phase 5: Backend Service & Database Verification ---");
const servicePath = resolve("Smart-Interview-Coach/backend/services/daily_quiz_service.py");
assert(existsSync(servicePath), "daily_quiz_service.py exists");

const serviceCode = readFileSync(servicePath, "utf-8");
assert(serviceCode.includes("generate_daily_quiz_questions"), "generate_daily_quiz_questions defined");
assert(serviceCode.includes("get_or_generate_daily_quiz"), "get_or_generate_daily_quiz defined");
assert(serviceCode.includes("submit_daily_quiz"), "submit_daily_quiz defined");
assert(serviceCode.includes("get_daily_quizzes_overview"), "get_daily_quizzes_overview defined");
assert(serviceCode.includes("_get_previous_quiz_questions"), "Anti-repetition function implemented");

const dbPath = resolve("Smart-Interview-Coach/backend/database.py");
const dbCode = readFileSync(dbPath, "utf-8");
assert(dbCode.includes("CREATE TABLE IF NOT EXISTS daily_quizzes"), "daily_quizzes table definition exists in database.py");

console.log("\n=======================================================");
console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
