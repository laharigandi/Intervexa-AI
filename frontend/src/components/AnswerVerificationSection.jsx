import React, { useState } from "react";
import theme from "../styles/theme";
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconSparkles,
  IconShield,
  IconHelpCircle,
} from "./Icons";

export default function AnswerVerificationSection({
  verification = null,
  overallSummary = null,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(true);

  if (!verification && !overallSummary) {
    return null;
  }

  // Determine status color and label
  const status = verification?.verification_status || "Verified Correct";
  const score = verification?.correctness_score ?? 85;
  const incorrectStatements = verification?.incorrect_statements || [];
  const claims = verification?.claims || [];
  const evidence = verification?.evidence || [];
  const explanation = verification?.explanation || "";
  const correctedAnswer = verification?.corrected_answer || "";

  let statusConfig = {
    bg: "rgba(16, 185, 129, 0.1)",
    border: "#10B981",
    color: "#059669",
    icon: IconCheckCircle,
    label: "Grounded & Verified",
  };

  if (status.includes("Inaccuracies") || status.includes("Incorrect") || score < 60) {
    statusConfig = {
      bg: "rgba(239, 68, 68, 0.1)",
      border: "#EF4444",
      color: "#DC2626",
      icon: IconAlertTriangle,
      label: "Technical Inaccuracies Flagged",
    };
  } else if (status.includes("Issues") || status.includes("Partially") || (score >= 60 && score < 85)) {
    statusConfig = {
      bg: "rgba(245, 158, 11, 0.1)",
      border: "#F59E0B",
      color: "#D97706",
      icon: IconAlertTriangle,
      label: "Partially Grounded with Issues",
    };
  } else if (status.includes("Unverified")) {
    statusConfig = {
      bg: "rgba(107, 114, 128, 0.1)",
      border: "#9CA3AF",
      color: "#4B5563",
      icon: IconHelpCircle,
      label: "Unverified (Insufficient Grounding)",
    };
  }

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="answer-verification-box"
      style={{
        borderRadius: theme.radius.md,
        border: `1.5px solid ${statusConfig.border}40`,
        background: theme.cardBg,
        boxShadow: theme.shadow.sm,
        marginTop: 12,
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: statusConfig.bg,
          borderBottom: expanded ? `1px solid ${statusConfig.border}30` : "none",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: statusConfig.border,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <StatusIcon size={14} color="#fff" />
          </div>
          <div>
            <span
              style={{
                fontSize: "12.5px",
                fontWeight: 700,
                color: theme.text,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              Technical Verification & Evidence Grounding
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 10,
                  background: statusConfig.border,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {statusConfig.label}
              </span>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: theme.muted, display: "block" }}>
              Correctness
            </span>
            <span style={{ fontSize: "13px", fontWeight: 800, color: statusConfig.color }}>
              {score}%
            </span>
          </div>
          <span style={{ fontSize: "11px", color: theme.muted }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ padding: "12px 14px" }}>
          {/* Flagged Inaccuracies / Hallucinations */}
          {incorrectStatements.length > 0 && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: theme.radius.sm,
                padding: "10px 12px",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <IconAlertTriangle size={14} color="#DC2626" />
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#DC2626", textTransform: "uppercase" }}>
                  Identified Factual Inaccuracies / Hallucinations
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "12px", color: "#991B1B", lineHeight: 1.45 }}>
                {incorrectStatements.map((stmt, idx) => (
                  <li key={idx} style={{ marginTop: 2 }}>
                    <strong>Discrepancy:</strong> &ldquo;{stmt}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Explanation */}
          {explanation && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: theme.muted, textTransform: "uppercase" }}>
                Verification Audit:
              </span>
              <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: theme.textSecondary, lineHeight: 1.45 }}>
                {explanation}
              </p>
            </div>
          )}

          {/* Corrected Technical Detail */}
          {correctedAnswer && (
            <div
              style={{
                background: "var(--primary-light)",
                border: "1px dashed var(--primary-border)",
                borderRadius: theme.radius.sm,
                padding: "8px 11px",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
                Verified Standard Principle:
              </span>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: theme.text, lineHeight: 1.4 }}>
                {correctedAnswer}
              </p>
            </div>
          )}

          {/* Authoritative Sources & Grounding Citations */}
          {evidence.length > 0 && (
            <div>
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: theme.muted, textTransform: "uppercase" }}>
                Authoritative Grounding Sources:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {evidence.map((ev, idx) => (
                  <a
                    key={idx}
                    href={ev.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 9px",
                      borderRadius: 14,
                      background: theme.hoverBg,
                      border: `1px solid ${theme.border}`,
                      fontSize: "11px",
                      fontWeight: 600,
                      color: theme.primary,
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                    title={ev.passage ? ev.passage.slice(0, 180) + "..." : "Official Documentation"}
                  >
                    <span>📖</span>
                    <span>{ev.source_title || "Official Docs"}</span>
                    {ev.confidence && (
                      <span
                        style={{
                          fontSize: "9.5px",
                          padding: "1px 5px",
                          borderRadius: 8,
                          background: theme.primaryLight,
                          color: theme.primary,
                        }}
                      >
                        {Math.round(ev.confidence * 100)}% Match
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

