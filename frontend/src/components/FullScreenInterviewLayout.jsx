import React, { useState, useEffect } from "react";
import theme from "../styles/theme";
import Button from "./Button";
import ThemeToggle from "./ThemeToggle";
import {
  IconBot,
  IconBriefcase,
  IconSparkles,
  IconLogOut,
  IconAlertTriangle,
  IconX,
  IconCheckCircle,
  IconMaximize,
  IconMinimize,
  IconClock,
} from "./Icons";

/**
 * FullScreenInterviewLayout
 * A dedicated, distraction-free active interview container.
 * Completely hides the main navbar, sidebar, footer, and other tabs.
 * Provides a sleek compact header with session context, progress indicator,
 * live session timer (MM:SS), fullscreen toggle, and an exit confirmation modal.
 */
export default function FullScreenInterviewLayout({
  role = "General Candidate",
  interviewType = "standard", // "adaptive" | "standard"
  currentQuestionIndex = 1,
  totalQuestions = 10,
  answeredCount = 0,
  progressPercent = 0,
  difficulty = null, // "easy" | "medium" | "hard" (for adaptive)
  topic = null, // for adaptive
  onExit,
  children,
}) {
  const [showExitModal, setShowExitModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Live session timer (MM:SS)
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Fullscreen API event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // browser permissions may restrict fullscreen toggle in certain iframe contexts
    }
  };

  const getDifficultyBadge = () => {
    if (!difficulty) return null;
    const d = String(difficulty).toLowerCase();
    const map = {
      easy: { bg: "var(--success-light)", text: "var(--success)", border: "var(--success-border)", label: "Easy" },
      medium: { bg: "var(--primary-light)", text: "var(--primary)", border: "var(--primary-border)", label: "Medium" },
      hard: { bg: "var(--accent-light)", text: "var(--accent)", border: "var(--accent-border)", label: "Hard" },
    };
    const style = map[d] || map.medium;
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          padding: "3px 10px",
          borderRadius: theme.radius.full,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {style.label}
      </span>
    );
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (onExit) {
      onExit();
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        maxHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: theme.background,
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* COMPACT DISTRACTION-FREE INTERVIEW HEADER */}
      <header
        style={{
          height: 56,
          flexShrink: 0,
          background: "var(--bg-nav)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: `1px solid ${theme.border}`,
          position: "sticky",
          top: 0,
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(16px, 2vw, 32px)",
          boxSizing: "border-box",
          boxShadow: "0 2px 10px rgba(113, 56, 245, 0.04)",
          width: "100%",
        }}
      >
        {/* LEFT: Branding & Role Context */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: theme.radius.sm,
                background: theme.gradientPrimary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(113, 56, 245, 0.3)",
              }}
            >
              <IconBot size={18} />
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: 15,
                color: theme.text,
                letterSpacing: "-0.02em",
              }}
              className="fullscreen-brand-title"
            >
              Intervexa <span style={{ color: theme.primary }}>AI</span>
            </span>
          </div>

          <div
            style={{
              height: 20,
              width: 1,
              background: theme.border,
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: theme.text,
                maxWidth: 220,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={role}
              className="fullscreen-role-label"
            >
              {role}
            </span>

            {/* Compact Mobile Question Progress Pill */}
            <span
              className="fullscreen-mobile-q-pill"
              style={{
                display: "none",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: "9999px",
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                whiteSpace: "nowrap",
              }}
            >
              Q{currentQuestionIndex}/{totalQuestions}
            </span>

            {interviewType === "adaptive" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "var(--primary-light)",
                    color: theme.primary,
                    border: `1px solid ${theme.primaryBorder}`,
                    padding: "2px 8px",
                    borderRadius: theme.radius.full,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  <IconSparkles size={11} /> Adaptive
                </span>
                {localStorage.getItem("isPersonalizedAdaptive") === "true" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "#10B981",
                      border: "1px solid rgba(16, 185, 129, 0.28)",
                      padding: "2px 8px",
                      borderRadius: theme.radius.full,
                      fontSize: 10.5,
                      fontWeight: 700,
                    }}
                    title="Interview questions calibrated using your previous performance memory"
                  >
                    Memory Calibrated
                  </span>
                )}
              </div>
            ) : (
              <span
                style={{
                  background: "var(--bg-secondary)",
                  color: theme.muted,
                  border: `1px solid ${theme.border}`,
                  padding: "2px 8px",
                  borderRadius: theme.radius.full,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Standard (10 Qs)
              </span>
            )}

            {getDifficultyBadge()}
          </div>
        </div>

        {/* CENTER: Progress & Question Counter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
          className="fullscreen-center-progress"
        >
          <div style={{ textAlign: "center" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: theme.primary,
                letterSpacing: "0.02em",
              }}
            >
              Question {currentQuestionIndex} of {totalQuestions}
            </span>
            <div
              style={{
                width: 130,
                height: 5,
                background: "var(--border-color)",
                borderRadius: theme.radius.full,
                overflow: "hidden",
                marginTop: 3,
              }}
            >
              <div
                style={{
                  width: `${Math.max(5, Math.min(100, progressPercent))}%`,
                  height: "100%",
                  background: theme.gradientPrimary,
                  borderRadius: theme.radius.full,
                  transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Session Timer, ThemeToggle, Fullscreen Toggle & Exit Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Theme Toggle */}
          <ThemeToggle size="sm" />

          {/* Session Timer */}
          <div
            title="Interview elapsed time"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--primary-light)",
              border: `1px solid ${theme.borderPurple}`,
              padding: "5px 10px",
              borderRadius: theme.radius.sm,
              fontSize: 12,
              fontWeight: 700,
              color: theme.primary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <IconClock size={13} color={theme.primary} />
            <span>{formatTime(secondsElapsed)}</span>
          </div>

          {/* Fullscreen API Toggle */}
          <button
            id="btn-toggle-fullscreen"
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              background: "var(--bg-surface)",
              border: `1px solid ${theme.border}`,
              color: theme.textSecondary,
              borderRadius: theme.radius.sm,
              cursor: "pointer",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--primary-border)";
              e.currentTarget.style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            {isFullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
          </button>

          {/* Exit Button */}
          <button
            id="btn-exit-interview"
            type="button"
            onClick={() => setShowExitModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--bg-surface)",
              border: `1px solid ${theme.border}`,
              color: theme.textSecondary,
              padding: "6px 12px",
              borderRadius: theme.radius.sm,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.18s ease",
            }}
            className="fullscreen-exit-btn"
            title="Exit interview and return to role selection"
          >
            <IconLogOut size={13} color={theme.muted} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT CONTENT - Fluid up to 1440px wide */}
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: theme.maxInterviewWidth,
          margin: "0 auto",
          padding: "clamp(10px, 1.5vw, 18px)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        <div
          className="animate-fade-in"
          style={{
            width: "100%",
            minWidth: 0,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </main>

      {/* CONFIRM EXIT MODAL */}
      {showExitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--bg-modal-overlay)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadow.elevated,
              width: "100%",
              maxWidth: 460,
              padding: "28px 28px 24px",
              boxSizing: "border-box",
              animation: "modalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: theme.warningLight,
                  border: `1px solid ${theme.warningBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.warning,
                  flexShrink: 0,
                }}
              >
                <IconAlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  id="modal-title"
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: 18,
                    fontWeight: 700,
                    color: theme.text,
                  }}
                >
                  Exit Active Interview?
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: theme.muted,
                    lineHeight: 1.55,
                  }}
                >
                  Are you sure you want to exit? Your answered questions are saved locally, but leaving now will stop your current live session.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 22,
                paddingTop: 16,
                borderTop: `1px solid ${theme.borderLight}`,
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowExitModal(false)}
              >
                Keep Practicing
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmExit}
              >
                Exit Session
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fullscreen-exit-btn:hover {
          background-color: var(--error-light) !important;
          border-color: var(--error-border) !important;
          color: var(--error) !important;
        }
        @media (max-width: 768px) {
          .fullscreen-center-progress {
            display: none !important;
          }
          .fullscreen-brand-title {
            display: none !important;
          }
          .fullscreen-mobile-q-pill {
            display: inline-flex !important;
          }
        }
        @media (min-width: 769px) {
          .fullscreen-mobile-q-pill {
            display: none !important;
          }
        }
        @media (max-width: 480px) {
          #btn-toggle-fullscreen {
            display: none !important;
          }
          .fullscreen-role-label {
            max-width: 110px !important;
            font-size: 11.5px !important;
          }
        }
        @media (max-width: 360px) {
          .fullscreen-role-label {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
