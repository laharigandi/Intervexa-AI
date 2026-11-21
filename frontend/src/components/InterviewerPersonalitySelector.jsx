import React, { useState, useEffect } from "react";
import theme from "../styles/theme";
import { IconCheckCircle, IconSparkles } from "./Icons";

export const PERSONALITY_OPTIONS = [
  { id: "technical", name: "Technical Interviewer" },
  { id: "hr", name: "HR Interviewer" },
  { id: "strict", name: "Strict Interviewer" },
  { id: "friendly", name: "Friendly Interviewer" },
  { id: "senior_engineer", name: "Senior Staff Engineer" },
  { id: "panel", name: "Multi-Perspective Panel" },
];

export default function InterviewerPersonalitySelector({ selected, onSelect, compact = false }) {
  const [currentSelected, setCurrentSelected] = useState(() => {
    return selected || localStorage.getItem("interviewer_personality") || "technical";
  });

  useEffect(() => {
    if (selected && selected !== currentSelected) {
      setCurrentSelected(selected);
    }
  }, [selected]);

  const handleChoose = (id) => {
    setCurrentSelected(id);
    localStorage.setItem("interviewer_personality", id);
    if (onSelect) {
      onSelect(id);
    }
  };

  return (
    <div className="personality-selector-container" style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--primary-light)",
              border: "1px solid var(--primary-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
            }}
          >
            <IconSparkles size={12} />
          </div>
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--text-main)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Interviewer Personality
          </h3>
        </div>
      </div>

      {/* 3x2 Responsive Grid */}
      <div className="personality-cards-grid">
        {PERSONALITY_OPTIONS.map((item) => {
          const isSelected = currentSelected === item.id;
          return (
            <div
              key={item.id}
              onClick={() => handleChoose(item.id)}
              className={`personality-card ${isSelected ? "selected" : ""}`}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleChoose(item.id);
                }
              }}
              style={{
                borderRadius: "10px",
                padding: "8px 12px",
                background: isSelected ? "var(--bg-selected)" : "var(--bg-surface)",
                border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border-color)",
                boxShadow: isSelected ? "0 2px 10px var(--primary-glow)" : theme.shadow.sm,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                userSelect: "none",
                minHeight: "38px",
                boxSizing: "border-box",
                transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: isSelected ? "var(--primary)" : "var(--primary-border)",
                    flexShrink: 0,
                    transition: "background 0.2s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? "var(--primary)" : "var(--text-main)",
                    lineHeight: 1.25,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "color 0.2s ease",
                  }}
                >
                  {item.name}
                </span>
              </div>

              {/* Selection indicator */}
              <div
                style={{
                  width: 17,
                  height: 17,
                  minWidth: 17,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isSelected ? "var(--primary)" : "transparent",
                  border: isSelected ? "none" : "2px solid var(--border-color)",
                  color: "#fff",
                  transition: "all 0.18s ease",
                }}
              >
                {isSelected && <IconCheckCircle size={12} color="#fff" />}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .personality-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
        }
        @media (max-width: 960px) {
          .personality-cards-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
        }
        @media (max-width: 520px) {
          .personality-cards-grid {
            grid-template-columns: 1fr;
            gap: 6px;
          }
        }
        .personality-card {
          transform: translateY(0);
          transition: transform 0.18s ease,
                      box-shadow 0.18s ease,
                      border-color 0.18s ease,
                      background-color 0.18s ease;
        }
        .personality-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
