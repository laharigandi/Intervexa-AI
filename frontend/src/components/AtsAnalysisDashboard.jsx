import React, { useMemo, useState } from "react";
import { classifyAtsScore } from "../utils/atsScoreClassification";
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconSparkles,
  IconSearch,
  IconBriefcase,
  IconFileText,
  IconTarget,
  IconTrendingUp,
  IconChevronDown,
  IconChevronRight,
  IconAward,
} from "./Icons";

// Common technical skills to highlight in text bullets
const TECH_KEYWORDS = [
  "React", "Node.js", "Python", "JavaScript", "TypeScript", "AWS", "Docker",
  "Kubernetes", "SQL", "NoSQL", "MongoDB", "PostgreSQL", "Git", "REST APIs",
  "GraphQL", "CI/CD", "Java", "Spring Boot", "Microservices", "HTML", "CSS",
  "Next.js", "Redux", "Express", "FastAPI", "Django", "Tailwind", "Linux",
  "C++", "C#", "Go", "Golang", "Jest", "PyTest", "Cypress", "Selenium",
  "Kafka", "RabbitMQ", "Redis", "Terraform", "GCP", "Azure", "DSA", "OOP",
];

// Action verbs to highlight in recommendations
const ACTION_VERBS = [
  "Add", "Include", "Highlight", "Quantify", "Incorporate", "Specify",
  "Improve", "Ensure", "Optimize", "Demonstrate", "Update", "Structure",
  "Tailor", "Focus", "Refactor", "Emphasize", "Showcase", "Expand",
  "Rephrase", "Integrate", "Mention", "Provide", "Feature", "Detail",
];

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBulletPoints(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((s) => (s !== null && s !== undefined ? String(s).trim() : ""))
      .filter((s) => s.length > 2);
  }
  if (typeof input !== "string") return [String(input)];

  try {
    const rawLines = input.split(/\r?\n+|(?<=[.!?])\s+(?=[A-Z0-9•\-\*])/);
    const cleaned = [];

    for (let line of rawLines) {
      if (!line) continue;
      const stripped = line.replace(/^[\s•\-\*\d\.\)\:]+/, "").trim();
      if (stripped.length > 2) {
        cleaned.push(stripped);
      }
    }

    return cleaned.length > 0 ? cleaned : [input.trim()];
  } catch {
    return [String(input).trim()];
  }
}

function extractSkillTokens(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map((s) => (s !== null && s !== undefined ? String(s).trim() : ""))
          .filter(Boolean)
      )
    );
  }
  if (typeof input !== "string") return [];

  try {
    const tokens = input
      .split(/[,;\n•\-\*]+/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((s) => s.length > 1 && !s.toLowerCase().startsWith("e.g."));

    return Array.from(new Set(tokens));
  } catch {
    return [];
  }
}

function parseActionItems(input) {
  if (!input) return [];
  const points = parseBulletPoints(input);
  if (!Array.isArray(points)) return [];

  return points.map((point) => {
    if (!point || typeof point !== "string") {
      return { highlight: "", text: String(point || "") };
    }
    const trimmed = point.trim();
    try {
      for (const verb of ACTION_VERBS) {
        const regex = new RegExp(`^(${escapeRegExp(verb)}\\b[^:.,-]*[:.,-]?)`, "i");
        const match = trimmed.match(regex);
        if (match) {
          return {
            highlight: match[1],
            text: trimmed.slice(match[1].length).replace(/^[:\s-]+/, " ").trim(),
          };
        }
      }
      const firstWordMatch = trimmed.match(/^([A-Z][a-z]+(?:\s+[a-z]+)?[:,-]?)/);
      if (firstWordMatch && firstWordMatch[1].length < 24) {
        return {
          highlight: firstWordMatch[1],
          text: trimmed.slice(firstWordMatch[1].length).replace(/^[:\s-]+/, " ").trim(),
        };
      }
    } catch {
      // fallback
    }
    return { highlight: "", text: trimmed };
  });
}

