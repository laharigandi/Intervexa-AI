/**
 * Centralized ATS Score Classification System for Intervexa AI.
 * 
 * Score Ranges:
 *  - 80–100: Excellent — Green (#16A34A)
 *  - 60–79:  Good — Blue (#2563EB)
 *  - 40–59:  Needs Improvement — Orange (#D97706)
 *  - 0–39:   Poor — Red (#DC2626)
 * 
 * Reusable across Resume Analysis, Dashboard, and all ATS score UI components.
 */

export const ATS_TIERS = {
  EXCELLENT: {
    category: "Excellent",
    label: "Excellent",
    minScore: 80,
    maxScore: 100,
    color: "#16A34A",
    bg: "rgba(22, 163, 74, 0.12)",
    border: "rgba(22, 163, 74, 0.28)",
    badge: "✓ Excellent ATS Alignment",
    subtext: "Your resume exhibits outstanding technical keyword density, standard formatting, and optimal compatibility with enterprise applicant tracking systems.",
  },
  GOOD: {
    category: "Good",
    label: "Good",
    minScore: 60,
    maxScore: 79,
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(37, 99, 235, 0.28)",
    badge: "✓ Good Candidate Match",
    subtext: "Solid technical baseline detected. Adding quantifiable project accomplishments and specific industry frameworks will further boost your ranking.",
  },
  NEEDS_IMPROVEMENT: {
    category: "Needs Improvement",
    label: "Needs Improvement",
    minScore: 40,
    maxScore: 59,
    color: "#D97706",
    bg: "rgba(217, 119, 6, 0.12)",
    border: "rgba(217, 119, 6, 0.28)",
    badge: "⚠ Needs Improvement — Gaps Detected",
    subtext: "Moderate alignment detected. Incorporating key role-specific technical skills, tools, and standardized section headers is advised.",
  },
  POOR: {
    category: "Poor",
    label: "Poor",
    minScore: 0,
    maxScore: 39,
    color: "#DC2626",
    bg: "rgba(220, 38, 38, 0.12)",
    border: "rgba(220, 38, 38, 0.28)",
    badge: "✕ Poor Alignment — Critical Gaps",
    subtext: "Low keyword density or missing structural sections detected. Restructure your resume using standard ATS-friendly conventions.",
  },
  UNAVAILABLE: {
    category: "Unavailable",
    label: "Not Available",
    minScore: null,
    maxScore: null,
    color: "var(--text-muted, #94A3B8)",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.25)",
    badge: "• Score Pending",
    subtext: "Upload your resume in PDF format to calculate your estimated ATS compatibility score.",
  },
};

/**
 * Classifies an ATS score into standard deterministic categories.
 * 
 * @param {number|string|null|undefined} rawScore
 * @returns {object} Classification result with score, category, label, colors, and badge.
 */
export function classifyAtsScore(rawScore) {
  // Guard against missing, null, undefined, or empty values
  if (
    rawScore === null ||
    rawScore === undefined ||
    rawScore === "" ||
    (typeof rawScore === "string" && rawScore.trim() === "")
  ) {
    return {
      isValid: false,
      score: null,
      scoreDisplay: "—",
      percentageDisplay: "Not Available",
      ...ATS_TIERS.UNAVAILABLE,
    };
  }

  const num = Number(rawScore);
  if (isNaN(num)) {
    return {
      isValid: false,
      score: null,
      scoreDisplay: "—",
      percentageDisplay: "Not Available",
      ...ATS_TIERS.UNAVAILABLE,
    };
  }

  // Validate score between 0 and 100
  const score = Math.max(0, Math.min(100, Math.round(num)));

  let tier = ATS_TIERS.POOR;
  if (score >= 80) {
    tier = ATS_TIERS.EXCELLENT;
  } else if (score >= 60) {
    tier = ATS_TIERS.GOOD;
  } else if (score >= 40) {
    tier = ATS_TIERS.NEEDS_IMPROVEMENT;
  } else {
    tier = ATS_TIERS.POOR;
  }

  return {
    isValid: true,
    score,
    scoreDisplay: `${score}`,
    percentageDisplay: `${score}%`,
    ...tier,
  };
}

