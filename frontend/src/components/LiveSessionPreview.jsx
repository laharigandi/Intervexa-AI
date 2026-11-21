import React, { useState, useEffect, useContext, useCallback } from "react";
import { InterviewContext } from "../context/InterviewContext";
import {
  IconBot,
  IconVolume2,
  IconPause,
  IconMic,
  IconFileText,
  IconCheckCircle,
  IconSparkles,
} from "./Icons";

const PREVIEW_QUESTIONS = [
  {
    id: 1,
    questionNumber: "Question 3 of 10",
    progressPercent: 30,
    difficulty: "Medium",
    defaultRole: "Python & Distributed Systems",
    question:
      "How would you design an asynchronous worker queue in Python with Redis, and ensure tasks are neither lost nor duplicated during unexpected worker crashes?",
    voiceTranscript:
      "I would utilize Celery or RQ with Redis as the broker, enabling task acknowledgments with acks_late=True and assigning unique idempotency keys. On restart, unacknowledged tasks are requeued, while worker deduplication guards against duplicate execution.",
    textAnswer:
      "I would implement a Redis Stream consumer group with explicit XACK acknowledgments. Unacknowledged message IDs are safely reclaimed via XAUTOCLAIM after a configurable visibility timeout.",
    score: "9.2 / 10",
    scoreBadge: "Strong Response",
    scoreLevel: "high",
  },
  {
    id: 2,
    questionNumber: "Question 4 of 10",
    progressPercent: 40,
    difficulty: "Hard",
    defaultRole: "Full Stack & System Design",
    question:
      "Explain how React 18 Concurrent Features and Fiber architecture optimize render scheduling, and when you would prefer useDeferredValue over debounce.",
    voiceTranscript:
      "React Fiber breaks reconciliation into interruptible units of work using time slicing. useDeferredValue lets React defer updating non-urgent UI without causing artificial typing lag, unlike debounce which delays the entire state update.",
    textAnswer:
      "Fiber's cooperative scheduler prioritizes urgent user inputs over heavy background tree renders. useDeferredValue adapts dynamically to device performance rather than using an arbitrary static delay timer.",
    score: "8.9 / 10",
    scoreBadge: "Strong Response",
    scoreLevel: "high",
  },
  {
    id: 3,
    questionNumber: "Question 5 of 10",
    progressPercent: 50,
    difficulty: "Medium",
    defaultRole: "Cloud & DevOps",
    question:
      "What strategies would you implement for zero-downtime database schema migrations in a Kubernetes microservices environment with continuous traffic?",
    voiceTranscript:
      "I adopt the expand-and-contract pattern: introduce backward-compatible additive schema changes first, deploy services supporting both schemas, migrate data asynchronously, and finally contract by deprecating legacy fields.",
    textAnswer:
      "Using Kubernetes initContainers running Liquibase or Flyway migrations with backward-compatible schema changes, coupled with blue/green or canary traffic shifting across deployments.",
    score: "8.6 / 10",
    scoreBadge: "Good Response",
    scoreLevel: "good",
  },
];

