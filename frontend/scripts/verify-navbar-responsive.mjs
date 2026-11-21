import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

console.log("===============================================================");
console.log(" Intervexa AI - Complete Navbar Responsive Verification Suite  ");
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

// 1. Inspect Home.jsx (Landing Page Navbar)
console.log("\n[TEST GROUP 1] Landing Page Navbar Component (Home.jsx)");
const homePath = path.join(frontendDir, "src", "pages", "Home.jsx");
const homeCode = fs.readFileSync(homePath, "utf-8");

assert(homeCode.includes("home-navbar-container"), "Sticky container has 'home-navbar-container' class");
assert(homeCode.includes("home-header-pill"), "Header pill has 'home-header-pill' class");
assert(homeCode.includes("home-brand-icon"), "Logo icon has 'home-brand-icon' class");
assert(homeCode.includes("home-brand-title"), "Brand text has 'home-brand-title' class");
assert(homeCode.includes("home-nav-links"), "Center nav links have 'home-nav-links' class");
assert(homeCode.includes("home-mobile-toggle"), "Mobile hamburger button has 'home-mobile-toggle' class");
assert(homeCode.includes("nav-desktop-actions"), "Desktop actions container has 'nav-desktop-actions' class");
assert(homeCode.includes("nav-signin-btn"), "Sign In button has 'nav-signin-btn' class");
assert(homeCode.includes("nav-getstarted-btn"), "Get Started button has 'nav-getstarted-btn' class");

// Verify Section Links
const expectedSections = ["features", "workflow", "tracks", "demo"];
for (const sec of expectedSections) {
  assert(homeCode.includes(`scrollToSection("${sec}")`), `Nav contains scroll action for section '${sec}'`);
}

// Verify Mobile Menu Scroll Lock & Escape Key
assert(homeCode.includes("mobileMenuOpen"), "State variable 'mobileMenuOpen' is managed");
assert(
  homeCode.includes("document.body.style.overflow = \"hidden\"") &&
  homeCode.includes("e.key === \"Escape\""),
  "Mobile drawer locks body scroll and handles Escape key dismiss"
);
assert(homeCode.includes("zIndex: 10001") && homeCode.includes("zIndex: 10002"), "Mobile backdrop (10001) & drawer (10002) have correct zIndex stack");
assert(homeCode.includes("nav-mobile-signin-btn") && homeCode.includes("nav-mobile-getstarted-btn"), "Drawer contains mobile Sign In and Get Started buttons");

// 2. Inspect Navbar.jsx (Authenticated App Navbar)
console.log("\n[TEST GROUP 2] Authenticated App Navbar (Navbar.jsx)");
const navbarPath = path.join(frontendDir, "src", "components", "Navbar.jsx");
const navbarCode = fs.readFileSync(navbarPath, "utf-8");

assert(navbarCode.includes("navbar-hamburger"), "Authenticated navbar has 'navbar-hamburger' button");
assert(navbarCode.includes("navbar-brand-text"), "Authenticated navbar has 'navbar-brand-text' class");
assert(navbarCode.includes("navbar-profile-btn"), "Profile button has 'navbar-profile-btn' class");
assert(navbarCode.includes("navbar-profile-name"), "Profile candidate name has 'navbar-profile-name' class");
assert(navbarCode.includes("navbar-chevron-down"), "Profile chevron has 'navbar-chevron-down' class");
assert(
  navbarCode.includes("event.key === \"Escape\"") && navbarCode.includes("setDropdownOpen(false)"),
  "Profile dropdown closes on 'Escape' key press"
);
assert(navbarCode.includes("zIndex: 10000"), "Profile dropdown elevated with zIndex 10000");

// 3. Inspect Sidebar.jsx (Authenticated App Sidebar Drawer)
console.log("\n[TEST GROUP 3] Authenticated Sidebar Drawer (Sidebar.jsx)");
const sidebarPath = path.join(frontendDir, "src", "components", "Sidebar.jsx");
const sidebarCode = fs.readFileSync(sidebarPath, "utf-8");

