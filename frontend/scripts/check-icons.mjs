import { readFileSync } from "fs";
import { basename } from "path";

const files = [
  "Smart-Interview-Coach/frontend/src/pages/Learning.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/DailyTasksView.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/DailyQuizSection.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/StudyPlanOverview.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/CalendarScheduleView.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/SkillImprovementRadar.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/AILearningAssistantModal.jsx",
  "Smart-Interview-Coach/frontend/src/components/study-planner/StudyPlanConfigModal.jsx"
];

const iconsContent = readFileSync("Smart-Interview-Coach/frontend/src/components/Icons.jsx", "utf8");
const exportedIcons = new Set([...iconsContent.matchAll(/export function (Icon\w+)/g)].map(m => m[1]));

for (const f of files) {
  const content = readFileSync(f, "utf8");
  const importMatches = [...content.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'][^"']*Icons["']/g)];
  const importedIcons = new Set();
  for (const m of importMatches) {
    m[1].split(",").forEach(item => {
      const name = item.trim();
      if (name.startsWith("Icon")) importedIcons.add(name);
    });
  }

  const usedMatches = [...content.matchAll(/<(Icon\w+)/g)].map(m => m[1]);
  const usedIcons = new Set(usedMatches);

  const missingImports = [...usedIcons].filter(i => !importedIcons.has(i));
  const notExported = [...usedIcons].filter(i => !exportedIcons.has(i));

  console.log("File:", basename(f));
  if (missingImports.length > 0) console.log("  MISSING IMPORTS:", missingImports);
  if (notExported.length > 0) console.log("  NOT EXPORTED:", notExported);
  if (missingImports.length === 0 && notExported.length === 0) console.log("  OK");
}
