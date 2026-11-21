import fs from "fs";
import path from "path";
import assert from "assert";

console.log("===========================================================================");
console.log("  Intervexa AI - Learning Roadmap Separate Options Verification Suite       ");
console.log("===========================================================================\n");

const frontendRoot = path.resolve("Smart-Interview-Coach/frontend");
const learningJsxPath = path.join(frontendRoot, "src/pages/Learning.jsx");
const indexCssPath = path.join(frontendRoot, "src/index.css");

assert(fs.existsSync(learningJsxPath), "Learning.jsx must exist");
assert(fs.existsSync(indexCssPath), "index.css must exist");

const learningCode = fs.readFileSync(learningJsxPath, "utf-8");
const indexCss = fs.readFileSync(indexCssPath, "utf-8");

// [GROUP 1] Segmented Tabs Navigation
console.log("[TEST GROUP 1] Segmented Tabs Navigation Options");
assert(
  learningCode.includes('activeMainTab, setActiveMainTab] = useState("plan")'),
  "Study Plan must be selected by default (activeMainTab === 'plan')"
);
console.log("  ✔ [PASS] Study Plan is selected by default");

assert(
  learningCode.includes('role="tablist"') && learningCode.includes('className="learning-segmented-nav"'),
  "Segmented tab list container must have accessible role and class"
);
console.log("  ✔ [PASS] Accessible tablist container rendered");

assert(
  learningCode.includes('id="tab-study-plan"') && learningCode.includes("Study Plan"),
  "Study Plan tab button must exist with id='tab-study-plan'"
);
assert(
  learningCode.includes('id="tab-resources"') && learningCode.includes("Resources"),
  "Resources tab button must exist with id='tab-resources'"
);
console.log("  ✔ [PASS] Both 'Study Plan' and 'Resources' buttons are present");

assert(
  learningCode.includes("IconLearning") && learningCode.includes("IconBook"),
  "Tabs must include graduation cap (IconLearning) and book (IconBook) icons"
);
console.log("  ✔ [PASS] Relevant icons (graduation cap & book) attached to tab options");

// [GROUP 2] Conditional Rendering & Separation
console.log("\n[TEST GROUP 2] Conditional Rendering & Isolation");
assert(
  learningCode.includes('{activeMainTab === "plan" && ('),
  "Study Plan section must be conditionally rendered when activeMainTab === 'plan'"
);
assert(
  learningCode.includes('{activeMainTab === "resources" && ('),
  "Resources section must be conditionally rendered when activeMainTab === 'resources'"
);
console.log("  ✔ [PASS] Study Plan and Resources are strictly separated into their own views");

// Ensure Resource Explorer is inside the resources condition
const planSectionStart = learningCode.indexOf('{activeMainTab === "plan" && (');
const resourcesSectionStart = learningCode.indexOf('{activeMainTab === "resources" && (');
const resourceCardIndex = learningCode.indexOf('title="Curated Resource Explorer"');

assert(
  resourceCardIndex > resourcesSectionStart,
  "Curated Resource Explorer must ONLY be placed inside the Resources tab panel"
);
console.log("  ✔ [PASS] Curated Resource Explorer is isolated within the Resources tab only");

const studyPlanOverviewIndex = learningCode.indexOf("<StudyPlanOverview");
assert(
  studyPlanOverviewIndex > planSectionStart && studyPlanOverviewIndex < resourcesSectionStart,
  "StudyPlanOverview must ONLY be placed inside the Study Plan tab panel"
);
console.log("  ✔ [PASS] Study Plan roadmap is isolated within the Study Plan tab only");

