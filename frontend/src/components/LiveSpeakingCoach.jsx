import React, { useState, useEffect, useRef, useMemo } from "react";
import theme from "../styles/theme";
import {
  IconClock,
  IconSparkles,
  IconMaximize,
  IconMinimize,
} from "./Icons";

const FILLER_REGEXES = [
  { word: "um", regex: /\bum\b/gi },
  { word: "uh", regex: /\buh\b/gi },
  { word: "like", regex: /\blike\b/gi },
  { word: "you know", regex: /\byou\s+know\b/gi },
  { word: "basically", regex: /\bbasically\b/gi },
  { word: "actually", regex: /\bactually\b/gi },
  { word: "i mean", regex: /\bi\s+mean\b/gi },
];

export default function LiveSpeakingCoach({
  isRecording = false,
  transcript = "",
  duration = 0,
  onTelemetryUpdate = null,
  compact = false,
}) {
  const [minimized, setMinimized] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);
  const [totalPauseDuration, setTotalPauseDuration] = useState(0);
  const lastSpeechTimeRef = useRef(Date.now());
  const pauseTimerRef = useRef(null);

  // Parse words and compute WPM
  const words = useMemo(() => {
    const clean = (transcript || "").trim();
    if (!clean) return [];
    return clean.match(/\b[A-Za-z0-9'-]+\b/g) || [];
  }, [transcript]);

  const wordCount = words.length;

  const wpm = useMemo(() => {
    if (duration < 3 || wordCount < 3) return 0;
    const mins = duration / 60.0;
    return Math.round(wordCount / mins);
  }, [duration, wordCount]);

  // Determine Pace Category
  const paceInfo = useMemo(() => {
    if (wpm === 0 || duration < 3) {
      return { category: "Calibrating", color: "#6B7280", bg: "rgba(107, 114, 128, 0.1)", label: "Waiting for speech..." };
    }
    if (wpm < 100) {
      return { category: "Slow", color: "#D97706", bg: "rgba(217, 119, 6, 0.12)", label: "Slow (<100 WPM)" };
    }
    if (wpm <= 160) {
      return { category: "Moderate", color: "#059669", bg: "rgba(5, 150, 105, 0.12)", label: "Moderate (Optimal: 100-160 WPM)" };
    }
    if (wpm <= 190) {
      return { category: "Fast", color: "#EA580C", bg: "rgba(234, 88, 12, 0.12)", label: "Fast (161-190 WPM)" };
    }
    return { category: "Very Fast", color: "#DC2626", bg: "rgba(220, 38, 38, 0.12)", label: "Very Fast (>190 WPM)" };
  }, [wpm, duration]);

  // Filler words counting
  const fillerAnalysis = useMemo(() => {
    const text = transcript.toLowerCase();
    const counts = {};
    let total = 0;
    FILLER_REGEXES.forEach(({ word, regex }) => {
      const matches = text.match(regex);
      const cnt = matches ? matches.length : 0;
      counts[word] = cnt;
      total += cnt;
    });
    return { counts, total };
  }, [transcript]);

  // Silence / pause detection: pause >= 2.0s
  useEffect(() => {
    if (!isRecording) return;
    lastSpeechTimeRef.current = Date.now();
  }, [transcript]);

  useEffect(() => {
    if (!isRecording) {
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
      return;
    }

    pauseTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSinceSpeech = (now - lastSpeechTimeRef.current) / 1000;
      if (elapsedSinceSpeech >= 2.0) {
        // Increment silence duration
        setTotalPauseDuration((prev) => +(prev + 0.5).toFixed(1));
        // If just hit 2.0s boundary
        if (Math.abs(elapsedSinceSpeech - 2.0) < 0.3) {
          setPauseCount((prev) => prev + 1);
        }
      }
    }, 500);

    return () => {
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
    };
  }, [isRecording]);

  // Push telemetry up to parent if callback provided
  useEffect(() => {
    if (onTelemetryUpdate) {
      onTelemetryUpdate({
        wpm,
        speedCategory: paceInfo.category,
        wordCount,
        durationSeconds: duration,
        pauseCount,
        pauseDuration: totalPauseDuration,
        fillerCount: fillerAnalysis.total,
        fillerCounts: fillerAnalysis.counts,
      });
    }
  }, [wpm, paceInfo.category, wordCount, duration, pauseCount, totalPauseDuration, fillerAnalysis.total, onTelemetryUpdate]);

  // Real-time coaching message
  const coachingTip = useMemo(() => {
    if (!isRecording && wordCount === 0) return "Start speaking to activate live pace & filler coaching.";
    if (duration < 5) return "Speak clearly at a natural, conversational tempo.";
    if (paceInfo.category === "Very Fast" || paceInfo.category === "Fast") {
      return "Slow down slightly so technical trade-offs are easy to absorb.";
    }
    if (paceInfo.category === "Slow") {
      return "Pick up your tempo slightly to keep the interviewer engaged.";
    }
    if (fillerAnalysis.total >= 3) {
      return "Verbal fillers detected. Try pausing silently for 1 second instead.";
    }
    if (pauseCount >= 3) {
      return "Long pauses detected. Structure points upfront using the STAR framework.";
    }
    return "Great vocal delivery! Natural pacing and clear expression.";
  }, [isRecording, wordCount, duration, paceInfo.category, fillerAnalysis.total, pauseCount]);

  if (minimized) {
    return (
      <div
        className="live-speaking-coach-minimized"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 12px",
          borderRadius: 20,
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow.sm,
          fontSize: "12px",
          fontWeight: 600,
          color: theme.text,
          cursor: "pointer",
        }}
        onClick={() => setMinimized(false)}
        title="Click to expand AI Speaking Coach"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isRecording ? "#10B981" : "#9CA3AF",
            animation: isRecording ? "pulse 1.5s infinite" : "none",
          }}
        />
        <span>Speaking Coach:</span>
        <span style={{ color: paceInfo.color, fontWeight: 700 }}>{wpm > 0 ? `${wpm} WPM` : "Calibrating"}</span>
        <span style={{ color: theme.border }}>|</span>
        <span style={{ color: fillerAnalysis.total > 2 ? "#DC2626" : theme.textSecondary }}>
          {fillerAnalysis.total} Fillers
        </span>
        <span style={{ color: theme.border }}>|</span>
        <span style={{ color: theme.muted }}>{pauseCount} Pauses</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(false);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: theme.primary,
            padding: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <IconMaximize size={13} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="live-speaking-coach-panel"
      style={{
        borderRadius: theme.radius.md,
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        boxShadow: "0 4px 18px rgba(0, 0, 0, 0.05)",
        padding: compact ? "10px 14px" : "12px 16px",
        width: "100%",
        boxSizing: "border-box",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: isRecording ? "linear-gradient(135deg, #10B981, #059669)" : "linear-gradient(135deg, #6B7280, #4B5563)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: isRecording ? "0 0 10px rgba(16, 185, 129, 0.4)" : "none",
            }}
          >
            <IconSparkles size={13} />
          </div>
          <div>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 6 }}>
              AI Real-Time Speaking Coach
              {isRecording && (
                <span
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 8,
                    background: "#ECFDF5",
                    color: "#059669",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Listening
                </span>
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: theme.muted,
            padding: "2px 4px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: "11px",
            borderRadius: 4,
          }}
          title="Minimize Coach Widget"
        >
          <IconMinimize size={13} />
          <span>Minimize</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginBottom: 10,
        }}
      >
        {/* Metric 1: Speaking Speed */}
        <div
          style={{
            background: paceInfo.bg,
            border: `1px solid ${paceInfo.color}30`,
            borderRadius: theme.radius.sm,
            padding: "7px 10px",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 600, color: theme.muted, textTransform: "uppercase" }}>
            Speed (WPM)
          </div>
          <div style={{ fontSize: "17px", fontWeight: 800, color: paceInfo.color, marginTop: 1 }}>
            {wpm > 0 ? wpm : "--"}
          </div>
          <div style={{ fontSize: "10px", fontWeight: 700, color: paceInfo.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {paceInfo.category}
          </div>
        </div>

        {/* Metric 2: Filler Words */}
        <div
          style={{
            background: fillerAnalysis.total > 2 ? "rgba(220, 38, 38, 0.08)" : theme.hoverBg,
            border: `1px solid ${fillerAnalysis.total > 2 ? "rgba(220, 38, 38, 0.25)" : theme.border}`,
            borderRadius: theme.radius.sm,
            padding: "7px 10px",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 600, color: theme.muted, textTransform: "uppercase" }}>
            Fillers
          </div>
          <div style={{ fontSize: "17px", fontWeight: 800, color: fillerAnalysis.total > 2 ? "#DC2626" : theme.text, marginTop: 1 }}>
            {fillerAnalysis.total}
          </div>
          <div style={{ fontSize: "10px", fontWeight: 600, color: theme.muted }}>
            {fillerAnalysis.total === 0 ? "Clean delivery" : "Detected"}
          </div>
        </div>

        {/* Metric 3: Long Pauses (>= 2s) */}
        <div
          style={{
            background: pauseCount > 2 ? "rgba(217, 119, 6, 0.08)" : theme.hoverBg,
            border: `1px solid ${pauseCount > 2 ? "rgba(217, 119, 6, 0.25)" : theme.border}`,
            borderRadius: theme.radius.sm,
            padding: "7px 10px",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 600, color: theme.muted, textTransform: "uppercase" }}>
            Pauses (≥2s)
          </div>
          <div style={{ fontSize: "17px", fontWeight: 800, color: pauseCount > 2 ? "#D97706" : theme.text, marginTop: 1 }}>
            {pauseCount}
          </div>
          <div style={{ fontSize: "10px", fontWeight: 600, color: theme.muted }}>
            {totalPauseDuration}s silence
          </div>
        </div>

        {/* Metric 4: Duration */}
        <div
          style={{
            background: theme.hoverBg,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.sm,
            padding: "7px 10px",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 600, color: theme.muted, textTransform: "uppercase" }}>
            Duration
          </div>
          <div style={{ fontSize: "17px", fontWeight: 800, color: theme.text, marginTop: 1 }}>
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}
          </div>
          <div style={{ fontSize: "10px", fontWeight: 600, color: theme.muted }}>
            {wordCount} words
          </div>
        </div>
      </div>

      {/* Live Coaching Tip Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 10px",
          borderRadius: 6,
          background: "rgba(99, 102, 241, 0.06)",
          border: "1px dashed rgba(99, 102, 241, 0.3)",
          fontSize: "11px",
          color: "#4338CA",
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: "12px" }}>💡</span>
        <span>{coachingTip}</span>
      </div>
    </div>
  );
}

