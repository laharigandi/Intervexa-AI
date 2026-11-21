import fs from "fs";
import path from "path";
import assert from "assert";

console.log("===========================================================================");
console.log("  Intervexa AI - Interview Results Redesign Verification Suite              ");
console.log("===========================================================================\n");

const frontendRoot = path.resolve("Smart-Interview-Coach/frontend");
const resultsJsxPath = path.join(frontendRoot, "src/pages/Results.jsx");

assert(fs.existsSync(resultsJsxPath), "Results.jsx must exist");
const resultsCode = fs.readFileSync(resultsJsxPath, "utf-8");

// [GROUP 1] Overall Score & Performance Tier
console.log("[TEST GROUP 1] Overall Score & Performance Summary");
assert(
  resultsCode.includes("overallScore") && resultsCode.includes("/ 100"),
  "Overall score out of 100 must be calculated and displayed"
);
assert(
  resultsCode.includes('"Excellent"') &&
  resultsCode.includes('"Good"') &&
  resultsCode.includes('"Average"') &&
  resultsCode.includes('"Needs Improvement"'),
  "Performance tier labels (Excellent, Good, Average, Needs Improvement) must be defined"
);
assert(
  resultsCode.includes("performance.summary"),
  "A short one-line performance summary must be rendered"
);
console.log("  ✔ [PASS] Overall score (0-100), performance tiers, and one-line summary verified");

// [GROUP 2] Exactly ONE Visualization Rule
console.log("\n[TEST GROUP 2] Exactly ONE Visualization Rule");
// Count chart component usages
const barChartMatches = resultsCode.match(/<BarChart/g) || [];
const pieChartMatches = resultsCode.match(/<PieChart/g) || [];
const radarChartMatches = resultsCode.match(/<RadarChart/g) || [];
const lineChartMatches = resultsCode.match(/<LineChart/g) || [];
const totalVisualizations = barChartMatches.length + pieChartMatches.length + radarChartMatches.length + lineChartMatches.length;

assert.strictEqual(
  totalVisualizations,
  1,
  `Expected exactly ONE visualization on the entire page, found ${totalVisualizations}`
);
assert(
  resultsCode.includes('title="Interview Performance Breakdown"'),
  "The single visualization must be the Interview Performance Breakdown chart"
);
assert(
  resultsCode.includes('dataKey="name"') && resultsCode.includes('dataKey="score"'),
  "Breakdown chart must display Technical, Communication, and Overall scores"
);
console.log(`  ✔ [PASS] Exactly ONE visualization rendered: Interview Performance Breakdown (BarChart: ${barChartMatches.length}, PieChart: 0, RadarChart: 0)`);

// [GROUP 3] Key Strengths and Areas to Improve
console.log("\n[TEST GROUP 3] Key Strengths & Areas to Improve (Two-Column Layout)");
assert(
  resultsCode.includes('title="Key Strengths"'),
  "Key Strengths card must be present"
);
assert(
  resultsCode.includes('title="Areas to Improve"'),
  "Areas to Improve card must be present"
);
assert(
  resultsCode.includes("topStrengths") && resultsCode.includes(".slice(0, 3)"),
  "Key Strengths must display at most top 3 strengths from genuine evaluation"
);
assert(
  resultsCode.includes("topImprovements") && resultsCode.includes(".slice(0, 3)"),
  "Areas to Improve must display at most top 3 weaknesses from genuine evaluation"
);
assert(
  resultsCode.includes("gridTemplateColumns: \"repeat(auto-fit, minmax(320px, 1fr))\""),
  "Key Strengths and Areas to Improve must be arranged in a responsive two-column grid"
);
console.log("  ✔ [PASS] Key Strengths (top 3) and Areas to Improve (top 3) rendered in two-column grid");

// [GROUP 4] Recommended Next Steps
console.log("\n[TEST GROUP 4] Recommended Next Steps");
assert(
  resultsCode.includes('title="Recommended Next Steps"'),
  "Recommended Next Steps section must be present"
);
assert(
  resultsCode.includes("step.topic") &&
  resultsCode.includes("step.reason") &&
  resultsCode.includes("step.action"),
  "Each next step recommendation must display topic name, short reason, and relevant action"
);
assert(
  resultsCode.includes('navigate("/learning")'),
  "Recommended next steps must provide a direct action link to Study Planner / Learning"
);
console.log("  ✔ [PASS] Recommended Next Steps includes topic, reason, action, and navigation link");

// [GROUP 5] Compact Interview Summary
console.log("\n[TEST GROUP 5] Compact Interview Summary");
assert(
  resultsCode.includes("Interview Summary") &&
  resultsCode.includes("targetRole") &&
  resultsCode.includes("interviewMode") &&
  resultsCode.includes("Total Questions:") &&
  resultsCode.includes("Answered:") &&
  resultsCode.includes("Completed"),
  "Compact Interview Summary must display mode, role, total questions, answered count, and completed status"
);
console.log("  ✔ [PASS] Compact Interview Summary card verified with all required metrics");

// [GROUP 6] Optional Collapsible "Review My Answers" (Collapsed by default)
console.log("\n[TEST GROUP 6] Review My Answers (Collapsible & Default Collapsed)");
assert(
  resultsCode.includes("const [showReview, setShowReview] = useState(false);"),
  "Review My Answers must be collapsed by default (showReview: false)"
);
assert(
  resultsCode.includes("Review My Answers"),
  "Section header must be named 'Review My Answers'"
);
assert(
  resultsCode.includes("candidateAnswer") &&
  resultsCode.includes("feedback") &&
  resultsCode.includes("improvedAnswer"),
  "Question review must show question, candidate answer, short feedback, and improved answer"
);
console.log("  ✔ [PASS] Review My Answers is collapsible, collapsed by default, and preserves question breakdown");

// [GROUP 7] Preservation of Existing Functionality & PDF Download
console.log("\n[TEST GROUP 7] PDF Download & History Actions");
assert(
  resultsCode.includes("downloadReport") && resultsCode.includes("/download_report"),
  "PDF download report handler must be preserved"
);
assert(
  resultsCode.includes('navigate("/history")') && resultsCode.includes('navigate("/role")'),
  "Navigation to history and interview retry must be preserved"
);
console.log("  ✔ [PASS] PDF report export and navigation handlers preserved");

console.log("\n===========================================================================");
console.log("  SUMMARY: All 7 Interview Results Test Groups PASSED! (100% OK)            ");
console.log("===========================================================================\n");

