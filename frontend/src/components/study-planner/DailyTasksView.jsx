import React, { useState } from "react";
import Button from "../Button";
import {
  IconCheckCircle,
  IconClock,
  IconSparkles,
  IconTarget,
  IconCode,
  IconExternalLink,
  IconChevronDown,
  IconRotateCcw,
  IconZap,
} from "../Icons";

// Helper to strip leading bullet characters or numbers
function cleanBulletText(val) {
  if (!val) return "";
  const s = String(val).trim();
  return s.replace(/^[\s\u2022\u25e6\u25aa\u2023\u2219\*\-\+\d+\.\)]+\s*/, "").trim();
}

// Helper to safely extract an array of bullet strings
function extractBullets(val, fallback = []) {
  if (!val) return fallback;
  if (Array.isArray(val)) {
    const cleaned = val.map(cleanBulletText).filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  const s = String(val).trim();
  if (!s) return fallback;
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map(cleanBulletText).filter(Boolean);
        if (cleaned.length > 0) return cleaned;
      }
    } catch (e) {
      // not JSON
    }
  }
  const lines = s.split(/[\r\n]+/);
  const result = [];
  for (const line of lines) {
    const c = cleanBulletText(line);
    if (c) result.push(c);
  }
  if (result.length <= 1 && s.length > 100) {
    const sentences = s.split(/(?<=[.!?])\s+/).map(cleanBulletText).filter(Boolean);
    if (sentences.length > 1) return sentences;
  }
  return result.length > 0 ? result : (s ? [cleanBulletText(s)] : fallback);
}

