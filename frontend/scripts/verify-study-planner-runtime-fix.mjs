import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

console.log("\n=======================================================");
console.log("  INTERVEXA AI — STUDY PLANNER RUNTIME ERROR FIX VERIFICATION");
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
// 1. Verify DailyTasksView IconZap Import & Usage
// ---------------------------------------------------------------------------
console.log("--- Phase 1: DailyTasksView.jsx Icon Imports ---");
const dailyTasksPath = resolve("Smart-Interview-Coach/frontend/src/components/study-planner/DailyTasksView.jsx");
assert(existsSync(dailyTasksPath), "DailyTasksView.jsx exists");

const dailyTasksCode = readFileSync(dailyTasksPath, "utf-8");

// Check import
const importMatch = dailyTasksCode.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\.\/Icons["']/);
assert(importMatch !== null, "Icons import block exists in DailyTasksView.jsx");

const importedNames = importMatch ? importMatch[1].split(",").map((s) => s.trim()) : [];
assert(importedNames.includes("IconZap"), "IconZap is explicitly imported in DailyTasksView.jsx");
assert(importedNames.includes("IconCheckCircle"), "IconCheckCircle is imported in DailyTasksView.jsx");
assert(importedNames.includes("IconClock"), "IconClock is imported in DailyTasksView.jsx");
assert(importedNames.includes("IconSparkles"), "IconSparkles is imported in DailyTasksView.jsx");
assert(importedNames.includes("IconTarget"), "IconTarget is imported in DailyTasksView.jsx");
assert(importedNames.includes("IconCode"), "IconCode is imported in DailyTasksView.jsx");
assert(importedNames.includes("IconExternalLink"), "IconExternalLink is imported in DailyTasksView.jsx");
assert(importedNames.includes("IconChevronDown"), "IconChevronDown is imported in DailyTasksView.jsx");
assert(importedNames.includes("IconRotateCcw"), "IconRotateCcw is imported in DailyTasksView.jsx");

// Verify usage
assert(dailyTasksCode.includes("<IconZap size={14} />") || dailyTasksCode.includes("<IconZap"), "IconZap component is rendered on Daily Quiz button");

// ---------------------------------------------------------------------------
// 2. Safe Array Handling & Defensive Task Mapping
// ---------------------------------------------------------------------------
console.log("\n--- Phase 2: Array.map & Null-safe Tasks Handling ---");
assert(dailyTasksCode.includes("const safeTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : []"), "DailyTasksView defines safeTasks fallback array");
assert(dailyTasksCode.includes("if (!task) return null"), "filteredTasks.map contains defensive null/undefined task guard");
assert(dailyTasksCode.includes("filteredTasks.map"), "filteredTasks.map safely renders task items");

// ---------------------------------------------------------------------------
// 3. Complete Study Planner Icon Import Audit
// ---------------------------------------------------------------------------
console.log("\n--- Phase 3: Comprehensive Study Planner Component Audit ---");
const plannerFiles = [
  "Smart-Interview-Coach/frontend/src/pages/Learning.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/DailyTasksView.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/DailyQuizSection.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/StudyPlanOverview.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/CalendarScheduleView.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/SkillImprovementRadar.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/AILearningAssistantModal.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/StudyPlanConfigModal.jsx",
];

const iconsContent = readFileSync(resolve("Smart-Interview-Coach/frontend/src/components/Icons.jsx"), "utf-8");
const exportedIcons = new Set([...iconsContent.matchAll(/export function (Icon\w+)/g)].map((m) => m[1]));

for (const filePath of plannerFiles) {
  const content = readFileSync(resolve(filePath), "utf-8");
  const compImports = [...content.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'][^"']*Icons["']/g)];
  const compImported = new Set();
  for (const m of compImports) {
    m[1].split(",").forEach((item) => {
      const name = item.trim();
      if (name.startsWith("Icon")) compImported.add(name);
    });
  }

  const usedIcons = new Set([...content.matchAll(/<(Icon\w+)/g)].map((m) => m[1]));
  const missing = [...usedIcons].filter((i) => !compImported.has(i));
  const unexported = [...usedIcons].filter((i) => !exportedIcons.has(i));

  assert(missing.length === 0, `${resolve(filePath).split(/[\\/]/).pop()}: Zero missing icon imports`);
  assert(unexported.length === 0, `${resolve(filePath).split(/[\\/]/).pop()}: All used icons are exported by Icons.jsx`);
}

console.log("\n=======================================================");
console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
