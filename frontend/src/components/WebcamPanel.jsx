import React, { useEffect, useRef } from "react";
import theme from "../styles/theme";
import {
  IconCamera,
  IconCameraOff,
  IconMic,
  IconMicOff,
  IconUser,
  IconShield,
  IconAlertTriangle,
  IconCheckCircle,
} from "./Icons";
import { FACE_STATUS } from "../hooks/useMonitoring";

/**
 * WebcamPanel Component
 *
 * Renders the live webcam feed during the active interview.
 * Sits alongside the Question Panel to simulate a genuine face-to-face mock interview.
 *
 * Features:
 * - Mirrored live video feed (natural feedback)
 * - Candidate badge & Live status indicator
 * - In-panel quick controls: Camera On/Off, Mic Mute/Unmute
 * - Graceful off-state with avatar placeholder
 * - Strict local privacy badge
 */
export default function WebcamPanel({
  stream,
  isCameraEnabled,
  isMicEnabled,
  onToggleCamera,
  onToggleMic,
  candidateName = "Candidate",
  onRequestCamera,
  videoRef: videoRefProp = null,      // external ref for monitoring hook
  faceStatus = null,                  // from useMonitoring
}) {
  const internalVideoRef = useRef(null);
  // Use external ref if provided, else internal
  const videoRef = videoRefProp || internalVideoRef;

  // Connect video element to active media stream
  useEffect(() => {
    if (videoRef.current && stream && isCameraEnabled) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        // autoplay restriction catch
      });
    }
  }, [stream, isCameraEnabled]);

  return (
    <div
      className="webcam-panel-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 220,
        maxHeight: 280,
        background: "#090D16",
        borderRadius: 18,
        border: "1px solid rgba(113, 56, 245, 0.25)",
        boxShadow: "0 10px 30px -5px rgba(15, 23, 42, 0.35)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* 1. Video Element or Off-State Placeholder */}
      {isCameraEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)", // Mirrored
            zIndex: 1,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 50% 40%, #1E1B4B 0%, #090D16 80%)",
            color: "#94A3B8",
            zIndex: 1,
            padding: 16,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(113, 56, 245, 0.15)",
              border: "1px solid rgba(113, 56, 245, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
              color: "#C4B5FD",
            }}
          >
            <IconUser size={28} color="#C4B5FD" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>
            Camera is Off
          </span>
          <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
            Your video preview is currently paused
          </span>

          {onRequestCamera && !stream && (
            <button
              onClick={onRequestCamera}
              style={{
                marginTop: 10,
                padding: "6px 14px",
                borderRadius: 8,
                background: theme.gradientPrimary,
                color: "#FFFFFF",
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconCamera size={13} color="#FFFFFF" />
              Enable Camera
            </button>
          )}
        </div>
      )}

      {/* 2. Top Header Overlay */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(9, 13, 22, 0.75) 0%, rgba(9, 13, 22, 0) 100%)",
        }}
      >
        {/* Status Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 20,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isCameraEnabled
                ? faceStatus === FACE_STATUS.OK
                  ? "#10B981"
                  : faceStatus === FACE_STATUS.NO_FACE_ALERT || faceStatus === FACE_STATUS.MULTI_ALERT
                  ? "#EF4444"
                  : faceStatus === FACE_STATUS.NO_FACE_GRACE || faceStatus === FACE_STATUS.MULTI_GRACE
                  ? "#F59E0B"
                  : "#10B981"
                : "#F59E0B",
              boxShadow: isCameraEnabled ? "0 0 8px #10B981" : "none",
            }}
          />
          {isCameraEnabled
            ? faceStatus === FACE_STATUS.OK
              ? "Live · ✓ 1 Face"
              : faceStatus === FACE_STATUS.NO_FACE_ALERT
              ? "Live · ⚠ No Face"
              : faceStatus === FACE_STATUS.NO_FACE_GRACE
              ? "Live · Checking…"
              : faceStatus === FACE_STATUS.MULTI_ALERT
              ? "Live · ✗ Multi-Face"
              : faceStatus === FACE_STATUS.MULTI_GRACE
              ? "Live · Checking…"
              : "Live Camera"
            : "Camera Off"}
        </div>

        {/* Candidate Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 20,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#E2E8F0",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <IconUser size={13} color="#A78BFA" />
          <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {candidateName}
          </span>
        </div>
      </div>

      {/* 3. Bottom Controls Overlay */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(0deg, rgba(9, 13, 22, 0.85) 0%, rgba(9, 13, 22, 0) 100%)",
        }}
      >
        {/* Hardware Toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Camera Toggle */}
          <button
            id="btn-toggle-camera"
            onClick={onToggleCamera}
            title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: isCameraEnabled ? "rgba(255, 255, 255, 0.15)" : "#EF4444",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isCameraEnabled ? <IconCamera size={15} /> : <IconCameraOff size={15} />}
          </button>

          {/* Mic Toggle */}
          <button
            id="btn-toggle-mic"
            onClick={onToggleMic}
            title={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: isMicEnabled ? "rgba(255, 255, 255, 0.15)" : "#EF4444",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isMicEnabled ? <IconMic size={15} /> : <IconMicOff size={15} />}
          </button>
        </div>

        {/* Local-Only Privacy Indicator */}
        <div
          title="Local practice preview only. Stream is not recorded or transmitted."
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "rgba(255, 255, 255, 0.6)",
            fontSize: 10,
            fontWeight: 500,
          }}
        >
          <IconShield size={12} color="#A78BFA" />
          <span>Local Only</span>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .webcam-panel-container {
            min-height: 160px !important;
            max-height: 200px !important;
          }
        }
      `}</style>
    </div>
  );
}