// Helper to extract subtopics list
function extractSubtopics(task) {
  if (Array.isArray(task.topic_breakdown) && task.topic_breakdown.length > 0) {
    return task.topic_breakdown;
  }
  if (typeof task.topic_breakdown === "string" && task.topic_breakdown.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(task.topic_breakdown);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  const rawSub = task.subtopics;
  let names = [];
  if (Array.isArray(rawSub)) names = rawSub;
  else if (typeof rawSub === "string") {
    try {
      names = rawSub.startsWith("[") ? JSON.parse(rawSub) : rawSub.split(",");
    } catch (e) {
      names = [rawSub];
    }
  }
  if (!names || names.length === 0) {
    names = [`${task.topic || "Core"} Fundamentals`, `${task.topic || "Core"} Practical Application`];
  }
  return names.map((name) => ({
    name: String(name).trim(),
    explanation: `Core mechanics and standard programming conventions for ${String(name).trim()}.`,
    example: `Code/Pattern: import/declare ${String(name).trim().toLowerCase().replace(/\s+/g, "_")} logic.`,
    use_case: "Applied in production systems to ensure reliable execution and interview readiness.",
  }));
}

// Helper to extract practical examples
function extractExamples(task) {
  if (Array.isArray(task.practical_examples) && task.practical_examples.length > 0) {
    return task.practical_examples;
  }
  if (typeof task.practical_examples === "string" && task.practical_examples.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(task.practical_examples);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  const topic = task.topic || "Technical Implementation";
  return [
    {
      title: `${topic} Code Example`,
      code: `# Implementation for ${topic}\ndef run_task():\n    print("Executing ${topic}...")\n    return True\n\nrun_task()`,
      explanation: `Executes core principles and demonstrates syntax for ${topic}.`,
      output: `Executing ${topic}...`,
      use_case: `Standard pattern applied when designing modules for ${topic}.`,
    },
  ];
}

export default function DailyTasksView({
  tasks = [],
  onUpdateStatus,
  onReschedule,
  onOpenAssistant,
  onOpenQuiz,
  dailyStudyMinutes = 60,
}) {
  const [filter, setFilter] = useState("all");
  const [reschedulingTaskId, setReschedulingTaskId] = useState(null);
  const [newDateInput, setNewDateInput] = useState("");
  const [skipPromptTaskId, setSkipPromptTaskId] = useState(null);
  const [skipReasonInput, setSkipReasonInput] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Ensure tasks is always a valid safe array
  const safeTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];

  // Default to expanding today's task, or the first task
  const [expandedDayIds, setExpandedDayIds] = useState(() => {
    const today = safeTasks.find((t) => t && t.is_today);
    return new Set(today ? [today.id] : (safeTasks[0] ? [safeTasks[0].id] : []));
  });

  const toggleDayExpanded = (taskId) => {
    setExpandedDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedDayIds(new Set(safeTasks.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedDayIds(new Set());
  };

  const handleCopyCode = (id, codeText) => {
    if (!codeText) return;
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const filteredTasks = safeTasks.filter((t) => {
    if (!t) return false;
    if (filter === "today") return t.is_today;
    if (filter === "pending") return t.status === "pending" || t.status === "rescheduled";
    if (filter === "completed") return t.status === "completed";
    return true;
  });

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case "Critical":
        return { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" };
      case "High":
        return { bg: "rgba(245, 158, 11, 0.12)", text: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" };
      case "Medium":
        return { bg: "var(--primary-light)", text: "var(--primary)", border: "1px solid var(--primary-border)" };
      case "Low":
      default:
        return { bg: "rgba(16, 185, 129, 0.12)", text: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" };
    }
  };

  const handleRescheduleSubmit = (taskId) => {
    if (!newDateInput) return;
    onReschedule(taskId, newDateInput);
    setReschedulingTaskId(null);
    setNewDateInput("");
  };

  const handleSkipSubmit = (taskId) => {
    onUpdateStatus(taskId, "skipped", skipReasonInput || "Skipped by user");
    setSkipPromptTaskId(null);
    setSkipReasonInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Control Bar: Filters & Expand All */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.5rem 0",
        }}
      >
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {[
            { id: "all", label: `All Tasks (${tasks.length})` },
            { id: "today", label: "Today's Focus" },
            { id: "pending", label: "Pending" },
            { id: "completed", label: "Completed" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "0.5rem",
                border: filter === f.id ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                background: filter === f.id ? "var(--primary)" : "var(--bg-surface)",
                color: filter === f.id ? "#ffffff" : "var(--text-secondary)",
                boxShadow: filter === f.id ? "0 2px 8px var(--primary-glow)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            onClick={expandedDayIds.size === tasks.length ? collapseAll : expandAll}
            style={{
              padding: "0.38rem 0.8rem",
              borderRadius: "0.375rem",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {expandedDayIds.size === tasks.length ? "Collapse All Lessons" : "Expand All Lessons"}
          </button>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Showing {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 ? (
        <div
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            borderRadius: "0.75rem",
            background: "var(--bg-card, rgba(255,255,255,0.02))",
            border: "1px dashed var(--border-color, rgba(255,255,255,0.1))",
            color: "var(--text-secondary, #94a3b8)",
          }}
        >
          No tasks found matching the selected filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {filteredTasks.map((task) => {
            if (!task) return null;
            const isCompleted = task.status === "completed";
            const isSkipped = task.status === "skipped";
            const isExpanded = expandedDayIds.has(task.id);
            const pStyle = getPriorityStyle(task.priority);

            // Extract structured fields
            const whatYouWillLearn = extractBullets(
              task.what_you_will_learn,
              extractBullets(task.description, [
                `Core architectural principles and mechanics of ${task.topic}.`,
                `Key syntax, execution flow, and standard conventions for ${task.topic}.`,
                `High-frequency interview questions and practical problem-solving in ${task.topic}.`,
              ])
            );

            const topicBreakdown = extractSubtopics(task);

            const learningSteps = extractBullets(
              task.learning_steps,
              [
                `Understand the core definition and execution model of ${task.topic}.`,
                `Review standard syntax rules, signatures, and conventions.`,
                `Walk through working code examples and inspect terminal outputs.`,
                `Implement hands-on practice challenges independently.`,
              ]
            );

            const practicalExamples = extractExamples(task);

            const practiceActivities = extractBullets(
              task.practice_activities,
              extractBullets(task.recommended_practice, [
                `Implement a standalone script demonstrating the core principles of ${task.topic}.`,
                `Solve at least 2 hands-on coding challenges or scenario questions on ${task.topic}.`,
              ])
            );

            const completionGoals = extractBullets(
              task.completion_goals,
              extractBullets(task.completion_criteria, [
                `Successfully write and execute clean code demonstrating ${task.topic} with zero errors.`,
                `Clearly explain the core mechanics and trade-offs of ${task.topic} out loud.`,
              ])
            );

            const resources = Array.isArray(task.recommended_resources) ? task.recommended_resources : [];

            return (
              <div
                key={task.id}
                style={{
                  borderRadius: "14px",
                  background: isCompleted
                    ? "var(--bg-surface)"
                    : task.is_today
                      ? "var(--bg-surface)"
                      : "var(--bg-surface)",
                  border: task.is_today
                    ? "2px solid var(--primary)"
                    : isCompleted
                      ? "1px solid var(--border-color)"
                      : "1px solid var(--border-color)",
                  boxShadow: task.is_today
                    ? "0 4px 18px -2px var(--primary-glow)"
                    : "var(--shadow-card)",
                  overflow: "hidden",
                  transition: "all 0.2s ease",
                }}
              >
                {/* SECTION A: DAY INFORMATION BAR */}
                <div
                  style={{
                    padding: "1.1rem 1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    background: task.is_today
                      ? "var(--primary-light)"
                      : "var(--bg-surface)",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", flex: 1 }}>
                    {/* Completion Checkmark Button */}
                    <button
                      onClick={() => onUpdateStatus(task.id, isCompleted ? "pending" : "completed")}
                      style={{
                        background: isCompleted ? "var(--success, #15803D)" : "transparent",
                        border: isCompleted ? "none" : "2px solid var(--border-color)",
                        borderRadius: "50%",
                        width: "26px",
                        height: "26px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        marginTop: "0.2rem",
                        color: "#fff",
                        transition: "all 0.15s ease",
                        flexShrink: 0,
                      }}
                      title={isCompleted ? "Mark as pending" : "Mark as completed"}
                    >
                      {isCompleted && <IconCheckCircle size={17} />}
                    </button>

                    <div style={{ flex: 1 }}>
                      {/* Meta Pills Row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "6px",
                            background: task.is_today ? "var(--primary)" : "var(--bg-secondary)",
                            color: task.is_today ? "#ffffff" : "var(--text-main)",
                            border: task.is_today ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          Day {task.day_number} &bull; {task.task_date}
                        </span>

                        {task.is_today && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "0.2rem 0.6rem",
                              borderRadius: "6px",
                              background: "var(--primary-light)",
                              color: "var(--primary)",
                              border: "1px solid var(--primary-border)",
                            }}
                          >
                            Today's Focus
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "6px",
                            background: pStyle.bg,
                            color: pStyle.text,
                            border: pStyle.border,
                          }}
                        >
                          {task.priority} Priority
                        </span>

                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "6px",
                            background: "var(--bg-secondary)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          {task.difficulty}
                        </span>

                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "6px",
                            background: "var(--bg-secondary)",
                            color: "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <IconClock size={12} />
                          {task.estimated_minutes} min
                        </span>

                        {isSkipped && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              padding: "0.2rem 0.55rem",
                              borderRadius: "6px",
                              background: "var(--error-light)",
                              color: "var(--error)",
                              border: "1px solid var(--error-border)",
                            }}
                          >
                            Skipped: {task.skip_reason}
                          </span>
                        )}

                        {task.status === "rescheduled" && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              padding: "0.2rem 0.55rem",
                              borderRadius: "6px",
                              background: "var(--warning-light)",
                              color: "var(--warning)",
                              border: "1px solid var(--warning-border)",
                            }}
                          >
                            Rescheduled
                          </span>
                        )}
                      </div>

                      {/* Topic Title */}
                      <h3
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          margin: 0,
                          textDecoration: isCompleted ? "line-through" : "none",
                          color: isCompleted ? "var(--text-secondary)" : "var(--text-main)",
                          lineHeight: 1.35,
                        }}
                      >
                        {task.topic}
                      </h3>
                    </div>
                  </div>

                  {/* Expand / Collapse Button */}
                  <button
                    onClick={() => toggleDayExpanded(task.id)}
                    style={{
                      padding: "0.38rem 0.75rem",
                      borderRadius: "6px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                    }}
                  >
                    <span>{isExpanded ? "Collapse" : "Full Lesson"}</span>
                    <span
                      style={{
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        display: "flex",
                        color: "var(--primary)",
                      }}
                    >
                      <IconChevronDown size={14} />
                    </span>
                  </button>
                </div>

                {/* CARD BODY CONTENT */}
                <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                  {/* SECTION B: WHAT YOU WILL LEARN (3-6 Simple Bullet Points) */}
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "10px",
                      background: "var(--primary-light)",
                      border: "1px solid var(--primary-border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                        marginBottom: "0.6rem",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "var(--primary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      <IconTarget size={16} />
                      <span>What You Will Learn Today</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {whatYouWillLearn.map((pt, idx) => (
                        <li
                          key={idx}
                          style={{
                            fontSize: "0.86rem",
                            color: "var(--text-main)",
                            lineHeight: 1.5,
                          }}
                        >
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* EXPANDABLE DEEP-DIVE SECTIONS C through H */}
                  {isExpanded && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                      {/* SECTION C: TOPIC EXPLANATION & SUBTOPIC BREAKDOWN */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            color: "var(--primary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.45rem",
                          }}
                        >
                          <IconSparkles size={16} />
                          <span>Topic Concepts & Breakdown</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "0.85rem" }}>
                          {topicBreakdown.map((st, sIdx) => {
                            const name = st.name || st;
                            const exp = st.explanation || `Core principles and syntax for ${name}.`;
                            const ex = st.example || "";
                            const useCase = st.use_case || "";

                            return (
                              <div
                                key={sIdx}
                                style={{
                                  padding: "0.95rem 1.15rem",
                                  borderRadius: "10px",
                                  background: "var(--bg-surface)",
                                  border: "1px solid var(--border-color)",
                                  boxShadow: "var(--shadow-sm)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                }}
                              >
                                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                  <span style={{ color: "var(--primary)", fontSize: "1.1rem" }}>•</span>
                                  <span>{name}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                                  {exp}
                                </p>
                                {ex && (
                                  <div
                                    style={{
                                      fontSize: "0.78rem",
                                      padding: "0.45rem 0.75rem",
                                      borderRadius: "6px",
                                      background: "var(--bg-secondary)",
                                      border: "1px solid var(--border-color)",
                                      color: "var(--text-main)",
                                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    <strong style={{ color: "var(--primary)" }}>Example: </strong>{ex}
                                  </div>
                                )}
                                {useCase && (
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                                    <strong style={{ color: "var(--primary)" }}>Use Case: </strong>{useCase}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* SECTION D: STEP-BY-STEP LEARNING INSTRUCTIONS */}
                      <div
                        style={{
                          padding: "1rem 1.25rem",
                          borderRadius: "10px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-color)",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            color: "var(--primary)",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            marginBottom: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.45rem",
                          }}
                        >
                          Step-by-Step Learning Instructions
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                          {learningSteps.map((step, sIdx) => {
                            const stepClean = cleanBulletText(step);
                            return (
                              <div key={sIdx} style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem" }}>
                                <span
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "50%",
                                    background: "var(--primary-light)",
                                    color: "var(--primary)",
                                    border: "1px solid var(--primary-border)",
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    marginTop: "0.1rem",
                                  }}
                                >
                                  {sIdx + 1}
                                </span>
                                <span style={{ fontSize: "0.86rem", color: "var(--text-main)", lineHeight: 1.55 }}>
                                  {stepClean}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* SECTION E: PRACTICAL EXAMPLES & CODE SNIPPET */}
                      {practicalExamples.length > 0 && (
                        <div
                          style={{
                            borderRadius: "10px",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            overflow: "hidden",
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          {practicalExamples.map((ex, exIdx) => (
                            <div key={exIdx} style={{ display: "flex", flexDirection: "column" }}>
                              {/* Snippet Header */}
                              <div
                                style={{
                                  padding: "0.75rem 1.15rem",
                                  background: "var(--bg-secondary)",
                                  borderBottom: "1px solid var(--border-color)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                                  <span style={{ color: "var(--primary)", display: "flex" }}>
                                    <IconCode size={16} />
                                  </span>
                                  <span>{ex.title || "Practical Implementation"}</span>
                                </div>
                                {ex.code && (
                                  <button
                                    onClick={() => handleCopyCode(`${task.id}-${exIdx}`, ex.code)}
                                    style={{
                                      padding: "0.3rem 0.7rem",
                                      borderRadius: "6px",
                                      background: "var(--bg-surface)",
                                      border: "1px solid var(--border-color)",
                                      color: copiedId === `${task.id}-${exIdx}` ? "var(--success, #15803D)" : "var(--text-secondary)",
                                      fontSize: "0.74rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                    }}
                                  >
                                    {copiedId === `${task.id}-${exIdx}` ? "✓ Copied" : "Copy Code"}
                                  </button>
                                )}
                              </div>

                              {/* Code Box */}
                              {ex.code && (
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: "1rem 1.25rem",
                                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace",
                                    fontSize: "0.82rem",
                                    lineHeight: 1.6,
                                    color: "#F8FAFC",
                                    background: "#0F172A",
                                    overflowX: "auto",
                                    borderTop: "1px solid #1E293B",
                                    borderBottom: "1px solid #1E293B",
                                  }}
                                >
                                  <code>{ex.code}</code>
                                </pre>
                              )}

                              {/* Explanation & Output Footer */}
                              <div
                                style={{
                                  padding: "0.9rem 1.15rem",
                                  background: "var(--bg-surface)",
                                  borderTop: "1px solid var(--border-color)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.45rem",
                                  fontSize: "0.82rem",
                                }}
                              >
                                {ex.explanation && (
                                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                    <strong style={{ color: "var(--primary)" }}>Explanation: </strong>
                                    {ex.explanation}
                                  </div>
                                )}
                                {ex.output && (
                                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                    <strong style={{ color: "var(--primary)" }}>Expected Output: </strong>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-main)", background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>{ex.output}</span>
                                  </div>
                                )}
                                {ex.use_case && (
                                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                    <strong style={{ color: "var(--primary)" }}>Production Scenario: </strong>
                                    {ex.use_case}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* SECTION F & G: PRACTICE ACTIVITIES & COMPLETION GOALS */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "0.85rem" }}>
                        {/* Section F: Practice Activities */}
                        <div
                          style={{
                            padding: "0.95rem 1.15rem",
                            borderRadius: "10px",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: "var(--primary)",
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                              marginBottom: "0.55rem",
                            }}
                          >
                            Practice Activities & Coding Drills
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            {practiceActivities.map((act, aIdx) => (
                              <li key={aIdx} style={{ fontSize: "0.84rem", color: "var(--text-main)", lineHeight: 1.45 }}>
                                {act}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Section G: Completion Goals */}
                        <div
                          style={{
                            padding: "0.95rem 1.15rem",
                            borderRadius: "10px",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: "var(--primary)",
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                              marginBottom: "0.55rem",
                            }}
                          >
                            Daily Completion Goals
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            {completionGoals.map((goal, gIdx) => (
                              <li key={gIdx} style={{ fontSize: "0.84rem", color: "var(--text-main)", lineHeight: 1.45 }}>
                                {goal}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* SECTION H: CURATED LEARNING RESOURCES */}
                      {resources.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            flexWrap: "wrap",
                            padding: "0.8rem 1.15rem",
                            borderRadius: "10px",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                            Learning Resources:
                          </span>
                          {resources.map((res, rIdx) => {
                            const title = res.title || "Study Reference";
                            const queryUrl = res.url?.startsWith("http")
                              ? res.url
                              : `https://www.google.com/search?q=${encodeURIComponent(res.url || title)}`;
                            return (
                              <a
                                key={rIdx}
                                href={queryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  color: "var(--primary)",
                                  background: "var(--primary-light)",
                                  border: "1px solid var(--primary-border)",
                                  padding: "0.3rem 0.65rem",
                                  borderRadius: "6px",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>{title}</span>
                                <IconExternalLink size={12} />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reschedule inline picker */}
                  {reschedulingTaskId === task.id && (
                    <div
                      style={{
                        padding: "0.75rem",
                        borderRadius: "8px",
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <input
                        type="date"
                        value={newDateInput}
                        onChange={(e) => setNewDateInput(e.target.value)}
                        style={{
                          padding: "0.4rem",
                          borderRadius: "4px",
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-input, var(--bg-surface))",
                          color: "var(--text-main)",
                          fontSize: "0.8rem",
                        }}
                      />
                      <Button size="sm" variant="primary" onClick={() => handleRescheduleSubmit(task.id)}>
                        Save Date
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setReschedulingTaskId(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Skip inline prompt */}
                  {skipPromptTaskId === task.id && (
                    <div
                      style={{
                        padding: "0.75rem",
                        borderRadius: "8px",
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Reason for skipping (e.g. already know this, busy today)..."
                        value={skipReasonInput}
                        onChange={(e) => setSkipReasonInput(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "0.4rem 0.6rem",
                          borderRadius: "4px",
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-input, var(--bg-surface))",
                          color: "var(--text-main)",
                          fontSize: "0.8rem",
                        }}
                      />
                      <Button size="sm" variant="secondary" onClick={() => handleSkipSubmit(task.id)}>
                        Confirm Skip
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setSkipPromptTaskId(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* ACTION FOOTER BUTTONS */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      paddingTop: "0.75rem",
                      borderTop: "1px solid var(--border-color)",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onOpenAssistant(task.topic, task.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <IconSparkles size={14} />
                        <span>AI Practice & Assistant</span>
                      </Button>

                      {onOpenQuiz && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenQuiz(task.day_number, task.topic, task.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            border: "1px solid var(--primary-border)",
                            color: "var(--primary)",
                            background: "var(--primary-light)",
                          }}
                        >
                          <IconZap size={14} />
                          <span>Daily Quiz</span>
                        </Button>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReschedulingTaskId(task.id);
                          setNewDateInput(task.task_date);
                        }}
                      >
                        Reschedule
                      </Button>
                      {!isSkipped && !isCompleted && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSkipPromptTaskId(task.id)}
                          style={{ color: "var(--error)" }}
                        >
                          Skip
                        </Button>
                      )}
                      {isCompleted ? (
                        <Button size="sm" variant="secondary" onClick={() => onUpdateStatus(task.id, "pending")}>
                          Undo
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => onUpdateStatus(task.id, "completed")}>
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