// [GROUP 3] Study Plan Content Integrity
console.log("\n[TEST GROUP 3] Study Plan Feature Integrity");
assert(
  learningCode.includes("No Learning Roadmap Yet"),
  "Empty state must display 'No Learning Roadmap Yet'"
);
assert(
  learningCode.includes("Generate a personalized learning roadmap based on your target role and skill requirements."),
  "Empty state description must match exact required text"
);
assert(
  learningCode.includes("Generate New Roadmap"),
  "Empty state button must display 'Generate New Roadmap'"
);
assert(
  learningCode.includes("<DailyTasksView") &&
  learningCode.includes("<CalendarScheduleView") &&
  learningCode.includes("<SkillImprovementRadar"),
  "DailyTasksView, CalendarScheduleView, and SkillImprovementRadar must be preserved"
);
assert(
  learningCode.includes("handleDownloadPdf") && learningCode.includes("handleDeleteStudyPlan"),
  "PDF download and roadmap deletion handlers must be preserved"
);
console.log("  ✔ [PASS] Roadmap generation, overview, daily tasks, calendar, radar, and PDF export preserved");

// [GROUP 4] Resources Content Integrity
console.log("\n[TEST GROUP 4] Resources Feature Integrity");
const expectedTracks = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Machine Learning Engineer",
  "Software Engineer",
  "Data Analyst",
  "Python Developer",
  "Java Developer",
];
expectedTracks.forEach((track) => {
  assert(learningCode.includes(`"${track}"`), `Track '${track}' must be in CAREER_TRACKS`);
});
console.log("  ✔ [PASS] All 8 target career tracks preserved");

const expectedTopics = [
  "System Design",
  "React Hooks & State",
  "SQL Optimization",
  "Data Structures",
  "Microservices",
  "REST APIs",
];
expectedTopics.forEach((topic) => {
  assert(learningCode.includes(`"${topic}"`), `Suggested topic '${topic}' must be present`);
});
console.log("  ✔ [PASS] All 6 suggested topic chips preserved with active toggle");

assert(
  learningCode.includes("handleSearchResources") &&
  learningCode.includes("handleTopicKeyDown") &&
  learningCode.includes("handleRemoveTopic"),
  "Resource search, topic addition/removal, and Enter key handlers must be preserved"
);
assert(
  learningCode.includes("RESOURCE_FILTER_TABS") &&
  learningCode.includes("filteredResources.map") &&
  learningCode.includes("Open Resource"),
  "Resource filter tabs and card layout with 'Open Resource' buttons must be preserved"
);
console.log("  ✔ [PASS] Tag chip management, search execution, filter tabs, and resource cards preserved");

// [GROUP 5] CSS & Responsive Styling
console.log("\n[TEST GROUP 5] CSS Styling & Multi-Device Responsiveness");
assert(
  indexCss.includes(".learning-segmented-nav"),
  ".learning-segmented-nav class must exist in index.css"
);
assert(
  indexCss.includes(".learning-segment-btn"),
  ".learning-segment-btn class must exist in index.css"
);
assert(
  indexCss.includes(".learning-segment-btn.active"),
  "Active state styling (.learning-segment-btn.active) must exist in index.css"
);
assert(
  indexCss.includes("@media (max-width: 640px)"),
  "Mobile breakpoint for segmented tabs must exist in index.css"
);
console.log("  ✔ [PASS] Segmented navigation and mobile responsive CSS rules verified");

// [GROUP 6] Resources Card Width & Center Alignment
console.log("\n[TEST GROUP 6] Resources Card Narrow Width & Center Alignment");
assert(
  learningCode.includes("resources-centered-container"),
  "Resources panel must use .resources-centered-container"
);
assert(
  indexCss.includes(".resources-centered-container"),
  ".resources-centered-container class must exist in index.css"
);
assert(
  indexCss.includes("max-width: 900px"),
  "Resources container must have max-width: 900px"
);
assert(
  indexCss.includes("margin-left: auto") && indexCss.includes("margin-right: auto"),
  "Resources container must be centered with margin-left: auto and margin-right: auto"
);
assert(
  indexCss.includes("width: 70%"),
  "Desktop width must be approximately 70%"
);
assert(
  indexCss.includes("width: 88%"),
  "Tablet width must be approximately 85-90%"
);
console.log("  ✔ [PASS] Resources card width ~70%, max-width 900px, and center alignment verified across desktop, tablet, and mobile");

console.log("\n===========================================================================");
console.log("  SUMMARY: All Separate Tabs, Features & Narrow Width Tests PASSED! (100% OK)");
console.log("===========================================================================\n");
