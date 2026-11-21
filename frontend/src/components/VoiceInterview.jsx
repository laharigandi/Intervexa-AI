import { useState, useEffect, useRef, useCallback } from "react";
import Card from "./Card";
import Button from "./Button";
import theme from "../styles/theme";
import { textareaStyle } from "../styles/shared";
import {
  IconMic,
  IconMicOff,
  IconVolume2,
  IconVolumeX,
  IconRotateCcw,
  IconCheckCircle,
  IconAlertTriangle,
  IconSparkles,
  IconArrowLeft,
  IconArrowRight,
  IconFileText,
} from "./Icons";

const SUPPORTED_LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-IN", label: "English (India)" },
  { code: "te-IN", label: "Telugu (తెలుగు)" },
];

function VoiceInterview({
  questionList = [],
  answers = [],
  onAnswerChange,
  onSubmit,
  loading = false,
  effectiveRole = "Candidate",
  onSwitchToText,
  webcamComponent = null,
  monitoringBlocked = false,
  monitoringBar = null,
  activeIndex = 0,
  onActiveIndexChange = null,
  progressPercent = 0,
}) {
  const [internalIndex, setInternalIndex] = useState(activeIndex || 0);
  const currentIndex = activeIndex !== undefined ? activeIndex : internalIndex;

  const setCurrentIndex = (val) => {
    const nextIdx = typeof val === "function" ? val(currentIndex) : val;
    setInternalIndex(nextIdx);
    if (typeof onActiveIndexChange === "function") {
      onActiveIndexChange(nextIdx);
    }
  };

  const [recordingState, setRecordingState] = useState("idle"); // idle | listening | processing | ready | error
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);
  const [autoReadPreference, setAutoReadPreference] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);

  const recognitionRef = useRef(null);
  const isManuallyStoppedRef = useRef(false);
  const recordingStartTimeRef = useRef(null);
  const durationsRef = useRef({});

  useEffect(() => {
    let interval = null;
    if (recordingState === "listening") {
      interval = setInterval(() => {
        const base = durationsRef.current[currentIndex] || 0;
        const currentBatch = recordingStartTimeRef.current ? (Date.now() - recordingStartTimeRef.current) / 1000 : 0;
        setLiveDuration(Math.round(base + currentBatch));
      }, 500);
    } else {
      setLiveDuration(Math.round(durationsRef.current[currentIndex] || 0));
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState, currentIndex]);

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Check browser capabilities
  const isSpeechRecognitionSupported = typeof window !== "undefined" && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );
  const isSpeechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const currentQuestion = questionList[currentIndex] || "";
  const currentAnswer = answers[currentIndex] || "";

  // Stop active speech synthesis
  const stopSpeaking = useCallback(() => {
    if (isSpeechSynthesisSupported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
    }
  }, [isSpeechSynthesisSupported]);

  // Read current question aloud
  const speakQuestion = useCallback(() => {
    if (!isSpeechSynthesisSupported || !window.speechSynthesis || !currentQuestion) {
      return;
    }

    if (isSpeakingQuestion) {
      stopSpeaking();
      return;
    }

    if (recordingState === "listening") {
      stopRecording();
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(currentQuestion);
    utterance.lang = selectedLanguage === "te-IN" ? "te-IN" : "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeakingQuestion(true);
    utterance.onend = () => setIsSpeakingQuestion(false);
    utterance.onerror = () => setIsSpeakingQuestion(false);

    window.speechSynthesis.speak(utterance);
  }, [currentQuestion, isSpeechSynthesisSupported, isSpeakingQuestion, stopSpeaking, recordingState, selectedLanguage]);

  // Record elapsed duration for active speaking timing
  const recordElapsedDuration = useCallback(() => {
    if (recordingStartTimeRef.current) {
      const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
      durationsRef.current[currentIndex] = (durationsRef.current[currentIndex] || 0) + elapsed;
      recordingStartTimeRef.current = null;
    }
  }, [currentIndex]);

  // Stop recording safely
  const stopRecording = useCallback(() => {
    isManuallyStoppedRef.current = true;
    recordElapsedDuration();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Recognition stop error:", err);
      }
    }
    setRecordingState((prev) => (prev === "listening" ? "ready" : prev));
    setInterimTranscript("");
  }, [recordElapsedDuration]);

  // Cleanup on unmount or question change
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [stopSpeaking]);

  useEffect(() => {
    stopSpeaking();
    stopRecording();
    setInterimTranscript("");
    setErrorMessage("");

    if (autoReadPreference && isSpeechSynthesisSupported) {
      const timer = setTimeout(() => {
        speakQuestion();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex]);

  // Start speech recognition
  const startRecording = () => {
    setErrorMessage("");
    stopSpeaking();

    if (!isSpeechRecognitionSupported) {
      setRecordingState("error");
      setErrorMessage("Speech Recognition is not supported by your browser. Please switch to Text Interview or use Google Chrome/Edge.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      isManuallyStoppedRef.current = false;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        recordingStartTimeRef.current = Date.now();
        setRecordingState("listening");
        setInterimTranscript("");
        setErrorMessage("");
      };

      recognition.onresult = (event) => {
        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcriptSegment + " ";
          } else {
            interim += transcriptSegment;
          }
        }

        if (finalChunk.trim()) {
          const currentText = (answers[currentIndex] || "").trim();
          const updatedText = currentText ? `${currentText} ${finalChunk.trim()}` : finalChunk.trim();
          onAnswerChange(currentIndex, updatedText);
        }

        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "no-speech") {
          setRecordingState("ready");
          return;
        }

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setRecordingState("error");
          setErrorMessage("Microphone permission denied. Please allow microphone access in your browser settings or switch to Text Interview.");
          return;
        }

        if (event.error === "audio-capture") {
          setRecordingState("error");
          setErrorMessage("No microphone detected. Please connect an audio input device.");
          return;
        }

        if (event.error === "network") {
          setRecordingState("error");
          setErrorMessage("Speech recognition network error. Please verify your internet connection or use Text Interview.");
          return;
        }

        setRecordingState("ready");
      };

      recognition.onend = () => {
        recordElapsedDuration();
        setInterimTranscript("");
        if (!isManuallyStoppedRef.current && recordingState === "listening") {
          setRecordingState("ready");
        }
      };

      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition start exception:", err);
      setRecordingState("error");
      setErrorMessage("Could not initialize speech recognition. Please check microphone permissions or switch to Text Mode.");
    }
  };

  const handleClearAnswer = () => {
    stopRecording();
    durationsRef.current[currentIndex] = 0;
    onAnswerChange(currentIndex, "");
    setInterimTranscript("");
    setRecordingState("idle");
  };

  const answeredCount = answers.filter((a) => (a || "").trim() !== "").length;
  const computedProgress = questionList.length > 0 ? Math.round((answeredCount / questionList.length) * 100) : 0;
  const effectiveProgress = progressPercent || computedProgress;
  const isCurrentAnswered = (currentAnswer || "").trim().length > 0;
  const wordCount = (currentAnswer || "").trim().split(/\s+/).filter(Boolean).length;
  const isLastQuestion = currentIndex === questionList.length - 1;

  const handleNext = () => {
    stopSpeaking();
    stopRecording();
    if (currentIndex < questionList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    stopSpeaking();
    stopRecording();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmitAll = () => {
    if (monitoringBlocked) return;
    stopRecording();
    recordElapsedDuration();
    const durationList = questionList.map((_, idx) => durationsRef.current[idx] || null);
    if (typeof onSubmit === "function") {
      onSubmit(durationList);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14, width: "100%" }}>
      {/* Monitoring status bar */}
      {monitoringBar}

      {/* CARD 1: INTERVIEW CONTROLS & QUESTION JUMP BAR (Matches Text Interview exactly) */}
      <Card style={{ marginBottom: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {/* Mode Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Input Mode:
            </span>
            <div
              style={{
                display: "inline-flex",
                background: theme.background,
                padding: 4,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.border}`,
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={onSwitchToText}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: theme.radius.sm - 2,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: "transparent",
                  color: theme.textSecondary,
                  transition: "all 0.18s ease",
                }}
              >
                <IconFileText size={14} /> Text
              </button>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: theme.radius.sm - 2,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: theme.primary,
                  color: "#FFFFFF",
                  transition: "all 0.18s ease",
                }}
              >
                <IconMic size={14} /> Voice (Mic)
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 600 }}>
              {answeredCount} of {questionList.length} answered ({effectiveProgress}%)
            </span>
          </div>
        </div>

        {/* Question Jump Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", marginRight: 4, letterSpacing: "0.04em" }}>
            Jump to:
          </span>
          {questionList.map((_, idx) => {
            const isAnswered = (answers[idx] || "").trim().length > 0;
            const isActive = currentIndex === idx;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  fontSize: 12,
                  fontWeight: 700,
                  border: isActive
                    ? `2px solid ${theme.primary}`
                    : isAnswered
                    ? `1px solid ${theme.successBorder}`
                    : `1px solid ${theme.border}`,
                  background: isActive
                    ? theme.primaryLight
                    : isAnswered
                    ? theme.successLight
                    : "var(--bg-surface)",
                  color: isActive
                    ? theme.primary
                    : isAnswered
                    ? theme.success
                    : theme.muted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: isActive ? "0 0 0 3px rgba(113, 56, 245, 0.16)" : "none",
                }}
                title={`Question ${idx + 1}: ${isAnswered ? "Answered" : "Pending"}`}
              >
                {isAnswered ? "✓" : idx + 1}
              </button>
            );
          })}
        </div>
      </Card>

      {/* CARD 2: FOCUSED SINGLE QUESTION VIEW (VOICE) */}
      <Card style={{ marginBottom: 0 }}>
        {/* Header: Question label, controls & word count */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: isCurrentAnswered ? theme.successLight : theme.primaryLight,
                color: isCurrentAnswered ? theme.success : theme.primary,
                border: `1px solid ${isCurrentAnswered ? theme.successBorder : theme.primaryBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {isCurrentAnswered ? "✓" : currentIndex + 1}
            </span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: theme.text }}>
              Interview Question {currentIndex + 1} of {questionList.length}
            </h3>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Language Selector */}
            <select
              aria-label="Recognition Language"
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                if (recordingState === "listening") {
                  stopRecording();
                }
              }}
              style={{
                padding: "5px 10px",
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.border}`,
                fontSize: 12,
                fontWeight: 600,
                color: theme.text,
                background: "var(--bg-surface)",
                cursor: "pointer",
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>

            {/* Read Aloud Button */}
            {isSpeechSynthesisSupported && (
              <Button
                variant={isSpeakingQuestion ? "primary" : "secondary"}
                size="sm"
                onClick={speakQuestion}
                icon={isSpeakingQuestion ? IconVolumeX : IconVolume2}
              >
                {isSpeakingQuestion ? "Stop Audio" : "Read Aloud"}
              </Button>
            )}

            {/* Word Count */}
            <span style={{ fontSize: 13, color: theme.muted }}>
              {wordCount} words
            </span>

            {/* Clear Button */}
            {isCurrentAnswered && (
              <button
                type="button"
                onClick={handleClearAnswer}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.danger,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 0,
                }}
              >
                <IconRotateCcw size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Side-by-side Question Banner & Live Webcam Panel (Matches Text Interview) */}
        {webcamComponent ? (
          <div
            className="interview-qa-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(260px, 1fr)",
              gap: 16,
              marginBottom: 12,
              alignItems: "stretch",
            }}
          >
            <div
              key={currentIndex}
              className="question-transition"
              style={{
                color: theme.text,
                fontSize: "clamp(15px, 1.5vw, 17px)",
                fontWeight: 600,
                lineHeight: 1.55,
                background: "var(--gradient-card)",
                padding: "16px 18px",
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.borderPurple}`,
                display: "flex",
                alignItems: "center",
              }}
            >
              {currentQuestion}
            </div>
            <div style={{ height: "100%", minHeight: 180 }}>
              {webcamComponent}
            </div>
          </div>
        ) : (
          <div
            key={currentIndex}
            className="question-transition"
            style={{
              color: theme.text,
              fontSize: "clamp(15px, 1.5vw, 17px)",
              fontWeight: 600,
              lineHeight: 1.55,
              background: "var(--gradient-card)",
              padding: "16px 18px",
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.borderPurple}`,
              marginBottom: 12,
            }}
          >
            {currentQuestion}
          </div>
        )}

        {/* Unsupported Browser Alert */}
        {!isSpeechRecognitionSupported && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: theme.radius.sm,
              background: theme.warningLight,
              border: `1px solid ${theme.warningBorder}`,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.warning }}>
              <IconAlertTriangle size={18} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Speech recognition is not supported in this browser. Please use Chrome/Edge or switch to Text Mode.
              </span>
            </div>
            <Button size="sm" onClick={onSwitchToText}>
              Switch to Text Mode
            </Button>
          </div>
        )}

        {/* Error Notification Banner */}
        {errorMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: theme.radius.sm,
              background: theme.dangerLight,
              border: `1px solid ${theme.dangerBorder}`,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.danger }}>
              <IconAlertTriangle size={16} />
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{errorMessage}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={onSwitchToText}>
              Switch to Text Mode
            </Button>
          </div>
        )}

        {/* COMPACT VOICE RECORDING BAR (Streamlined, no speaking coach clutter) */}
        <div
          style={{
            padding: "8px 14px",
            borderRadius: theme.radius.md,
            background: recordingState === "listening" ? "rgba(239, 68, 68, 0.08)" : "var(--bg-secondary, rgba(255,255,255,0.025))",
            border: `1px solid ${recordingState === "listening" ? "rgba(239, 68, 68, 0.35)" : "var(--border-color, rgba(255,255,255,0.08))"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
            flexWrap: "wrap",
            transition: "all 0.18s ease",
          }}
        >
          {/* Left: Mic Button & Live Recording Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {recordingState === "listening" ? (
              <button
                type="button"
                onClick={stopRecording}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: theme.danger,
                  color: "#ffffff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 0 0 6px rgba(239, 68, 68, 0.25)",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
                className="pulse-mic-live"
                aria-label="Stop recording speech"
                title="Click to stop recording"
              >
                <IconMicOff size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={!isSpeechRecognitionSupported}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "var(--gradient-primary)",
                  color: "#ffffff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isSpeechRecognitionSupported ? "pointer" : "not-allowed",
                  boxShadow: "0 4px 14px var(--primary-glow)",
                  opacity: isSpeechRecognitionSupported ? 1 : 0.6,
                  flexShrink: 0,
                  transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                aria-label="Start speaking into microphone"
                title="Tap to speak your answer"
              >
                <IconMic size={20} />
              </button>
            )}

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: recordingState === "listening" ? theme.danger : theme.text,
                  }}
                >
                  {recordingState === "listening"
                    ? "Listening... Speak your answer now"
                    : isCurrentAnswered
                    ? "Transcript Ready (You can edit below or record more)"
                    : "Tap microphone to speak your answer"}
                </span>

                {/* Pulsing Audio Waves when listening */}
                {recordingState === "listening" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, height: 16 }}>
                    {[10, 16, 12, 18, 11].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: 3,
                          height: `${h}px`,
                          background: theme.danger,
                          borderRadius: 2,
                          animation: `pulseLiveMic 0.7s ease-in-out infinite alternate ${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <span style={{ fontSize: 11, color: theme.muted }}>
                {recordingState === "listening"
                  ? "Click the red microphone when finished speaking."
                  : "Spoken answers are converted to text and can be edited before submitting."}
              </span>
            </div>
          </div>

          {/* Right: Live Interim Transcript & Duration Timer */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {interimTranscript && (
              <div
                style={{
                  padding: "4px 12px",
                  background: "var(--primary-light)",
                  borderRadius: theme.radius.sm,
                  border: `1px dashed ${theme.primary}`,
                  fontSize: 12,
                  fontStyle: "italic",
                  color: theme.primary,
                  maxWidth: 320,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                "{interimTranscript}..."
              </div>
            )}

            {liveDuration > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.12)",
                  color: "var(--text-secondary)",
                  fontVariantNumeric: "tabular-nums",
                }}
                title="Speaking duration"
              >
                {formatTime(liveDuration)}
              </span>
            )}
          </div>
        </div>

        {/* Recognized Answer Transcript Textarea */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: theme.textSecondary, textTransform: "uppercase", marginBottom: 5, letterSpacing: "0.04em" }}>
            Recognized Answer Transcript (Review & Edit):
          </label>
          <textarea
            rows={4}
            placeholder="Your spoken transcript will appear here automatically. You can also type to edit or add details..."
            value={currentAnswer}
            onChange={(e) => onAnswerChange(currentIndex, e.target.value)}
            style={{
              ...textareaStyle,
              borderColor: isCurrentAnswered ? theme.primary : theme.border,
              fontSize: 14,
              lineHeight: 1.55,
            }}
          />
        </div>

        {/* Navigation & Question Confirmation Controls (Matches Text Interview) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            paddingTop: 10,
            borderTop: `1px solid ${theme.borderLight}`,
          }}
        >
          <Button
            variant="secondary"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            icon={IconArrowLeft}
          >
            Previous
          </Button>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {!isLastQuestion ? (
              <Button
                variant={isCurrentAnswered ? "primary" : "secondary"}
                onClick={handleNext}
                icon={IconArrowRight}
              >
                Next Question
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmitAll}
                loading={loading}
                disabled={loading || answeredCount === 0 || monitoringBlocked}
                icon={IconSparkles}
                size="md"
              >
                {loading ? "Evaluating..." : "Finish & Submit for Evaluation"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <style>{`
        .interview-qa-grid {
          display: grid;
        }
        @media (max-width: 1024px) {
          .interview-qa-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes pulseLiveMic {
          0% { height: 6px; }
          100% { height: 18px; }
        }
        .pulse-mic-live {
          animation: micPulseLive 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes micPulseLive {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}

export default VoiceInterview;
