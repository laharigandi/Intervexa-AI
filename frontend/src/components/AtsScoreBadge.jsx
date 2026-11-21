import React from "react";
import { classifyAtsScore } from "../utils/atsScoreClassification";

export default function AtsScoreBadge({
  score,
  size = "md",
  showLabel = true,
  showProgress = false,
  className = "",
  style = {},
}) {
  const classification = classifyAtsScore(score);

  if (!classification.isValid) {
    return (
      <span
        className={`ats-score-badge ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: size === "sm" ? 11 : size === "lg" ? 14 : 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          background: "var(--bg-secondary)",
          padding: size === "sm" ? "2px 8px" : "3px 10px",
          borderRadius: 9999,
          border: "1px solid var(--border-color)",
          ...style,
        }}
      >
        <span>Pending</span>
      </span>
    );
  }

  const isSmall = size === "sm";
  const isLarge = size === "lg";

  return (
    <div
      className={`ats-score-badge-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 6 : 8,
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: isSmall ? 11 : isLarge ? 13.5 : 12,
          fontWeight: 700,
          color: classification.color,
          background: classification.bg,
          border: `1px solid ${classification.border}`,
          padding: isSmall ? "2px 8px" : isLarge ? "4px 12px" : "3px 10px",
          borderRadius: 9999,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
          transition: "background 0.3s ease, border-color 0.3s ease, color 0.3s ease",
        }}
      >
        <span style={{ fontWeight: 800 }}>{classification.percentageDisplay}</span>
        {showLabel && (
          <>
            <span style={{ opacity: 0.5, fontSize: "0.85em" }}>•</span>
            <span>{classification.label}</span>
          </>
        )}
      </span>

      {showProgress && (
        <div
          style={{
            width: isSmall ? 40 : 60,
            height: 5,
            borderRadius: 3,
            background: "var(--bg-secondary)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: `${classification.score}%`,
              height: "100%",
              background: classification.color,
              borderRadius: 3,
              transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      )}
    </div>
  );
}
