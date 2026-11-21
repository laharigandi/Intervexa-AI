/**
 * Automated Verification Suite for Intervexa AI - Global UI Readability & Card Design System
 * Tests all requirements from:
 * # GLOBAL UI READABILITY & CARD DESIGN SYSTEM IMPROVEMENT
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DAILY_TASKS_PATH = path.resolve(__dirname, '../src/components/study-planner/DailyTasksView.jsx');
const STUDY_OVERVIEW_PATH = path.resolve(__dirname, '../src/components/study-planner/StudyPlanOverview.jsx');
const CALENDAR_PATH = path.resolve(__dirname, '../src/components/study-planner/CalendarScheduleView.jsx');
const RADAR_PATH = path.resolve(__dirname, '../src/components/study-planner/SkillImprovementRadar.jsx');
const CONFIG_MODAL_PATH = path.resolve(__dirname, '../src/components/study-planner/StudyPlanConfigModal.jsx');
const AI_MODAL_PATH = path.resolve(__dirname, '../src/components/study-planner/AILearningAssistantModal.jsx');
const LEARNING_PAGE_PATH = path.resolve(__dirname, '../src/pages/Learning.jsx');
const DASHBOARD_PAGE_PATH = path.resolve(__dirname, '../src/pages/Dashboard.jsx');
const SELECT_ROLE_PATH = path.resolve(__dirname, '../src/pages/SelectRole.jsx');
const CARD_PATH = path.resolve(__dirname, '../src/components/Card.jsx');
const THEME_PATH = path.resolve(__dirname, '../src/styles/theme.js');
const CSS_PATH = path.resolve(__dirname, '../src/index.css');

const dailyTasksSrc = fs.readFileSync(DAILY_TASKS_PATH, 'utf-8');
const studyOverviewSrc = fs.readFileSync(STUDY_OVERVIEW_PATH, 'utf-8');
const calendarSrc = fs.readFileSync(CALENDAR_PATH, 'utf-8');
const radarSrc = fs.readFileSync(RADAR_PATH, 'utf-8');
const configModalSrc = fs.readFileSync(CONFIG_MODAL_PATH, 'utf-8');
const aiModalSrc = fs.readFileSync(AI_MODAL_PATH, 'utf-8');
const learningSrc = fs.readFileSync(LEARNING_PAGE_PATH, 'utf-8');
const dashboardSrc = fs.readFileSync(DASHBOARD_PAGE_PATH, 'utf-8');
const selectRoleSrc = fs.readFileSync(SELECT_ROLE_PATH, 'utf-8');
const cardSrc = fs.readFileSync(CARD_PATH, 'utf-8');
const themeSrc = fs.readFileSync(THEME_PATH, 'utf-8');
const cssSrc = fs.readFileSync(CSS_PATH, 'utf-8');

const results = [];

function test(id, description, condition, details = '') {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ id, description, status, details });
  console.log(`[${status === 'PASS' ? '✓ PASS' : '✕ FAIL'}] ${id}: ${description} ${details ? '— ' + details : ''}`);
}

console.log('='.repeat(80));
console.log('INTERVEXA AI — GLOBAL UI READABILITY & CARD DESIGN VERIFICATION');
console.log('='.repeat(80));

// ── PHASE 1: LEARNING & STUDY PLAN TEXT READABILITY ──
test(
  'READ-01',
  'Topic Concepts & Breakdown heading uses consistent purple accent rather than pale cyan',
  dailyTasksSrc.includes('<span>Topic Concepts & Breakdown</span>') &&
  !dailyTasksSrc.includes('color: "#38bdf8"') &&
  dailyTasksSrc.includes('color: "var(--primary)"'),
  'Eliminated pale blue #38bdf8 in breakdown heading'
);

test(
  'READ-02',
  'Concept card titles render dark readable text with purple bullet indicator',
  dailyTasksSrc.includes('color: "var(--text-main)"') &&
  !dailyTasksSrc.includes('color: "#a5b4fc"'),
  'Eliminated pale lilac #a5b4fc in concept titles'
);

test(
  'READ-03',
  'Concept descriptions use readable neutral text rather than low-contrast fallback',
  dailyTasksSrc.includes('color: "var(--text-secondary)"') &&
  !dailyTasksSrc.includes('color: "var(--text-secondary, #cbd5e1)"'),
  'High-contrast description typography verified'
);

test(
  'READ-04',
  'Code examples feature dark neutral background (#0F172A) with high-contrast readable code text (#F8FAFC)',
  dailyTasksSrc.includes('background: "#0F172A"') &&
  dailyTasksSrc.includes('color: "#F8FAFC"') &&
  dailyTasksSrc.includes('overflowX: "auto"') &&
  dailyTasksSrc.includes("'JetBrains Mono'"),
  'Dark neutral code container (#0F172A) and crisp code text verified'
);

test(
  'READ-05',
  'Step-by-Step Learning Instructions use visible purple indicators instead of orange/amber numbers',
  dailyTasksSrc.includes('background: "var(--primary-light)"') &&
  dailyTasksSrc.includes('color: "var(--primary)"') &&
  dailyTasksSrc.includes('border: "1px solid var(--primary-border)"') &&
  !dailyTasksSrc.includes('background: "rgba(245, 158, 11, 0.15)"'),
  'Visible purple rounded step indicators verified'
);

test(
  'READ-06',
  'What You Will Learn Today section uses clean dark readable text and purple accent',
  dailyTasksSrc.includes('<span>What You Will Learn Today</span>') &&
  dailyTasksSrc.includes('color: "var(--text-main)"') &&
  !dailyTasksSrc.includes('color: "var(--text-primary, #e2e8f0)"'),
  'Eliminated washed out #e2e8f0 in learning points'
);

test(
  'READ-07',
  'Day number badge does not render white-on-white in light mode when not today',
  !dailyTasksSrc.includes('background: task.is_today ? "var(--primary)" : "rgba(255,255,255,0.08)"') &&
  dailyTasksSrc.includes('background: task.is_today ? "var(--primary)" : "var(--bg-secondary)"'),
  'Day badge renders dark text on secondary surface in light mode'
);

test(
  'READ-08',
  'Practice Activities & Completion Goals use clean unified cards without loud cyan/green backgrounds',
  !dailyTasksSrc.includes('background: "rgba(14, 165, 233, 0.04)"') &&
  !dailyTasksSrc.includes('background: "rgba(16, 185, 129, 0.04)"') &&
  dailyTasksSrc.includes('Practice Activities & Coding Drills') &&
  dailyTasksSrc.includes('Daily Completion Goals'),
  'Clean standardized cards verified for practice & completion goals'
);

// ── PHASE 2: GLOBAL BRAND COLOR SYSTEM & CARDS ──
test(
  'BRAND-01',
  'Study Plan Overview 4 metric cards standardized without multicolor left borders',
  !studyOverviewSrc.includes('borderLeft: "3.5px solid #F59E0B"') &&
  !studyOverviewSrc.includes('borderLeft: "3.5px solid #10B981"') &&
  !studyOverviewSrc.includes('borderLeft: "3.5px solid #06B6D4"') &&
  studyOverviewSrc.includes('border: "1px solid var(--border-color)"'),
  'Removed orange, green, and cyan left border stripes from overview cards'
);

test(
  'BRAND-02',
  'Study Plan Overview stat icons standardized to purple container system',
  studyOverviewSrc.includes('background: "var(--primary-light)"') &&
  studyOverviewSrc.includes('color: "var(--primary)"') &&
  studyOverviewSrc.includes('border: "1px solid var(--primary-border)"'),
  'Unified purple icon containers across all overview metrics'
);

test(
  'BRAND-03',
  'Calendar Schedule View cards and day badges standardized with high contrast',
  !calendarSrc.includes('rgba(255,255,255,0.04)') &&
  calendarSrc.includes('color: "var(--text-main)"') &&
  calendarSrc.includes('border: "1px solid var(--border-color)"'),
  'Calendar schedule high-contrast cards verified'
);

test(
  'BRAND-04',
  'AI Learning Assistant modal eliminates cyan text (#38bdf8) and indigo buttons (#6366f1)',
  !aiModalSrc.includes('color: "#38bdf8"') &&
  !aiModalSrc.includes('background: activeTab === t.id ? "#6366f1"') &&
  aiModalSrc.includes('background: activeTab === t.id ? "var(--primary)"') &&
  aiModalSrc.includes('background: "#0F172A"'),
  'AI assistant modal standardized with purple brand identity and dark code box'
);

test(
  'BRAND-05',
  'Skill Mastery Radar uses standardized purple brand fills and neutral border rings',
  !radarSrc.includes('stroke="rgba(255, 255, 255, 0.08)"') &&
  radarSrc.includes('stroke="var(--border-color)"') &&
  radarSrc.includes('stroke="var(--primary)"'),
  'Radar concentric rings and axes use neutral border tokens'
);

test(
  'BRAND-06',
  'Study Plan Configuration modal duration and level cards use brand purple selection states',
  configModalSrc.includes('background: isSelected ? "var(--primary-light)" : "var(--bg-secondary)"') &&
  configModalSrc.includes('border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)"'),
  'Duration and prep level cards use standardized purple selection state'
);

test(
  'CARD-01',
  'Reusable Card component enforces standardized surface, neutral border, and rounded corners',
  cardSrc.includes('borderRadius: 14') &&
  cardSrc.includes('border: selected ? "2px solid var(--primary)" : `1px solid var(--border-color)`') &&
  cardSrc.includes('boxShadow: "var(--shadow-card)"'),
  'Universal Card architecture confirmed'
);

test(
  'CARD-02',
  'Dashboard stat cards follow unified compact SaaS metric card specifications',
  cssSrc.includes('.dashboard-stat-card {') &&
  cssSrc.includes('border-radius: 14px;') &&
  cssSrc.includes('border: 1px solid var(--border-color);') &&
  dashboardSrc.includes('className="dashboard-stat-card"'),
  'Dashboard stat cards follow global card styling standard'
);

test(
  'CARD-03',
  'Target Role selection cards follow unified card standard with purple active state',
  selectRoleSrc.includes('role-card interactive-card') &&
  selectRoleSrc.includes('border: `2px solid ${selected ? "var(--primary)" : "var(--border-color)"}`') &&
  selectRoleSrc.includes('background: selected ? "var(--bg-selected)" : "var(--bg-card)"'),
  'Target Role card standardization verified'
);

test(
  'TOKENS-01',
  'Light and dark mode tokens defined with consistent purple brand (#8054E8 / #9B78F5)',
  cssSrc.includes('--primary: #8054E8;') &&
  cssSrc.includes('--primary: #9B78F5;') &&
  themeSrc.includes('primary: "var(--primary)"'),
  'CSS and JS design tokens aligned around primary purple identity'
);

// ── SUMMARY REPORT ──
console.log('='.repeat(80));
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`SUMMARY: ${passed}/${results.length} TESTS PASSED (${failed} FAILED)`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
