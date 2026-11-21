import { readFileSync } from "fs";
import { resolve } from "path";

console.log("\n========================================================");
console.log("  INTERVEXA AI - DASHBOARD CARD LAYOUT VERIFICATION");
console.log("========================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

const dashPath = resolve("Smart-Interview-Coach/frontend/src/pages/Dashboard.jsx");
const dashCode = readFileSync(dashPath, "utf-8");

const cssPath = resolve("Smart-Interview-Coach/frontend/src/index.css");
const cssCode = readFileSync(cssPath, "utf-8");

// Landmarks
const posTrend = dashCode.indexOf('title="Interview Performance Trend"');
const posResume = dashCode.indexOf('title="Resume & Job Readiness"');
const posNext = dashCode.indexOf('title="Recommended Next Step"');
const posSkill = dashCode.indexOf('title="Your Skill Performance"');
const posRecent = dashCode.indexOf('title="Recent Interviews"');
const posPlan = dashCode.indexOf('title="Learning Progress"');
const posQuick = dashCode.indexOf('dashboard-quick-actions-bar');

assert(posTrend !== -1, "Interview Performance Trend card is present");
assert(posResume !== -1, "Resume & Job Readiness card is present");
assert(posNext !== -1, "Recommended Next Step card is present");
assert(posSkill !== -1, "Your Skill Performance card is present");
assert(posRecent !== -1, "Recent Interviews card is present");
assert(posPlan !== -1, "Learning Progress card is present");
assert(posQuick !== -1, "Quick Actions bottom bar is present");

// Ordering assertions
// Row 1: Trend & Resume side by side
assert(posTrend < posResume, "Row 1: Interview Performance Trend is on the left of Resume & Job Readiness");

// Row 2: Next step below Row 1
assert(posResume < posNext, "Row 2: Recommended Next Step appears below Resume & Job Readiness");

// Row 3: Skill performance below Row 2
assert(posNext < posSkill, "Row 3: Your Skill Performance appears below Recommended Next Step");

// Row 4: Recent Interviews & Learning progress below Row 3
assert(posSkill < posRecent, "Row 4: Recent Interviews appears below Your Skill Performance");
assert(posRecent < posPlan, "Row 4: Recent Interviews is on the left of Learning Progress");

// Bottom: Quick actions bar below Row 4
assert(posPlan < posQuick, "Quick Actions appears at the bottom");

// Check side-by-side grid container for Row 1
const row1Snippet = dashCode.substring(posTrend - 400, posResume + 200);
assert(row1Snippet.includes("dashboard-two-col-grid"), "Row 1 uses dashboard-two-col-grid for balanced side-by-side placement");

// Check Row 2 Next Step prominent layout
const nextStepSnippet = dashCode.substring(posNext - 200, posSkill);
assert(nextStepSnippet.includes("Why This Matters"), "Recommended Next Step includes 'Why This Matters' explanation");
assert(nextStepSnippet.includes("IconArrowRight"), "Recommended Next Step includes prominent action button with icon");

// Check Row 3 Skill Performance responsive subgrid
const skillSnippet = dashCode.substring(posSkill, posRecent);
assert(skillSnippet.includes("repeat(auto-fit, minmax(min(100%, 280px), 1fr))"), "Skill Performance items use responsive multi-column auto-fit subgrid");

// Check CSS grid rules in index.css
assert(cssCode.includes(".dashboard-two-col-grid {"), ".dashboard-two-col-grid defined in index.css");
assert(cssCode.includes("repeat(2, minmax(0, 1fr))"), "Two-column grid defines equal 50/50 balanced columns on desktop");
assert(cssCode.includes("align-items: stretch"), "Two-column grid enforces align-items: stretch for consistent heights");
assert(cssCode.includes("@media (max-width: 960px)"), "Responsive breakpoint collapses two-column grid on tablet and mobile");

console.log("\n========================================================");
console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("========================================================\n");

if (failed > 0) {
  process.exit(1);
}
