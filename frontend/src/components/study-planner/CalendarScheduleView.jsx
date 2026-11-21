import React, { useState } from "react";
import Button from "../Button";
import { IconCheckCircle, IconClock, IconSparkles, IconZap } from "../Icons";

export default function CalendarScheduleView({
  tasks = [],
  onOpenAssistant,
  onUpdateStatus,
}) {
  const [viewMode, setViewMode] = useState("week"); // 'week', 'all'

  const safeTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];

  // Group tasks by date
  const tasksByDate = safeTasks.reduce((acc, task) => {
    if (!task) return acc;
    const d = task.task_date || "Scheduled";
    if (!acc[d]) acc[d] = [];
    acc[d].push(task);
    return acc;
  }, {});

  const dates = Object.keys(tasksByDate).sort();
  const displayedDates = viewMode === "week" ? dates.slice(0, 7) : dates;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Calendar Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.2rem 0" }}>
            Study Plan Calendar
          </h3>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary, #94a3b8)" }}>
            Visual schedule of daily tasks, milestones, and spaced revisions.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            onClick={() => setViewMode("week")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "0.5rem",
              border: viewMode === "week" ? "1px solid var(--primary)" : "1px solid var(--border-color)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              background: viewMode === "week" ? "var(--primary)" : "var(--bg-surface)",
              color: viewMode === "week" ? "#fff" : "var(--text-secondary)",
              boxShadow: viewMode === "week" ? "0 2px 8px var(--primary-glow)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            First 7 Days
          </button>
          <button
            onClick={() => setViewMode("all")}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "0.5rem",
              border: viewMode === "all" ? "1px solid var(--primary)" : "1px solid var(--border-color)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              background: viewMode === "all" ? "var(--primary)" : "var(--bg-surface)",
              color: viewMode === "all" ? "#fff" : "var(--text-secondary)",
              boxShadow: viewMode === "all" ? "0 2px 8px var(--primary-glow)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Full Plan Overview ({dates.length} Days)
          </button>
        </div>
      </div>

      {/* Grid of Days */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
          gap: "1rem",
        }}
      >
        {displayedDates.map((dateStr, idx) => {
          const dayTasks = tasksByDate[dateStr] || [];
          const allCompleted = dayTasks.length > 0 && dayTasks.every((t) => t.status === "completed");
          const hasToday = dayTasks.some((t) => t.is_today);

          let parsedDate;
          try {
            parsedDate = new Date(dateStr + "T00:00:00");
          } catch {
            parsedDate = new Date();
          }

          const dayOfWeek = parsedDate.toLocaleDateString("en-US", { weekday: "short" });
          const monthDay = parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

          return (
            <div
              key={dateStr}
              style={{
                borderRadius: "14px",
                background: hasToday
                  ? "var(--primary-light)"
                  : "var(--bg-surface)",
                border: hasToday
                  ? "2px solid var(--primary)"
                  : "1px solid var(--border-color)",
                padding: "1.1rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                boxShadow: hasToday ? "0 4px 15px -1px var(--primary-glow)" : "var(--shadow-card)",
              }}
            >
              {/* Day Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: hasToday ? "var(--primary)" : "var(--text-secondary)",
                    }}
                  >
                    {dayOfWeek}
                  </span>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>{monthDay}</div>
                </div>
                {allCompleted ? (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.55rem",
                      borderRadius: "9999px",
                      background: "var(--success-light)",
                      color: "var(--success)",
                      border: "1px solid var(--success-border)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <IconCheckCircle size={12} /> Done
                  </span>
                ) : hasToday ? (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.55rem",
                      borderRadius: "9999px",
                      background: "var(--primary)",
                      color: "#fff",
                    }}
                  >
                    Today
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "6px",
                    }}
                  >
                    Day {dayTasks[0]?.day_number || idx + 1}
                  </span>
                )}
              </div>

              {/* Tasks within this day */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {dayTasks.map((t) => {
                  const isTaskDone = t.status === "completed";
                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: "0.7rem 0.85rem",
                        borderRadius: "8px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            textDecoration: isTaskDone ? "line-through" : "none",
                            color: isTaskDone ? "var(--text-secondary)" : "var(--text-main)",
                            lineHeight: 1.35,
                          }}
                        >
                          {t.topic}
                        </span>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                            background:
                              t.priority === "Critical"
                                ? "var(--error-light)"
                                : t.priority === "High"
                                ? "var(--warning-light)"
                                : "var(--primary-light)",
                            color:
                              t.priority === "Critical"
                                ? "var(--error)"
                                : t.priority === "High"
                                ? "var(--warning)"
                                : "var(--primary)",
                            border: `1px solid ${
                              t.priority === "Critical"
                                ? "var(--error-border)"
                                : t.priority === "High"
                                ? "var(--warning-border)"
                                : "var(--primary-border)"
                            }`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.priority}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.2rem" }}>
                        <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                          ⏱ {t.estimated_minutes} min
                        </span>
                        <button
                          onClick={() => onOpenAssistant(t.topic, t.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--primary)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "0.15rem 0.35rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <IconSparkles size={12} /> Practice
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

