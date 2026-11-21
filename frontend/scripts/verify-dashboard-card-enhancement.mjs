/**
 * Dashboard Card UI/UX Enhancement Automated Verification Suite
 * Intervexa AI - Smart SaaS Dashboard Visual Quality & Architecture Checks
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

function checkFileContains(relPath, snippet, testName) {
  const fullPath = path.join(FRONTEND_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    assert(false, testName, `File not found: ${relPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  const found = content.includes(snippet);
  assert(found, testName, `Expected snippet: "${snippet.slice(0, 50)}..."`);
}

console.log("\n=======================================================");
console.log("INTERVEXA AI - DASHBOARD CARD UI/UX ENHANCEMENT CHECKS");
console.log("=======================================================\n");

// 1. Welcome Card Design & Accent
console.log("--- 1. Welcome Header Card ---");
checkFileContains(
  "src/pages/Dashboard.jsx",
  'className="dashboard-welcome-card"',
  "Dashboard welcome header uses dedicated .dashboard-welcome-card container"
);
checkFileContains(
  "src/index.css",
  ".dashboard-welcome-card::before",
  "Dashboard welcome card features a subtle brand purple top accent stripe"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "Start New Interview",
  "Welcome card includes clear 'Start New Interview' primary button"
);

// 2. Metric Cards Uniformity & Icons
console.log("\n--- 2. Four Key Performance Metric Cards ---");
checkFileContains(
  "src/index.css",
  ".dashboard-stat-icon-wrap",
  "Metric cards feature standardized .dashboard-stat-icon-wrap styling"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "dashboard-stat-icon-wrap",
  "All 4 metric cards utilize consistent purple icon containers"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "Total Completed",
  "Total Completed metric card exists with prominent value and subtext"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "Average Score",
  "Average Score metric card exists with score percentage and trajectory"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "Best Score",
  "Best Score metric card exists with personal peak calculation"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "Overall Readiness",
  "Overall Readiness metric card exists with technical/communication weighting"
);

// 3. Row 3: Performance Trend & Recommended Next Step
console.log("\n--- 3. Performance Trend & Recommended Next Step (Row 3) ---");
checkFileContains(
  "src/pages/Dashboard.jsx",
  'title="Interview Performance Trend"',
  "Interview Performance Trend card has clear heading, icon, and trajectory badge"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "topAccent={true}",
  "Cards feature Standard-Interview style top accent stripe"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "<LineChart",
  "Performance Trend renders Recharts LineChart with purple brand stroke"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  'title="Recommended Next Step"',
  "Recommended Next Step card uses topAccent and actionable recommendation area"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "Why This Matters",
  "Next Step includes structured focus area explanation"
);

// 4. Row 4: Skill Performance & Resume / Job Readiness
console.log("\n--- 4. Skill Performance & Resume Readiness (Row 4) ---");
checkFileContains(
  "src/pages/Dashboard.jsx",
  'title="Your Skill Performance"',
  "Your Skill Performance card separates strong skills and practice areas"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "dashboard-skill-item",
  "Skill items utilize .dashboard-skill-item layout with progress indicators"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  'title="Resume & Job Readiness"',
  "Resume & Job Readiness card presents ATS score and role matching"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "dashboard-mini-metric",
  "Resume card uses 3 standardized .dashboard-mini-metric cells"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "Missing Skills to Add",
  "Resume card displays missing skill tags cleanly"
);

// 5. Row 5: Recent Interviews & Learning Progress
console.log("\n--- 5. Recent Interviews & Learning Progress (Row 5) ---");
checkFileContains(
  "src/pages/Dashboard.jsx",
  'title="Recent Interviews"',
  "Recent Interviews card renders completed session history with score pills"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "dashboard-list-item",
  "Recent interviews utilize .dashboard-list-item with hover elevation"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  'title="Learning Progress"',
  "Learning Progress card renders active study roadmap or creation prompt"
);

// 6. Row 6: Quick Actions Bar
console.log("\n--- 6. Quick Actions Bottom Bar ---");
checkFileContains(
  "src/pages/Dashboard.jsx",
  "dashboard-quick-actions-bar",
  "Quick Actions 5-action bottom bar rendered with responsive wrapping"
);
checkFileContains(
  "src/pages/Dashboard.jsx",
  "dashboard-quick-action-item",
  "Quick action items use .dashboard-quick-action-item styling"
);

// 7. Equal Height & Layout Consistency
console.log("\n--- 7. Layout Alignment & Equal Height Styling ---");
checkFileContains(
  "src/index.css",
  "align-items: stretch",
  "Dashboard grids enforce align-items: stretch for balanced card heights"
);
checkFileContains(
  "src/index.css",
  "min-height: 114px",
  "Metric cards enforce uniform minimum height on desktop"
);

console.log("\n=======================================================");
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All Dashboard Card UI/UX checks passed successfully!");
  process.exit(0);
}