/**
 * Skill Score Classification System for Intervexa AI.
 * 
 * Classification Thresholds:
 *  - 80–100%: Excellent — Green (#16A34A)
 *  - 60–79%:  Good — Blue (#2563EB)
 *  - 40–59%:  Needs Improvement — Orange (#D97706)
 *  - 0–39%:   Poor — Red (#DC2626)
 *  - Not Evaluated Yet: Grey (#64748B)
 */
export const SKILL_TIERS = {
  EXCELLENT: {
    category: "Excellent",
    label: "Excellent",
    minScore: 80,
    maxScore: 100,
    color: "#16A34A",
    bg: "rgba(22, 163, 74, 0.12)",
    border: "rgba(22, 163, 74, 0.28)",
    badge: "Excellent",
  },
  GOOD: {
    category: "Good",
    label: "Good",
    minScore: 60,
    maxScore: 79,
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(37, 99, 235, 0.28)",
    badge: "Good",
  },
  NEEDS_IMPROVEMENT: {
    category: "Needs Improvement",
    label: "Needs Improvement",
    minScore: 40,
    maxScore: 59,
    color: "#D97706",
    bg: "rgba(217, 119, 6, 0.12)",
    border: "rgba(217, 119, 6, 0.28)",
    badge: "Needs Improvement",
  },
  POOR: {
    category: "Poor",
    label: "Poor",
    minScore: 0,
    maxScore: 39,
    color: "#DC2626",
    bg: "rgba(220, 38, 38, 0.12)",
    border: "rgba(220, 38, 38, 0.28)",
    badge: "Poor",
  },
  NOT_EVALUATED: {
    category: "Not Evaluated Yet",
    label: "Not Evaluated Yet",
    minScore: null,
    maxScore: null,
    color: "#64748B",
    bg: "rgba(100, 116, 139, 0.12)",
    border: "rgba(100, 116, 139, 0.25)",
    badge: "Not Evaluated Yet",
  },
};

/**
 * Classifies an evaluated or unevaluated skill score into standard deterministic categories.
 * 
 * @param {number|string|null|undefined} rawScore - Numerical percentage (0-100) or score
 * @param {boolean} [isEvaluated=true] - Whether questions have been evaluated for this skill
 * @param {number} [count=0] - Number of questions evaluated for this skill
 * @returns {object} Classification result with score, category, label, colors, and badge.
 */
export function classifySkillScore(rawScore, isEvaluated = true, count = 0) {
  // Check if explicitly unrated
  if (isEvaluated === false) {
    return {
      isValid: false,
      isEvaluated: false,
      score: null,
      scoreDisplay: "—",
      percentageDisplay: "Not evaluated yet",
      count: 0,
      ...SKILL_TIERS.NOT_EVALUATED,
    };
  }

  // Guard against missing, null, undefined, or empty values
  if (
    rawScore === null ||
    rawScore === undefined ||
    rawScore === "" ||
    rawScore === "Not evaluated yet" ||
    (typeof rawScore === "string" && rawScore.trim() === "")
  ) {
    return {
      isValid: false,
      isEvaluated: false,
      score: null,
      scoreDisplay: "—",
      percentageDisplay: "Not evaluated yet",
      count: count || 0,
      ...SKILL_TIERS.NOT_EVALUATED,
    };
  }

  const num = Number(rawScore);
  if (isNaN(num)) {
    return {
      isValid: false,
      isEvaluated: false,
      score: null,
      scoreDisplay: "—",
      percentageDisplay: "Not evaluated yet",
      count: count || 0,
      ...SKILL_TIERS.NOT_EVALUATED,
    };
  }

  // Clamp score between 0 and 100
  const score = Math.max(0, Math.min(100, Math.round(num)));

  let tier = SKILL_TIERS.POOR;
  if (score >= 80) {
    tier = SKILL_TIERS.EXCELLENT;
  } else if (score >= 60) {
    tier = SKILL_TIERS.GOOD;
  } else if (score >= 40) {
    tier = SKILL_TIERS.NEEDS_IMPROVEMENT;
  } else {
    tier = SKILL_TIERS.POOR;
  }

  return {
    isValid: true,
    isEvaluated: true,
    score,
    scoreDisplay: `${score}%`,
    percentageDisplay: `${score}%`,
    count: count || 0,
    ...tier,
  };
}

export default classifyAtsScore;
