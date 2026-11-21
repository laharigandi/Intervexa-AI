import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

console.log("===============================================================");
console.log("  Intervexa AI - Multi-Column Professional Footer Test Suite   ");
console.log("===============================================================");

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    totalFailed++;
  }
}

// 1. Inspect Footer.jsx Structure
console.log("\n[TEST GROUP 1] Footer Design & Visual Styling (Footer.jsx)");
const footerPath = path.join(frontendDir, "src", "components", "Footer.jsx");
const footerCode = fs.readFileSync(footerPath, "utf-8");

assert(footerCode.includes("#091833"), "Dark navy background (#091833) configured");
assert(footerCode.includes("footer-columns-grid"), "Spacious multi-column CSS grid defined");
assert(footerCode.includes("rgba(255, 255, 255, 0.08)"), "Subtle horizontal divider present");

// 2. Inspect Column 1: Branding
console.log("\n[TEST GROUP 2] Column 1 – Intervexa AI Branding");
assert(footerCode.includes("IconBot"), "Branding includes Intervexa AI Bot Icon");
assert(footerCode.includes("Intervexa"), "Branding includes 'Intervexa' text");
assert(footerCode.includes("purple-gradient-text"), "Branding uses purple-gradient-text accent");
assert(
  footerCode.includes("Practice smarter. Prepare confidently. Ace your next interview with AI-powered interview coaching."),
  "Includes exact required short description text"
);
assert(footerCode.includes("IconGithub"), "Social links include GitHub");
assert(footerCode.includes("IconLinkedin"), "Social links include LinkedIn");
assert(footerCode.includes("IconTwitter"), "Social links include Twitter / X");
assert(footerCode.includes("IconMail"), "Social links include Email");
assert(footerCode.includes("rel=\"noopener noreferrer\""), "External social links have rel='noopener noreferrer'");

// 3. Inspect Column 2: PRODUCT
console.log("\n[TEST GROUP 3] Column 2 – PRODUCT Section");
const productItems = [
  "How It Works",
  "Resume Analysis",
  "Standard Interview",
  "Adaptive Interview",
  "AI Interview Assistant",
  "Interview Results",
  "Study Planner",
];
for (const item of productItems) {
  assert(footerCode.includes(item), `Product column includes '${item}'`);
}
assert(
  footerCode.includes("intervexa-open-chatbot"),
  "AI Interview Assistant dispatches custom event to trigger chatbot window"
);

// 4. Inspect Column 3: PRACTICE BY ROLE
console.log("\n[TEST GROUP 4] Column 3 – PRACTICE BY ROLE Section");
const roleItems = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Machine Learning Engineer",
  "Python Developer",
  "Java Developer",
  "Data Analyst",
  "Software Engineer",
];
for (const role of roleItems) {
  assert(footerCode.includes(role), `Practice by role includes '${role}'`);
}
assert(
  footerCode.includes("handleRoleSelect"),
  "Role clicks trigger handleRoleSelect to store role and navigate to /role"
);

// 5. Inspect Column 4: INTERVIEW PREPARATION
console.log("\n[TEST GROUP 5] Column 4 – INTERVIEW PREPARATION Section");
const prepItems = [
  "Technical Interview",
  "HR Interview",
  "Coding Practice",
  "Communication Skills",
  "AI Interview Evaluation",
  "Learning Resources",
];
for (const prep of prepItems) {
  assert(footerCode.includes(prep), `Interview preparation includes '${prep}'`);
}

// 6. Inspect Column 5: COMPANY
console.log("\n[TEST GROUP 6] Column 5 – COMPANY Section");
const companyItems = [
  "About Intervexa AI",
  "Contact",
  "Privacy Policy",
  "Terms of Service",
  "Sign In",
  "Get Started",
];
for (const comp of companyItems) {
  assert(footerCode.includes(comp), `Company section includes '${comp}'`);
}
assert(footerCode.includes("to=\"/login\""), "Sign In navigates to /login");
assert(footerCode.includes("to=\"/signup\""), "Get Started navigates to /signup");

// 7. Footer Bottom Section
console.log("\n[TEST GROUP 7] Footer Bottom Section (Copyright & Legal)");
assert(
  footerCode.includes("Intervexa AI. All rights reserved."),
  "Bottom row includes 'Intervexa AI. All rights reserved.'"
);
assert(
  footerCode.includes("footer-legal-links"),
  "Bottom row includes legal links container"
);

