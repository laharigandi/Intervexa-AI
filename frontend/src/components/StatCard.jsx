import React, { useState, useEffect } from "react";
import theme from "../styles/theme";
import { getCardAccent } from "../styles/shared";

/**
 * StatCard Component
 * Modern SaaS metric card with category-colored accents,
 * top label, prominent value, icon badge, and supporting subtext.
 */
function StatCard({
  label,
  value,
  accent,
  accentColor,
  icon: Icon,
  subtext,
  trend,
  trendType = "neutral",
  className = "",
  onClick,
}) {
  const effectiveAccent = accentColor || accent;
  const accentObj = getCardAccent(effectiveAccent);

  // Animated number counter
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    const strVal = String(value ?? "");
    const match = strVal.match(/^([0-9.]+)(.*)$/);
    if (!match) {
      setDisplayValue(value);
      return;
    }

    const targetNum = parseFloat(match[1]);
    const suffix = match[2];
    if (isNaN(targetNum)) {
      setDisplayValue(value);
      return;
    }

    const duration = 650;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = targetNum * easeProgress;

      const formatted = targetNum % 1 !== 0
        ? current.toFixed(1)
        : Math.round(current);

      setDisplayValue(`${formatted}${suffix}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    const frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  const isSemanticStatus = accentObj && (accentObj.name === "green" || accentObj.name === "orange" || accentObj.name === "red");
  const accentLeftBorder = isSemanticStatus
    ? { borderLeft: `3.5px solid ${accentObj.color}` }
    : {};

  return (
    <div
      onClick={onClick}
      className={`app-stat-card ${onClick ? "clickable" : ""} ${className}`}
      style={{
        background: "var(--bg-surface)",
        padding: "18px 22px",
        borderRadius: 14,
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border-color)",
        ...accentLeftBorder,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        textAlign: "left",
        position: "relative",
        boxSizing: "border-box",
        minHeight: 116,
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* Top Header Row: Label & Unified Brand Icon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            fontSize: 11.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>

        {Icon && (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: isSemanticStatus ? accentObj.bg : "var(--primary-light)",
              color: isSemanticStatus ? accentObj.color : "var(--primary)",
              border: `1px solid ${isSemanticStatus ? accentObj.border : "var(--primary-border)"}`,
              boxShadow: isSemanticStatus ? `0 2px 8px ${accentObj.glow}` : "0 2px 6px var(--primary-glow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "transform 0.2s ease",
            }}
            className="stat-icon-wrapper"
          >
            <Icon size={19} />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <p
          style={{
            margin: 0,
            fontSize: 27,
            fontWeight: 800,
            color: "var(--text-main)",
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
          }}
        >
          {displayValue}
        </p>

        {trend && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 6,
              background: trendType === "up" ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
              color: trendType === "up" ? "#10B981" : "#EF4444",
            }}
          >
            {trend}
          </span>
        )}
      </div>

      {/* Subtext Description at Bottom */}
      {subtext && (
        <p
          style={{
            margin: "6px 0 0 0",
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={subtext}
        >
          {subtext}
        </p>
      )}

      <style>{`
        .app-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -4px rgba(128, 84, 232, 0.12) !important;
          border-color: var(--primary) !important;
        }
        .app-stat-card:hover .stat-icon-wrapper {
          transform: scale(1.06);
        }
        .app-stat-card.clickable:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}

export default StatCard;
