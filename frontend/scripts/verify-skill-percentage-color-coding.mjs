import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { classifySkillScore, SKILL_TIERS } from "../src/utils/atsScoreClassification.js";

console.log("\n=======================================================");
console.log("  INTERVEXA AI — DYNAMIC SKILL SCORE COLOR CODING TESTS");
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
// 1. Classification Utility Tests
// ---------------------------------------------------------------------------
console.log("--- Phase 1: Classification Thresholds & Color Codes ---");

// Test: 80–100% -> Excellent (#16A34A)
const score80 = classifySkillScore(80, true, 3);
assert(score80.category === "Excellent", "Score 80 classifies as 'Excellent'");
assert(score80.color === "#16A34A", "Score 80 uses color #16A34A");
assert(score80.bg === "rgba(22, 163, 74, 0.12)", "Score 80 uses subtle green background tint");
assert(score80.percentageDisplay === "80%", "Score 80 displays '80%'");
assert(score80.isValid === true, "Score 80 is valid");

const score100 = classifySkillScore(100, true, 5);
assert(score100.category === "Excellent", "Score 100 classifies as 'Excellent'");
assert(score100.color === "#16A34A", "Score 100 uses color #16A34A");

// Test: 60–79% -> Good (#2563EB)
const score60 = classifySkillScore(60, true, 2);
assert(score60.category === "Good", "Score 60 classifies as 'Good'");
assert(score60.color === "#2563EB", "Score 60 uses color #2563EB");
assert(score60.bg === "rgba(37, 99, 235, 0.12)", "Score 60 uses subtle blue background tint");
assert(score60.percentageDisplay === "60%", "Score 60 displays '60%'");

const score75 = classifySkillScore(75, true, 4);
assert(score75.category === "Good", "Score 75 classifies as 'Good'");
assert(score75.color === "#2563EB", "Score 75 uses color #2563EB");

// Test: 40–59% -> Needs Improvement (#D97706)
const score40 = classifySkillScore(40, true, 2);
assert(score40.category === "Needs Improvement", "Score 40 classifies as 'Needs Improvement'");
assert(score40.color === "#D97706", "Score 40 uses color #D97706");
assert(score40.bg === "rgba(217, 119, 6, 0.12)", "Score 40 uses subtle orange background tint");
assert(score40.percentageDisplay === "40%", "Score 40 displays '40%'");

const score55 = classifySkillScore(55, true, 3);
assert(score55.category === "Needs Improvement", "Score 55 classifies as 'Needs Improvement'");
assert(score55.color === "#D97706", "Score 55 uses color #D97706");

// Test: User Explicit Examples (0–39%: Poor, #DC2626)
console.log("\n--- Phase 2: User Explicit Scenario Verification ---");
// HTML: 7% -> Red, Poor
const html = classifySkillScore(7, true, 2);
assert(html.category === "Poor", "HTML (7%) classifies as 'Poor'");
assert(html.color === "#DC2626", "HTML (7%) uses color #DC2626 (Red)");
assert(html.bg === "rgba(220, 38, 38, 0.12)", "HTML (7%) uses subtle red background tint");
assert(html.percentageDisplay === "7%", "HTML (7%) displays '7%'");

// JavaScript: 0% -> Red, Poor
const js = classifySkillScore(0, true, 1);
assert(js.category === "Poor", "JavaScript (0%) classifies as 'Poor'");
assert(js.color === "#DC2626", "JavaScript (0%) uses color #DC2626 (Red)");
assert(js.percentageDisplay === "0%", "JavaScript (0%) displays '0%'");

// React: 3% -> Red, Poor
const react = classifySkillScore(3, true, 2);
assert(react.category === "Poor", "React (3%) classifies as 'Poor'");
assert(react.color === "#DC2626", "React (3%) uses color #DC2626 (Red)");
assert(react.percentageDisplay === "3%", "React (3%) displays '3%'");

// REST API Integration: 24% -> Red, Poor
const restApi = classifySkillScore(24, true, 3);
assert(restApi.category === "Poor", "REST API Integration (24%) classifies as 'Poor'");
assert(restApi.color === "#DC2626", "REST API Integration (24%) uses color #DC2626 (Red)");
assert(restApi.percentageDisplay === "24%", "REST API Integration (24%) displays '24%'");

// Test: Not Evaluated Yet -> Grey (#64748B)
console.log("\n--- Phase 3: Not Evaluated Yet Verification ---");
const unrated1 = classifySkillScore(null, false, 0);
assert(unrated1.category === "Not Evaluated Yet", "Unrated skill classifies as 'Not Evaluated Yet'");
assert(unrated1.color === "#64748B", "Unrated skill uses color #64748B (Grey)");
assert(unrated1.bg === "rgba(100, 116, 139, 0.12)", "Unrated skill uses subtle grey background tint");
assert(unrated1.isEvaluated === false, "Unrated skill isEvaluated is false");
assert(unrated1.percentageDisplay === "Not evaluated yet", "Unrated skill does NOT show 0%");

const unrated2 = classifySkillScore(undefined, false, 0);
assert(unrated2.color === "#64748B", "Undefined score uses color #64748B");

const unrated3 = classifySkillScore("Not evaluated yet", false, 0);
assert(unrated3.color === "#64748B", "String 'Not evaluated yet' uses color #64748B");

// ---------------------------------------------------------------------------
// 4. Frontend Dashboard.jsx Inspection
// ---------------------------------------------------------------------------
console.log("\n--- Phase 4: Dashboard Integration Inspection ---");
const dashFile = resolve("Smart-Interview-Coach/frontend/src/pages/Dashboard.jsx");
assert(existsSync(dashFile), "Dashboard.jsx exists");

const dashCode = readFileSync(dashFile, "utf-8");

assert(dashCode.includes("classifySkillScore"), "Dashboard.jsx imports classifySkillScore");
assert(dashCode.includes("from \"../utils/atsScoreClassification\""), "Imported from atsScoreClassification");

// Check strong section color coding
assert(dashCode.includes("classifySkillScore(item.scorePct, true, item.count)"), "Strong section calls classifySkillScore");
assert(dashCode.includes("color: cls.color"), "Skill item applies dynamic cls.color");
assert(dashCode.includes("background: cls.bg"), "Skill badge applies dynamic cls.bg");
assert(dashCode.includes("border: `1px solid ${cls.border}`"), "Skill badge applies dynamic cls.border");
assert(dashCode.includes("background: cls.color"), "Progress bar fill applies dynamic cls.color");

// Check weak section
assert(dashCode.includes("Needs Focus & Practice"), "Needs Focus & Practice section preserved");

// Check emerging competencies (1 Q)
assert(dashCode.includes("Emerging Competencies"), "Emerging Competencies section preserved");
assert(dashCode.includes("classifySkillScore(item.scorePct, true, 1)"), "Emerging competencies calls classifySkillScore");

// Check unrated section (grey #64748B)
assert(dashCode.includes("Not Evaluated Yet"), "Not Evaluated Yet section preserved");
assert(dashCode.includes("classifySkillScore(null, false, 0)"), "Not Evaluated section calls classifySkillScore with false");

console.log("\n=======================================================");
console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
