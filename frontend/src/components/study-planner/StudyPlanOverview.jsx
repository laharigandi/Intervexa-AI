import React from "react";
import Button from "../Button";
import {
  IconTarget,
  IconZap,
  IconClock,
  IconCheckCircle,
  IconRefresh,
  IconSparkles,
  IconDownload,
  IconTrash,
} from "../Icons";

export default function StudyPlanOverview({
  plan,
  onOpenConfig,
  onRegenerate,
  onDownloadPdf,
  onDeleteRoadmap,
  onOpenAssistant,
  onCompleteTodayTask,
  onOpenQuiz,
  loading = false,
  pdfDownloading = false,
  isDeleting = false,
}) {
  if (!plan || !plan.has_active_plan) return null;

  const completionPct = plan.completion_rate_pct || 0;
  const streakDays = plan.streak_days || 0;
  const completedTasks = plan.completed_tasks || 0;
  const totalTasks = plan.total_tasks || 0;
  const todayTasks = plan.today_tasks || [];
  const primaryTodayTask = todayTasks[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Banner & Control Card */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "0.75rem",
          background: "linear-gradient(135deg, var(--primary-light) 0%, rgba(184, 158, 255, 0.08) 100%)",
          border: "1px solid var(--primary-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                background: "var(--primary)",
                color: "#fff",
                letterSpacing: "0.04em",
              }}
            >
              Active AI Study Plan
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.2rem 0.55rem",
                borderRadius: "9999px",
                background: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              {plan.preparation_level} Level
            </span>
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", color: "var(--text-main)" }}>
            <span>{plan.requested_topic ? `${plan.requested_topic} Learning Roadmap` : plan.target_role}</span>
            {plan.requested_topic && plan.target_role && !plan.target_role.includes(plan.requested_topic) && (
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", background: "var(--primary-light)", border: "1px solid var(--primary-border)", padding: "0.15rem 0.55rem", borderRadius: "9999px" }}>
                {plan.target_role}
              </span>
            )}
          </h2>
          <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {plan.duration_days}-Day Plan • {plan.daily_study_minutes} mins daily study • {plan.days_remaining} days remaining
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          {onDownloadPdf && (
            <Button
              variant="secondary"
              onClick={onDownloadPdf}
              disabled={pdfDownloading || loading || isDeleting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <IconDownload size={15} />
              <span>{pdfDownloading ? "Generating PDF..." : "Download PDF"}</span>
            </Button>
          )}
          <Button variant="secondary" onClick={onOpenConfig} disabled={loading || isDeleting}>
            Configure Plan
          </Button>
          <Button variant="primary" onClick={onRegenerate} disabled={loading || isDeleting}>
            <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
            <span>Regenerate Roadmap</span>
          </Button>
          {onDeleteRoadmap && (
            <Button
              variant="danger"
              onClick={(e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                const planId = plan?.plan_id || plan?.id;
                console.log("[StudyPlanOverview] Delete Roadmap button clicked! target planId:", planId);
                onDeleteRoadmap(planId);
              }}
              disabled={isDeleting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.35)",
              }}
            >
              <IconTrash size={14} />
              <span>{isDeleting ? "Deleting..." : "Delete Roadmap"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4 Stat Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Metric 1: Overall Progress */}
        <div
          className="study-stat-card"
          style={{
            padding: "18px 20px",
            borderRadius: "14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-card)",
            transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Plan Completion
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconTarget size={17} />
            </div>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--text-main)" }}>
            {completionPct}%
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: "6px",
              width: "100%",
              borderRadius: "3px",
              background: "var(--border-color)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${completionPct}%`,
                background: "var(--primary)",
                borderRadius: "3px",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Metric 2: Study Streak */}
        <div
          className="study-stat-card"
          style={{
            padding: "18px 20px",
            borderRadius: "14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-card)",
            transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Study Streak
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
              }}
            >
              <IconZap size={17} />
            </div>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 800, marginBottom: "0.2rem", color: "var(--text-main)" }}>
            {streakDays} {streakDays === 1 ? "Day" : "Days"}
          </div>
          <div style={{ fontSize: "0.78rem", color: streakDays > 0 ? "var(--success)" : "var(--text-secondary)" }}>
            {streakDays > 0 ? "Daily momentum active! Keep it going." : "Complete today's task to start streak."}
          </div>
        </div>

        {/* Metric 3: Tasks Completed */}
        <div
          className="study-stat-card"
          style={{
            padding: "18px 20px",
            borderRadius: "14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-card)",
            transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Tasks Completed
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCheckCircle size={17} />
            </div>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 800, marginBottom: "0.2rem", color: "var(--text-main)" }}>
            {completedTasks} / {totalTasks}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {totalTasks - completedTasks} tasks remaining in schedule
          </div>
        </div>

        {/* Metric 4: Time Invested */}
        <div
          className="study-stat-card"
          style={{
            padding: "18px 20px",
            borderRadius: "14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-card)",
            transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              Study Hours
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconClock size={17} />
            </div>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 800, marginBottom: "0.2rem", color: "var(--text-main)" }}>
            {(plan.completed_minutes / 60).toFixed(1)}h / {(plan.total_estimated_minutes / 60).toFixed(1)}h
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            Based on completed task commitments
          </div>
        </div>
      </div>

      {/* Today's Focus Card */}
      {primaryTodayTask && (
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderRadius: "14px",
            background: "var(--primary-light)",
            border: "1px solid var(--primary-border)",
            borderLeft: "4px solid var(--primary)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: "0 2px 8px var(--primary-glow)",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#818cf8",
                  letterSpacing: "0.05em",
                }}
              >
                Today's Priority Focus
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary, #94a3b8)" }}>
                • Day {primaryTodayTask.day_number} ({primaryTodayTask.estimated_minutes} min)
              </span>
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
              {primaryTodayTask.topic}
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", lineHeight: 1.4 }}>
              {primaryTodayTask.description}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {onOpenQuiz && (
              <Button
                variant="secondary"
                onClick={() => onOpenQuiz(primaryTodayTask.day_number, primaryTodayTask.topic)}
                style={{
                  border: "1px solid var(--primary-border)",
                  color: "var(--primary)",
                  background: "var(--primary-light)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <IconZap size={14} />
                <span>Daily Quiz</span>
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => onOpenAssistant(primaryTodayTask.topic, primaryTodayTask.id)}
            >
              <IconSparkles size={14} />
              <span>Launch AI Practice</span>
            </Button>
            {primaryTodayTask.status !== "completed" && (
              <Button
                variant="secondary"
                onClick={() => onCompleteTodayTask(primaryTodayTask.id)}
              >
                Mark Done
              </Button>
            )}
          </div>
        </div>
      )}

      <style>{`
        .study-stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.12) !important;
        }
      `}</style>
    </div>
  );
}

