import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

console.log("\n=======================================================");
console.log("  INTERVEXA AI — ROOT .GITIGNORE VERIFICATION SUITE");
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

// 1. Confirm Location & Existence
const rootGitignorePath = resolve("Smart-Interview-Coach/.gitignore");
assert(existsSync(rootGitignorePath), ".gitignore is located in the main project root (Smart-Interview-Coach/.gitignore)");

const content = readFileSync(rootGitignorePath, "utf-8");
assert(content.length > 500, ".gitignore is populated with comprehensive rules");

// Helper to simulate gitignore pattern matching
// Gitignore specification:
// - lines starting with # are comments
// - lines starting with ! are negations (whitelist)
// - trailing / matches only directories
// - patterns without / match at any directory level
function parseGitignore(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const rules = [];
  for (const line of lines) {
    const isNegation = line.startsWith("!");
    const rawPattern = isNegation ? line.slice(1) : line;
    const isDirOnly = rawPattern.endsWith("/");
    const cleanPattern = isDirOnly ? rawPattern.slice(0, -1) : rawPattern;
    rules.push({ isNegation, isDirOnly, pattern: cleanPattern, raw: line });
  }
  return rules;
}

const rules = parseGitignore(content);

function matchesPattern(pathStr, isDir, pattern, isDirOnly) {
  if (isDirOnly && !isDir) return false;

  const normalized = pathStr.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const filename = parts[parts.length - 1];

  // Regex support for patterns with character classes or wildcards like *.py[cod]
  if (pattern.includes("[") && pattern.includes("]")) {
    const rxStr = "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
    const rx = new RegExp(rxStr);
    if (rx.test(filename)) return true;
  }

  // If pattern is wildcard like *.db or *.log
  if (pattern.startsWith("*.") && !pattern.includes("/")) {
    const ext = pattern.slice(1); // e.g. .db
    return filename.endsWith(ext);
  }

  // Exact name matches anywhere if no slash in pattern
  if (!pattern.includes("/")) {
    if (filename === pattern) return true;
    if (parts.includes(pattern)) return true;
    // Prefix wildcard like npm-debug.log*
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (filename.startsWith(prefix)) return true;
    }
  }

  // Subpath matching like **/uploads/* or .vscode/*
  if (pattern.startsWith("**/")) {
    const sub = pattern.slice(3);
    if (sub.endsWith("/*")) {
      const dirName = sub.slice(0, -2);
      const idx = parts.indexOf(dirName);
      if (idx !== -1 && idx < parts.length - 1) return true;
    }
  }

  if (pattern.endsWith("/*")) {
    const dirPrefix = pattern.slice(0, -2);
    if (normalized.startsWith(dirPrefix + "/")) return true;
  }

  // Path suffix or exact path match
  if (normalized === pattern || normalized.endsWith("/" + pattern) || normalized.includes("/" + pattern + "/")) {
    return true;
  }

  return false;
}

function isPathIgnored(testPath, isDir = false) {
  let ignored = false;
  for (const r of rules) {
    if (matchesPattern(testPath, isDir, r.pattern, r.isDirOnly)) {
      if (r.isNegation) {
        ignored = false;
      } else {
        ignored = true;
      }
    }
  }
  return ignored;
}

// ---------------------------------------------------------------------------
// 2. Sensitive & Secret Files (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("--- Category 1: Environment Variables & Secrets ---");
assert(isPathIgnored("backend/.env", false), "backend/.env is ignored");
assert(isPathIgnored("frontend/.env", false), "frontend/.env is ignored");
assert(isPathIgnored(".env.local", false), ".env.local is ignored");
assert(isPathIgnored(".env.production", false), ".env.production is ignored");

// .env.example MUST BE WHITELISTED / TRACKED
assert(!isPathIgnored(".env.example", false), ".env.example is whitelisted and eligible for git tracking");
assert(!isPathIgnored("backend/.env.example", false), "backend/.env.example is whitelisted and eligible for tracking");
assert(!isPathIgnored("frontend/.env.example", false), "frontend/.env.example is whitelisted and eligible for tracking");

// ---------------------------------------------------------------------------
// 3. Dependencies & Virtual Environments (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("\n--- Category 2: Dependencies & Virtual Environments ---");
assert(isPathIgnored("node_modules", true), "root node_modules/ is ignored");
assert(isPathIgnored("frontend/node_modules", true), "frontend/node_modules/ is ignored");
assert(isPathIgnored("backend/node_modules", true), "backend/node_modules/ is ignored");
assert(isPathIgnored("venv", true), "venv/ is ignored");
assert(isPathIgnored("backend/venv", true), "backend/venv/ is ignored");
assert(isPathIgnored(".venv", true), ".venv/ is ignored");

// ---------------------------------------------------------------------------
// 4. Python Caches & Bytecode (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("\n--- Category 3: Python Bytecode & Caches ---");
assert(isPathIgnored("__pycache__", true), "__pycache__/ is ignored");
assert(isPathIgnored("backend/__pycache__", true), "backend/__pycache__/ is ignored");
assert(isPathIgnored("backend/app.pyc", false), "*.pyc bytecode is ignored");

