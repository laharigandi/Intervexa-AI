import React from "react";
import { IconTarget, IconZap, IconSparkles } from "../Icons";

export default function SkillImprovementRadar({
  topicMasteryList = [],
  targetRole = "Full Stack Developer",
  onPracticeTopic = () => {},
}) {
  // If list is empty, supply role baseline
  const skills = topicMasteryList.length > 0
    ? topicMasteryList.slice(0, 6)
    : [
        { topic: "React Architecture", average_score: 65, mastery_status: "Learning" },
        { topic: "SQL & Databases", average_score: 55, mastery_status: "Needs Revision" },
        { topic: "REST API Design", average_score: 80, mastery_status: "Proficient" },
        { topic: "System Design", average_score: 70, mastery_status: "Learning" },
        { topic: "Data Structures", average_score: 60, mastery_status: "Learning" },
        { topic: "Authentication", average_score: 85, mastery_status: "Mastered" },
      ];

  const total = skills.length;
  const radius = 100;
  const centerX = 140;
  const centerY = 130;

  // Polar coordinates calculation
  const getCoordinates = (value, index) => {
    const angle = (Math.PI * 2 / total) * index - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    return { x, y };
  };

  // Generate radar polygon points
  const candidatePoints = skills.map((s, i) => {
    const val = s.average_score > 0 ? s.average_score : 50;
    const { x, y } = getCoordinates(val, i);
    return `${x},${y}`;
  }).join(" ");

  const benchmarkPoints = skills.map((_, i) => {
    const { x, y } = getCoordinates(85, i); // 85% target benchmark
    return `${x},${y}`;
  }).join(" ");

  const getMasteryColor = (status) => {
    switch (status) {
      case "Mastered":
        return "#10b981";
      case "Proficient":
        return "var(--primary)";
      case "Learning":
        return "#f59e0b";
      case "Needs Revision":
      default:
        return "#ef4444";
    }
  };

  return (
    <div
      style={{
        padding: "1.25rem 1.5rem",
        borderRadius: "14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.2rem 0", color: "var(--text-main)" }}>
            Skill Mastery & Benchmark Radar
          </h3>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Real-time tracking of candidate competency vs 85% role target for {targetRole}.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--primary)" }} />
            <span>Your Mastery</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", border: "1px dashed var(--success)", background: "transparent" }} />
            <span>Target (85%)</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "1.5rem", alignItems: "center" }}>
        {/* SVG Radar Chart */}
        <div style={{ display: "flex", justifyContent: "center", width: "100%", minWidth: 0 }}>
          <svg width="280" height="260" viewBox="0 0 280 260" style={{ maxWidth: "100%", height: "auto" }}>
            {/* Background concentric rings */}
            {[0.25, 0.5, 0.75, 1.0].map((ring, idx) => (
              <polygon
                key={idx}
                points={skills.map((_, i) => {
                  const { x, y } = getCoordinates(ring * 100, i);
                  return `${x},${y}`;
                }).join(" ")}
                fill="none"
                stroke="var(--border-color)"
                strokeWidth="1"
              />
            ))}

            {/* Radial axes */}
            {skills.map((_, i) => {
              const { x, y } = getCoordinates(100, i);
              return (
                <line
                  key={i}
                  x1={centerX}
                  y1={centerY}
                  x2={x}
                  y2={y}
                  stroke="var(--border-color)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Benchmark Polygon */}
            <polygon
              points={benchmarkPoints}
              fill="none"
              stroke="var(--success)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Candidate Polygon */}
            <polygon
              points={candidatePoints}
              fill="rgba(128, 84, 232, 0.18)"
              stroke="var(--primary)"
              strokeWidth="2"
            />

            {/* Vertex dots & Labels */}
            {skills.map((s, i) => {
              const val = s.average_score > 0 ? s.average_score : 50;
              const { x, y } = getCoordinates(val, i);
              const labelCoord = getCoordinates(115, i);

              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill="var(--primary)" stroke="var(--bg-surface)" strokeWidth="1.5" />
                  <text
                    x={labelCoord.x}
                    y={labelCoord.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--text-secondary)"
                    fontSize="9"
                    fontWeight="600"
                  >
                    {s.topic.length > 14 ? s.topic.substring(0, 13) + "…" : s.topic}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Skill Breakdown List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {skills.map((s, idx) => {
            const score = s.average_score > 0 ? s.average_score : 50;
            const statusColor = getMasteryColor(s.mastery_status);

            return (
              <div
                key={idx}
                style={{
                  padding: "0.65rem 0.9rem",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>{s.topic}</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: statusColor }}>
                      {score}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      height: "4px",
                      width: "100%",
                      borderRadius: "2px",
                      background: "var(--border-color)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, score)}%`,
                        background: statusColor,
                        borderRadius: "2px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => onPracticeTopic(s.topic)}
                  style={{
                    background: "var(--primary-light)",
                    border: "1px solid var(--primary-border)",
                    borderRadius: "6px",
                    color: "var(--primary)",
                    padding: "0.3rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  <IconSparkles size={12} /> Practice
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

