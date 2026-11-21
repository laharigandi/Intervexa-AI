import React, { useEffect, useRef, useState } from "react";
import theme from "../styles/theme";
import {
  IconCamera,
  IconCameraOff,
  IconMic,
  IconMicOff,
  IconShield,
  IconCheckCircle,
  IconAlertTriangle,
  IconRefresh,
  IconPlay,
  IconArrowLeft,
} from "./Icons";

/**
 * PreInterviewSetup Component
 *
 * Provides a professional pre-flight check before entering the full-screen mock interview.
 * - Live camera preview with mirrored video
 * - Hardware permission handling (granted, denied, unavailable, unsupported)
 * - "Continue Without Camera" fallback
 * - Privacy assurance notice
 * - One-click trigger for browser Fullscreen API + interview launch
 */
export default function PreInterviewSetup({
  roleTitle,
  interviewMode = "standard", // "standard" | "adaptive"
  stream,
  permissionState,
  isCameraEnabled,
  isMicEnabled,
  errorMessage,
  onStartInterview,
  onRetryPermission,
  onContinueWithoutCamera,
  onCancel,
}) {
  const videoRef = useRef(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Bind video element to media stream
  useEffect(() => {
    if (videoRef.current && stream && permissionState === "granted") {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        // autoplay restriction catch
      });
    }
  }, [stream, permissionState]);

  const handleRetry = async () => {
    setIsInitializing(true);
    try {
      await onRetryPermission?.();
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 20px",
        boxSizing: "border-box",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          background: "var(--bg-surface)",
          borderRadius: 24,
          boxShadow: theme.shadow.elevated,
          border: `1px solid ${theme.borderPurple}`,
          overflow: "hidden",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: `1px solid ${theme.borderLight}`,
            background: "var(--gradient-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: theme.gradientPrimary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 8px 16px -4px rgba(124, 58, 237, 0.35)",
              }}
            >
              <IconCamera size={22} color="#FFFFFF" />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: theme.text,
                  letterSpacing: "-0.02em",
                }}
              >
                Device Setup
              </h1>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 13,
                  color: theme.textSecondary,
                }}
              >
                {roleTitle ? `Role: ${roleTitle}` : "Technical Interview"} &bull;{" "}
                <span style={{ fontWeight: 600, color: theme.primary }}>
                  {interviewMode === "adaptive" ? "Adaptive Mode" : "Standard (10 Qs)"}
                </span>
              </p>
            </div>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${theme.border}`,
                background: "var(--bg-surface)",
                color: theme.textSecondary,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
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
              <IconArrowLeft size={16} />
              Back
            </button>
          )}
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: "clamp(16px, 3.5vw, 32px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "clamp(16px, 3vw, 28px)",
          }}
        >
          {/* Left Column: Webcam Preview Box */}
          <div>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 10",
                background: "var(--bg-main)",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.4), 0 8px 24px -4px rgba(15, 23, 42, 0.2)",
                border: `1px solid ${theme.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* State 1: Camera Granted & Active */}
              {permissionState === "granted" && stream && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: "scaleX(-1)", // Mirror video for natural candidate feedback
                    }}
                  />
                  {/* Overlay Badge: Live Camera */}
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      background: "rgba(15, 23, 42, 0.75)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      padding: "6px 12px",
                      borderRadius: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#10B981",
                        boxShadow: "0 0 10px #10B981",
                      }}
                    />
                    Live Camera Ready
                  </div>

                  {/* Overlay Badge: Mic Status */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 14,
                      left: 14,
                      background: "rgba(15, 23, 42, 0.75)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      padding: "6px 12px",
                      borderRadius: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: isMicEnabled ? "#A7F3D0" : "#FDE68A",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {isMicEnabled ? <IconMic size={14} color="#10B981" /> : <IconMicOff size={14} color="#F59E0B" />}
                    {isMicEnabled ? "Microphone Detected" : "Mic Optional"}
                  </div>
                </>
              )}

              {/* State 2: Permission Denied */}
              {permissionState === "denied" && (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "#F8FAFC",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "rgba(239, 68, 68, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconCameraOff size={28} color="#EF4444" />
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
                      Camera Access Blocked
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", maxWidth: 280, lineHeight: 1.5 }}>
                      Click the lock or camera icon in your browser address bar to allow camera access, then retry.
                    </p>
                  </div>
                  <button
                    onClick={handleRetry}
                    disabled={isInitializing}
                    style={{
                      marginTop: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: theme.gradientPrimary,
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <IconRefresh size={14} />
                    {isInitializing ? "Checking..." : "Retry Camera Check"}
                  </button>
                </div>
              )}

              {/* State 3: Device Unavailable / Not Found */}
              {permissionState === "unavailable" && (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "#F8FAFC",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "rgba(245, 158, 11, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconAlertTriangle size={28} color="#F59E0B" />
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
                      No Camera Detected
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", maxWidth: 280, lineHeight: 1.5 }}>
                      We couldn't detect a connected webcam. You can still proceed with standard or voice interview questions.
                    </p>
                  </div>
                </div>
              )}

              {/* State 4: Prompt / Unsupported / Initializing */}
              {(permissionState === "prompt" || permissionState === "unsupported") && (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "#F8FAFC",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "rgba(113, 56, 245, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconCamera size={28} color="#A78BFA" />
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
                      Camera Authorization
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", maxWidth: 280, lineHeight: 1.5 }}>
                      Enable camera preview to simulate a genuine face-to-face video interview environment.
                    </p>
                  </div>
                  <button
                    onClick={handleRetry}
                    disabled={isInitializing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 18px",
                      borderRadius: 8,
                      background: theme.gradientPrimary,
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <IconCamera size={16} />
                    {isInitializing ? "Connecting..." : "Enable Camera"}
                  </button>
                </div>
              )}
            </div>

            {/* Error Message pill if present */}
            {errorMessage && permissionState !== "granted" && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: theme.dangerLight,
                  border: `1px solid ${theme.dangerBorder}`,
                  color: theme.danger,
                  fontSize: 12,
                  lineHeight: 1.4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconAlertTriangle size={16} color={theme.danger} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Right Column: Readiness Checklist, Privacy Guarantee, and Launch CTA */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20 }}>
            <div>
              <h3
                style={{
                  margin: "0 0 14px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color: theme.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Interview Environment Check
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <IconCheckCircle size={18} color={theme.success} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                      Camera Framing & Lighting
                    </span>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12, color: theme.textSecondary, lineHeight: 1.4 }}>
                      Position yourself at eye level with front-facing light for professional posture.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <IconCheckCircle size={18} color={theme.success} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                      Speech Recognition & Voice
                    </span>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12, color: theme.textSecondary, lineHeight: 1.4 }}>
                      Speak naturally. You can respond using your microphone or type in your answers anytime.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <IconCheckCircle size={18} color={theme.success} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                      Distraction-Free Immersion
                    </span>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12, color: theme.textSecondary, lineHeight: 1.4 }}>
                      The session expands into a full-screen workspace, hiding sidebars and tabs.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Shield Box */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "var(--bg-secondary)",
                border: `1px solid ${theme.borderPurple}`,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <IconShield size={18} color={theme.primary} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 2px 0", fontSize: 12, fontWeight: 700, color: theme.text }}>
                  100% Local Privacy Guarantee
                </h4>
                <p style={{ margin: 0, fontSize: 11, color: theme.textSecondary, lineHeight: 1.45 }}>
                  Your camera stream is mirrored strictly on your local screen for posture and confidence practice. No video or audio is ever recorded, stored on servers, or analyzed by AI.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                id="btn-start-mock-interview"
                onClick={() => onStartInterview?.()}
                style={{
                  width: "100%",
                  padding: "13px 22px",
                  borderRadius: 12,
                  background: theme.gradientHero,
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  boxShadow: "0 8px 20px -4px rgba(113, 56, 245, 0.35)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px -4px rgba(113, 56, 245, 0.45)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 20px -4px rgba(113, 56, 245, 0.35)";
                }}
              >
                <IconPlay size={17} color="#FFFFFF" />
                Start Interview
              </button>

              {/* Secondary fallback if camera is not enabled or user prefers no camera */}
              {permissionState !== "granted" && (
                <button
                  id="btn-continue-without-camera"
                  onClick={() => onContinueWithoutCamera?.()}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "transparent",
                    color: theme.textSecondary,
                    border: `1px solid ${theme.border}`,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary-border)";
                    e.currentTarget.style.color = "var(--primary)";
                    e.currentTarget.style.background = "var(--primary-light)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Continue Without Camera
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