// ---------------------------------------------------------------------------
// 5. Frontend Build Outputs (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("\n--- Category 4: Build Outputs ---");
assert(isPathIgnored("frontend/dist", true), "frontend/dist/ is ignored");
assert(isPathIgnored("frontend/dist-test", true), "frontend/dist-test/ is ignored");
assert(isPathIgnored("dist", true), "dist/ is ignored");
assert(isPathIgnored("build", true), "build/ is ignored");

// ---------------------------------------------------------------------------
// 6. Test & Coverage Outputs (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("\n--- Category 5: Test & Coverage Outputs ---");
assert(isPathIgnored(".pytest_cache", true), ".pytest_cache/ is ignored");
assert(isPathIgnored("backend/.pytest_cache", true), "backend/.pytest_cache/ is ignored");
assert(isPathIgnored("coverage", true), "coverage/ is ignored");
assert(isPathIgnored("e2e_test_results.json", false), "e2e_test_results.json is ignored");

// ---------------------------------------------------------------------------
// 7. Local Databases (Must be Ignored - PII & Non-seed)
// ---------------------------------------------------------------------------
console.log("\n--- Category 6: Local Databases (Contains Candidate PII) ---");
assert(isPathIgnored("backend/interview_history.db", false), "backend/interview_history.db is ignored");
assert(isPathIgnored("backend/intervexa.db", false), "backend/intervexa.db is ignored");
assert(isPathIgnored("test.sqlite", false), "*.sqlite is ignored");
assert(isPathIgnored("test.sqlite3", false), "*.sqlite3 is ignored");

// ---------------------------------------------------------------------------
// 8. User Uploads & Generated Documents (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("\n--- Category 7: User Uploads & Generated Reports ---");
assert(isPathIgnored("backend/uploads/user_resume.pdf", false), "backend/uploads/*.pdf user uploads are ignored");
assert(isPathIgnored("backend/Interview_Report.pdf", false), "Generated Interview_Report.pdf is ignored");
assert(isPathIgnored("backend/download_report", false), "Temporary download_report is ignored");

// ---------------------------------------------------------------------------
// 9. Error Dumps & Logs (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("\n--- Category 8: Logs & Error Dumps ---");
assert(isPathIgnored("backend/groq_error.txt", false), "backend/groq_error.txt is ignored");
assert(isPathIgnored("backend/ats_error.txt", false), "backend/ats_error.txt is ignored");
assert(isPathIgnored("server.log", false), "*.log files are ignored");
assert(isPathIgnored("npm-debug.log", false), "npm-debug.log is ignored");

// ---------------------------------------------------------------------------
// 10. IDE & OS Artifacts (Must be Ignored)
// ---------------------------------------------------------------------------
console.log("\n--- Category 9: IDE & OS Files ---");
assert(isPathIgnored("desktop.ini", false), "desktop.ini is ignored");
assert(isPathIgnored(".DS_Store", false), ".DS_Store is ignored");
assert(isPathIgnored("Thumbs.db", false), "Thumbs.db is ignored");
assert(isPathIgnored(".idea", true), ".idea/ is ignored");

// ---------------------------------------------------------------------------
// 11. Core Source Files & Assets (MUST NEVER BE IGNORED)
// ---------------------------------------------------------------------------
console.log("\n--- Category 10: Essential Project Files (MUST REMAIN TRACKED) ---");
assert(!isPathIgnored("backend/package.json", false), "backend/package.json is tracked");
assert(!isPathIgnored("backend/package-lock.json", false), "backend/package-lock.json is tracked");
assert(!isPathIgnored("backend/requirements.txt", false), "backend/requirements.txt is tracked");
assert(!isPathIgnored("backend/app.py", false), "backend/app.py is tracked");
assert(!isPathIgnored("backend/database.py", false), "backend/database.py is tracked");
assert(!isPathIgnored("backend/data/questions.json", false), "backend/data/questions.json is tracked");
assert(!isPathIgnored("backend/services/skill_performance_service.py", false), "backend services are tracked");
assert(!isPathIgnored("frontend/package.json", false), "frontend/package.json is tracked");
assert(!isPathIgnored("frontend/package-lock.json", false), "frontend/package-lock.json is tracked");
assert(!isPathIgnored("frontend/vite.config.js", false), "frontend/vite.config.js is tracked");
assert(!isPathIgnored("frontend/eslint.config.js", false), "frontend/eslint.config.js is tracked");
assert(!isPathIgnored("frontend/index.html", false), "frontend/index.html is tracked");
assert(!isPathIgnored("frontend/src/App.jsx", false), "frontend/src/App.jsx is tracked");
assert(!isPathIgnored("frontend/src/pages/Dashboard.jsx", false), "frontend/src/pages/Dashboard.jsx is tracked");
assert(!isPathIgnored("README.md", false), "README.md is tracked");

console.log("\n=======================================================");
console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