// 8. Inspect Legal Pages & Routes (Privacy.jsx, Terms.jsx, App.jsx)
console.log("\n[TEST GROUP 8] Legal Pages & Route Registrations");
const appPath = path.join(frontendDir, "src", "App.jsx");
const appCode = fs.readFileSync(appPath, "utf-8");

assert(fs.existsSync(path.join(frontendDir, "src", "pages", "Privacy.jsx")), "Privacy.jsx page created");
assert(fs.existsSync(path.join(frontendDir, "src", "pages", "Terms.jsx")), "Terms.jsx page created");
assert(appCode.includes("path=\"/privacy\""), "App.jsx registers public /privacy route");
assert(appCode.includes("path=\"/terms\""), "App.jsx registers public /terms route");

// 9. Inspect Layout Integration (Footer Only on Public Landing Page)
console.log("\n[TEST GROUP 9] Footer Exclusivity – Public Landing Page vs Authenticated Layout");
const homePath = path.join(frontendDir, "src", "pages", "Home.jsx");
const homeCode = fs.readFileSync(homePath, "utf-8");
const pageShellPath = path.join(frontendDir, "src", "components", "PageShell.jsx");
const pageShellCode = fs.readFileSync(pageShellPath, "utf-8");

assert(homeCode.includes("<Footer />"), "Public Landing page (Home.jsx) includes <Footer />");
assert(!pageShellCode.includes("<Footer"), "Authenticated PageShell.jsx completely excludes <Footer />");
assert(!pageShellCode.includes("import Footer"), "Authenticated PageShell.jsx does not import Footer");

// Verify that all authenticated pages do NOT render a footer
const authPages = [
  "Dashboard.jsx",
  "History.jsx",
  "Interview.jsx",
  "InterviewSelection.jsx",
  "Learning.jsx",
  "Profile.jsx",
  "Results.jsx",
  "SelectRole.jsx",
  "UploadResume.jsx",
];

for (const pageName of authPages) {
  const pPath = path.join(frontendDir, "src", "pages", pageName);
  const pCode = fs.readFileSync(pPath, "utf-8");
  assert(!pCode.includes("<Footer"), `Authenticated page ${pageName} does not render <Footer />`);
}

// Verify that auth pages (Login, Signup) do NOT render a footer
const authFlowPages = ["Login.jsx", "Signup.jsx"];
for (const pageName of authFlowPages) {
  const pPath = path.join(frontendDir, "src", "pages", pageName);
  const pCode = fs.readFileSync(pPath, "utf-8");
  assert(!pCode.includes("<Footer"), `Auth flow page ${pageName} does not render <Footer />`);
}

// 10. Multi-Device Responsive Simulation (320px to 1920px)
console.log("\n[TEST GROUP 10] Multi-Device Responsive Breakpoint Verification");
const viewports = [
  { width: 320, name: "iPhone SE (Compact)", layout: "1-column stacked" },
  { width: 375, name: "Galaxy Z Fold 6 (Outer)", layout: "2-column mobile" },
  { width: 390, name: "iPhone 16 / Pixel 9", layout: "2-column mobile" },
  { width: 768, name: "iPad Mini / Z Fold 6 (Inner)", layout: "3-column tablet" },
  { width: 1024, name: "iPad Pro / Small Laptop", layout: "5-column desktop" },
  { width: 1440, name: "Standard Desktop / MacBook", layout: "5-column desktop" },
  { width: 1920, name: "Full HD Monitor", layout: "5-column desktop" },
];

assert(footerCode.includes("@media (max-width: 1023px) and (min-width: 768px)"), "Tablet CSS breakpoint defined (768px - 1023px)");
assert(footerCode.includes("@media (max-width: 767px)"), "Mobile CSS breakpoint defined (<= 767px)");
assert(footerCode.includes("@media (max-width: 374px)"), "Small mobile CSS breakpoint defined (<= 374px)");

for (const vp of viewports) {
  let isDesktop = vp.width >= 1024;
  let isTablet = vp.width >= 768 && vp.width < 1024;
  let isSmallMobile = vp.width <= 374;
  let isMobile = vp.width > 374 && vp.width < 768;

  let activeLayout = isDesktop ? "5-column desktop" : isTablet ? "3-column tablet" : isSmallMobile ? "1-column stacked" : "2-column mobile";
  assert(activeLayout === vp.layout, `Viewport ${vp.width}px (${vp.name}): Formats correctly as ${activeLayout}`);
}

console.log("\n===============================================================");
console.log(` Summary: ${totalPassed} Passed, ${totalFailed} Failed`);
console.log("===============================================================");

if (totalFailed > 0) {
  process.exit(1);
}

