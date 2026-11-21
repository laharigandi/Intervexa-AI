import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./Card";
import Button from "./Button";
import theme from "../styles/theme";
import { textareaStyle, getScoreColor, getScoreBackground, getScoreBorder } from "../styles/shared";
import { API_BASE_URL } from "../config/api";
import {
  IconMic,
  IconMicOff,
  IconVolume2,
  IconVolumeX,
  IconRotateCcw,
  IconCheckCircle,
  IconAlertTriangle,
  IconSparkles,
  IconBriefcase,
  IconArrowRight,
  IconFileText,
} from "./Icons";

const SUPPORTED_LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-IN", label: "English (India)" },
  { code: "te-IN", label: "Telugu (తెలుగు)" },
];

function getDifficultyStyle(difficulty) {
  const d = String(difficulty || "").toLowerCase();
  if (d === "easy") {
    return {
      bg: "var(--success-light)",
      border: "var(--success-border)",
      color: "var(--success)",
      label: "Easy",
    };
  }
  if (d === "hard") {
    return {
      bg: "var(--accent-light)",
      border: "var(--accent-border)",
      color: "var(--accent)",
      label: "Hard",
    };
  }
  return {
    bg: "var(--primary-light)",
    border: "var(--primary-border)",
    color: "var(--primary)",
    label: "Medium",
  };
}

