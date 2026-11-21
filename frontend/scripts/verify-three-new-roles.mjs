/**
 * Frontend Verification Script for 3 New Target Roles
 * Intervexa AI - SelectRole.jsx & End-to-End Role Selection Flow
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
console.log("INTERVEXA AI - 3 NEW TARGET ROLES FRONTEND VERIFICATION");
console.log("=======================================================\n");

const selectRolePath = path.join(FRONTEND_DIR, "src/pages/SelectRole.jsx");
const content = fs.readFileSync(selectRolePath, "utf-8");

// 1. Role Count: Exactly 12 Roles
console.log("--- 1. Role Count & Preservation ---");
const roleMatches = content.match(/title:\s*"([^"]+)"/g) || [];
const roleTitles = roleMatches.map((m) => m.match(/title:\s*"([^"]+)"/)[1]);
assert(
  roleTitles.length === 12,
  `SelectRole.jsx defines exactly 12 roles (found ${roleTitles.length})`,
  `Roles: ${roleTitles.join(", ")}`
);

const expectedRoles = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Java Developer",
  "Software Developer",
  "Python Developer",
  "Software Test Engineer",
  "Machine Learning Engineer",
  "AI/ML Engineer",
  "Data Analyst",
  "Data Scientist",
  "Cloud Engineer",
];

for (const roleName of expectedRoles) {
  assert(
    roleTitles.includes(roleName),
    `Role '${roleName}' is present in SelectRole.jsx`
  );
}

// 2. New Role 1: Frontend Developer
console.log("\n--- 2. Frontend Developer Specifications ---");
checkFileContains(
  "src/pages/SelectRole.jsx",
  'title: "Frontend Developer"',
  "Frontend Developer title exists"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  'badge: "Web Development"',
  "Frontend Developer category/badge is 'Web Development'"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  "HTML, CSS, JavaScript, React, responsive design, UI development, and frontend performance.",
  "Frontend Developer description matches specification"
);
const frontendSkills = [
  "HTML",
  "CSS",
  "JavaScript",
  "React",
  "Responsive Design",
  "REST API Integration",
  "UI Development",
];
for (const skill of frontendSkills) {
  checkFileContains(
    "src/pages/SelectRole.jsx",
    `"${skill}"`,
    `Frontend Developer skill '${skill}' is present`
  );
}

// 3. New Role 2: Backend Developer
console.log("\n--- 3. Backend Developer Specifications ---");
checkFileContains(
  "src/pages/SelectRole.jsx",
  'title: "Backend Developer"',
  "Backend Developer title exists"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  'badge: "Backend Development"',
  "Backend Developer category/badge is 'Backend Development'"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  "Python, Java, REST APIs, database management, authentication, server-side development, and backend architecture.",
  "Backend Developer description matches specification"
);
const backendSkills = [
  "Python",
  "Java",
  "REST APIs",
  "SQL",
  "Database Design",
  "Authentication",
  "Backend Architecture",
];
for (const skill of backendSkills) {
  checkFileContains(
    "src/pages/SelectRole.jsx",
    `"${skill}"`,
    `Backend Developer skill '${skill}' is present`
  );
}

// 4. New Role 3: Java Developer
console.log("\n--- 4. Java Developer Specifications ---");
checkFileContains(
  "src/pages/SelectRole.jsx",
  'title: "Java Developer"',
  "Java Developer title exists"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  'badge: "Software Development"',
  "Java Developer category/badge is 'Software Development'"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  "Core Java, object-oriented programming, collections, exception handling, Spring Boot, and database integration.",
  "Java Developer description matches specification"
);
const javaSkills = [
  "Core Java",
  "OOP",
  "Collections",
  "Exception Handling",
  "Spring Boot",
  "JDBC",
  "SQL",
];
for (const skill of javaSkills) {
  checkFileContains(
    "src/pages/SelectRole.jsx",
    `"${skill}"`,
    `Java Developer skill '${skill}' is present`
  );
}

// 5. Responsive Grid & Card Styling
console.log("\n--- 5. Responsive Grid (4 Desktop, 2 Tablet, 1 Mobile) ---");
checkFileContains(
  "src/pages/SelectRole.jsx",
  "grid-template-columns: repeat(4, minmax(0, 1fr))",
  "Desktop layout uses 4 columns"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  "grid-template-columns: repeat(2, minmax(0, 1fr))",
  "Tablet layout uses 2 columns (max-width: 1024px)"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  "grid-template-columns: 1fr",
  "Mobile layout uses 1 column (max-width: 640px)"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  "align-items: stretch",
  "Target roles grid enforces align-items: stretch for uniform card heights"
);

// 6. Dynamic Skills Synchronization
console.log("\n--- 6. Dynamic Skills Synchronization ---");
checkFileContains(
  "src/pages/SelectRole.jsx",
  "displayedSkills",
  "Skills to be Tested computes dynamic displayedSkills based on selected role"
);
checkFileContains(
  "src/pages/SelectRole.jsx",
  "localStorage.setItem(\"skills\", JSON.stringify(",
  "Selecting a role updates localStorage skills with selected role skills"
);

console.log("\n=======================================================");
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All Frontend Target Roles checks passed successfully!");
  process.exit(0);
}
