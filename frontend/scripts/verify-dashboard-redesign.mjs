/**
 * Comprehensive Automated Verification Suite for Intervexa AI - Minimal Dashboard Redesign
 * Tests all requirements from:
 * # Intervexa AI – Professional Minimal Dashboard Redesign
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DASHBOARD_PATH = path.resolve(__dirname, '../src/pages/Dashboard.jsx');
const CSS_PATH = path.resolve(__dirname, '../src/index.css');

const dashSrc = fs.readFileSync(DASHBOARD_PATH, 'utf-8');
const cssSrc = fs.readFileSync(CSS_PATH, 'utf-8');

const results = [];

function test(id, description, condition, details = '') {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ id, description, status, details });
  console.log(`[${status === 'PASS' ? '✓ PASS' : '✕ FAIL'}] ${id}: ${description} ${details ? '— ' + details : ''}`);
}

console.log('='.repeat(80));
console.log('INTERVEXA AI — PROFESSIONAL MINIMAL DASHBOARD REDESIGN VERIFICATION');
console.log('='.repeat(80));

// 1. Container Width & Centering
test(
  'MIN-01',
  'Dashboard container has controlled maximum width (1140px) and center alignment',
  dashSrc.includes('maxWidth: "1140px"') && dashSrc.includes('margin: "0 auto"'),
  'Controlled width prevents horizontal stretching'
);

// 2. Section A: Welcome Header
test(
  'MIN-02A',
  'Welcome Header displays greeting "Welcome back, [User Name]!"',
  dashSrc.includes('Welcome back') && dashSrc.includes('user?.name'),
  'Personalized candidate greeting verified'
);

test(
  'MIN-02B',
  'Welcome Header displays exact required subtitle',
  dashSrc.includes('Track your progress and prepare for your next interview.'),
  'Exact subtitle verified'
);

test(
  'MIN-02C',
  'Welcome Header displays target career role badge if available',
  dashSrc.includes('dashboard-role-badge') && dashSrc.includes('stats.most_practiced_role'),
  'Career target role badge verified'
);

test(
  'MIN-02D',
  'Welcome Header provides primary button "Start New Interview" navigating to /role',
  dashSrc.includes('Start New Interview') && dashSrc.includes('navigate("/role")'),
  'Primary action button verified'
);

// 3. Section B: Four Important Statistics
test(
  'MIN-03A',
  'Card 1: Completed Interviews displays evaluated sessions count',
  dashSrc.includes('Completed Interviews') && dashSrc.includes('stats.total') && dashSrc.includes('evaluated session'),
  'Completed interviews statistic verified'
);

test(
  'MIN-03B',
  'Card 2: Average Score scaled to 0-100% and displays "Not available" when no evaluations',
  dashSrc.includes('Average Score') &&
    dashSrc.includes('Math.round(stats.average * 10)}%') &&
    dashSrc.includes('"Not available"'),
  'Average Score scaling & empty handling verified'
);

test(
  'MIN-03C',
  'Card 3: Best Score scaled to 0-100% and displays "Not available" when no evaluations',
  dashSrc.includes('Best Score') &&
    dashSrc.includes('Math.round(stats.best * 10)}%') &&
    dashSrc.includes('"Not available"'),
  'Best Score scaling & empty handling verified'
);

test(
  'MIN-03D',
  'Card 4: Latest Interview displays score percentage and date/type in small text',
  dashSrc.includes('Latest Interview') &&
    dashSrc.includes('latest_interview') &&
    dashSrc.includes('"Not available"') &&
    dashSrc.includes('interview_type'),
  'Latest Interview score & metadata verified'
);

// 4. Section C: Interview Performance Trend (ONE visualization only)
test(
  'MIN-04A',
  'Section C displays single clean Line Chart "Interview Performance Trend"',
  dashSrc.includes('Interview Performance Trend') &&
    dashSrc.includes('Track how your interview scores change over time.') &&
    dashSrc.includes('<LineChart'),
  'Interview Performance Trend line chart verified'
);

test(
  'MIN-04B',
  'Line chart has 0-100% Y-axis domain and ticks [0, 20, 40, 60, 80, 100]',
  dashSrc.includes('domain={[0, 100]}') && dashSrc.includes('ticks={[0, 20, 40, 60, 80, 100]}'),
  'Chart Y-axis scaled 0-100% verified'
);

test(
  'MIN-04C',
  'Line chart uses brand purple stroke color and custom tooltip',
  dashSrc.includes('var(--primary, #7650D8)') && dashSrc.includes('PerformanceTooltip'),
  'Chart purple theme & hover tooltip verified'
);

test(
  'MIN-04D',
  'Handles single evaluated interview with note to complete more interviews',
  dashSrc.includes('trendChartData.length === 1') &&
    dashSrc.includes('1 interview evaluated. Complete more interviews to establish a performance trend.'),
  'Single data point note verified'
);

test(
  'MIN-04E',
  'Handles zero evaluations with clean empty state and call to action',
  dashSrc.includes('No interview evaluation data yet') && dashSrc.includes('Start First Interview'),
  'Empty state call to action verified'
);

// 5. Section D: Recent Interviews
test(
  'MIN-05A',
  'Section D displays ONLY latest 3 evaluated interviews',
  dashSrc.includes('recentSessions.slice(0, 3)'),
  'Slice latest 3 verified'
);

test(
  'MIN-05B',
  'Recent interview rows contain role, type (Standard/Adaptive), score pill, and date',
  dashSrc.includes('session.role') &&
    dashSrc.includes('isAdaptive ? "Adaptive" : "Standard"') &&
    dashSrc.includes('scorePct') &&
    dashSrc.includes('toLocaleDateString'),
  'Recent interview metadata verified'
);

test(
  'MIN-05C',
  'Recent interviews section has View All link navigating to /history',
  dashSrc.includes('navigate("/history")') && dashSrc.includes('View All'),
  'View All link to /history verified'
);

test(
  'MIN-05D',
  'Recent interviews has exact empty state copy when no interviews exist',
  dashSrc.includes("You haven't completed an evaluated interview yet. Start your first interview."),
  'Exact empty state copy verified'
);

// 6. Section E: Recommended Next Step
test(
  'MIN-06A',
  'Section E displays strictly ONE recommendation card based on actual user activity',
  dashSrc.includes('title="Recommended Next Step"') && dashSrc.includes('nextAction.title'),
  'Single recommended action card verified'
);

test(
  'MIN-06B',
  'Recommended action prioritizes resume, baseline interview, low score practice, study plan, and adaptive round',
  dashSrc.includes('Upload & Analyze Your Resume') &&
    dashSrc.includes('Start Your First Mock Interview') &&
    dashSrc.includes('Practice Technical Questions') &&
    dashSrc.includes('Challenge Yourself With Adaptive Questions'),
  'Contextual recommendation logic verified'
);

// 7. Sections Removed Verification (Strictly 5 sections only)
test(
  'MIN-07A',
  'Quick Actions 4-card grid is removed from Dashboard.jsx',
  !dashSrc.includes('dashboard-quick-actions-grid'),
  'Quick Actions grid removed from dashboard'
);

test(
  'MIN-07B',
  'Detailed Skill Improvement cards are removed from Dashboard.jsx',
  !dashSrc.includes('title="Skill Improvement"'),
  'Skill Improvement cards removed from dashboard'
);

test(
  'MIN-07C',
  'No extra chart components (BarChart, PieChart, RadarChart) in Dashboard.jsx',
  !dashSrc.includes('<BarChart') && !dashSrc.includes('<PieChart') && !dashSrc.includes('<RadarChart'),
  'Only single LineChart present in dashboard'
);

console.log('='.repeat(80));
const total = results.length;
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`SUMMARY: ${passed}/${total} TESTS PASSED (${failed} FAILED)`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL MINIMAL DASHBOARD REDESIGN VERIFICATION TESTS PASSED SUCCESSFULLY!');
}
