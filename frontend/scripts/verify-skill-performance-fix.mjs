import { readFileSync } from "fs";
import { resolve } from "path";

console.log("\n========================================================");
console.log("  INTERVEXA AI – SKILL PERFORMANCE FIX VERIFICATION");
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

// 1. Verify Backend Skill Performance Service
const servicePath = resolve("Smart-Interview-Coach/backend/services/skill_performance_service.py");
const serviceCode = readFileSync(servicePath, "utf-8");

assert(serviceCode.includes("ROLE_SKILLS: Dict[str, List[str]]"), "ROLE_SKILLS catalog defined in skill_performance_service.py");
assert(serviceCode.includes("SKILL_PATTERNS: Dict[str, List[str]]"), "SKILL_PATTERNS comprehensive regex map defined");
assert(serviceCode.includes("SKILL_DESCRIPTIONS: Dict[str, Dict[str, str]]"), "Curated SKILL_DESCRIPTIONS defined");
assert(serviceCode.includes("def map_question_to_skills"), "map_question_to_skills function implemented");
assert(serviceCode.includes("def calculate_user_skill_performance"), "calculate_user_skill_performance function implemented");
assert(serviceCode.includes("not_evaluated"), "Supports 'not_evaluated' state");
assert(serviceCode.includes("insufficient_data"), "Supports 'insufficient_data' state");
assert(serviceCode.includes("needs_improvement"), "Supports 'needs_improvement' state");
assert(serviceCode.includes("strong"), "Supports 'strong' state");
assert(serviceCode.includes("total_tech / (count * 10.0)"), "Uses exact transparent skill percentage formula");
assert(serviceCode.includes("Not evaluated yet"), "Displays 'Not evaluated yet' instead of 0% for unrated skills");

// 2. Verify Backend app.py Integration
const appPath = resolve("Smart-Interview-Coach/backend/app.py");
const appCode = readFileSync(appPath, "utf-8");

assert(appCode.includes("from services.skill_performance_service import calculate_user_skill_performance"), "app.py imports calculate_user_skill_performance");
assert(appCode.includes("from services.skill_performance_service import map_question_to_skills"), "app.py imports map_question_to_skills in /evaluate_answers");
assert(appCode.includes('"assesses_skill": q_skill'), "/evaluate_answers persists assesses_skill into interview results");
assert(appCode.includes('"skill_performance": skill_perf'), "/dashboard returns skill_performance payload");
assert(appCode.includes('"target_role": skill_perf.get("target_role"'), "/dashboard returns target_role aligned with active role");

// 3. Verify Frontend Dashboard.jsx Implementation
const dashPath = resolve("Smart-Interview-Coach/frontend/src/pages/Dashboard.jsx");
const dashCode = readFileSync(dashPath, "utf-8");

assert(dashCode.includes("skill_performance: null"), "Dashboard initialStats has skill_performance state");
assert(dashCode.includes("localStorage.getItem(\"role\")"), "Dashboard reads active role from localStorage for targeted skills");
assert(dashCode.includes("skillAnalysis = useMemo"), "skillAnalysis useMemo hook implemented");
assert(dashCode.includes("allSkills.filter((s) => s.isStrong"), "skillAnalysis separates strong skills (>= 70%)");
assert(dashCode.includes("allSkills.filter((s) => s.needsImprovement"), "skillAnalysis separates weak skills (< 70%)");
assert(dashCode.includes("allSkills.filter((s) => s.insufficientData"), "skillAnalysis identifies insufficient data skills (1 question)");
assert(dashCode.includes("allSkills.filter((s) => !s.isEvaluated"), "skillAnalysis identifies notEvaluated skills (0 questions)");
assert(dashCode.includes("Your Skill Performance"), "Your Skill Performance card title present");
assert(dashCode.includes("Strongest Areas"), "Strongest Areas section rendered");
assert(dashCode.includes("Needs Focus & Practice"), "Needs Focus & Practice section rendered");
assert(dashCode.includes("Emerging Competencies"), "Emerging Competencies (Limited Data) section rendered");
assert(dashCode.includes("Not Evaluated Yet"), "Not Evaluated Yet section rendered");
assert(dashCode.includes("Not evaluated yet"), "Renders 'Not evaluated yet' badge instead of 0%");
assert(dashCode.includes("dashboard-skill-item"), "Uses standardized dashboard-skill-item CSS class");

// 4. Verify CSS Definitions in index.css
const cssPath = resolve("Smart-Interview-Coach/frontend/src/index.css");
const cssCode = readFileSync(cssPath, "utf-8");

assert(cssCode.includes(".dashboard-skill-item {"), ".dashboard-skill-item rule present in index.css");
assert(cssCode.includes("var(--primary)"), "Card design uses centralized brand var(--primary)");

console.log("\n========================================================");
console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("========================================================\n");

if (failed > 0) {
  process.exit(1);
}