function renderHighlightedText(text) {
  if (!text || typeof text !== "string") return text || null;

  try {
    const sortedKeywords = [...TECH_KEYWORDS].sort((a, b) => b.length - a.length);
    const escaped = sortedKeywords.map(escapeRegExp).join("|");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      const isKeyword = TECH_KEYWORDS.some(
        (kw) => kw.toLowerCase() === part.toLowerCase()
      );

      if (isKeyword) {
        return (
          <span
            key={idx}
            style={{
              background: "var(--primary-light)",
              color: "var(--primary)",
              border: "1px solid var(--primary-border)",
              padding: "1px 6px",
              borderRadius: "4px",
              fontWeight: 700,
              fontSize: "12px",
              margin: "0 2px",
              display: "inline-block",
              lineHeight: 1.3,
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  } catch {
    return text;
  }
}

// Format summary into strictly 2-3 concise, meaningful sentences
function formatConciseSummary(rawSummary) {
  if (!rawSummary || typeof rawSummary !== "string") return "";
  const cleaned = rawSummary.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  const sentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length === 0) return cleaned;
  return sentences.slice(0, 3).join(" ");
}

// Shorten bullet point to a crisp, punchy sentence
function shortenBullet(text, maxChars = 145) {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const firstSentenceMatch = trimmed.match(/^([^.!?]+[.!?])/);
  if (firstSentenceMatch && firstSentenceMatch[1].length >= 35 && firstSentenceMatch[1].length <= maxChars) {
    return firstSentenceMatch[1].trim();
  }
  const truncated = trimmed.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

function AtsAnalysisDashboard({ analysis, skills = [], jdMatchResult = null }) {
  if (!analysis || typeof analysis !== "object") return null;

  const [showFactors, setShowFactors] = useState(true);

  const atsScore = Math.max(0, Math.min(100, Math.round(Number(analysis.ats_score) || 0)));
  const classification = useMemo(() => {
    return classifyAtsScore(Number(analysis.ats_score));
  }, [analysis?.ats_score]);

  const isJdProvided = Boolean(analysis.target_jd_provided || (jdMatchResult && jdMatchResult.available));

  const scoreLabel = analysis.score_label || (isJdProvided ? "Job-Specific ATS Match Score" : "General Resume Quality Score");
  const scoreDescription = analysis.score_description || (
    isJdProvided
      ? "Evaluated against target job requirements, skills, and expectations."
      : "Benchmark of keyword depth, structure, metrics, and readability."
  );

  // Extracted skills
  const extractedSkillsList = useMemo(() => {
    if (Array.isArray(skills) && skills.length > 0) {
      return Array.from(new Set(skills.map((s) => String(s).trim()).filter(Boolean)));
    }
    return [];
  }, [skills]);

  // Matched skills from JD
  const matchedSkillsList = useMemo(() => {
    if (jdMatchResult && Array.isArray(jdMatchResult.matching_skills) && jdMatchResult.matching_skills.length > 0) {
      return Array.from(new Set(jdMatchResult.matching_skills.map((s) => String(s).trim()).filter(Boolean)));
    }
    if (analysis.matched_skills && Array.isArray(analysis.matched_skills) && analysis.matched_skills.length > 0) {
      return Array.from(new Set(analysis.matched_skills.map((s) => String(s).trim()).filter(Boolean)));
    }
    return [];
  }, [jdMatchResult, analysis.matched_skills]);

  // Missing skills from JD
  const missingSkillsList = useMemo(() => {
    if (jdMatchResult && Array.isArray(jdMatchResult.missing_skills) && jdMatchResult.missing_skills.length > 0) {
      return Array.from(new Set(jdMatchResult.missing_skills.map((s) => String(s).trim()).filter(Boolean)));
    }
    return [];
  }, [jdMatchResult]);

  // Recommended skills from ATS analysis
  const rawMissingSkills = useMemo(() => extractSkillTokens(analysis.missing_skills), [analysis.missing_skills]);
  const filteredMissingSkills = useMemo(() => {
    const extractedLower = new Set(extractedSkillsList.map((s) => s.toLowerCase()));
    return rawMissingSkills.filter((s) => !extractedLower.has(s.toLowerCase()));
  }, [rawMissingSkills, extractedSkillsList]);

  // Strengths & Improvements
  const strengthsList = useMemo(() => parseBulletPoints(analysis.strengths), [analysis.strengths]);
  const weaknessesList = useMemo(() => parseBulletPoints(analysis.weaknesses), [analysis.weaknesses]);
  const actionItems = useMemo(() => parseActionItems(analysis.suggestions), [analysis.suggestions]);

  // Summary & Feedback
  const summaryText = typeof analysis.summary === "string" ? analysis.summary.trim() : "";
  const conciseSummary = useMemo(() => formatConciseSummary(summaryText), [summaryText]);
  const skillsAnalysisText = typeof analysis.skills_analysis === "string" ? analysis.skills_analysis.trim() : "";

  const projectFeedbackList = useMemo(() => {
    if (analysis.project_experience_feedback) {
      return parseBulletPoints(analysis.project_experience_feedback);
    }
    return [];
  }, [analysis.project_experience_feedback]);

  const explicitActionItems = useMemo(() => {
    if (analysis.action_items) {
      return parseBulletPoints(analysis.action_items);
    }
    return [];
  }, [analysis.action_items]);

  // Combined improvements
  const combinedImprovements = useMemo(() => {
    const items = [];
    weaknessesList.forEach((w) => items.push({ type: "weakness", text: w }));
    actionItems.forEach((a) => items.push({ type: "suggestion", highlight: a.highlight, text: a.text }));
    return items;
  }, [weaknessesList, actionItems]);

  // SVG Circular Gauge calculation
  const circleRadius = 26;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(atsScore, 0), 100) / 100);

  const factorItems = analysis.factors || analysis.factor_breakdown || [];

  return (
    <section className="resume-analysis-results-section" aria-label="Resume Analysis Results" style={{ marginBottom: 20 }}>
      {/* =========================================================================
          1. TOP KPI METRICS GRID (Compact, Prominent, Balanced)
          ========================================================================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Card 1: ATS Compatibility Score */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: `1px solid ${classification.border}`,
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 10,
            position: "relative",
            overflow: "hidden",
            flex: "1 1 min(100%, 320px)",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ATS Score
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: classification.color,
                background: classification.bg,
                border: `1px solid ${classification.border}`,
                padding: "2px 7px",
                borderRadius: 9999,
                transition: "all 0.4s ease",
              }}
            >
              {classification.badge}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* SVG Circular Gauge */}
            <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
              <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
                <circle
                  cx={28}
                  cy={28}
                  r={circleRadius}
                  fill="transparent"
                  stroke="var(--border-color)"
                  strokeWidth={4.5}
                />
                <circle
                  cx={28}
                  cy={28}
                  r={circleRadius}
                  fill="transparent"
                  stroke={classification.color}
                  strokeWidth={4.5}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{
                    transition: "stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease",
                  }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: classification.color,
                    lineHeight: 1,
                    transition: "color 0.4s ease",
                  }}
                >
                  {atsScore}
                </span>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
                  {atsScore}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
                  / 100
                </span>
              </div>
              <p style={{ margin: "3px 0 0 0", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.3 }}>
                {classification.category} compatibility
              </p>
            </div>
          </div>

          {/* Quick Progress Indicator */}
          <div style={{ width: "100%", background: "var(--bg-secondary)", borderRadius: 9999, height: 5, overflow: "hidden" }}>
            <div
              style={{
                width: `${atsScore}%`,
                height: "100%",
                background: classification.color,
                borderRadius: 9999,
                transition: "width 0.8s ease, background 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Card 2: Skills Found */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Skills Found
            </span>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "var(--primary-light)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSearch size={14} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
              {extractedSkillsList.length}
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              Technical skills verified
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", background: "var(--primary-light)", border: "1px solid var(--primary-border)", padding: "2px 7px", borderRadius: 9999 }}>
              ✓ Verified in Resume
            </span>
          </div>
        </div>

        {/* Card 3: Matched Skills */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Matched Skills
            </span>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: isJdProvided ? "rgba(22, 163, 74, 0.1)" : "var(--primary-light)",
                color: isJdProvided ? "var(--success, #16A34A)" : "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCheckCircle size={14} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
              {isJdProvided ? matchedSkillsList.length : "—"}
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              {isJdProvided
                ? `${jdMatchResult?.match_score ?? 0}% requirement match`
                : "Add target JD below to evaluate"}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isJdProvided ? "var(--success, #16A34A)" : "var(--text-muted)",
                background: isJdProvided ? "rgba(22, 163, 74, 0.1)" : "var(--bg-secondary)",
                border: `1px solid ${isJdProvided ? "rgba(22, 163, 74, 0.25)" : "var(--border-color)"}`,
                padding: "2px 7px",
                borderRadius: 9999,
              }}
            >
              {isJdProvided ? `✓ ${matchedSkillsList.length} Matched` : "Optional Target JD"}
            </span>
          </div>
        </div>

        {/* Card 4: Missing & Recommended Skills */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Missing & Recommended
            </span>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "rgba(245, 158, 11, 0.1)",
                color: "var(--warning, #F59E0B)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconAlertTriangle size={14} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-main)", lineHeight: 1 }}>
              {isJdProvided ? missingSkillsList.length : filteredMissingSkills.length}
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              {isJdProvided ? "Missing JD keywords" : "Placement keywords to add"}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--warning, #D97706)", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: "2px 7px", borderRadius: 9999 }}>
              + Opportunities
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. SIMPLE RESUME SUMMARY (2-3 Important Sentences)
          ========================================================================= */}
      {conciseSummary && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderLeft: "3.5px solid var(--primary)",
            borderRadius: 10,
            padding: "13px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "var(--primary-light)",
              border: "1px solid var(--primary-border)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <IconSparkles size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                Resume Summary
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", border: "1px solid var(--primary-border)", padding: "1px 7px", borderRadius: 9999 }}>
                AI Executive Overview
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {renderHighlightedText(conciseSummary)}
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. SKILLS & COMPETENCIES (Extracted Skills & Competencies, Matched, Missing, Recommended)
          ========================================================================= */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "var(--primary-light)",
                border: "1px solid var(--primary-border)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconSearch size={14} />
            </div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
              Extracted Skills & Competencies
            </h2>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {extractedSkillsList.length} skills identified
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {/* Card A: Skills Found */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Skills Found ({extractedSkillsList.length})
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", padding: "1px 6px", borderRadius: 9999 }}>
                Verified
              </span>
            </div>
            {extractedSkillsList.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {extractedSkillsList.map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                      border: "1px solid var(--primary-border)",
                      padding: "3px 9px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>✓</span>
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                No technical skills detected.
              </p>
            )}
          </div>

          {/* Card B: Matched Skills & Missing Skills */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {isJdProvided ? "Matched & Missing Skills" : "Job Match Alignment"}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: isJdProvided ? "var(--success)" : "var(--text-muted)", background: isJdProvided ? "rgba(22, 163, 74, 0.1)" : "var(--bg-secondary)", padding: "1px 6px", borderRadius: 9999 }}>
                {isJdProvided ? `${matchedSkillsList.length} Matched` : "Target JD"}
              </span>
            </div>

            {isJdProvided ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {matchedSkillsList.length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--success, #16A34A)", display: "block", marginBottom: 5 }}>
                      ✓ Matched Skills ({matchedSkillsList.length})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {matchedSkillsList.map((skill, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: "rgba(22, 163, 74, 0.08)",
                            color: "var(--success, #16A34A)",
                            border: "1px solid rgba(22, 163, 74, 0.25)",
                            padding: "3px 8px",
                            borderRadius: 9999,
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          ✓ {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {missingSkillsList.length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--warning, #D97706)", display: "block", marginBottom: 5 }}>
                      ✕ Missing Skills ({missingSkillsList.length})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {missingSkillsList.map((skill, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: "var(--bg-surface)",
                            color: "var(--text-secondary)",
                            border: "1.5px dashed var(--border-color)",
                            padding: "3px 8px",
                            borderRadius: 9999,
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          ✕ {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p style={{ margin: "0 0 8px 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  Add a target Job Description in the section below to evaluate direct keyword matches and skill gaps.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {extractedSkillsList.slice(0, 4).map((s, i) => (
                    <span key={i} style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "2px 6px", borderRadius: 4 }}>
                      • {s}
                    </span>
                  ))}
                  {extractedSkillsList.length > 4 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 4px" }}>
                      +{extractedSkillsList.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card C: Recommended Skills */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Recommended Skills ({filteredMissingSkills.length})
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", padding: "1px 6px", borderRadius: 9999 }}>
                + High Yield
              </span>
            </div>
            {filteredMissingSkills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {filteredMissingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--primary)",
                      border: "1.5px dashed var(--primary-border)",
                      padding: "3px 9px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>+</span>
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                Comprehensive skill coverage detected for your domain.
              </p>
            )}
          </div>
        </div>

        {/* Short Technical Stack Note */}
        {skillsAnalysisText && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              fontSize: 12.5,
              color: "var(--text-secondary)",
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: "var(--text-main)", marginRight: 5 }}>Technical Stack Depth:</strong>
            {shortenBullet(skillsAnalysisText, 180)}
          </div>
        )}
      </div>

      {/* =========================================================================
          4. STRENGTHS & AREAS FOR IMPROVEMENT (2-Column Responsive Grid)
          ========================================================================= */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "var(--primary-light)",
                border: "1px solid var(--primary-border)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconCheckCircle size={14} />
            </div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
              Evaluation Breakdown
            </h2>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Strengths & actionable adjustments
          </span>
        </div>

        <div className="ats-strengths-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {/* Column 1: Strengths */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IconCheckCircle size={15} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
                  Resume Strengths
                </h3>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 9999,
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  border: "1px solid var(--primary-border)",
                }}
              >
                {strengthsList.length} Evidenced
              </span>
            </div>

            <div style={{ flex: 1 }}>
              {strengthsList.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {strengthsList.slice(0, 5).map((strength, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        color: "var(--text-main)",
                      }}
                    >
                      <span
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: "50%",
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9.5,
                          fontWeight: 800,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        ✓
                      </span>
                      <span style={{ flex: 1 }}>
                        {renderHighlightedText(shortenBullet(strength))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                  No distinct strengths extracted.
                </p>
              )}
            </div>
          </div>

          {/* Column 2: Areas for Improvement & Suggestions */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IconAlertTriangle size={15} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
                  Areas for Improvement
                </h3>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 9999,
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  border: "1px solid var(--primary-border)",
                }}
              >
                {combinedImprovements.length} Suggestions
              </span>
            </div>

            <div style={{ flex: 1 }}>
              {combinedImprovements.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {combinedImprovements.slice(0, 5).map((item, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        color: "var(--text-main)",
                      }}
                    >
                      <span
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: "50%",
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9.5,
                          fontWeight: 800,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ flex: 1 }}>
                        {item.highlight && (
                          <strong style={{ color: "var(--primary)", marginRight: 4 }}>
                            {item.highlight}
                          </strong>
                        )}
                        {shortenBullet(item.text)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                  No critical weaknesses detected.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. EDUCATION & WORK EXPERIENCE QUICK OVERVIEW (Compact Grid)
          ========================================================================= */}
      {analysis?.candidate_profile && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {/* Education Summary */}
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}>
                  🎓 Education & Credentials
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--text-secondary)" }}>
                {analysis.candidate_profile.education?.degrees?.length > 0 && (
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>Degree:</strong> {analysis.candidate_profile.education.degrees.join(", ")}
                    {analysis.candidate_profile.education.fields_of_study?.length > 0 && ` in ${analysis.candidate_profile.education.fields_of_study.join(", ")}`}
                  </div>
                )}
                {analysis.candidate_profile.education?.institutions?.length > 0 && (
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>Institution:</strong> {analysis.candidate_profile.education.institutions.join(", ")}
                  </div>
                )}
                {!analysis.candidate_profile.education?.degrees?.length && (
                  <div>Standard academic credentials verified via factor analysis.</div>
                )}
              </div>
            </div>

            {/* Experience Summary */}
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}>
                  💼 Experience & Seniority
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--text-secondary)" }}>
                <div>
                  <strong style={{ color: "var(--text-main)" }}>Seniority:</strong>{" "}
                  <span style={{ fontWeight: 600, color: "var(--primary)" }}>
                    {analysis.candidate_profile.experience?.seniority_level || "Entry / Associate"}
                  </span>
                  {" • "}
                  <span>{analysis.candidate_profile.experience?.quantifiable_metrics_count || 0} business metrics</span>
                </div>
                {analysis.candidate_profile.certifications?.length > 0 && (
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>Certs:</strong> {analysis.candidate_profile.certifications.join(", ")}
                  </div>
                )}
                {projectFeedbackList.length > 0 && (
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>Project Feedback:</strong> {shortenBullet(projectFeedbackList[0], 120)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. PRIORITIZED ACTION PLAN (AI Recommendations)
          ========================================================================= */}
      {explicitActionItems.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <IconTrendingUp size={15} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--text-main)" }}>
                Prioritized Action Plan
              </h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              {explicitActionItems.slice(0, 3).map((action, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: "var(--text-main)",
                  }}
                >
                  <span
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: "50%",
                      background: "var(--primary)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span>{shortenBullet(action, 130)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. ATS SCORING FACTORS & EXPLAINABILITY (Compact Collapsible)
          ========================================================================= */}
      {factorItems.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowFactors(!showFactors)}
            style={{
              width: "100%",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              color: "var(--text-main)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconAward size={15} color="var(--primary)" />
              <span>ATS Scoring Factors & Explainability ({factorItems.length} Factors)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 12 }}>
              <span>{showFactors ? "Hide Breakdown" : "View Breakdown"}</span>
              {showFactors ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </div>
          </button>

          {showFactors && (
            <div
              style={{
                marginTop: 8,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {factorItems.map((factor, idx) => {
                const rawAwarded = factor.awarded_points !== undefined && factor.awarded_points !== null
                  ? factor.awarded_points
                  : (factor.score !== undefined && factor.score !== null ? factor.score : null);

                const isNotEvaluated = factor.not_evaluated === true || factor.status === "not_evaluated" || rawAwarded === null;
                const awarded = isNotEvaluated ? null : Number(rawAwarded);
                const max = Number(factor.max_points || factor.max_score || 20);
                const pct = isNotEvaluated || isNaN(awarded) || max <= 0
                  ? 0
                  : Math.round((Math.max(0, Math.min(max, awarded)) / max) * 100);

                const factorColor = isNotEvaluated
                  ? "#64748B"
                  : pct >= 80
                  ? "#16A34A"
                  : pct >= 60
                  ? "#2563EB"
                  : pct >= 40
                  ? "#D97706"
                  : "#DC2626";

                const descriptionText = factor.description || factor.details || "";

                return (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}>
                        {factor.name}
                      </span>
                      {isNotEvaluated ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B" }}>
                          Not evaluated
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: factorColor }}>
                          {awarded} / {max} pts ({pct}%)
                        </span>
                      )}
                    </div>
                    <div style={{ width: "100%", background: "var(--border-color)", borderRadius: 9999, height: 4, overflow: "hidden", marginBottom: 6 }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: factorColor,
                          borderRadius: 9999,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    {descriptionText ? (
                      <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.35 }}>
                        {descriptionText}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .ats-strengths-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

export default AtsAnalysisDashboard;
