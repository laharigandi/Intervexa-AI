import React from "react";
import theme from "../styles/theme";

function SkillChip({ label, onRemove, variant = "primary" }) {
  const isSecondary = variant === "secondary";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: isSecondary ? "var(--bg-secondary)" : "var(--primary-light)",
        color: isSecondary ? theme.textSecondary : theme.primary,
        border: `1px solid ${isSecondary ? theme.border : theme.primaryBorder}`,
        padding: "5px 13px",
        borderRadius: theme.radius.full,
        fontSize: 13,
        fontWeight: 600,
        marginRight: 8,
        marginBottom: 8,
        boxShadow: "var(--shadow-sm)",
        transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className="skill-chip-pill"
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: "transparent",
            border: "none",
            color: theme.primary,
            cursor: "pointer",
            padding: "0 2px",
            fontSize: 15,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
          }}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export default SkillChip;
