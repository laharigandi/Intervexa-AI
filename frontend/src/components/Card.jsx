import React from "react";
import theme from "../styles/theme";
import { getCardAccent } from "../styles/shared";

/**
 * Card Component
 * Professional SaaS dashboard card with categorical colored accents,
 * crisp typography, rounded corners, and smooth elevation on hover.
 */
function Card({
  children,
  style = {},
  title,
  subtitle,
  icon: Icon,
  action,
  className = "",
  hoverable = false,
  compact = false,
  accent,
  accentColor,
  accentBorder = false,
  topAccent = false,
  selected = false,
  badge,
  badgeType = "primary",
  onClick,
}) {
  const effectiveAccent = accentColor || accent;
  const accentObj = getCardAccent(effectiveAccent);

  // Maintain clean, standardized card borders across all cards
  // (Left border is reserved strictly for semantic status cards like errors or warnings)
  const isSemanticStatus = accentObj && (accentObj.name === "green" || accentObj.name === "orange" || accentObj.name === "red");
  const accentLeftBorder = accentBorder && isSemanticStatus
    ? { borderLeft: `3.5px solid ${accentObj.color}` }
    : {};

  return (
    <div
      onClick={onClick}
      className={`app-card ${hoverable || onClick ? "hoverable" : ""} ${selected ? "selected-card" : ""} ${className}`}
      style={{
        background: selected ? "var(--bg-selected)" : "var(--bg-surface)",
        borderRadius: 14,
        padding: compact ? "14px 18px" : "20px 24px",
        boxShadow: "var(--shadow-card)",
        border: selected ? "2px solid var(--primary)" : `1px solid var(--border-color)`,
        marginBottom: 14,
        textAlign: "left",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
        ...accentLeftBorder,
        ...style,
      }}
    >
      {/* Optional Brand Purple Top Accent Stripe */}
      {topAccent && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3.5px",
            background: "linear-gradient(90deg, var(--primary), #B89EFF)",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        />
      )}

      {(title || Icon || action || badge) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: subtitle ? 4 : 14,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {Icon && (
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: isSemanticStatus ? accentObj.bg : "var(--primary-light)",
                  border: `1px solid ${isSemanticStatus ? accentObj.border : "var(--primary-border)"}`,
                  color: isSemanticStatus ? accentObj.color : "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isSemanticStatus ? `0 2px 8px ${accentObj.glow}` : "0 2px 6px var(--primary-glow)",
                  flexShrink: 0,
                  transition: "transform 0.2s ease",
                }}
                className="card-header-icon"
              >
                <Icon size={19} />
              </div>
            )}
            {title && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: "var(--text-main)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {title}
                </h2>
                {badge && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 9999,
                      background: isSemanticStatus ? accentObj.bg : "var(--primary-light)",
                      color: isSemanticStatus ? accentObj.color : "var(--primary)",
                      border: `1px solid ${isSemanticStatus ? accentObj.border : "var(--primary-border)"}`,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
            )}
          </div>

          {action && <div>{action}</div>}
        </div>
      )}

      {subtitle && (
        <p
          style={{
            margin: "0 0 14px 0",
            fontSize: 13.5,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}

      {children}

      <style>{`
        @media (hover: hover) and (pointer: fine) {
          .app-card.hoverable {
            cursor: pointer;
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease !important;
          }
          .app-card.hoverable:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px -4px rgba(128, 84, 232, 0.12) !important;
            border-color: var(--primary) !important;
          }
          .app-card.hoverable:hover .card-header-icon {
            transform: scale(1.05);
          }
          .app-card.hoverable:active {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default Card;
