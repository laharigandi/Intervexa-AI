import React from "react";
import { FACE_STATUS, NOISE_STATUS } from "../hooks/useMonitoring";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconCamera,
  IconCameraOff,
  IconMic,
  IconMicOff,
  IconShield,
} from "./Icons";

/**
 * MonitoringStatusBar
 *
 * A compact, non-intrusive status bar displayed during active interviews.
 * Shows real-time face-detection and background-noise status.
 * Displays a blocking banner above the answer area when submission is paused.
 *
 * All detection is local — nothing is uploaded or recorded.
 */

// Dev diagnostics: set to true to surface raw monitoring metrics in the UI.
// Keep false in production.
const SHOW_DIAG = false;

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  green  : "#10B981",
  amber  : "#F59E0B",
  red    : "#EF4444",
  muted  : "#64748B",
  purple : "#A78BFA",
};

// ─── Dot indicator ────────────────────────────────────────────────────────────
function Dot({ color, pulse = false }) {
  return (
    <span
      style={{
        display     : "inline-block",
        width       : 8,
        height      : 8,
        borderRadius: "50%",
        background  : color,
        boxShadow   : color !== C.muted ? `0 0 6px ${color}88` : "none",
        flexShrink  : 0,
        animation   : pulse ? "monitorPulse 1.8s ease-in-out infinite" : "none",
      }}
    />
  );
}

// ─── Face status label ────────────────────────────────────────────────────────
function FaceLabel({ status, count }) {
  switch (status) {
    case FACE_STATUS.LOADING:
      return (
        <>
          <Dot color={C.muted} />
          <span>Loading face detection…</span>
        </>
      );
    case FACE_STATUS.INITIALIZING:
      return (
        <>
          <Dot color={C.muted} />
          <span>Checking camera…</span>
        </>
      );
    case FACE_STATUS.UNAVAILABLE:
      return (
        <>
          <IconCameraOff size={12} color={C.muted} />
          <span>Camera unavailable — enable camera access</span>
        </>
      );
    case FACE_STATUS.ERROR:
      return (
        <>
          <IconAlertTriangle size={12} color={C.amber} />
          <span style={{ color: C.amber }}>Face detection unavailable — check camera or reload</span>
        </>
      );
    case FACE_STATUS.OK:
      return (
        <>
          <Dot color={C.green} />
          <span style={{ color: C.green }}>Face detected</span>
        </>
      );
    case FACE_STATUS.NO_FACE_GRACE:
      return (
        <>
          <Dot color={C.amber} pulse />
          <span style={{ color: C.amber }}>No face detected. Please look at the camera.</span>
        </>
      );
    case FACE_STATUS.NO_FACE_ALERT:
      return (
        <>
          <IconAlertTriangle size={12} color={C.red} />
          <span style={{ color: C.red }}>No face detected — please stay in front of the camera</span>
        </>
      );
    case FACE_STATUS.MULTI_GRACE:
      return (
        <>
          <Dot color={C.amber} pulse />
          <span style={{ color: C.amber }}>
            Multiple faces detected ({count}). Only one candidate should be visible.
          </span>
        </>
      );
    case FACE_STATUS.MULTI_ALERT:
      return (
        <>
          <IconAlertTriangle size={12} color={C.red} />
          <span style={{ color: C.red }}>
            Multiple faces detected ({count}). Only one candidate should be visible.
          </span>
        </>
      );
    default:
      return (
        <>
          <Dot color={C.muted} />
          <span>Initializing…</span>
        </>
      );
  }
}

// ─── Noise status label ───────────────────────────────────────────────────────
function NoiseLabel({ status }) {
  switch (status) {
    case NOISE_STATUS.INACTIVE:
      return null;
    case NOISE_STATUS.INITIALIZING:
      return (
        <>
          <Dot color={C.muted} />
          <span>Requesting mic access…</span>
        </>
      );
    case NOISE_STATUS.CALIBRATING:
      return (
        <>
          <Dot color={C.muted} />
          <span>Calibrating audio…</span>
        </>
      );
    case NOISE_STATUS.OK:
      return (
        <>
          <Dot color={C.green} />
          <span style={{ color: C.green }}>Audio level normal</span>
        </>
      );
    case NOISE_STATUS.MODERATE:
      return (
        <>
          <Dot color={C.amber} pulse />
          <span style={{ color: C.amber }}>High ambient audio level detected</span>
        </>
      );
    case NOISE_STATUS.HIGH_ALERT:
      return (
        <>
          <IconAlertTriangle size={12} color={C.red} />
          <span style={{ color: C.red }}>
            High ambient audio level. Please move to a quieter environment.
          </span>
        </>
      );
    case NOISE_STATUS.UNAVAILABLE:
      return (
        <>
          <IconMicOff size={12} color={C.muted} />
          <span>Microphone unavailable — check browser permissions</span>
        </>
      );
    default:
      return null;
  }
}

