import theme from "./theme";

export const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.border}`,
  background: "var(--bg-surface)",
  fontSize: 14,
  color: theme.text,
  boxSizing: "border-box",
  transition: "border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.2s ease",
  outline: "none",
};

export const textareaStyle = {
  width: "100%",
  minHeight: 140,
  padding: "14px 18px",
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.border}`,
  background: "var(--bg-surface)",
  fontSize: 14,
  lineHeight: 1.6,
  fontFamily: "inherit",
  color: theme.text,
  resize: "vertical",
  boxSizing: "border-box",
  transition: "border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.2s ease",
  outline: "none",
};

export const preStyle = {
  whiteSpace: "pre-wrap",
  background: "var(--bg-secondary)",
  padding: "16px 20px",
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.borderPurple}`,
  fontSize: 13,
  lineHeight: 1.65,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  margin: 0,
  color: theme.text,
};

export const sectionLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: theme.primary,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: theme.spacing.xs,
};

export const gridTwoCol = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: theme.spacing.md,
};

export const statRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
  gap: theme.spacing.md,
  marginBottom: theme.spacing.md,
};

export const badgeStyle = (
  color = theme.primaryLight,
  textColor = theme.primary,
  borderColor = theme.primaryBorder
) => ({
  background: color,
  color: textColor,
  border: `1px solid ${borderColor}`,
  padding: "5px 12px",
  borderRadius: theme.radius.full,
  fontWeight: 600,
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
  transition: "all 0.18s ease",
});

export const getScoreColor = (score) => {
  const num = Number(score);
  if (num >= 8) return theme.success;
  if (num >= 5) return theme.warning;
  return theme.danger;
};

export const getScoreBackground = (score) => {
  const num = Number(score);
  if (num >= 8) return theme.successLight;
  if (num >= 5) return theme.warningLight;
  return theme.dangerLight;
};

export const getScoreBorder = (score) => {
  const num = Number(score);
  if (num >= 8) return theme.successBorder;
  if (num >= 5) return theme.warningBorder;
  return theme.dangerBorder;
};

// ─── CARD ACCENT DESIGN SYSTEM (UNIFIED BRAND PALETTE) ───
export const CARD_ACCENTS = {
  purple: {
    name: "purple",
    color: "var(--primary)", // #8054E8 Unified Brand Primary
    bg: "var(--primary-light)",
    border: "var(--primary-border)",
    hoverBorder: "var(--primary)",
    glow: "var(--primary-glow)",
    subtleBg: "var(--bg-selected)",
  },
  primary: {
    name: "primary",
    color: "var(--primary)",
    bg: "var(--primary-light)",
    border: "var(--primary-border)",
    hoverBorder: "var(--primary)",
    glow: "var(--primary-glow)",
    subtleBg: "var(--bg-selected)",
  },
  // Semantic status colors ONLY (strictly reserved for status feedback, not decorative card themes)
  green: {
    name: "green",
    color: "var(--success)",
    bg: "var(--success-light)",
    border: "var(--success-border)",
    hoverBorder: "var(--success)",
    glow: "rgba(21, 128, 61, 0.20)",
    subtleBg: "var(--success-light)",
  },
  orange: {
    name: "orange",
    color: "var(--warning)",
    bg: "var(--warning-light)",
    border: "var(--warning-border)",
    hoverBorder: "var(--warning)",
    glow: "rgba(180, 83, 9, 0.20)",
    subtleBg: "var(--warning-light)",
  },
  red: {
    name: "red",
    color: "var(--error)",
    bg: "var(--error-light)",
    border: "var(--error-border)",
    hoverBorder: "var(--error)",
    glow: "rgba(220, 38, 38, 0.20)",
    subtleBg: "var(--error-light)",
  },
};

// Aliases ensuring legacy decorative accents map cleanly to the single unified brand purple
CARD_ACCENTS.blue = CARD_ACCENTS.purple;
CARD_ACCENTS.cyan = CARD_ACCENTS.purple;
CARD_ACCENTS.pink = CARD_ACCENTS.purple;

export const getCardAccent = (accent) => {
  if (!accent) return null;
  const key = String(accent).toLowerCase();
  if (CARD_ACCENTS[key]) return CARD_ACCENTS[key];
  if (key === "green" || key === "success") return CARD_ACCENTS.green;
  if (key === "orange" || key === "warning") return CARD_ACCENTS.orange;
  if (key === "red" || key === "danger" || key === "error") return CARD_ACCENTS.red;

  // All decorative card accents standardize to the single brand purple token
  return CARD_ACCENTS.purple;
};
