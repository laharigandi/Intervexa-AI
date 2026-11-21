import React from "react";
import theme from "../styles/theme";
import { IconSparkles, IconVolume2 } from "./Icons";

/**
 * QuestionCard
 * Clean, distraction-free container for presenting interview questions.
 */
function QuestionCard({
  index = 1,
  total = 10,
  question = "",
  topic,
  difficulty,
  onSpeak,
  isSpeaking = false,
  className = "",
}) {
  const getDifficultyPill = () => {
    if (!difficulty) return null;
    const d = String(difficulty).toLowerCase();
    const map = {
      easy: { bg: "var(--success-light)", text: "var(--success)", border: "var(--success-border)" },
      medium: { bg: "var(--primary-light)", text: "var(--primary)", border: "var(--primary-border)" },
      hard: { bg: "var(--accent-light)", text: "var(--accent)", border: "var(--accent-border)" },
    };
    const style = map[d] || map.medium;
    return (
      <span
        style={{
          background: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          padding: "3px 10px",
          borderRadius: theme.radius.full,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {difficulty}
      </span>
    );
  };

  return (
    <div
      className={`app-question-card ${className}`}
      style={{
        background: "var(--bg-surface)",
        borderRadius: "14px",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-card)",
        padding: "20px 24px",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
        animation: "fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Brand Purple Top Accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3.5px",
          background: "linear-gradient(90deg, var(--primary), #B89EFF)",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: theme.gradientPrimary,
              color: "#ffffff",
              padding: "4px 12px",
              borderRadius: theme.radius.full,
              fontSize: 12,
              fontWeight: 700,
              boxShadow: "0 2px 6px var(--primary-glow)",
            }}
          >
            Question {index} of {total}
          </span>
          {topic && (
            <span
              style={{
                background: theme.primaryLight,
                color: theme.primary,
                border: `1px solid ${theme.primaryBorder}`,
                padding: "3px 10px",
                borderRadius: theme.radius.full,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {topic}
            </span>
          )}
          {getDifficultyPill()}
        </div>

        {onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: isSpeaking ? theme.primaryLight : "var(--bg-surface)",
              color: isSpeaking ? theme.primary : theme.textSecondary,
              border: `1px solid ${isSpeaking ? theme.primaryBorder : theme.border}`,
              padding: "4px 11px",
              borderRadius: theme.radius.full,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title={isSpeaking ? "Stop reading" : "Read question aloud"}
          >
            <IconVolume2 size={14} color={isSpeaking ? theme.primary : theme.muted} />
            <span>{isSpeaking ? "Speaking..." : "Listen"}</span>
          </button>
        )}
      </div>

      <h3
        style={{
          margin: 0,
          fontSize: "clamp(16px, 1.8vw, 19px)",
          fontWeight: 700,
          color: theme.text,
          lineHeight: 1.5,
          letterSpacing: "-0.015em",
        }}
      >
        {question}
      </h3>
    </div>
  );
}

export default QuestionCard;
