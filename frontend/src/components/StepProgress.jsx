import React from "react";
import theme from "../styles/theme";

const STEPS = [
  { number: 1, label: "Upload Resume" },
  { number: 2, label: "Select Role" },
  { number: 3, label: "Mock Interview" },
  { number: 4, label: "Results & Analysis" },
];

function StepProgress({ currentStep = 1 }) {
  const safeStepNum = Math.max(1, Math.min(STEPS.length, Number(currentStep) || 1));
  const activeStep = STEPS.find((s) => s.number === safeStepNum) || STEPS[0];
  const progressPercent = Math.round((safeStepNum / STEPS.length) * 100);

  return (
    <div className="stepper-container">
      {/* =====================================================================
          DESKTOP (>= 1024px) & TABLET (641px - 1023px) FULL HORIZONTAL STEPPER
          ===================================================================== */}
      <div className="stepper-desktop-tablet">
        <div className="stepper-track">
          {STEPS.map((step, index) => {
            const isComplete = currentStep > step.number;
            const isActive = currentStep === step.number;

            return (
              <div
                key={step.number}
                className={`stepper-step-item ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: index < STEPS.length - 1 ? 1 : "none",
                  minWidth: 0,
                }}
              >
                <div
                  className="stepper-step-content"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="stepper-circle"
                    style={{
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      background: isComplete
                        ? "var(--primary)"
                        : isActive
                        ? "var(--primary)"
                        : "var(--bg-surface)",
                      color: isComplete || isActive ? "#FFFFFF" : "var(--text-muted)",
                      border: isActive
                        ? `2px solid var(--primary)`
                        : isComplete
                        ? `2px solid var(--primary)`
                        : `1px solid var(--border-color)`,
                      boxShadow: isActive ? "0 0 0 4px var(--primary-glow)" : "none",
                      transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  >
                    {isComplete ? "✓" : step.number}
                  </span>
                  <span
                    className="stepper-label"
                    style={{
                      fontWeight: isActive ? 700 : isComplete ? 600 : 500,
                      color: isActive ? "var(--primary)" : isComplete ? "var(--text-main)" : "var(--text-muted)",
                      whiteSpace: "nowrap",
                      letterSpacing: "-0.01em",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {step.label}
                  </span>
                </div>

                {index < STEPS.length - 1 && (
                  <div
                    className="stepper-connector"
                    style={{
                      flex: 1,
                      height: 2.5,
                      background: isComplete ? "var(--primary)" : "var(--border-color)",
                      borderRadius: 9999,
                      transition: "background 0.3s ease",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          MOBILE COMPACT STEPPER (< 641px)
          Dynamic Step Number, Title, Segmented Dots & Progress Bar
          ===================================================================== */}
      <div className="stepper-mobile-view">
        {/* Top Info Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: theme.primary,
            }}
          >
            Step {safeStepNum} of {STEPS.length}
          </span>

          {/* Segmented mini step indicators */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {STEPS.map((s) => {
              const isDone = currentStep > s.number;
              const isCur = currentStep === s.number;
              return (
                <span
                  key={s.number}
                  title={`Step ${s.number}: ${s.label}`}
                  style={{
                    width: isCur ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: isDone
                      ? "var(--primary)"
                      : isCur
                      ? "var(--primary)"
                      : "var(--border-color, #CBD5E1)",
                    boxShadow: isCur ? "0 0 0 2px var(--primary-glow)" : "none",
                    transition: "all 0.25s ease",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Current Active Step Title */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: theme.text,
            marginBottom: 8,
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
          }}
        >
          {activeStep.label}
        </div>

        {/* Progress Bar & Percentage Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`Workflow progress: Step ${safeStepNum} of ${STEPS.length} - ${activeStep.label}`}
            style={{
              flex: 1,
              height: 7,
              background: "var(--border-light, rgba(0,0,0,0.08))",
              borderRadius: 9999,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                background: theme.gradientPrimary,
                borderRadius: 9999,
                transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: theme.primary,
              minWidth: 32,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {progressPercent}%
          </span>
        </div>
      </div>

      <style>{`
        /* Stepper Container Baseline */
        .stepper-container {
          background: var(--bg-surface);
          border-bottom: 1px solid ${theme.border};
          padding: 14px clamp(18px, 2.5vw, 36px);
          width: 100%;
          box-sizing: border-box;
          transition: background-color 0.25s ease, border-color 0.25s ease;
        }

        /* Desktop Mode (>= 1024px) */
        @media (min-width: 1024px) {
          .stepper-desktop-tablet {
            display: block;
            width: 100%;
            max-width: var(--max-content-width, 1280px);
            margin: 0 auto;
          }
          .stepper-track {
            display: flex;
            align-items: center;
            justifyContent: space-between;
            width: 100%;
            flex-wrap: nowrap;
          }
          .stepper-circle {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }
          .stepper-label {
            font-size: 13px;
          }
          .stepper-connector {
            margin: 0 12px;
            min-width: 20px;
          }
          .stepper-mobile-view {
            display: none !important;
          }
        }

        /* Tablet Responsive Mode (641px - 1023px) */
        @media (min-width: 641px) and (max-width: 1023px) {
          .stepper-container {
            padding: 12px 18px;
          }
          .stepper-desktop-tablet {
            display: block;
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
          }
          .stepper-track {
            display: flex;
            align-items: center;
            justifyContent: space-between;
            width: 100%;
            flex-wrap: nowrap;
          }
          .stepper-step-content {
            gap: 7px !important;
          }
          .stepper-circle {
            width: 28px;
            height: 28px;
            font-size: 11px;
          }
          .stepper-label {
            font-size: 12px;
          }
          .stepper-connector {
            margin: 0 6px;
            min-width: 10px;
          }
          .stepper-mobile-view {
            display: none !important;
          }
        }

        /* Mobile Compact Mode (<= 640px) */
        @media (max-width: 640px) {
          .stepper-container {
            padding: 10px 16px;
          }
          .stepper-desktop-tablet {
            display: none !important;
          }
          .stepper-mobile-view {
            display: block !important;
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}

export default StepProgress;
