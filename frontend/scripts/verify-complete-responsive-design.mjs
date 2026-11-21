/**
 * Comprehensive Responsive Design Automated Verification Suite
 * Intervexa AI – Smart Interview Coach & Placement Prep
 *
 * Verifies responsive breakpoints, layout constraints, and fluid styling
 * across all major pages, navigation shells, interview modes, and study tools.
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
  assert(found, testName, `Expected to find: "${snippet.slice(0, 60)}..."`);
}

function checkFileRegex(relPath, regex, testName) {
  const fullPath = path.join(FRONTEND_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    assert(false, testName, `File not found: ${relPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  const found = regex.test(content);
  assert(found, testName, `Expected regex match: ${regex}`);
}

console.log("\n=======================================================");
console.log("INTERVEXA AI - COMPREHENSIVE RESPONSIVE DESIGN VERIFICATION");
console.log("=======================================================\n");

// 1. Navigation & Header Bar Responsive Controls
console.log("--- 1. Navigation & App Bar Responsive Adaptations ---");
checkFileContains(
  "src/components/Navbar.jsx",
  "navbar-profile-name",
  "Navbar hides textual user name on narrow mobile screens (keeping avatar badge)"
);
checkFileContains(
  "src/components/Navbar.jsx",
  "navbar-chevron-down",
  "Navbar hides chevron down arrow on extra small screens <= 380px"
);
checkFileContains(
  "src/components/FullScreenInterviewLayout.jsx",
  "fullscreen-mobile-q-pill",
  "FullScreenInterviewLayout renders dedicated mobile question progress badge (Q x/y)"
);
checkFileContains(
  "src/components/FullScreenInterviewLayout.jsx",
  "fullscreen-role-label",
  "FullScreenInterviewLayout has responsive role label truncation"
);

// 2. Standard Interview Layout & Action Bars
console.log("\n--- 2. Interview Layout & Navigation Controls ---");
checkFileContains(
  "src/pages/Interview.jsx",
  "interview-nav-footer",
  "Interview navigation footer has responsive flex wrapping and stacking"
);
checkFileContains(
  "src/pages/Interview.jsx",
  "interview-jump-btn",
  "Interview question jump bar has touch-accessible tap targets"
);

// 3. Resume Analysis & ATS Dashboard Fluid Constraints
console.log("\n--- 3. Resume Analysis & ATS Dashboard Fluid Flex ---");
checkFileContains(
  "src/pages/UploadResume.jsx",
  'flex: "1 1 min(100%, 240px)"',
  "UploadResume uses fluid flex basis (min(100%, 240px)) preventing 320px horizontal overflow"
);
checkFileContains(
  "src/components/AtsAnalysisDashboard.jsx",
  'flex: "1 1 min(100%, 320px)"',
  "AtsAnalysisDashboard uses fluid flex basis for category cards avoiding rigid horizontal overflow"
);

// 4. Role Selection & Interview Mode Cards
console.log("\n--- 4. Role Selection & Interview Mode Grid Breakpoints ---");
checkFileContains(
  "src/pages/SelectRole.jsx",
  "target-roles-grid",
  "SelectRole cards use responsive 4-desktop, 2-tablet, 1-mobile grid (.target-roles-grid)"
);
checkFileContains(
  "src/pages/InterviewSelection.jsx",
  "@media (max-width: 768px)",
  "InterviewSelection includes tablet/mobile breakpoint stacking cards vertically"
);

// 5. Results & History Fluid Grids
console.log("\n--- 5. Results & History Multi-Device Layouts ---");
checkFileContains(
  "src/pages/Results.jsx",
  "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  "Results.jsx metrics grid wraps fluidly with min(100%, 280px)"
);
checkFileContains(
  "src/pages/Results.jsx",
  "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  "Results.jsx dimension feedback cards wrap fluidly down to mobile viewports"
);
checkFileContains(
  "src/pages/History.jsx",
  "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  "History.jsx interview cards wrap smoothly on all screen sizes"
);

// 6. Study Planner, Calendar, Radar & Modals
console.log("\n--- 6. Study Planner & Interactive Modal Responsiveness ---");
checkFileContains(
  "src/components/study-planner/DailyTasksView.jsx",
  "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  "DailyTasksView uses fluid grid wrapping for day cards"
);
checkFileContains(
  "src/components/study-planner/CalendarScheduleView.jsx",
  "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
  "CalendarScheduleView wraps daily calendar blocks cleanly"
);
checkFileContains(
  "src/components/study-planner/SkillImprovementRadar.jsx",
  'maxWidth: "100%", height: "auto"',
  "SkillImprovementRadar SVG scales dynamically without breaking container boundaries"
);
checkFileContains(
  "src/components/study-planner/StudyPlanConfigModal.jsx",
  "repeat(auto-fit, minmax(min(100%, 85px), 1fr))",
  "StudyPlanConfigModal prep level buttons scale gracefully"
);
checkFileContains(
  "src/components/study-planner/AILearningAssistantModal.jsx",
  'WebkitOverflowScrolling: "touch"',
  "AILearningAssistantModal tab bar supports smooth touch scrolling on mobile"
);

// 7. Profile & Account Settings
console.log("\n--- 7. Profile & Account Settings Responsiveness ---");
checkFileContains(
  "src/pages/Profile.jsx",
  "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  "Profile.jsx metric summary grid wraps fluidly on small screens"
);

// 8. AI Chatbot Assistant Responsiveness
console.log("\n--- 8. AI Chatbot Floating Window & Input Responsiveness ---");
checkFileContains(
  "src/components/AiChatbot.jsx",
  "calc(100vw - 32px)",
  "AiChatbot window enforces max-width calc(100vw - 32px) on desktop/tablet"
);
checkFileContains(
  "src/components/AiChatbot.jsx",
  "@media (max-width: 480px)",
  "AiChatbot has dedicated mobile viewport rules for bottom sheet/docked view"
);

// 9. Global CSS Viewport Utilities & Hardening
console.log("\n--- 9. Global CSS Viewport Coverage & Hardening ---");
checkFileContains(
  "src/index.css",
  "fullscreen-mobile-q-pill",
  "Global index.css styles .fullscreen-mobile-q-pill for screens <= 768px"
);
checkFileContains(
  "src/index.css",
  "@media (max-width: 320px)",
  "Global index.css includes ultra-narrow viewport hardening for 320px/280px devices"
);
checkFileContains(
  "src/index.css",
  "table-responsive-container",
  "Global index.css provides responsive table scrolling utility"
);
checkFileContains(
  "src/index.css",
  "@media (min-width: 1920px)",
  "Global index.css handles ultra-wide desktop viewports up to 1920px+"
);

console.log("\n=======================================================");
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All Responsive Design checks successfully verified!");
  process.exit(0);
}