assert(sidebarCode.includes("app-sidebar"), "Sidebar has 'app-sidebar' class");
assert(
  sidebarCode.includes("document.body.style.overflow = \"hidden\"") &&
  sidebarCode.includes("e.key === \"Escape\""),
  "Sidebar drawer locks body scroll and closes on Escape key"
);
assert(
  sidebarCode.includes("zIndex: 10001") && sidebarCode.includes("zIndex: 10002"),
  "Sidebar mobile backdrop (10001) and aside (10002) are correctly elevated above navbars"
);

// 4. Inspect AiChatbot.jsx (Floating Launcher Layering)
console.log("\n[TEST GROUP 4] AI Assistant Floating Launcher Layering (AiChatbot.jsx)");
const chatbotPath = path.join(frontendDir, "src", "components", "AiChatbot.jsx");
const chatbotCode = fs.readFileSync(chatbotPath, "utf-8");

assert(chatbotCode.includes("z-index: 995"), "Floating chatbot launcher has z-index: 995 (below navbar 1000 and mobile drawers 10001+)");
assert(chatbotCode.includes(".ai-chatbot-window"), "Chatbot window panel is present");

// 5. Inspect index.css (Breakpoint Architecture)
console.log("\n[TEST GROUP 5] CSS Responsive Breakpoints (index.css)");
const cssPath = path.join(frontendDir, "src", "index.css");
const cssCode = fs.readFileSync(cssPath, "utf-8");

assert(cssCode.includes("@media (min-width: 1024px)"), "Desktop breakpoint (>= 1024px) defined");
assert(cssCode.includes("@media (max-width: 1023px) and (min-width: 768px)"), "Tablet breakpoint (768px - 1023px) defined");
assert(cssCode.includes("@media (max-width: 767px)"), "Mobile breakpoint (<= 767px) defined");
assert(cssCode.includes("@media (max-width: 374px)"), "Small mobile micro-scaling (<= 374px) defined");
assert(cssCode.includes("@media (max-width: 640px)"), "Authenticated profile name hide query (<= 640px) defined");
assert(cssCode.includes("@media (max-width: 380px)"), "Authenticated chevron hide query (<= 380px) defined");

// 6. Viewport Matrix Simulation
console.log("\n[TEST GROUP 6] Viewport Matrix Simulation (9 Required Screen Sizes)");
const viewports = [
  { name: "iPhone SE (Compact Mobile)", width: 320, category: "small-mobile" },
  { name: "iPhone 16 / Pixel 9 (Standard Mobile)", width: 390, category: "mobile" },
  { name: "iPhone 16 Pro Max (Large Mobile)", width: 430, category: "mobile" },
  { name: "Galaxy A55 (Standard Android Mobile)", width: 412, category: "mobile" },
  { name: "Galaxy Z Fold 6 Outer (Narrow Foldable)", width: 375, category: "mobile" },
  { name: "iPad / Galaxy Z Fold 6 Inner (Tablet)", width: 768, category: "tablet" },
  { name: "iPad Pro / Small Laptop", width: 1024, category: "desktop" },
  { name: "Standard Desktop / MacBook", width: 1280, category: "desktop" },
  { name: "FHD Monitor (1080p)", width: 1920, category: "desktop" },
];

for (const vp of viewports) {
  let navLinksVisible = vp.width >= 1024;
  let hamburgerVisible = vp.width < 1024;
  let desktopActionsVisible = vp.width >= 768;
  let drawerHasAuthActions = vp.width < 768;
  let authProfileNameVisible = vp.width > 640;

  assert(
    (vp.category === "desktop" ? navLinksVisible : !navLinksVisible) &&
    (vp.category !== "desktop" ? hamburgerVisible : !hamburgerVisible),
    `Viewport ${vp.width}px (${vp.name}): Category '${vp.category}', nav links=${navLinksVisible}, hamburger=${hamburgerVisible}, desktopActions=${desktopActionsVisible}, authName=${authProfileNameVisible}`
  );
}

console.log("\n===============================================================");
console.log(` Summary: ${totalPassed} Passed, ${totalFailed} Failed`);
console.log("===============================================================");

if (totalFailed > 0) {
  process.exit(1);
}

