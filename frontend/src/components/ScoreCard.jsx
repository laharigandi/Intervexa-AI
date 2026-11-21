import React, { useEffect, useState } from "react";
import theme from "../styles/theme";
import { getScoreColor, getScoreBackground, getScoreBorder } from "../styles/shared";

/**
 * ScoreCard
 * Displays an animated circular score gauge with status badge and subtext.
 */
function ScoreCard({
  score = 0,
  maxScore = 10,
  label = "Score",
  subtext,
  size = 96,
  strokeWidth = 8,
  accentColor,
}) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const numScore = Number(score) || 0;
  const percentage = Math.min(Math.max((numScore / maxScore) * 100, 0), 100);

  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color = accentColor || getScoreColor(numScore);
  const bgColor = getScoreBackground(numScore);
  const borderColor = getScoreBorder(numScore);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimatedScore(numScore);
      return;
    }

    let start = 0;
    const duration = 700;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore((numScore * ease).toFixed(1));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setAnimatedScore(numScore);
      }
    };

    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [numScore]);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        borderRadius: 14,
        padding: "16px 20px",
        border: "1px solid var(--border-color)",
        borderLeft: `3.5px solid ${color}`,
        boxShadow: "var(--shadow-card)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className="score-card-component"
    >
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--border-color)"
            strokeWidth={strokeWidth}
          />
          {/* Animated score stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </svg>

        {/* Centered Score Label */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: theme.text,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {animatedScore}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: theme.muted, marginTop: 2 }}>
            / {maxScore}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text }}>
            {label}
          </h4>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              background: bgColor,
              color: color,
              border: `1px solid ${borderColor}`,
              padding: "2px 8px",
              borderRadius: theme.radius.full,
            }}
          >
            {percentage >= 80 ? "Excellent" : percentage >= 50 ? "Proficient" : "Needs Review"}
          </span>
        </div>
        {subtext && (
          <p style={{ margin: 0, fontSize: 13, color: theme.muted, lineHeight: 1.45 }}>
            {subtext}
          </p>
        )}
      </div>

      <style>{`
        .score-card-component:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -4px rgba(124, 58, 237, 0.1);
        }
      `}</style>
    </div>
  );
}

export default ScoreCard;
