import React, { useState } from "react";
import Button from "../Button";
import { IconTarget, IconClock, IconZap, IconRefresh, IconX, IconAlertTriangle } from "../Icons";

const ROLES = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Java Developer",
  "Software Developer",
  "Python Developer",
  "Software Test Engineer",
  "Machine Learning Engineer",
  "AI/ML Engineer",
  "Data Analyst",
  "Data Scientist",
  "Cloud Engineer",
];

const SUGGESTED_TOPICS = [
  "Python",
  "SQL",
  "React",
  "Machine Learning",
  "Data Structures",
  "Java",
  "Deep Learning",
  "HTML and CSS",
  "System Design",
];

const DURATIONS = [
  { days: 7, label: "7 Days (Sprint)", desc: "Intensive last-minute prep before interviews" },
  { days: 14, label: "14 Days (Recommended)", desc: "Optimal balanced depth across weak areas" },
  { days: 30, label: "30 Days (Comprehensive)", desc: "Thorough mastery & spaced retention" },
  { days: 60, label: "60 Days (Deep Foundation)", desc: "Complete syllabus & system design mastery" },
];

const STUDY_TIMES = [
  { minutes: 30, label: "30 Mins / Day", desc: "Quick daily practice" },
  { minutes: 60, label: "1 Hour / Day (Recommended)", desc: "Balanced standard pace" },
  { minutes: 120, label: "2 Hours / Day", desc: "Rigorous accelerated study" },
  { minutes: 180, label: "3 Hours / Day", desc: "Full-time dedicated bootcamp" },
];

const PREP_LEVELS = [
  { level: "Beginner", desc: "Build fundamental conceptual clarity" },
  { level: "Intermediate", desc: "Strengthen interview patterns & trade-offs" },
  { level: "Advanced", desc: "High-scale architecture, edge cases & depth" },
];

export default function StudyPlanConfigModal({
  isOpen,
  onClose,
  onGenerate,
  initialRole = "Full Stack Developer",
  loading = false,
  error = null,
}) {
  const [topic, setTopic] = useState("");
  const [topicError, setTopicError] = useState("");
  const [targetRole, setTargetRole] = useState(initialRole || "Full Stack Developer");
  const [durationDays, setDurationDays] = useState(14);
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [prepLevel, setPrepLevel] = useState("Intermediate");
  const [includeMemory, setIncludeMemory] = useState(true);
  const [includeResume, setIncludeResume] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      setTopicError("Please enter at least one topic (e.g. Python, SQL, React).");
      return;
    }
    setTopicError("");
    onGenerate({
      topic: topic.trim(),
      target_role: targetRole.trim() || `${topic.trim()} Specialist`,
      duration_days: durationDays,
      daily_study_minutes: dailyMinutes,
      preparation_level: prepLevel,
      include_memory: includeMemory,
      include_resume: includeResume,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 17, 32, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "1rem",
          maxWidth: "680px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.75rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          color: "var(--text-main)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <IconZap size={18} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>Configure AI Learning Roadmap</h2>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
              Generate a dedicated, structured curriculum for any single topic or multiple skills.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "6px",
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Topic Input (Mandatory) */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                Topic(s) to Master <span style={{ color: "#f43f5e" }}>*</span>
              </label>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Single topic or multiple skills
              </span>
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                if (topicError) setTopicError("");
              }}
              placeholder="e.g. Python, SQL, React, Machine Learning, Java, HTML and CSS..."
              style={{
                width: "100%",
                padding: "0.7rem 0.85rem",
                borderRadius: "0.5rem",
                border: topicError ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
                background: "var(--bg-input, var(--bg-surface))",
                color: "var(--text-main)",
                fontSize: "0.92rem",
                outline: "none",
                boxSizing: "border-box",
              }}
              autoFocus
            />
            {topicError && (
              <div style={{ color: "#f87171", fontSize: "0.78rem", marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <IconAlertTriangle size={14} />
                <span>{topicError}</span>
              </div>
            )}

            {/* Quick Topic Suggestions */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", marginTop: "0.6rem" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginRight: "0.2rem" }}>
                Suggestions:
              </span>
              {SUGGESTED_TOPICS.map((sug) => {
                const isSelected = topic.toLowerCase() === sug.toLowerCase();
                return (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setTopic(sug);
                      if (topicError) setTopicError("");
                    }}
                    style={{
                      padding: "0.25rem 0.65rem",
                      borderRadius: "9999px",
                      border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                      background: isSelected ? "var(--primary)" : "var(--bg-secondary)",
                      color: isSelected ? "#ffffff" : "var(--text-secondary)",
                      fontSize: "0.75rem",
                      fontWeight: isSelected ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {sug}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Role (Optional) */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                Target Job Role <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>(Optional)</span>
              </label>
            </div>
            <input
              type="text"
              list="role-options"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Full Stack Developer (Optional)"
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-color)",
                background: "var(--bg-input, var(--bg-surface))",
                color: "var(--text-main)",
                fontSize: "0.9rem",
                boxSizing: "border-box",
              }}
            />
            <datalist id="role-options">
              {ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>

          {/* Plan Duration */}
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.5rem" }}>
              Plan Duration
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.6rem" }}>
              {DURATIONS.map((d) => {
                const isSelected = durationDays === d.days;
                return (
                  <div
                    key={d.days}
                    onClick={() => setDurationDays(d.days)}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                      background: isSelected ? "var(--primary-light)" : "var(--bg-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: isSelected ? "var(--primary)" : "var(--text-main)" }}>
                      {d.label}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {d.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Study Time */}
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.5rem" }}>
              Daily Study Time Commitment
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem" }}>
              {STUDY_TIMES.map((st) => {
                const isSelected = dailyMinutes === st.minutes;
                return (
                  <div
                    key={st.minutes}
                    onClick={() => setDailyMinutes(st.minutes)}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                      background: isSelected ? "var(--primary-light)" : "var(--bg-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: isSelected ? "var(--primary)" : "var(--text-main)" }}>
                      {st.label}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {st.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preparation Level */}
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.5rem" }}>
              Preparation Level
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 85px), 1fr))", gap: "0.6rem" }}>
              {PREP_LEVELS.map((pl) => {
                const isSelected = prepLevel === pl.level;
                return (
                  <div
                    key={pl.level}
                    onClick={() => setPrepLevel(pl.level)}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                      background: isSelected ? "var(--primary-light)" : "var(--bg-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: isSelected ? "var(--primary)" : "var(--text-main)" }}>
                      {pl.level}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {pl.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Personalization Sources */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "0.5rem",
              background: "var(--primary-light)",
              border: "1px dashed var(--primary-border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)" }}>
              AI Personalization Engine Settings:
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-main)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeMemory}
                onChange={(e) => setIncludeMemory(e.target.checked)}
                style={{ accentColor: "var(--primary)" }}
              />
              Incorporate past interview memory, recurring mistakes & weak topics
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-main)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeResume}
                onChange={(e) => setIncludeResume(e.target.checked)}
                style={{ accentColor: "var(--primary)" }}
              />
              Align with uploaded Resume skills & Job Description gaps
            </label>
          </div>

          {/* Error Message & Retry Indication */}
          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                background: "var(--error-light)",
                border: "1px solid var(--error-border)",
                color: "var(--error)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <IconAlertTriangle size={18} color="var(--error)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontWeight: 500 }}>{error}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <IconRefresh className="animate-spin" size={16} />
                  <span>Synthesizing Plan...</span>
                </>
              ) : (
                <>
                  <IconZap size={16} />
                  <span>Generate AI Study Plan</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

