import { useContext, useState, useEffect, useRef } from "react";
import { InterviewContext } from "../context/InterviewContext";
import { useNavigate, useLocation } from "react-router-dom";
import FullScreenInterviewLayout from "../components/FullScreenInterviewLayout";
import Card from "../components/Card";
import Button from "../components/Button";
import VoiceInterview from "../components/VoiceInterview";
import AdaptiveInterview from "../components/AdaptiveInterview";
import PreInterviewSetup from "../components/PreInterviewSetup";
import WebcamPanel from "../components/WebcamPanel";
import MonitoringStatusBar from "../components/MonitoringStatusBar";
import { useWebcamMedia } from "../hooks/useWebcamMedia";
import useMonitoring from "../hooks/useMonitoring";
import theme from "../styles/theme";
import { textareaStyle } from "../styles/shared";
import { API_BASE_URL } from "../config/api";
import {
  IconCheckCircle,
  IconSparkles,
  IconBriefcase,
  IconMic,
  IconFileText,
  IconRotateCcw,
  IconArrowLeft,
  IconArrowRight,
  IconBot,
  IconAlertTriangle,
} from "../components/Icons";

function Interview({ forcedType }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, questions, setQuestions, setResults, interviewType, setInterviewType, adaptiveSession, setAdaptiveSession } = useContext(InterviewContext);
  const [loading, setLoading] = useState(false);
  const [initAdaptiveLoading, setInitAdaptiveLoading] = useState(false);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState("stepper"); // 'stepper' (single question) | 'all' (review all)
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [evalStage, setEvalStage] = useState(0);
  const isFinishingRef = useRef(false);

  const EVAL_STATUS_MESSAGES = [
    "Analyzing your answers...",
    "Calculating technical and communication scores...",
    "Verifying key concepts against official documentation...",
    "Preparing your personalized performance evaluation...",
  ];

  useEffect(() => {
    if (!loading) {
      setEvalStage(0);
      return;
    }
    const timer = setInterval(() => {
      setEvalStage((prev) => (prev + 1) % EVAL_STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [loading]);

  // Webcam & Media Management
  const {
    stream,
    permissionState,
    isCameraEnabled,
    isMicEnabled,
    errorMessage: webcamErrorMessage,
    startStream,
    stopStream,
    toggleCamera,
    toggleMic,
  } = useWebcamMedia();

  // Video element ref — shared with WebcamPanel and useMonitoring
  const videoRef = useRef(null);

  // Retrieve Candidate Name from auth/user storage
  let candidateName = "Candidate";
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      candidateName = parsed.name || parsed.username || parsed.email?.split("@")[0] || "Candidate";
    }
  } catch {}

  // Auto-check webcam on pre-interview mount
  useEffect(() => {
    if (!interviewStarted) {
      startStream({ withAudio: false });
    }
  }, [interviewStarted, startStream]);

  const [interviewMode, setInterviewMode] = useState(() => {
    return localStorage.getItem("interviewMode") || "text";
  });

  const urlForcedType = location.pathname.includes("adaptive")
    ? "adaptive"
    : location.pathname.includes("standard")
    ? "standard"
    : null;
  const currentInterviewType = forcedType || urlForcedType || interviewType || localStorage.getItem("interviewType") || "standard";

  let effectiveAdaptiveSession = adaptiveSession;
  if (!effectiveAdaptiveSession) {
    try {
      const stored = localStorage.getItem("adaptiveSession");
      if (stored) effectiveAdaptiveSession = JSON.parse(stored);
    } catch {}
  }

  const handleModeChange = (mode) => {
    setInterviewMode(mode);
    localStorage.setItem("interviewMode", mode);
  };

  // Monitoring (face detection + background noise)
  // Noise detection now runs in all modes (text + voice), not just voice.
  const {
    faceStatus,
    faceCount,
    faceError,
    noiseStatus,
    noiseLevel,
    monitoringBlocked,
    faceBlocked,
    noiseBlocked,
    isFaceDetectionSupported,
    diagInfo,
  } = useMonitoring({
    videoRef,
    stream,
    isCameraEnabled,
    isInterviewActive: interviewStarted,
  });

  const effectiveRole = role || localStorage.getItem("role") || "General Candidate";

  // Parse standard questions from context or localStorage (prefer standard_questions to prevent adaptive cross-contamination)
  let rawQuestions = questions;
  if (!rawQuestions || (Array.isArray(rawQuestions) && rawQuestions.length === 0)) {
    const saved = localStorage.getItem("standard_questions") || localStorage.getItem("questions");
    if (saved) {
      try {
        rawQuestions = JSON.parse(saved);
      } catch {
        rawQuestions = saved;
      }
    }
  }

  // Robust normalization of questions
  const questionList = (
    Array.isArray(rawQuestions)
      ? rawQuestions.map((q) => {
          if (typeof q === "object" && q !== null) {
            return q.question || q.text || q.q || JSON.stringify(q);
          }
          return typeof q === "string" ? q : String(q || "");
        })
      : typeof rawQuestions === "string"
      ? rawQuestions.split("\n")
      : []
  )
    .map((q) => q.replace(/^(?:Question\s*\d+[\s:.-]*|\d+[\s:.-]+)/i, "").trim())
    .filter((q) => q.length > 5);

  // Self-healing: If in standard interview and question list is not exactly 10, fetch exactly 10 questions
  useEffect(() => {
    if (
      currentInterviewType === "standard" &&
      !effectiveAdaptiveSession &&
      questionList.length !== 10 &&
      !fetchingQuestions
    ) {
      let isMounted = true;
      const fetchTenQuestions = async () => {
        setFetchingQuestions(true);
        try {
          const token = localStorage.getItem("token");
          const storedRole = localStorage.getItem("role") || effectiveRole || "General Technical Candidate";
          const res = await fetch(`${API_BASE_URL}/generate_questions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              role: storedRole,
              experience_level: localStorage.getItem("experienceLevel") || "Mid Level",
              interview_type: localStorage.getItem("interviewMode") || "technical",
              interviewer_personality: localStorage.getItem("interviewerPersonality") || "professional",
            }),
          });
          const data = await res.json();
          const generated = Array.isArray(data.questions) ? data.questions : (Array.isArray(data) ? data : []);
          if (isMounted && generated.length === 10) {
            if (setQuestions) setQuestions(generated);
            localStorage.setItem("questions", JSON.stringify(generated));
            localStorage.setItem("standard_questions", JSON.stringify(generated));
          }
        } catch (err) {
          console.error("Self-healing 10-question fetch error:", err);
        } finally {
          if (isMounted) setFetchingQuestions(false);
        }
      };
      fetchTenQuestions();
      return () => {
        isMounted = false;
      };
    }
  }, [currentInterviewType, effectiveAdaptiveSession, questionList.length, effectiveRole, fetchingQuestions, setQuestions]);

  // Initialize answers with persistent cache recovery for browser refresh support
  const [answers, setAnswers] = useState(() => {
    try {
      const cached = localStorage.getItem("interview_answers");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length === questionList.length) {
          return parsed;
        }
      }
    } catch {}
    return Array(questionList.length).fill("");
  });

  // Keep answers length in sync with questionList
  useEffect(() => {
    if (questionList.length > 0 && answers.length !== questionList.length) {
      setAnswers((prev) => {
        let cached = [];
        try {
          const raw = localStorage.getItem("interview_answers");
          if (raw) cached = JSON.parse(raw);
        } catch {}
        return questionList.map((_, i) => cached[i] || prev[i] || "");
      });
    }
  }, [questionList.length]);

  const handleAnswerChange = (index, value) => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[index] = value;
      try {
        localStorage.setItem("interview_answers", JSON.stringify(updated));
      } catch (err) {
        console.warn("Could not save answers to localStorage", err);
      }
      return updated;
    });
  };

  // Safe navigation exit handler
  const handleExitInterview = () => {
    stopStream();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    localStorage.removeItem("adaptiveSession");
    localStorage.removeItem("interview_answers");
    navigate("/interview");
  };

  // Start interview from Pre-Interview Setup screen (with fullscreen gesture)
  const handleStartMockInterview = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Graceful fallback if Fullscreen API is restricted
    }
    if (!stream && permissionState !== "denied" && permissionState !== "unavailable") {
      await startStream({ withAudio: false });
    }
    setInterviewStarted(true);
  };

  // Continue Without Camera fallback
  const handleContinueWithoutCamera = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Graceful fallback
    }
    setInterviewStarted(true);
  };

  // Cancel pre-interview setup and return to interview selection
  const handleCancelSetup = () => {
    stopStream();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    navigate("/interview");
  };

  const answeredCount = answers.filter((a) => a && a.trim().length > 0).length;
  const progress = questionList.length > 0
    ? Math.round((answeredCount / questionList.length) * 100)
    : 0;

  const [submissionError, setSubmissionError] = useState(null);
  const cachedDurationsRef = useRef(null);

  // Submit standard interview answers to backend
  const submitAnswers = async (durationsParam = null, explicitAnswers = null) => {
    if (isFinishingRef.current || loading) return;
    isFinishingRef.current = true;

    if (durationsParam && Array.isArray(durationsParam)) {
      cachedDurationsRef.current = durationsParam;
    }
    const activeDurations = cachedDurationsRef.current || (Array.isArray(durationsParam) ? durationsParam : null);

    setSubmissionError(null);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const token = localStorage.getItem("token");

      // Prepare final answers array
      let finalAnswers = Array.isArray(explicitAnswers) && explicitAnswers.length > 0 ? [...explicitAnswers] : [...answers];
      // If state answers were empty, restore from persistent interview_answers cache
      if ((!finalAnswers || finalAnswers.length === 0 || finalAnswers.every((a) => !a)) && localStorage.getItem("interview_answers")) {
        try {
          const cached = JSON.parse(localStorage.getItem("interview_answers"));
          if (Array.isArray(cached) && cached.length > 0) {
            finalAnswers = [...cached];
          }
        } catch {}
      }

      // Ensure current active question answer is captured if the user just typed into it
      const currentActiveAnswer = answers[activeIndex] || "";
      const activeText = currentActiveAnswer.trim();
      if (activeText && (!finalAnswers[activeIndex] || finalAnswers[activeIndex].trim() !== activeText)) {
        finalAnswers[activeIndex] = currentActiveAnswer;
      }
      while (finalAnswers.length < questionList.length) {
        finalAnswers.push("");
      }

      // Always ensure candidate's current answers are safely persisted in localStorage
      try {
        localStorage.setItem("interview_answers", JSON.stringify(finalAnswers));
      } catch (e) {
        console.warn("Could not cache answers to storage", e);
      }

      const payload = {
        role: effectiveRole,
        questions: questionList,
        answers: finalAnswers,
        personality: localStorage.getItem("interviewer_personality") || "technical",
        interview_mode: interviewMode === "voice" ? "voice" : "text",
        interview_type: "Standard",
      };
      if (Array.isArray(activeDurations) && activeDurations.length > 0) {
        payload.durations = activeDurations;
      }

      const response = await fetch(`${API_BASE_URL}/evaluate_answers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        const errorMsg = data.message || data.error || `Evaluation failed with status ${response.status}.`;
        setSubmissionError(errorMsg);
        return;
      }

      const receivedResults = data.results || (Array.isArray(data) ? data : []);
      const receivedSummary = data.summary || {};
      const savedInterviewId = data.interview_id;

      setResults(receivedResults);
      try {
        localStorage.setItem("results", JSON.stringify(receivedResults));
        localStorage.setItem("summary", JSON.stringify(receivedSummary));
        if (savedInterviewId) {
          localStorage.setItem("last_interview_id", String(savedInterviewId));
        }
        const activeResumeName = localStorage.getItem("resumeFileName") || "";
        if (activeResumeName) {
          localStorage.setItem("resultsResumeFileName", activeResumeName);
        } else {
          localStorage.removeItem("resultsResumeFileName");
        }
        localStorage.removeItem("interview_answers");
      } catch (storageErr) {
        console.warn("Storage write failed (e.g. quota exceeded):", storageErr);
      }

      // Stop media tracks and exit fullscreen upon completion
      stopStream();
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      navigate(savedInterviewId ? `/results?id=${savedInterviewId}` : "/results", {
        state: { interviewId: savedInterviewId, results: receivedResults, summary: receivedSummary },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("[Submission Error]:", error);
      const isTimeout = error.name === "AbortError";
      const message = isTimeout
        ? "Evaluation request took longer than expected. Your answers have been preserved safely. Click 'Retry Submission' to try again."
        : "Failed to submit answers. Your responses are saved safely. Please check your network and click 'Retry Submission'.";
      setSubmissionError(message);
      isFinishingRef.current = false;
    } finally {
      setLoading(false);
      isFinishingRef.current = false;
    }
  };

  const startAdaptiveSessionNow = async () => {
    try {
      setInitAdaptiveLoading(true);
      const token = localStorage.getItem("token");
      const resumeText = localStorage.getItem("resumeText") || "";
      const storedSkills = (() => {
        try {
          const raw = localStorage.getItem("skills");
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })();
      const storedJd = localStorage.getItem("jobDescription") || "";

      const response = await fetch(`${API_BASE_URL}/adaptive/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          role: effectiveRole,
          skills: storedSkills,
          resume_text: resumeText,
          job_description: storedJd,
          max_questions: 10,
          initial_difficulty: "medium",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.session) {
        alert(data.message || data.error || "Failed to initialize adaptive session. Please try again.");
        return;
      }

      if (setInterviewType) setInterviewType("adaptive");
      if (setAdaptiveSession) setAdaptiveSession(data.session);
      localStorage.setItem("interviewType", "adaptive");
      localStorage.setItem("adaptiveSession", JSON.stringify(data.session));
      localStorage.setItem("adaptive_question", JSON.stringify(data.session.current_question));
      window.location.reload();
    } catch (err) {
      console.error("Adaptive start error:", err);
      alert("Network error starting adaptive interview. Please try again.");
    } finally {
      setInitAdaptiveLoading(false);
    }
  };

  // =========================================================================
  // CASE A: EMPTY QUESTIONS / UNINITIALIZED ADAPTIVE SESSION FALLBACK
  // =========================================================================
  if (fetchingQuestions && currentInterviewType !== "adaptive") {
    return (
      <FullScreenInterviewLayout role={effectiveRole} onExit={handleExitInterview}>
        <div style={{ width: "100%", maxWidth: 640, margin: "60px auto 0", textAlign: "center" }} className="animate-slide-up">
          <Card>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: theme.primaryLight,
                color: theme.primary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <IconSparkles size={28} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
              Preparing Exactly 10 Questions...
            </h2>
            <p style={{ color: theme.muted, fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
              AI is generating a full set of 10 tailored interview questions for {effectiveRole}.
            </p>
          </Card>
        </div>
      </FullScreenInterviewLayout>
    );
  }

  if (
    (currentInterviewType !== "adaptive" && questionList.length === 0) ||
    (currentInterviewType === "adaptive" && !effectiveAdaptiveSession)
  ) {
    const isAdaptive = currentInterviewType === "adaptive";
    return (
      <FullScreenInterviewLayout role={effectiveRole} onExit={handleExitInterview}>
        <div style={{ width: "100%", maxWidth: 640, margin: "60px auto 0", textAlign: "center" }} className="animate-slide-up">
          <Card>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: theme.primaryLight,
                color: theme.primary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <IconBot size={28} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
              {isAdaptive ? "Adaptive AI Interview Setup" : "No Active Questions Found"}
            </h2>
            <p style={{ color: theme.muted, fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
              {isAdaptive
                ? `Dynamic difficulty calibration for ${effectiveRole}. Initialize your adaptive session to start.`
                : "Select a target role and interview format to generate questions for your mock session."}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {isAdaptive ? (
                <>
                  <Button
                    size="md"
                    pill
                    onClick={startAdaptiveSessionNow}
                    loading={initAdaptiveLoading}
                    icon={IconSparkles}
                  >
                    {initAdaptiveLoading ? "Calibrating..." : "Start Adaptive Session"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    pill
                    onClick={() => navigate("/interview")}
                    icon={IconArrowLeft}
                  >
                    Back to Selection
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="md"
                    pill
                    onClick={() => navigate("/role?mode=standard")}
                    icon={IconBriefcase}
                  >
                    Setup Standard Questions
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    pill
                    onClick={() => navigate("/interview")}
                    icon={IconArrowLeft}
                  >
                    Back to Selection
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </FullScreenInterviewLayout>
    );
  }

  // Active in-interview Webcam Panel component
  const webcamNode = (
    <WebcamPanel
      stream={stream}
      isCameraEnabled={isCameraEnabled}
      isMicEnabled={isMicEnabled}
      onToggleCamera={toggleCamera}
      onToggleMic={toggleMic}
      candidateName={candidateName}
      onRequestCamera={() => startStream({ withAudio: false })}
      videoRef={videoRef}
      faceStatus={faceStatus}
    />
  );

  // =========================================================================
  // PRE-INTERVIEW SETUP: CAMERA, MIC CHECK & IMMERSIVE LAUNCH
  // =========================================================================
  if (!interviewStarted) {
    return (
      <PreInterviewSetup
        roleTitle={effectiveRole}
        interviewMode={currentInterviewType}
        stream={stream}
        permissionState={permissionState}
        isCameraEnabled={isCameraEnabled}
        isMicEnabled={isMicEnabled}
        errorMessage={webcamErrorMessage}
        onStartInterview={handleStartMockInterview}
        onRetryPermission={() => startStream({ withAudio: false })}
        onContinueWithoutCamera={handleContinueWithoutCamera}
        onCancel={handleCancelSetup}
      />
    );
  }

  // =========================================================================
  // CASE B: ADAPTIVE INTERVIEW IN FULL-SCREEN MODE
  // =========================================================================
  if (currentInterviewType === "adaptive" && effectiveAdaptiveSession) {
    const qIndex = effectiveAdaptiveSession.current_question_index || 1;
    const maxQ = effectiveAdaptiveSession.max_questions || 10;
    const currentDiff = effectiveAdaptiveSession.current_difficulty || "medium";
    const currentTopic = effectiveAdaptiveSession.current_topic || "Technical";

    return (
      <FullScreenInterviewLayout
        role={effectiveRole}
        interviewType="adaptive"
        currentQuestionIndex={qIndex}
        totalQuestions={maxQ}
        answeredCount={qIndex - 1}
        progressPercent={Math.round(((qIndex - 1) / maxQ) * 100)}
        difficulty={currentDiff}
        topic={currentTopic}
        onExit={handleExitInterview}
      >
        <AdaptiveInterview
          initialSession={effectiveAdaptiveSession}
          effectiveRole={effectiveRole}
          webcamComponent={webcamNode}
          monitoringBlocked={monitoringBlocked}
          monitoringBar={
            <MonitoringStatusBar
              faceStatus={faceStatus}
              faceCount={faceCount}
              noiseStatus={noiseStatus}
              monitoringBlocked={monitoringBlocked}
              faceBlocked={faceBlocked}
              noiseBlocked={noiseBlocked}
              isFaceDetectionSupported={isFaceDetectionSupported}
              inputMode="text"
            />
          }
        />
      </FullScreenInterviewLayout>
    );
  }

  // Reusable inline error banner for non-blocking submission retries
  const errorBanner = submissionError ? (
    <div
      style={{
        background: "rgba(239, 68, 68, 0.12)",
        border: "1px solid rgba(239, 68, 68, 0.35)",
        borderRadius: theme.radius.md,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#EF4444", fontSize: 13.5, fontWeight: 500 }}>
        <IconAlertTriangle size={20} color="#EF4444" />
        <span>{submissionError}</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => submitAnswers()}
          loading={loading}
          icon={IconSparkles}
        >
          {loading ? "Evaluating..." : "Retry Submission"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSubmissionError(null)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  ) : null;

  // =========================================================================
  // CASE C: VOICE INTERVIEW MODE
  // =========================================================================
  if (interviewMode === "voice") {
    return (
      <FullScreenInterviewLayout
        role={effectiveRole}
        interviewType="standard"
        currentQuestionIndex={activeIndex + 1}
        totalQuestions={questionList.length}
        answeredCount={answeredCount}
        progressPercent={progress}
        onExit={handleExitInterview}
      >
        <VoiceInterview
          questionList={questionList}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          onSubmit={submitAnswers}
          loading={loading}
          effectiveRole={effectiveRole}
          onSwitchToText={() => handleModeChange("text")}
          webcamComponent={webcamNode}
          monitoringBlocked={monitoringBlocked}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          progressPercent={progress}
          monitoringBar={
            <>
              {errorBanner}
              <MonitoringStatusBar
                faceStatus={faceStatus}
                faceCount={faceCount}
                noiseStatus={noiseStatus}
                monitoringBlocked={monitoringBlocked}
                faceBlocked={faceBlocked}
                noiseBlocked={noiseBlocked}
                isFaceDetectionSupported={isFaceDetectionSupported}
                inputMode="voice"
              />
            </>
          }
        />
      </FullScreenInterviewLayout>
    );
  }

  // =========================================================================
  // CASE D: STANDARD TEXT INTERVIEW IN FULL-SCREEN MODE (Focused Stepper)
  // =========================================================================
  const currentQuestionText = questionList[activeIndex] || "";
  const currentAnswerText = answers[activeIndex] || "";
  const isCurrentAnswered = currentAnswerText.trim().length > 0;
  const wordCount = currentAnswerText.trim().split(/\s+/).filter(Boolean).length;
  const isLastQuestion = activeIndex === questionList.length - 1;

  return (
    <FullScreenInterviewLayout
      role={effectiveRole}
      interviewType="standard"
      currentQuestionIndex={activeIndex + 1}
      totalQuestions={questionList.length}
      answeredCount={answeredCount}
      progressPercent={progress}
      onExit={handleExitInterview}
    >
      <div style={{ display: "grid", gap: 18, width: "100%" }}>
        {errorBanner}
        {/* MONITORING STATUS BAR */}
        <MonitoringStatusBar
          faceStatus={faceStatus}
          faceCount={faceCount}
          noiseStatus={noiseStatus}
          monitoringBlocked={monitoringBlocked}
          faceBlocked={faceBlocked}
          noiseBlocked={noiseBlocked}
          isFaceDetectionSupported={isFaceDetectionSupported}
          inputMode="text"
        />

        {/* INTERVIEW CONTROLS & QUESTION JUMP BAR */}
        <Card style={{ marginBottom: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 16,
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
                  onClick={() => handleModeChange("text")}
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
                    background: interviewMode === "text" ? theme.primary : "transparent",
                    color: interviewMode === "text" ? "#FFFFFF" : theme.textSecondary,
                    transition: "all 0.18s ease",
                  }}
                >
                  <IconFileText size={14} /> Text
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("voice")}
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
                    background: interviewMode === "voice" ? theme.primary : "transparent",
                    color: interviewMode === "voice" ? "#FFFFFF" : theme.textSecondary,
                    transition: "all 0.18s ease",
                  }}
                >
                  <IconMic size={14} /> Voice (Mic)
                </button>
              </div>
            </div>

            {/* View Mode Toggle: Focused Stepper vs All Questions Review */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 600 }}>
                {answeredCount} of {questionList.length} answered ({progress}%)
              </span>
              <button
                type="button"
                onClick={() => setViewMode((prev) => (prev === "stepper" ? "all" : "stepper"))}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${theme.border}`,
                  padding: "5px 12px",
                  borderRadius: theme.radius.sm,
                  fontSize: 12,
                  fontWeight: 600,
                  color: theme.textSecondary,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                }}
              >
                {viewMode === "stepper" ? "Review All (10 Qs)" : "Focus Mode (1 Q)"}
              </button>
            </div>
          </div>

          {/* Question Jump Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", marginRight: 4, letterSpacing: "0.04em" }}>
              Jump to:
            </span>
            {questionList.map((_, idx) => {
              const isAnswered = (answers[idx] || "").trim().length > 0;
              const isActive = activeIndex === idx && viewMode === "stepper";

              return (
                <button
                  key={idx}
                  type="button"
                  className="interview-jump-btn"
                  onClick={() => {
                    setActiveIndex(idx);
                    if (viewMode === "all") setViewMode("stepper");
                  }}
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

        {/* FOCUSED SINGLE QUESTION VIEW (Default Full-Screen Stepper) */}
        {viewMode === "stepper" ? (
          <Card style={{ marginBottom: 0 }}>
            {/* Header: Question label and word count */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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
                  {isCurrentAnswered ? "✓" : activeIndex + 1}
                </span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: theme.text }}>
                  Interview Question {activeIndex + 1} of {questionList.length}
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 13, color: theme.muted }}>
                  {wordCount} words
                </span>
                {isCurrentAnswered && (
                  <button
                    type="button"
                    onClick={() => handleAnswerChange(activeIndex, "")}
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

            {/* Side-by-side Question Banner & Live Webcam Panel */}
            <div
              className="interview-qa-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(260px, 1fr)",
                gap: 16,
                marginBottom: 16,
                alignItems: "stretch",
              }}
            >
              <div
                key={activeIndex}
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
                {currentQuestionText}
              </div>
              <div style={{ height: "100%", minHeight: 190 }}>
                {webcamNode}
              </div>
            </div>

            {/* Answer Textarea */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: theme.textSecondary, textTransform: "uppercase", marginBottom: 5, letterSpacing: "0.04em" }}>
                Your Technical Answer:
              </label>
              <textarea
                rows={5}
                placeholder="Type your structured answer here (explain core concepts, approach, trade-offs, architecture, and examples)..."
                value={currentAnswerText}
                onChange={(e) => handleAnswerChange(activeIndex, e.target.value)}
                style={{
                  ...textareaStyle,
                  borderColor: isCurrentAnswered ? theme.primary : theme.border,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Navigation Footer */}
            <div
              className="interview-nav-footer"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                paddingTop: 12,
                borderTop: `1px solid ${theme.borderLight}`,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeIndex === 0}
                icon={IconArrowLeft}
              >
                Previous
              </Button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!isLastQuestion ? (
                  <Button
                    variant={isCurrentAnswered ? "primary" : "secondary"}
                    onClick={() => setActiveIndex((prev) => Math.min(questionList.length - 1, prev + 1))}
                    icon={IconArrowRight}
                  >
                    Next Question
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const updatedAnswers = [...answers];
                      if (currentAnswerText && currentAnswerText.trim()) {
                        updatedAnswers[activeIndex] = currentAnswerText;
                        setAnswers(updatedAnswers);
                      }
                      submitAnswers(null, updatedAnswers);
                    }}
                    disabled={loading || (answeredCount === 0 && !currentAnswerText.trim()) || monitoringBlocked}
                    loading={loading}
                    icon={IconSparkles}
                    size="md"
                  >
                    {loading ? "Evaluating..." : "Finish & Submit for Evaluation"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ) : (
          /* ALL QUESTIONS REVIEW MODE (When candidate wants to see all at once) */
          <div style={{ display: "grid", gap: 18 }}>
            {questionList.map((question, index) => {
              const isAnswered = (answers[index] || "").trim().length > 0;
              const qWordCount = (answers[index] || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean).length;

              return (
                <Card
                  key={index}
                  style={{
                    borderLeft: isAnswered ? `4px solid ${theme.success}` : `4px solid ${theme.border}`,
                    marginBottom: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: isAnswered ? theme.successLight : theme.background,
                          color: isAnswered ? theme.success : theme.muted,
                          border: `1px solid ${isAnswered ? theme.successBorder : theme.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {isAnswered ? "✓" : index + 1}
                      </span>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
                        Question {index + 1}
                      </h3>
                    </div>

                    <span style={{ fontSize: 12, color: theme.muted }}>
                      {qWordCount} words
                    </span>
                  </div>

                  <p
                    style={{
                      marginBottom: 16,
                      color: theme.text,
                      fontSize: 15,
                      fontWeight: 500,
                      lineHeight: 1.6,
                      background: theme.background,
                      padding: "14px 18px",
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {question}
                  </p>

                  <textarea
                    rows={4}
                    placeholder="Type your structured answer here..."
                    value={answers[index] || ""}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    style={{
                      ...textareaStyle,
                      borderColor: isAnswered ? theme.border : "#CBD5E1",
                    }}
                  />
                </Card>
              );
            })}

            {/* Bottom Submit Row for Review All mode */}
            <Card style={{ textAlign: "center", marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                  {answeredCount} of {questionList.length} questions completed
                </span>
                <Button
                  variant="primary"
                  onClick={() => submitAnswers(null, answers)}
                  disabled={loading || answeredCount === 0 || monitoringBlocked}
                  loading={loading}
                  icon={IconSparkles}
                  size="lg"
                >
                  {loading ? "AI Evaluating Answers..." : "Submit All Answers"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* AI Evaluation Loading Overlay Modal */}
      {loading && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Evaluating Interview"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.78)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--bg-card, #1E293B)",
              borderRadius: "16px",
              padding: "36px 32px",
              maxWidth: 480,
              width: "100%",
              textAlign: "center",
              border: `1px solid var(--border-color, rgba(255, 255, 255, 0.12))`,
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                border: "3px solid var(--primary-light)",
                borderTop: "3px solid var(--primary)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: theme.text, margin: "0 0 10px" }}>
              Evaluating Your Interview...
            </h3>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--primary)",
                fontWeight: 600,
                minHeight: 26,
                margin: "0 0 16px",
                transition: "all 0.3s ease",
              }}
            >
              {EVAL_STATUS_MESSAGES[evalStage]}
            </p>
            <p style={{ fontSize: "0.82rem", color: theme.muted, margin: 0, lineHeight: 1.5 }}>
              Please do not refresh or navigate away while our AI model evaluates your responses and generates detailed feedback.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .interview-qa-grid {
          display: grid;
        }
        @media (max-width: 1024px) {
          .interview-qa-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .interview-nav-footer {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .interview-nav-footer > button,
          .interview-nav-footer > div,
          .interview-nav-footer > div > button {
            width: 100% !important;
            justify-content: center !important;
          }
          .interview-jump-btn {
            width: 28px !important;
            height: 28px !important;
            font-size: 11px !important;
          }
        }
      `}</style>
    </FullScreenInterviewLayout>
  );
}

export default Interview;
