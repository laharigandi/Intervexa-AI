import React from "react";
import Card from "./Card";
import Button from "./Button";
import theme from "../styles/theme";
import { classifyAtsScore } from "../utils/atsScoreClassification";
import {
  IconFileText,
  IconUpload,
  IconCheckCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconSparkles,
  IconTrash,
} from "./Icons";

export default function ResumeDashboardSection({
  hasActiveResume,
  activeResumeId,
  resumeFileName,
  resumeAnalysis,
  skills = [],
  jdMatchResult,
  onUploadClick,
  onRemoveResume,
}) {
  // If no resume is currently active, render the clean empty state
  if (!hasActiveResume || !resumeAnalysis) {
    return (
      <Card
        title="ATS Resume Score & Analysis"
        subtitle="ATS compatibility and skills analysis."
        icon={IconFileText}
        style={{
          border: `1px solid ${theme.border}`,
          background: "var(--card-bg)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "38px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: "rgba(16, 185, 129, 0.12)",
              color: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              boxShadow: "0 4px 16px rgba(16, 185, 129, 0.15)",
            }}
          >
            <IconUpload size={26} />
          </div>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 700,
              margin: "0 0 6px 0",
              color: theme.text,
            }}
          >
            No Active Resume Uploaded
          </h3>
          <p
            style={{
              color: theme.textSecondary,
              fontSize: 13.5,
              maxWidth: 460,
              margin: "0 auto 20px auto",
              lineHeight: 1.55,
            }}
          >
            Upload your resume to view your ATS score and personalized analysis.
          </p>
          <Button variant="primary" onClick={onUploadClick} icon={IconUpload} pill>
            Upload Resume
          </Button>
        </div>
      </Card>
    );
  }

  // Active Resume: extract metrics strictly from the active resume analysis using standard classification
  const classification = classifyAtsScore(resumeAnalysis?.ats_score);
  const atsScore = classification.score ?? 0;
  const tier = classification;
  const jdScore = jdMatchResult?.match_score ?? null;

  // Extract strengths, weaknesses, and missing skills safely
  const strengths = Array.isArray(resumeAnalysis.strengths)
    ? resumeAnalysis.strengths
    : Array.isArray(resumeAnalysis.formatting_positives)
    ? resumeAnalysis.formatting_positives
    : [];

  const weaknesses = Array.isArray(resumeAnalysis.weaknesses)
    ? resumeAnalysis.weaknesses
    : Array.isArray(resumeAnalysis.actionable_recommendations)
    ? resumeAnalysis.actionable_recommendations
    : [];

  const missingSkills = Array.isArray(resumeAnalysis.missing_skills)
    ? resumeAnalysis.missing_skills
    : Array.isArray(jdMatchResult?.missing_skills)
    ? jdMatchResult.missing_skills
    : [];

  const activeSkillsList = Array.isArray(skills) && skills.length > 0 ? skills : [];

  return (
    <Card
      title="Resume ATS Score & Analysis"
      subtitle={`ATS benchmark for ${resumeFileName || "your uploaded resume"}`}
      icon={IconFileText}
      style={{
        border: `1px solid ${theme.border}`,
        background: "var(--card-bg)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Top Summary Banner */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: theme.radius.md,
            background: `linear-gradient(135deg, ${tier.bg} 0%, rgba(59, 130, 246, 0.04) 100%)`,
            border: `1px solid ${tier.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14,
            transition: "all 0.4s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Score Pill / Circle */}
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: tier.bg,
                border: `2px solid ${tier.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: tier.color,
                fontWeight: 800,
                flexShrink: 0,
                transition: "all 0.4s ease",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 800 }}>{tier.percentageDisplay}</span>
              <span style={{ fontSize: 8.5, opacity: 0.85, textTransform: "uppercase", marginTop: 2 }}>ATS</span>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: theme.radius.full,
                    background: tier.bg,
                    color: tier.color,
                    border: `1px solid ${tier.border}`,
                  }}
                >
                  {tier.label}
                </span>
                {jdScore !== null && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: theme.radius.full,
                      background: "rgba(113, 56, 245, 0.12)",
                      color: theme.accent,
                      border: "1px solid rgba(113, 56, 245, 0.25)",
                    }}
                  >
                    JD Match: {jdScore}%
                  </span>
                )}
              </div>
              <h4 style={{ margin: "0 0 2px 0", fontSize: 16, fontWeight: 700, color: theme.text }}>
                {resumeFileName}
              </h4>
              <span style={{ fontSize: 12, color: theme.muted }}>
                Strictly active resume reference • {activeSkillsList.length} skills identified
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={onRemoveResume} icon={IconTrash} title="Remove this resume">
              Remove
            </Button>
            <Button variant="primary" size="sm" onClick={onUploadClick} icon={IconArrowRight} pill>
              Full ATS Report
            </Button>
          </div>
        </div>

        {/* 2-column or 3-column analysis details */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {/* Extracted Skills */}
          <div
            style={{
              background: "var(--bg-secondary)",
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              padding: "14px 16px",
            }}
          >
            <strong
              style={{
                fontSize: 12,
                color: theme.primary,
                textTransform: "uppercase",
                display: "block",
                marginBottom: 10,
                letterSpacing: "0.04em",
              }}
            >
              ✓ Extracted Resume Skills ({activeSkillsList.length})
            </strong>
            {activeSkillsList.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activeSkillsList.slice(0, 10).map((skill, sIdx) => (
                  <span
                    key={sIdx}
                    style={{
                      background: "var(--card-bg)",
                      color: theme.text,
                      border: `1px solid ${theme.border}`,
                      padding: "3px 9px",
                      borderRadius: theme.radius.full,
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    {skill}
                  </span>
                ))}
                {activeSkillsList.length > 10 && (
                  <span style={{ fontSize: 11, color: theme.muted, alignSelf: "center" }}>
                    +{activeSkillsList.length - 10} more
                  </span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: theme.muted }}>No specific skills extracted.</span>
            )}
          </div>

          {/* Missing Skills / Keyword Gaps */}
          <div
            style={{
              background: theme.warningLight,
              border: `1px solid ${theme.warningBorder}`,
              borderRadius: theme.radius.sm,
              padding: "14px 16px",
            }}
          >
            <strong
              style={{
                fontSize: 12,
                color: theme.warning,
                textTransform: "uppercase",
                display: "block",
                marginBottom: 10,
                letterSpacing: "0.04em",
              }}
            >
              ⚠ Missing Keywords & Gaps
            </strong>
            {missingSkills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {missingSkills.slice(0, 8).map((ms, msIdx) => (
                  <span
                    key={msIdx}
                    style={{
                      background: "var(--card-bg)",
                      color: theme.warning,
                      border: `1px solid ${theme.warningBorder}`,
                      padding: "3px 9px",
                      borderRadius: theme.radius.full,
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    {typeof ms === "object" ? ms.skill || ms.name || JSON.stringify(ms) : ms}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: theme.muted }}>
                No critical keyword gaps identified for current track.
              </span>
            )}
          </div>

          {/* Key Strengths & Suggestions */}
          <div
            style={{
              background: "var(--bg-secondary)",
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              padding: "14px 16px",
            }}
          >
            <strong
              style={{
                fontSize: 12,
                color: theme.success,
                textTransform: "uppercase",
                display: "block",
                marginBottom: 10,
                letterSpacing: "0.04em",
              }}
            >
              ★ Resume Strengths & Highlights
            </strong>
            {strengths.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                {strengths.slice(0, 3).map((st, stIdx) => (
                  <li key={stIdx} style={{ marginBottom: 4 }}>
                    {typeof st === "object" ? st.text || st.name || JSON.stringify(st) : st}
                  </li>
                ))}
              </ul>
            ) : (
              <span style={{ fontSize: 12, color: theme.muted }}>
                Standard ATS formatting recognized.
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

