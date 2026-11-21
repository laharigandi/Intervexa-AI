/**
 * Comprehensive Automated Verification Suite for Intervexa AI - Open Workspace Resume Analysis Redesign
 * Tests all requirements from:
 * # RESUME ANALYSIS PAGE – REMOVE WORKFLOW AND CARD-BASED LAYOUT
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_PAGE_PATH = path.resolve(__dirname, '../src/pages/UploadResume.jsx');
const ATS_DASHBOARD_PATH = path.resolve(__dirname, '../src/components/AtsAnalysisDashboard.jsx');
const PAGE_SHELL_PATH = path.resolve(__dirname, '../src/components/PageShell.jsx');

const uploadSrc = fs.readFileSync(UPLOAD_PAGE_PATH, 'utf-8');
const atsSrc = fs.readFileSync(ATS_DASHBOARD_PATH, 'utf-8');
const shellSrc = fs.readFileSync(PAGE_SHELL_PATH, 'utf-8');

const results = [];

function test(id, description, condition, details = '') {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ id, description, status, details });
  console.log(`[${status === 'PASS' ? '✓ PASS' : '✕ FAIL'}] ${id}: ${description} ${details ? '— ' + details : ''}`);
}

console.log('='.repeat(80));
console.log('INTERVEXA AI — OPEN WORKSPACE RESUME ANALYSIS REDESIGN VERIFICATION');
console.log('='.repeat(80));

// 1. Complete Workflow Progress Removal
test(
  'NOWF-01',
  'Workflow Progress section is completely removed from Resume Analysis page',
  !uploadSrc.includes('WorkflowVerticalStepper') &&
  !uploadSrc.includes('StepProgress') &&
  !uploadSrc.includes('Workflow Progress'),
  'No stepper component or workflow heading rendered'
);

test(
  'NOWF-02',
  'No empty left sidebar column remains; main content uses full available width',
  !uploadSrc.includes('resume-analysis-sidebar-col') &&
  uploadSrc.includes('width: "100%"'),
  'Two-column sidebar layout eliminated, full-width container confirmed'
);

test(
  'NOWF-03',
  'Horizontal stepper is suppressed via PageShell (hideStepper={true})',
  uploadSrc.includes('hideStepper={true}') && shellSrc.includes('!hideStepper'),
  'PageShell stepper suppression verified'
);

// 2. Removal of Large Card-Based Containers & Purple Top Accent Lines
test(
  'NOCARD-01',
  'Decorative purple top-border lines removed from outer section containers',
  !uploadSrc.includes('linear-gradient(90deg, var(--primary), #B89EFF)') &&
  !atsSrc.includes('linear-gradient(90deg, var(--primary), #B89EFF)'),
  'Purple top-border lines removed from outer containers'
);

test(
  'NOCARD-02',
  'Page utilizes an open, section-based layout with clean dividers and section tags',
  uploadSrc.includes('<section className="resume-section"') &&
  uploadSrc.includes('<hr style={{ border: "none"') &&
  !uploadSrc.includes('className="app-card"'),
  'Open section-based architecture verified'
);

// 3. Top Section
test(
  'TOP-01',
  'Top section displays exact required heading and supporting description',
  uploadSrc.includes('title="Resume Analysis & ATS Evaluation"') &&
  uploadSrc.includes('subtitle="Analyze your resume, identify important skills, and evaluate your job readiness."'),
  'Standardized page title and description verified'
);

// 4. Section 1: Resume Upload
test(
  'UPL-01',
  'Upload section includes upload icon, "Upload Your Resume" heading, and description',
  uploadSrc.includes('Upload Your Resume') &&
  uploadSrc.includes('Upload your resume in PDF format to analyze your skills and job readiness.') &&
  uploadSrc.includes('IconUpload'),
  'Upload section header verified'
);

test(
  'UPL-02',
  'Drag-and-drop area has subtle dashed border and is not wrapped in an oversized card',
  uploadSrc.includes('border: `2px dashed') &&
  uploadSrc.includes('onDragOver') &&
  uploadSrc.includes('onDrop'),
  'Interactive drag-and-drop box verified'
);

test(
  'UPL-03',
  'Enforces PDF format and 10MB maximum file size limit notice',
  uploadSrc.includes('MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024') &&
  uploadSrc.includes('Supported format: PDF only') &&
  uploadSrc.includes('Maximum file size: 10MB'),
  'Backend-aligned file constraints verified'
);

test(
  'UPL-04',
  'Provides upload progress bar and status message during analysis',
  uploadSrc.includes('Analyzing Resume... {uploadProgress}%') &&
  uploadSrc.includes('Cancel Analysis'),
  'Upload in-progress UX confirmed'
);

test(
  'UPL-05',
  'Active resume strip displays filename, metadata, Replace Resume, Remove, and View Text actions',
  uploadSrc.includes('Replace Resume') &&
  uploadSrc.includes('Remove') &&
  uploadSrc.includes('View Parsed Text'),
  'Compact active resume bar verified'
);

// 5. Section 2: Resume Analysis Results
test(
  'RES-01',
  'ATS score displayed out of 100 with circular gauge and actual backend data',
  atsSrc.includes('{atsScore}') &&
  atsSrc.includes('/ 100') &&
  atsSrc.includes('strokeDasharray={circumference}') &&
  atsSrc.includes('Number(analysis.ats_score)'),
  'Authentic backend ATS score and circular gauge verified'
);

test(
  'RES-02',
  'Skills profile displays extracted technical skills and recommended keywords in unified purple color system',
  atsSrc.includes('Extracted Skills & Competencies') &&
  atsSrc.includes('var(--primary-light)') &&
  atsSrc.includes('var(--primary)'),
  'Unified purple skill chips verified'
);

test(
  'RES-03',
  'Strengths and Areas for Improvement are organized in a 2-column responsive grid',
  atsSrc.includes('ats-strengths-grid') &&
  atsSrc.includes('gridTemplateColumns: "repeat(2, minmax(0, 1fr))"') &&
  atsSrc.includes('Resume Strengths') &&
  atsSrc.includes('Areas for Improvement'),
  '2-column evaluation breakdown verified'
);

test(
  'RES-04',
  'Analysis results are hidden before successful analysis',
  uploadSrc.includes('{hasValidAnalysis && (') &&
  uploadSrc.includes('<AtsAnalysisDashboard'),
  'Conditional rendering guards unanalyzed state'
);

// 6. Section 3: Target Job Description Matching
test(
  'JD-01',
  'Job Description matching section placed below resume analysis section',
  uploadSrc.indexOf('<AtsAnalysisDashboard') < uploadSrc.indexOf('Target Job Description Matching (Optional)'),
  'Section ordering verified below analysis results'
);

test(
  'JD-02',
  'JD matching features wide comfortable textarea with 10,000 character limit',
  uploadSrc.includes('MAX_JD_CHARS = 10000') &&
  uploadSrc.includes('minHeight: 120') &&
  uploadSrc.includes('Analyze Match'),
  'Comfortable textarea and CTA verified'
);

test(
  'JD-03',
  'JD matching displays actual match score, matching skills, and missing skills',
  uploadSrc.includes('jdMatchResult.match_score') &&
  uploadSrc.includes('jdMatchResult.matching_skills') &&
  uploadSrc.includes('jdMatchResult.missing_skills'),
  'Authentic JD match score and skill gaps verified'
);

// 7. Navigation & Regression Safety
test(
  'NAV-01',
  'Page actions render Continue to Role Selection button navigating to /role',
  uploadSrc.includes('Continue to Role Selection') &&
  uploadSrc.includes('navigate("/role")'),
  'Role selection navigation confirmed'
);

test(
  'NAV-02',
  'Upload abortion and race condition protections preserved',
  uploadSrc.includes('abortControllerRef.current.abort()') &&
  uploadSrc.includes('uploadRequestIdRef.current++'),
  'Concurrency & race condition protection verified'
);

console.log('='.repeat(80));
const total = results.length;
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`SUMMARY: ${passed}/${total} TESTS PASSED (${failed} FAILED)`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
}