export default function AdaptiveInterview({
  initialSession,
  effectiveRole = "Candidate",
  webcamComponent = null,
  monitoringBlocked = false,
  monitoringBar = null,
}) {
  const navigate = useNavigate();

  const [session, setSession] = useState(initialSession || null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [inputMode, setInputMode] = useState(() => localStorage.getItem("adaptiveInputMode") || "text"); // 'text' | 'voice'
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Speech Recognition state
  const [recordingState, setRecordingState] = useState("idle"); // idle | listening | ready | error
  const [interimTranscript, setInterimTranscript] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");

  // Speech Synthesis state
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);
  const [autoReadPreference, setAutoReadPreference] = useState(false);

  const recognitionRef = useRef(null);
  const isManuallyStoppedRef = useRef(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const voiceStartTimeRef = useRef(null);

  useEffect(() => {
    let timer = null;
    if (recordingState === "listening") {
      voiceStartTimeRef.current = Date.now();
      timer = setInterval(() => {
        if (voiceStartTimeRef.current) {
          setVoiceDuration(Math.round((Date.now() - voiceStartTimeRef.current) / 1000));
        }
      }, 500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recordingState]);

  const isSpeechRecognitionSupported = typeof window !== "undefined" && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );
  const isSpeechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const currentQuestion = session?.current_question || "";
  const currentDifficulty = session?.current_difficulty || "medium";
  const currentTopic = session?.current_topic || "Technical Competency";
  const questionIndex = session?.current_question_index || 1;
  const maxQuestions = session?.max_questions || 10;
  const progressPercent = Math.round(((questionIndex - 1) / maxQuestions) * 100);

  // Stop active SpeechSynthesis
  const stopSpeaking = useCallback(() => {
    if (isSpeechSynthesisSupported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
    }
  }, [isSpeechSynthesisSupported]);

  // Read current question aloud
  const speakQuestion = useCallback(() => {
    if (!isSpeechSynthesisSupported || !window.speechSynthesis || !currentQuestion) return;

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

  // Clean up speech resources on unmount
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

  // Auto-read question if preference enabled
  useEffect(() => {
    if (autoReadPreference && currentQuestion) {
      speakQuestion();
    }
  }, [currentQuestion, autoReadPreference]);

  // Stop recording safely
  const stopRecording = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Recognition stop error:", err);
      }
    }
    setRecordingState("ready");
    setInterimTranscript("");
  }, []);

  // Start speech recognition
  const startRecording = useCallback(() => {
    if (!isSpeechRecognitionSupported) {
      setErrorMessage("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or switch to Text mode.");
      return;
    }

    stopSpeaking();
    setErrorMessage("");
    isManuallyStoppedRef.current = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;

    recognition.onstart = () => {
      setRecordingState("listening");
      setInterimTranscript("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalized = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalized += transcriptPart + " ";
        } else {
          interim += transcriptPart;
        }
      }

      if (finalized) {
        setCurrentAnswer((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${finalized.trim()}` : finalized.trim();
        });
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setErrorMessage("Microphone permission denied. Please allow microphone access in your browser address bar.");
        setRecordingState("error");
      } else if (event.error === "network") {
        setErrorMessage("Network error during speech recognition. Please check your internet connection.");
        setRecordingState("error");
      } else if (event.error !== "no-speech") {
        setErrorMessage(`Voice recognition encountered an issue (${event.error}). Please try again.`);
        setRecordingState("idle");
      }
    };

    recognition.onend = () => {
      if (!isManuallyStoppedRef.current && recordingState === "listening") {
        try {
          recognition.start();
        } catch {
          setRecordingState("ready");
        }
      } else {
        setRecordingState("ready");
        setInterimTranscript("");
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setErrorMessage("Could not initialize microphone. Please check browser settings.");
      setRecordingState("idle");
    }
  }, [isSpeechRecognitionSupported, selectedLanguage, stopSpeaking, recordingState]);

  const toggleRecording = () => {
    if (recordingState === "listening") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleInputModeToggle = (mode) => {
    if (recordingState === "listening") {
      stopRecording();
    }
    setInputMode(mode);
    localStorage.setItem("adaptiveInputMode", mode);
  };

  // Submit Answer & receive next question or completion
  const handleSubmitAnswer = async () => {
    if (loading) return;
    if (monitoringBlocked) return; // paused by monitoring

    const trimmed = currentAnswer.trim();
    if (!trimmed) {
      alert("Please provide an answer before advancing to the next question.");
      return;
    }

    if (recordingState === "listening") {
      stopRecording();
    }
    stopSpeaking();

    try {
      setLoading(true);
      setStatusMessage("AI is evaluating your technical answer and calibrating difficulty...");
      setErrorMessage("");

      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE_URL}/adaptive/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          session_id: session.session_id,
          answer: trimmed,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.message || data.error || "Failed to submit answer. Please try again.");
        setStatusMessage("");
        return;
      }

      if (data.is_completed) {
        // Finish Session
        setStatusMessage("Completing adaptive session and compiling evaluation report...");
        const finishRes = await fetch(`${API_BASE_URL}/adaptive/finish`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            session_id: session.session_id,
          }),
        });

        const finishData = await finishRes.json().catch(() => ({}));
        if (finishRes.ok && finishData.success) {
          const evalResults = finishData.results || [];
          const evalSummary = finishData.summary || {};
          const savedInterviewId = finishData.interview_id;

          try {
            localStorage.setItem("results", JSON.stringify(evalResults));
            localStorage.setItem("summary", JSON.stringify(evalSummary));
            if (savedInterviewId) {
              localStorage.setItem("last_interview_id", String(savedInterviewId));
            }
            const activeResumeName = localStorage.getItem("resumeFileName") || "";
            if (activeResumeName) {
              localStorage.setItem("resultsResumeFileName", activeResumeName);
            } else {
              localStorage.removeItem("resultsResumeFileName");
            }
            localStorage.removeItem("adaptiveSession");
          } catch (storageErr) {
            console.warn("Storage write failed (e.g. quota exceeded):", storageErr);
          }
          navigate(savedInterviewId ? `/results?id=${savedInterviewId}` : "/results", {
            state: { interviewId: savedInterviewId, results: evalResults, summary: evalSummary },
          });
        } else {
          setErrorMessage(finishData.message || finishData.error || "Failed to finalize evaluation report. Please click 'Retry Evaluation'.");
          setStatusMessage("");
        }
      } else {
        // Advance to next question
        setSession(data.session);
        localStorage.setItem("adaptiveSession", JSON.stringify(data.session));
        setCurrentAnswer("");
        setInterimTranscript("");
        setRecordingState("idle");
        setStatusMessage(
          data.feedback
            ? `Difficulty adjusted to ${data.next_difficulty?.toUpperCase()}. Score: ${data.evaluation?.technical_score || "N/A"}/10`
            : ""
        );
      }
    } catch (error) {
      console.error("Adaptive answer error:", error);
      setErrorMessage("Network error during answer evaluation. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const diffStyle = getDifficultyStyle(currentDifficulty);

  return (
    <div style={{ display: "grid", gap: 18, width: "100%" }}>
      {/* Monitoring status bar — rendered at top of interview grid */}
      {monitoringBar}
      {/* Top Controls Bar */}
      <Card style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          {/* Mode Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Input:
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
                onClick={() => handleInputModeToggle("text")}
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
                  background: inputMode === "text" ? theme.primary : "transparent",
                  color: inputMode === "text" ? "#FFFFFF" : theme.textSecondary,
                  transition: "all 0.18s ease",
                }}
              >
                <IconFileText size={14} /> Text
              </button>
              <button
                type="button"
                onClick={() => handleInputModeToggle("voice")}
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
                  background: inputMode === "voice" ? theme.primary : "transparent",
                  color: inputMode === "voice" ? "#FFFFFF" : theme.textSecondary,
                  transition: "all 0.18s ease",
                }}
              >
                <IconMic size={14} /> Voice (Mic)
              </button>
            </div>

            {/* Language Selector for voice */}
            {inputMode === "voice" && (
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: theme.radius.sm,
                  border: `1px solid ${theme.border}`,
                  fontSize: 12,
                  color: theme.text,
                  background: "var(--bg-surface)",
                  cursor: "pointer",
                }}
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Right Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                background: diffStyle.bg,
                color: diffStyle.color,
                border: `1px solid ${diffStyle.border}`,
                padding: "4px 12px",
                borderRadius: theme.radius.full,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Adaptive: {diffStyle.label}
            </span>
            <span
              style={{
                background: "var(--bg-secondary)",
                color: theme.textSecondary,
                border: `1px solid ${theme.border}`,
                padding: "4px 12px",
                borderRadius: theme.radius.full,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Topic: {currentTopic}
            </span>
            <span
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                padding: "4px 12px",
                borderRadius: theme.radius.full,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Interviewer: {(localStorage.getItem("interviewer_personality") || "technical").replace("_", " ").toUpperCase()}
            </span>
          </div>
        </div>
      </Card>

      {/* Main Dynamic Question Card */}
      <Card style={{ marginBottom: 0 }}>
        {/* Error notification */}
        {errorMessage && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: theme.radius.sm,
              background: "var(--error-light)",
              border: "1px solid var(--error-border)",
              color: "var(--error)",
              marginBottom: 16,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconAlertTriangle size={17} />
              <span>{errorMessage}</span>
            </div>
            {session?.session_id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSubmitAnswer}
                loading={loading}
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Dynamic Question Presentation */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.primary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Question {questionIndex} of {maxQuestions}
            </span>

            {/* Read question aloud TTS button */}
            {isSpeechSynthesisSupported && (
              <button
                type="button"
                onClick={speakQuestion}
                style={{
                  background: isSpeakingQuestion ? "var(--primary-light)" : "transparent",
                  border: `1px solid ${isSpeakingQuestion ? theme.primaryBorder : theme.border}`,
                  color: isSpeakingQuestion ? theme.primary : theme.textSecondary,
                  padding: "5px 12px",
                  borderRadius: theme.radius.full,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.18s ease",
                }}
              >
                {isSpeakingQuestion ? <IconVolumeX size={15} /> : <IconVolume2 size={15} />}
                <span>{isSpeakingQuestion ? "Stop Reading" : "Read Aloud"}</span>
              </button>
            )}
          </div>

          {webcamComponent ? (
            <div
              className="adaptive-qa-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(260px, 1fr)",
                gap: 16,
                alignItems: "stretch",
              }}
            >
              <div
                key={questionIndex}
                className="question-transition"
                style={{
                  background: "var(--gradient-card)",
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.borderPurple}`,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "clamp(15px, 1.6vw, 18px)",
                    fontWeight: 700,
                    color: theme.text,
                    lineHeight: 1.5,
                  }}
                >
                  {currentQuestion}
                </h3>
              </div>
              <div style={{ height: "100%", minHeight: 190 }}>
                {webcamComponent}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--gradient-card)",
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.borderPurple}`,
                padding: "16px 20px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "clamp(15px, 1.6vw, 18px)",
                  fontWeight: 700,
                  color: theme.text,
                  lineHeight: 1.5,
                }}
              >
                {currentQuestion}
              </h3>
            </div>
          )}
        </div>

        {/* Voice Mode Compact Audio Bar */}
        {inputMode === "voice" && (
          <div
            style={{
              background: recordingState === "listening" ? "rgba(239, 68, 68, 0.08)" : "var(--bg-secondary)",
              borderRadius: theme.radius.md,
              border: `1px solid ${recordingState === "listening" ? "rgba(239, 68, 68, 0.35)" : theme.borderPurple}`,
              padding: "10px 16px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {recordingState === "listening" ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: theme.danger,
                    color: "#FFFFFF",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 0 0 6px rgba(239, 68, 68, 0.25)",
                    flexShrink: 0,
                  }}
                  className="pulse-mic-live"
                  aria-label="Stop recording"
                  title="Stop recording"
                >
                  <IconMicOff size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!isSpeechRecognitionSupported}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: theme.gradientPrimary,
                    color: "#FFFFFF",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isSpeechRecognitionSupported ? "pointer" : "not-allowed",
                    boxShadow: "0 4px 14px var(--primary-glow)",
                    opacity: isSpeechRecognitionSupported ? 1 : 0.6,
                    flexShrink: 0,
                  }}
                  aria-label="Start speaking"
                  title="Tap to speak"
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
                      ? "Listening... Speak your technical explanation"
                      : currentAnswer.trim()
                      ? "Transcript Ready (Review and refine below)"
                      : "Tap microphone to speak your response"}
                  </span>
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
          </div>
        )}

        {/* Editable Answer Text Area */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {inputMode === "voice" ? "Recognized Answer Transcript (Review & Edit):" : "Your Technical Answer:"}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: theme.muted }}>
                {currentAnswer.trim().split(/\s+/).filter(Boolean).length} words
              </span>
              {currentAnswer.trim() && (
                <button
                  type="button"
                  onClick={() => setCurrentAnswer("")}
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
                  }}
                >
                  <IconRotateCcw size={13} /> Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            rows={inputMode === "voice" ? 4 : 5}
            placeholder={
              inputMode === "voice"
                ? "Your spoken answer will appear here automatically. You can edit before submitting..."
                : "Type your structured technical answer here (explain approach, core mechanics, trade-offs, and examples)..."
            }
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={loading}
            style={{
              ...textareaStyle,
              borderColor: currentAnswer.trim() ? theme.primary : theme.border,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Submit Action Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: theme.textSecondary }}>
            {statusMessage || "The AI evaluator will analyze your answer and dynamically select the next question."}
          </span>

          <Button
            variant="primary"
            onClick={handleSubmitAnswer}
            disabled={loading || !currentAnswer.trim() || monitoringBlocked}
            loading={loading}
            icon={IconSparkles}
            size="md"
          >
            {loading ? "Evaluating..." : questionIndex >= maxQuestions ? "Finish Interview & Evaluate" : "Submit Answer & Next Question"}
          </Button>
        </div>

        <p style={{ margin: "10px 0 0 0", fontSize: 11, color: theme.muted, textAlign: "center" }}>
          🔒 <strong>Privacy Assurance:</strong> Spoken responses are converted to text locally in your browser. Audio recordings are never uploaded or stored.
        </p>
      </Card>

      <style>{`
        .adaptive-qa-grid {
          display: grid;
        }
        @media (max-width: 1024px) {
          .adaptive-qa-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

