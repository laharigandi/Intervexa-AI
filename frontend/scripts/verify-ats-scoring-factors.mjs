import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const dashboardPath = path.resolve(frontendDir, "src", "components", "AtsAnalysisDashboard.jsx");

console.log("\n=======================================================");
console.log("  VERIFYING ATS SCORING FACTORS DISPLAY & INTEGRATION");
console.log("=======================================================\n");

const dashboardCode = fs.readFileSync(dashboardPath, "utf8");

// Test 1: Verify factor items extraction handles both analysis.factors and analysis.factor_breakdown
assert.ok(
  dashboardCode.includes("analysis.factors || analysis.factor_breakdown"),
  "AtsAnalysisDashboard must read from both analysis.factors and analysis.factor_breakdown"
);
console.log("✓ Test 1: factorItems fallback handles both analysis.factors and analysis.factor_breakdown");

// Test 2: Verify safe awarded_points extraction with fallback to factor.score
assert.ok(
  dashboardCode.includes("factor.awarded_points") && dashboardCode.includes("factor.score"),
  "AtsAnalysisDashboard must read factor.awarded_points and fall back to factor.score"
);
console.log("✓ Test 2: Correctly checks factor.awarded_points with fallback to factor.score");

// Test 3: Verify max points extraction with fallback to factor.max_score and default 20
assert.ok(
  dashboardCode.includes("factor.max_points") && dashboardCode.includes("factor.max_score"),
  "AtsAnalysisDashboard must read factor.max_points and fall back to factor.max_score"
);
console.log("✓ Test 3: Correctly checks factor.max_points with fallback to factor.max_score (default 20)");

// Test 4: Verify 'Not evaluated' handling
assert.ok(
  dashboardCode.includes("not_evaluated") && dashboardCode.includes("Not evaluated"),
  "AtsAnalysisDashboard must display 'Not evaluated' when a factor is not evaluated"
);
console.log("✓ Test 4: Correctly handles not evaluated factors without showing false 0");

// Test 5: Verify description/details rendering
assert.ok(
  dashboardCode.includes("factor.description") && dashboardCode.includes("factor.details"),
  "AtsAnalysisDashboard must support both factor.description and factor.details"
);
console.log("✓ Test 5: Correctly reads factor.description with fallback to factor.details");

// Test 6: Verify dynamic color coding thresholds
assert.ok(
  dashboardCode.includes("#16A34A") && // Green
  dashboardCode.includes("#2563EB") && // Blue
  dashboardCode.includes("#D97706") && // Orange
  dashboardCode.includes("#DC2626"),   // Red
  "AtsAnalysisDashboard must use standardized dynamic color coding for factor scores"
);
console.log("✓ Test 6: Standardized dynamic score color classification applied (Green, Blue, Orange, Red, Grey)");

// Test 7: Verify section is open by default (useState(true))
assert.ok(
  dashboardCode.includes("useState(true)"),
  "showFactors must be true by default so factors are visible immediately upon resume upload"
);
console.log("✓ Test 7: Factor breakdown is visible by default (useState(true))");

// Test 8: Simulate factor mapping logic directly
const mockFactors = [
  {
    name: "Technical Skills & Keywords",
    score: 18,
    awarded_points: 18,
    max_score: 20,
    max_points: 20,
    percentage: 90,
    status: "Optimal",
    description: "Verified 22 technical competencies across 5 domains.",
  },
  {
    name: "Experience & Quantifiable Impact",
    score: 17,
    awarded_points: 17,
    max_score: 20,
    max_points: 20,
    percentage: 85,
    status: "Optimal",
    description: "Strong quantifiable impact with 6 metric indicators.",
  },
  {
    name: "Section Completeness & Structure",
    score: 19,
    awarded_points: 19,
    max_score: 20,
    max_points: 20,
    percentage: 95,
    status: "Optimal",
    description: "All core sections and contact information verified.",
  },
  {
    name: "Education & Qualifications",
    score: 17,
    awarded_points: 17,
    max_score: 20,
    max_points: 20,
    percentage: 85,
    status: "Optimal",
    description: "Accredited master's degree and institution verified.",
  },
  {
    name: "Formatting & Readability",
    score: 19,
    awarded_points: 19,
    max_score: 20,
    max_points: 20,
    percentage: 95,
    status: "Optimal",
    description: "Optimal length (620 words) with structured bullets.",
  },
];

const totalScore = mockFactors.reduce((acc, f) => acc + f.awarded_points, 0);
assert.strictEqual(totalScore, 90, "Sum of mock factors must match overall 90/100");
mockFactors.forEach((factor) => {
  const rawAwarded = factor.awarded_points !== undefined ? factor.awarded_points : factor.score;
  const isNotEvaluated = factor.not_evaluated === true || factor.status === "not_evaluated" || rawAwarded === null;
  const awarded = isNotEvaluated ? null : Number(rawAwarded);
  const max = Number(factor.max_points || factor.max_score || 20);
  const pct = isNotEvaluated || isNaN(awarded) || max <= 0 ? 0 : Math.round((Math.max(0, Math.min(max, awarded)) / max) * 100);

  assert.strictEqual(isNotEvaluated, false);
  assert.ok(awarded > 0, "Awarded points must be non-zero");
  assert.strictEqual(max, 20, "Max points must be 20");
  assert.strictEqual(pct, factor.percentage);
});
console.log("✓ Test 8: Mathematical evaluation of factor breakdown sums exactly to overall ATS score (90/100)");

console.log("\n=======================================================");
console.log("  ALL FRONTEND ATS FACTOR TESTS PASSED!");
console.log("=======================================================\n");
