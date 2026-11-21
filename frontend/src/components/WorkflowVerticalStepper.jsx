import React from "react";
import { useNavigate } from "react-router-dom";
import { IconCheckCircle, IconSparkles } from "./Icons";

const STEPS = [
  {
    number: 1,
    title: "Upload Resume",
    desc: "PDF & ATS Analysis",
    path: "/upload",
  },
  {
    number: 2,
    title: "Select Role",
    desc: "Target Job & Mode",
    path: "/role",
  },
  {
    number: 3,
    title: "Mock Interview",
    desc: "10 Technical Questions",
    path: "/interview",
  },
  {
    number: 4,
    title: "Results & Analysis",
    desc: "AI Evaluation & Scores",
    path: "/results",
  },
];

/**
 * WorkflowVerticalStepper
 * Professional SaaS vertical stepper sidebar for the left column of the interview preparation workflow.
 */
function WorkflowVerticalStepper({
  currentStep = 1,
  hasValidResume = false,
  hasRole = false,
  hasCompletedInterview = false,
  className = "",
  style = {},
}) {
  const navigate = useNavigate();

  const handleStepClick = (step) => {
    if (step.number === currentStep) {
      // Already on current page
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (step.number === 1) {
      navigate("/upload");
      return;
    }

    if (step.number === 2) {
      if (hasValidResume) {
        navigate("/role");
      }
      return;
    }

    if (step.number === 3) {
      if (hasRole) {
        navigate("/interview");
      }
      return;
    }

    if (step.number === 4) {
      if (hasCompletedInterview) {
        navigate("/results");
      }
      return;
    }
  };

  const getStepState = (stepNumber) => {
    // Current step
    if (stepNumber === currentStep) {
      // If Step 1 and resume is already uploaded & analyzed, it's both active and completed
      const isCompleted = stepNumber === 1 && hasValidResume;
      return {
        isActive: true,
        isCompleted: isCompleted,
        isLocked: false,
        statusText: isCompleted ? "Active • Ready" : "In Progress",
      };
    }

    // Previous steps
    if (stepNumber < currentStep) {
      return {
        isActive: false,
        isCompleted: true,
        isLocked: false,
        statusText: "Completed",
      };
    }

    // Future steps
    if (stepNumber === 2) {
      return {
        isActive: false,
        isCompleted: false,
        isLocked: !hasValidResume,
        statusText: hasValidResume ? "Ready" : "Upcoming",
      };
    }

    if (stepNumber === 3) {
      return {
        isActive: false,
        isCompleted: false,
        isLocked: !hasRole,
        statusText: hasRole ? "Ready" : "Upcoming",
      };
    }

    return {
      isActive: false,
      isCompleted: false,
      isLocked: true,
      statusText: "Upcoming",
    };
  };

  return (
    <aside
      className={`workflow-vertical-sidebar ${className}`}
      aria-label="Interview Preparation Workflow"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        borderRadius: 14,
        boxShadow: "var(--shadow-card)",
        position: "relative",
        overflow: "hidden",
        padding: "20px 18px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Brand Purple Top Accent Stripe (Standard Interview Card Reference) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3.5px",
          background: "linear-gradient(90deg, var(--primary), #B89EFF)",
        }}
      />

      {/* Stepper Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--primary-light)",
            border: "1px solid var(--primary-border)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconSparkles size={16} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              color: "var(--text-main)",
              letterSpacing: "-0.015em",
            }}
          >
            Workflow Progress
          </h3>
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
            Step {currentStep} of {STEPS.length}
          </span>
        </div>
      </div>

      {/* Vertical Steps List */}
      <nav className="vertical-stepper-track" aria-label="Workflow Steps" style={{ position: "relative" }}>
        {STEPS.map((step, index) => {
          const { isActive, isCompleted, isLocked, statusText } = getStepState(step.number);
          const isClickable = !isLocked && (step.number === currentStep || step.number < currentStep || (step.number === 2 && hasValidResume));
          const isLast = index === STEPS.length - 1;

          return (
            <div
              key={step.number}
              className={`vertical-step-row ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""} ${isLocked ? "locked" : ""}`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                paddingBottom: isLast ? 0 : 20,
              }}
            >
              {/* Connector line between steps */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 28,
                    left: 14,
                    bottom: 0,
                    width: 2,
                    background: isCompleted
                      ? "var(--success, #10B981)"
                      : isActive
                        ? "var(--primary)"
                        : "var(--border-color)",
                    transition: "background 0.3s ease",
                    zIndex: 1,
                  }}
                />
              )}

              {/* Step Circle Node */}
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 800,
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  background: isCompleted
                    ? "var(--success, #10B981)"
                    : isActive
                      ? "var(--primary)"
                      : "var(--bg-secondary)",
                  color: isCompleted || isActive ? "#FFFFFF" : "var(--text-muted)",
                  border: isCompleted
                    ? "2px solid var(--success, #10B981)"
                    : isActive
                      ? "2px solid var(--primary)"
                      : "1.5px solid var(--border-color)",
                  boxShadow: isActive ? "0 0 0 4px var(--primary-glow)" : isCompleted ? "0 2px 6px rgba(16, 185, 129, 0.25)" : "none",
                }}
              >
                {isCompleted ? "✓" : step.number}
              </div>

              {/* Step Content / Interactive Pill */}
              <div
                onClick={() => isClickable && handleStepClick(step)}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : -1}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    handleStepClick(step);
                  }
                }}
                className={`vertical-step-content ${isClickable ? "clickable" : ""}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: isActive ? "var(--primary-light)" : "transparent",
                  border: isActive ? "1px solid var(--primary-border)" : "1px solid transparent",
                  cursor: isClickable ? "pointer" : "default",
                  transition: "all 0.2s ease",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 700 : isCompleted ? 600 : 500,
                      color: isActive
                        ? "var(--primary)"
                        : isCompleted
                          ? "var(--text-main)"
                          : "var(--text-secondary)",
                      letterSpacing: "-0.01em",
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {step.title}
                  </span>

                  {/* Status Badge */}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 9999,
                      background: isCompleted
                        ? "var(--success-light, rgba(16, 185, 129, 0.12))"
                        : isActive
                          ? "var(--bg-surface)"
                          : "var(--bg-secondary)",
                      color: isCompleted
                        ? "var(--success, #10B981)"
                        : isActive
                          ? "var(--primary)"
                          : "var(--text-muted)",
                      border: isCompleted
                        ? "1px solid var(--success-border, rgba(16, 185, 129, 0.3))"
                        : isActive
                          ? "1px solid var(--primary-border)"
                          : "1px solid var(--border-color)",
                      flexShrink: 0,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {statusText}
                  </span>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 11.5,
                    color: isActive ? "var(--primary)" : "var(--text-muted)",
                    opacity: isActive ? 0.9 : 0.8,
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Hint / Info Notice */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <IconCheckCircle size={14} color={hasValidResume ? "var(--primary)" : "var(--text-muted)"} />
        <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.3 }}>
          {hasValidResume
            ? "Resume verified. Ready to proceed."
            : "Upload PDF resume to unlock Role Selection."}
        </span>
      </div>

      <style>{`
        .vertical-step-content.clickable:hover {
          background: var(--primary-light) !important;
          border-color: var(--primary-border) !important;
          transform: translateX(2px);
        }
        .vertical-step-content.clickable:hover span {
          color: var(--primary) !important;
        }
      `}</style>
    </aside>
  );
}

export default WorkflowVerticalStepper;
