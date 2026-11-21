/**
 * Verification Script for Centralized ATS Score Classification System
 * 
 * Verifies:
 * 1. Score boundary values: 0, 25, 39, 40, 59, 60, 79, 80, 90, 100
 * 2. Exact colors: #16A34A (Green), #2563EB (Blue), #D97706 (Orange), #DC2626 (Red)
 * 3. Exact category labels: Excellent, Good, Needs Improvement, Poor
 * 4. Missing/unavailable score handling (null, undefined, "", NaN) -> Never 0%
 * 5. Reusable utility & component usage across AtsAnalysisDashboard, ResumeDashboardSection, Dashboard, UploadResume
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log("  INTERVEXA AI — DYNAMIC ATS SCORE CLASSIFICATION TESTS");
console.log("=======================================================\n");

// 1. Test Utility Logic
const utilPath = path.join(frontendDir, "src", "utils", "atsScoreClassification.js");
assert(fs.existsSync(utilPath), "atsScoreClassification.js utility file exists");

const { classifyAtsScore, ATS_TIERS } = await import(`file://${utilPath}`);

console.log("\n--- Phase 1: Boundary Value Testing ---");

const boundaryTests = [
  { score: 0, expectedCategory: "Poor", expectedColor: "#DC2626" },
  { score: 25, expectedCategory: "Poor", expectedColor: "#DC2626" },
  { score: 39, expectedCategory: "Poor", expectedColor: "#DC2626" },
  { score: 40, expectedCategory: "Needs Improvement", expectedColor: "#D97706" },
  { score: 59, expectedCategory: "Needs Improvement", expectedColor: "#D97706" },
  { score: 60, expectedCategory: "Good", expectedColor: "#2563EB" },
  { score: 79, expectedCategory: "Good", expectedColor: "#2563EB" },
  { score: 80, expectedCategory: "Excellent", expectedColor: "#16A34A" },
  { score: 90, expectedCategory: "Excellent", expectedColor: "#16A34A" },
  { score: 100, expectedCategory: "Excellent", expectedColor: "#16A34A" },
];

boundaryTests.forEach(({ score, expectedCategory, expectedColor }) => {
  const result = classifyAtsScore(score);
  assert(
    result.category === expectedCategory,
    `Score ${score} classifies as category '${expectedCategory}' (got '${result.category}')`
  );
  assert(
    result.color === expectedColor,
    `Score ${score} uses color '${expectedColor}' (got '${result.color}')`
  );
  assert(
    result.percentageDisplay === `${score}%`,
    `Score ${score} displays percentage '${score}%'`
  );
  assert(
    result.bg.includes("rgba(") && result.bg.includes("0.12)"),
    `Score ${score} uses subtle background tint '${result.bg}'`
  );
  assert(
    result.isValid === true,
    `Score ${score} is marked as valid`
  );
});

console.log("\n--- Phase 2: Missing & Unavailable Scores (Never 0%) ---");

const invalidTests = [
  { val: null, label: "null" },
  { val: undefined, label: "undefined" },
  { val: "", label: "empty string" },
  { val: "   ", label: "whitespace" },
  { val: "invalid", label: "non-numeric string" },
  { val: NaN, label: "NaN" },
];

invalidTests.forEach(({ val, label }) => {
  const result = classifyAtsScore(val);
  assert(
    result.isValid === false,
    `Invalid score (${label}) is marked as isValid: false`
  );
  assert(
    result.score === null,
    `Invalid score (${label}) returns score: null (not 0)`
  );
  assert(
    result.percentageDisplay !== "0%",
    `Invalid score (${label}) does NOT display 0% (displays '${result.percentageDisplay}')`
  );
  assert(
    result.category === "Unavailable",
    `Invalid score (${label}) category is 'Unavailable'`
  );
});

console.log("\n--- Phase 3: Out-of-Bounds Normalization ---");

const clampLow = classifyAtsScore(-15);
assert(clampLow.score === 0 && clampLow.category === "Poor", "Score -15 clamps to 0 (Poor)");

const clampHigh = classifyAtsScore(140);
assert(clampHigh.score === 100 && clampHigh.category === "Excellent", "Score 140 clamps to 100 (Excellent)");

console.log("\n--- Phase 4: Component Integration Checks ---");

const atsDashboardPath = path.join(frontendDir, "src", "components", "AtsAnalysisDashboard.jsx");
const atsDashboardCode = fs.readFileSync(atsDashboardPath, "utf-8");
assert(
  atsDashboardCode.includes("classifyAtsScore"),
  "AtsAnalysisDashboard.jsx imports and uses classifyAtsScore"
);
assert(
  atsDashboardCode.includes("classification.color"),
  "AtsAnalysisDashboard.jsx applies dynamic color from classification"
);
assert(
  atsDashboardCode.includes("classification.category"),
  "AtsAnalysisDashboard.jsx displays category label from classification"
);
assert(
  atsDashboardCode.includes("transition"),
  "AtsAnalysisDashboard.jsx includes smooth transition animations"
);

const resumeSectionPath = path.join(frontendDir, "src", "components", "ResumeDashboardSection.jsx");
const resumeSectionCode = fs.readFileSync(resumeSectionPath, "utf-8");
assert(
  resumeSectionCode.includes("classifyAtsScore"),
  "ResumeDashboardSection.jsx imports and uses classifyAtsScore"
);

const dashboardPath = path.join(frontendDir, "src", "pages", "Dashboard.jsx");
const dashboardCode = fs.readFileSync(dashboardPath, "utf-8");
assert(
  dashboardCode.includes("classifyAtsScore"),
  "Dashboard.jsx imports and uses classifyAtsScore"
);
assert(
  dashboardCode.includes("atsCls.percentageDisplay"),
  "Dashboard.jsx displays percentage and category from classification"
);

const uploadResumePath = path.join(frontendDir, "src", "pages", "UploadResume.jsx");
const uploadResumeCode = fs.readFileSync(uploadResumePath, "utf-8");
assert(
  uploadResumeCode.includes("classifyAtsScore"),
  "UploadResume.jsx imports and uses classifyAtsScore"
);

const badgeComponentPath = path.join(frontendDir, "src", "components", "AtsScoreBadge.jsx");
assert(
  fs.existsSync(badgeComponentPath),
  "Reusable AtsScoreBadge.jsx component created and exists"
);

console.log("\n=======================================================");
console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