export default function LiveSessionPreview() {
  const { role, jdMatchResult } = useContext(InterviewContext);
  const [activeIdx, setActiveIdx] = useState(0);
  const [responseMode, setResponseMode] = useState("voice"); // "voice" | "text"
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const currentSample = PREVIEW_QUESTIONS[activeIdx] || PREVIEW_QUESTIONS[0];
  const activeRole = role || localStorage.getItem("role") || currentSample.defaultRole;

  // Real ATS Match Percentage extraction (Requirement 2 & 6: Never display fake 88%)
  const validAtsScore = (() => {
    try {
      if (
        jdMatchResult &&
        typeof jdMatchResult.match_score === "number" &&
        jdMatchResult.match_score > 0
      ) {
        return Math.round(jdMatchResult.match_score);
      }
      const raw = localStorage.getItem("jdMatchResult");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.match_score === "number" && parsed.match_score > 0) {
          return Math.round(parsed.match_score);
        }
      }
    } catch {}
    return null;
  })();

  const isSpeechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const stopAudio = useCallback(() => {
    if (isSpeechSupported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  }, [isSpeechSupported]);

  const handleToggleReadAloud = useCallback(() => {
    if (!isSpeechSupported) return;

    if (isPlayingAudio) {
      stopAudio();
      return;
    }

    stopAudio();
    const utterance = new SpeechSynthesisUtterance(currentSample.question);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  }, [isSpeechSupported, isPlayingAudio, stopAudio, currentSample.question]);

  // Stop audio whenever question changes
  useEffect(() => {
    stopAudio();
  }, [activeIdx, stopAudio]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const getScoreColor = (level) => {
    if (level === "high") {
      return {
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.4)",
        text: "#10B981",
        glow: "0 0 14px rgba(16, 185, 129, 0.25)",
      };
    }
    if (level === "good") {
      return {
        bg: "rgba(167, 139, 250, 0.12)",
        border: "rgba(167, 139, 250, 0.4)",
        text: "#A78BFA",
        glow: "0 0 14px rgba(167, 139, 250, 0.25)",
      };
    }
    return {
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.4)",
      text: "#F59E0B",
      glow: "0 0 14px rgba(245, 158, 11, 0.25)",
    };
  };

  const scoreTheme = getScoreColor(currentSample.scoreLevel);

  return (
    <div
      className="live-session-preview-container"
      style={{
        maxWidth: 1120,
        width: "100%",
        margin: "0 auto",
        background: "linear-gradient(180deg, #0B1120 0%, #0F172A 60%, #111D35 100%)",
        borderRadius: 18,
        border: "1px solid rgba(139, 92, 246, 0.22)",
        boxShadow:
          "0 20px 50px -12px rgba(2, 6, 23, 0.75), 0 0 0 1px rgba(139, 92, 246, 0.15), 0 0 35px -15px rgba(124, 58, 237, 0.22)",
        overflow: "hidden",
        textAlign: "left",
        color: "#F1F5F9",
        boxSizing: "border-box",
      }}
    >
      {/* ─── 1. INTERVIEW PROGRESS HEADER (COMPACT) ─── */}
      <div
        style={{
          padding: "11px 18px 9px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(15, 23, 42, 0.65)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 9,
          }}
        >
          {/* Left Badges: Question Num, Track, Difficulty, and ATS Match (if available) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 7,
            }}
          >
            {/* Question Number Pill */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                color: "#FFFFFF",
                padding: "3px 11px",
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.02em",
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.35)",
              }}
            >
              <IconSparkles size={12} color="#FFFFFF" />
              {currentSample.questionNumber}
            </span>

            {/* Selected Track Pill */}
            <span
              style={{
                background: "rgba(139, 92, 246, 0.12)",
                color: "#DDD6FE",
                border: "1px solid rgba(139, 92, 246, 0.28)",
                padding: "3px 10px",
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              Track: {activeRole}
            </span>

            {/* Adaptive Difficulty Pill */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#6EE7B7",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "3px 10px",
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#10B981",
                  boxShadow: "0 0 6px #10B981",
                }}
              />
              Adaptive Difficulty: {currentSample.difficulty}
            </span>

            {/* ATS Match Percentage Badge — Rendered ONLY if real match data exists */}
            {validAtsScore !== null && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34D399",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  padding: "3px 10px",
                  borderRadius: 9999,
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                <span>ATS Match: {validAtsScore}%</span>
                <span
                  style={{
                    width: 42,
                    height: 4,
                    background: "rgba(255, 255, 255, 0.15)",
                    borderRadius: 9999,
                    overflow: "hidden",
                    display: "inline-block",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${validAtsScore}%`,
                      background: "#10B981",
                      borderRadius: 9999,
                    }}
                  />
                </span>
              </span>
            )}
          </div>

          {/* Right Question Switcher Controls (Prev / Next sample questions) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: "#94A3B8",
                marginRight: 2,
                fontWeight: 500,
              }}
            >
              Demo Preview:
            </span>
            {PREVIEW_QUESTIONS.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setActiveIdx(idx)}
                style={{
                  background:
                    activeIdx === idx
                      ? "rgba(139, 92, 246, 0.3)"
                      : "rgba(255, 255, 255, 0.05)",
                  color: activeIdx === idx ? "#FFFFFF" : "#94A3B8",
                  border:
                    activeIdx === idx
                      ? "1px solid #8B5CF6"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                  padding: "2px 8px",
                  borderRadius: 9999,
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                aria-label={`Switch to sample question ${idx + 1}`}
              >
                Q{idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Slim Horizontal Progress Bar */}
        <div
          style={{
            width: "100%",
            height: 4,
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 9999,
            overflow: "hidden",
            position: "relative",
          }}
          role="progressbar"
          aria-valuenow={currentSample.progressPercent}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            style={{
              height: "100%",
              width: `${currentSample.progressPercent}%`,
              background: "linear-gradient(90deg, #7C3AED 0%, #10B981 100%)",
              borderRadius: 9999,
              transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      </div>

      {/* ─── MAIN PREVIEW BODY (COMPACT SPACING) ─── */}
      <div
        style={{
          padding: "15px 18px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* ─── 2. MAIN AI QUESTION AREA ─── */}
        <div
          style={{
            background: "rgba(124, 58, 237, 0.06)",
            borderRadius: 14,
            border: "1px solid rgba(139, 92, 246, 0.22)",
            padding: "13px 16px",
            position: "relative",
            boxShadow: "0 4px 16px -4px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {/* Label */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                color: "#C4B5FD",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "rgba(139, 92, 246, 0.2)",
                  color: "#A78BFA",
                }}
              >
                <IconBot size={12} />
              </span>
              <span>AI Interview Question</span>
            </div>

            {/* Read Aloud / Listen Button */}
            <button
              onClick={handleToggleReadAloud}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: isPlayingAudio
                  ? "rgba(239, 68, 68, 0.16)"
                  : "rgba(139, 92, 246, 0.14)",
                color: isPlayingAudio ? "#FCA5A5" : "#E9D5FF",
                border: isPlayingAudio
                  ? "1px solid rgba(239, 68, 68, 0.4)"
                  : "1px solid rgba(139, 92, 246, 0.35)",
                padding: "4px 11px",
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              title={isPlayingAudio ? "Stop Audio" : "Listen to Question"}
              aria-label={isPlayingAudio ? "Stop Audio" : "Read Aloud"}
            >
              {isPlayingAudio ? (
                <>
                  <IconPause size={12} color="#F87171" />
                  <span>Speaking... Stop</span>
                </>
              ) : (
                <>
                  <IconVolume2 size={12} color="#A78BFA" />
                  <span>Read Aloud</span>
                </>
              )}
            </button>
          </div>

          {/* Large Prominent Question Text */}
          <h3
            style={{
              margin: 0,
              fontSize: "clamp(15px, 1.5vw, 17px)",
              fontWeight: 600,
              color: "#F8FAFC",
              lineHeight: 1.5,
              letterSpacing: "-0.01em",
            }}
          >
            "{currentSample.question}"
          </h3>
        </div>

        {/* ─── 3. CANDIDATE ANSWER / VOICE TRANSCRIPT AREA ─── */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.75)",
            borderRadius: 14,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "12px 16px",
            position: "relative",
          }}
        >
          {/* Mode Switching Tabs & Score Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            {/* Response Mode Selector (Voice vs Text) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(255, 255, 255, 0.04)",
                padding: 2,
                borderRadius: 9999,
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <button
                onClick={() => setResponseMode("voice")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 9999,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background:
                    responseMode === "voice"
                      ? "rgba(16, 185, 129, 0.2)"
                      : "transparent",
                  color: responseMode === "voice" ? "#34D399" : "#94A3B8",
                  transition: "all 0.2s ease",
                }}
              >
                <IconMic size={12} />
                <span>Voice Response</span>
              </button>

              <button
                onClick={() => setResponseMode("text")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 9999,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background:
                    responseMode === "text"
                      ? "rgba(139, 92, 246, 0.2)"
                      : "transparent",
                  color: responseMode === "text" ? "#C4B5FD" : "#94A3B8",
                  transition: "all 0.2s ease",
                }}
              >
                <IconFileText size={12} />
                <span>Text Response</span>
              </button>
            </div>

            {/* ─── 4. PROFESSIONAL SCORE INDICATOR (Oval/Pill Badge) ─── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: scoreTheme.bg,
                  border: `1px solid ${scoreTheme.border}`,
                  color: scoreTheme.text,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontSize: 11.5,
                  fontWeight: 700,
                  boxShadow: scoreTheme.glow,
                  letterSpacing: "0.02em",
                }}
              >
                <IconCheckCircle size={13} />
                <span>Score: {currentSample.score}</span>
                <span
                  style={{
                    opacity: 0.75,
                    fontWeight: 500,
                    fontSize: 10.5,
                    marginLeft: 2,
                  }}
                >
                  • {currentSample.scoreBadge}
                </span>
              </span>
            </div>
          </div>

          {/* Response Content Display */}
          {responseMode === "voice" ? (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              {/* Mic Icon indicator */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  minWidth: 30,
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.16)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  color: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
                className="pulse-mic-live"
              >
                <IconMic size={15} />
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#10B981",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Voice Response Captured
                  </span>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#10B981",
                      boxShadow: "0 0 5px #10B981",
                    }}
                  />
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    color: "#CBD5E1",
                    lineHeight: 1.45,
                    fontStyle: "normal",
                  }}
                >
                  "{currentSample.voiceTranscript}"
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              {/* Text Icon indicator */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  minWidth: 30,
                  borderRadius: "50%",
                  background: "rgba(139, 92, 246, 0.16)",
                  border: "1px solid rgba(139, 92, 246, 0.35)",
                  color: "#A78BFA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                <IconFileText size={15} />
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#A78BFA",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Submitted Text Response
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    color: "#CBD5E1",
                    lineHeight: 1.45,
                  }}
                >
                  "{currentSample.textAnswer}"
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