// ─── Blocking banner ──────────────────────────────────────────────────────────
function BlockingBanner({ faceBlocked, noiseBlocked, faceStatus }) {
  if (!faceBlocked && !noiseBlocked) return null;

  let reason   = "";
  let recovery = "";

  if (faceBlocked && noiseBlocked) {
    reason   = "Face presence issue and high ambient audio detected.";
    recovery = "Ensure only you are visible and reduce background noise.";
  } else if (faceBlocked) {
    if (faceStatus === FACE_STATUS.NO_FACE_ALERT) {
      reason   = "No face detected. Please stay in front of the camera.";
      recovery = "Submission will resume when your face is visible again.";
    } else {
      reason   = "Multiple faces detected. Only the candidate should be visible.";
      recovery = "Submission will resume when only one face is consistently detected.";
    }
  } else {
    reason   = "Sustained high ambient audio level detected.";
    recovery = "Submission will resume when audio returns to an acceptable level.";
  }

  return (
    <div
      className="monitor-fade-in"
      role="alert"
      aria-live="assertive"
      style={{
        display      : "flex",
        alignItems   : "flex-start",
        gap          : 10,
        padding      : "10px 14px",
        borderRadius : 8,
        background   : "rgba(239, 68, 68, 0.10)",
        border       : "1px solid rgba(239, 68, 68, 0.4)",
        marginBottom : 10,
      }}
    >
      <IconAlertTriangle
        size={16}
        color={C.red}
        style={{ flexShrink: 0, marginTop: 1 }}
        className="monitor-alert-blink"
      />
      <div>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.red, display: "block" }}>
          Submission paused — {reason}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary, #94A3B8)", marginTop: 2, display: "block" }}>
          {recovery}
        </span>
      </div>
    </div>
  );
}

// ─── Dev diagnostics panel ────────────────────────────────────────────────────
function DiagPanel({ diagInfo, faceStatus, noiseStatus, noiseLevel }) {
  if (!SHOW_DIAG) return null;
  return (
    <div
      style={{
        marginTop    : 6,
        padding      : "6px 10px",
        background   : "rgba(0,0,0,0.35)",
        borderRadius : 6,
        fontSize     : 10,
        fontFamily   : "monospace",
        color        : "#94A3B8",
        lineHeight   : 1.6,
      }}
    >
      <strong style={{ color: "#A78BFA" }}>[Monitoring Debug]</strong>
      {" "} model:{diagInfo.modelLoaded ? "✓" : "loading"}{" "}
      videoReady:{diagInfo.videoReady ? "✓" : "✗"}{" "}
      frames:{diagInfo.framesProcessed}{" "}
      faces:{diagInfo.lastFaceCount} conf:{diagInfo.lastConfidence}%{" "}
      | mic:{diagInfo.analyserActive ? "✓" : "✗"}{" "}
      rms:{diagInfo.currentRms}{" "}
      grace:{diagInfo.graceFrames}{" "}
      | faceState:{faceStatus} noiseState:{noiseStatus}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MonitoringStatusBar({
  faceStatus,
  faceCount         = 0,
  faceError         = null,
  noiseStatus,
  noiseLevel        = 0,
  monitoringBlocked = false,
  faceBlocked       = false,
  noiseBlocked      = false,
  isFaceDetectionSupported = true,
  diagInfo          = {},
}) {
  const noiseActive = noiseStatus !== NOISE_STATUS.INACTIVE;

  // Don't render if there's nothing meaningful to show
  if (
    faceStatus === FACE_STATUS.LOADING &&
    !noiseActive
  ) {
    return null;
  }

  return (
    <div
      className="monitoring-status-bar monitor-fade-in"
      aria-live="polite"
      style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }}
    >
      {/* Blocking banner */}
      <BlockingBanner
        faceBlocked={faceBlocked}
        noiseBlocked={noiseBlocked}
        faceStatus={faceStatus}
      />

      {/* Status pills row */}
      <div
        style={{
          display       : "flex",
          alignItems    : "center",
          gap           : 8,
          flexWrap      : "wrap",
          padding       : "6px 12px",
          borderRadius  : 8,
          background    : "rgba(15, 23, 42, 0.55)",
          border        : "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(6px)",
        }}
      >
        {/* Privacy label */}
        <span
          title="All monitoring is local — no data is recorded or transmitted"
          style={{
            display    : "inline-flex",
            alignItems : "center",
            gap        : 4,
            fontSize   : 10,
            fontWeight : 600,
            color      : "rgba(167,139,250,0.8)",
            flexShrink : 0,
          }}
        >
          <IconShield size={11} color={C.purple} />
          <span className="monitor-label-desktop">Monitor</span>
        </span>

        <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />

        {/* Face pill */}
        <span
          style={{
            display    : "inline-flex",
            alignItems : "center",
            gap        : 5,
            fontSize   : 11,
            fontWeight : 600,
            color      : "var(--text-secondary, #94A3B8)",
            lineHeight : 1.3,
          }}
        >
          <IconCamera size={12} color="var(--text-secondary, #94A3B8)" style={{ flexShrink: 0 }} />
          <FaceLabel status={faceStatus} count={faceCount} />
        </span>

        {/* Noise pill — shown when monitoring is active */}
        {noiseActive && (
          <>
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
            <span
              style={{
                display    : "inline-flex",
                alignItems : "center",
                gap        : 5,
                fontSize   : 11,
                fontWeight : 600,
                color      : "var(--text-secondary, #94A3B8)",
                lineHeight : 1.3,
              }}
            >
              <IconMic size={12} color="var(--text-secondary, #94A3B8)" style={{ flexShrink: 0 }} />
              <NoiseLabel status={noiseStatus} />
            </span>
          </>
        )}
      </div>

      {/* Dev diagnostics */}
      <DiagPanel
        diagInfo={diagInfo}
        faceStatus={faceStatus}
        noiseStatus={noiseStatus}
        noiseLevel={noiseLevel}
      />
    </div>
  );
}
