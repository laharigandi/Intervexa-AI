import { useState, useEffect, useCallback, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import Button from "../Button";
import { API_BASE_URL } from "../../config/api";
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconSparkles,
  IconRefresh,
  IconTarget,
  IconClock,
  IconZap,
  IconChevronDown,
  IconChevronRight,
  IconRotateCcw,
} from "../Icons";

export default function DailyQuizSection({
  plan,
  selectedDay = null,
  onSelectDay = null,
  onQuizCompleted = null,
  onBackToTasks = null,
}) {
  const { token } = useContext(AuthContext);

  const [activeDay, setActiveDay] = useState(() => selectedDay || 1);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [quizData, setQuizData] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState(null);

  // 'ready' | 'active' | 'result'
  const [quizState, setQuizState] = useState("ready");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const planId = plan?.plan_id || plan?.id;

  // Sync activeDay if selectedDay prop changes
  useEffect(() => {
    if (selectedDay && selectedDay !== activeDay) {
      setActiveDay(selectedDay);
    }
  }, [selectedDay]);

  // Fetch overview of all daily quizzes
  const fetchOverview = useCallback(async () => {
    if (!planId) return;
    const authToken = token || localStorage.getItem("token");
    try {
      setOverviewLoading(true);
      const res = await fetch(`${API_BASE_URL}/study-planner/daily-quiz/overview?plan_id=${planId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setOverview(json);
        }
      }
    } catch (err) {
      console.error("Daily quiz overview fetch error:", err);
    } finally {
      setOverviewLoading(false);
    }
  }, [planId, token]);

  // Fetch quiz for specific day
  const fetchQuizForDay = useCallback(
    async (dayNum, forceRegenerate = false) => {
      if (!planId) return;
      const authToken = token || localStorage.getItem("token");
      try {
        setQuizLoading(true);
        setQuizError(null);
        setSubmitError(null);

        const url = `${API_BASE_URL}/study-planner/daily-quiz?plan_id=${planId}&day_number=${dayNum}${
          forceRegenerate ? "&force_regenerate=true" : ""
        }`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const json = await res.json();
        if (res.ok && json.success) {
          setQuizData(json);
          setCurrentQuestionIndex(0);
          setUserAnswers(json.user_answers || {});

          if (json.is_completed && !forceRegenerate) {
            setSubmitResult(json);
            setQuizState("result");
          } else {
            setSubmitResult(null);
            setQuizState("ready");
          }
        } else {
          setQuizError(json.error || json.message || "Failed to load quiz for this day.");
        }
      } catch (err) {
        console.error("Quiz fetch error:", err);
        setQuizError("Network error. Unable to load quiz questions.");
      } finally {
        setQuizLoading(false);
      }
    },
    [planId, token]
  );

  // Initial load
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeDay) {
      fetchQuizForDay(activeDay);
    }
  }, [activeDay, fetchQuizForDay]);

  const handleSelectDay = (dayNum) => {
    setActiveDay(dayNum);
    if (onSelectDay) onSelectDay(dayNum);
  };

  const handleStartQuiz = () => {
    setQuizState("active");
    setCurrentQuestionIndex(0);
    setUserAnswers({});
  };

  const handleOptionSelect = (questionId, optionLetter) => {
    setUserAnswers((prev) => ({
      ...prev,
      [String(questionId)]: optionLetter,
    }));
  };

  const handleNextQuestion = () => {
    if (!quizData?.questions) return;
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!quizData?.questions || !planId) return;

    // Validate that questions are answered
    const totalQ = quizData.questions.length;
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount < totalQ) {
      const confirmSubmit = window.confirm(
        `You have answered ${answeredCount} of ${totalQ} questions. Are you sure you want to submit?`
      );
      if (!confirmSubmit) return;
    }

    const authToken = token || localStorage.getItem("token");
    try {
      setSubmitting(true);
      setSubmitError(null);

      const res = await fetch(`${API_BASE_URL}/study-planner/daily-quiz/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          day_number: activeDay,
          user_answers: userAnswers,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmitResult(json);
        setQuizState("result");
        // Refresh overview and parent plan stats
        fetchOverview();
        if (onQuizCompleted) {
          onQuizCompleted(json);
        }
      } else {
        setSubmitError(json.error || json.message || "Failed to submit quiz.");
      }
    } catch (err) {
      console.error("Quiz submit error:", err);
      setSubmitError("Network error. Could not submit answers.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    fetchQuizForDay(activeDay, true);
  };

  // Helper score color
  const getScoreColor = (pct) => {
    if (pct >= 80) return "#16a34a"; // Green
    if (pct >= 60) return "#2563eb"; // Blue
    if (pct >= 40) return "#d97706"; // Orange
    return "#dc2626"; // Red
  };

  const questions = quizData?.questions || [];
  const currentQ = questions[currentQuestionIndex];
  const totalQuestionsCount = questions.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%" }}>
      {/* ── TOP HEADER & SUMMARY METRICS ── */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          borderRadius: "14px",
          background: "linear-gradient(135deg, var(--primary-light) 0%, rgba(184, 158, 255, 0.08) 100%)",
          border: "1px solid var(--primary-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                background: "var(--primary)",
                color: "#fff",
                letterSpacing: "0.04em",
              }}
            >
              Daily Quiz System
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                padding: "0.2rem 0.55rem",
                borderRadius: "9999px",
                background: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              {plan?.target_role || "Technical Role"} • Day {activeDay}
            </span>
          </div>

          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
            {quizData?.topic || `Day ${activeDay} Technical Quiz`}
          </h2>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Dynamic 5-question technical quiz tailored to your daily learning topic and difficulty level.
          </p>
        </div>

        {/* Progress summary stats */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {overview && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.5rem 0.9rem",
                background: "var(--bg-surface)",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>Quizzes Completed</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
                  {overview.completed_quizzes_count} / {overview.total_days} Days
                </div>
              </div>
              <div style={{ height: "24px", width: "1px", background: "var(--border-color)" }} />
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>Average Score</div>
                <div
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    color: getScoreColor(overview.average_quiz_score),
                  }}
                >
                  {overview.average_quiz_score}%
                </div>
              </div>
            </div>
          )}

          {onBackToTasks && (
            <Button variant="secondary" onClick={onBackToTasks} style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}>
              Back to Checklist
            </Button>
          )}
        </div>
      </div>

      {/* ── HORIZONTAL DAY SELECTOR STRIP ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Select Day to Practice / Review
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Day {activeDay} of {overview?.total_days || plan?.duration_days || 14}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
            paddingBottom: "0.4rem",
            scrollbarWidth: "thin",
          }}
        >
          {(overview?.quizzes || Array.from({ length: plan?.duration_days || 14 }, (_, i) => ({ day_number: i + 1, quiz_status: "pending" }))).map(
            (item) => {
              const dNum = item.day_number;
              const isSelected = activeDay === dNum;
              const isCompleted = item.quiz_status === "completed" || item.is_completed;
              const score = item.score_pct || 0;

              return (
                <button
                  key={dNum}
                  onClick={() => handleSelectDay(dNum)}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "10px",
                    cursor: "pointer",
                    border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                    background: isSelected ? "var(--primary-light)" : "var(--bg-surface)",
                    boxShadow: isSelected ? "0 2px 8px var(--primary-glow)" : "none",
                    minWidth: "75px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: isSelected ? "var(--primary)" : "var(--text-main)",
                    }}
                  >
                    Day {dNum}
                  </span>

                  {isCompleted ? (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: getScoreColor(score),
                        background: "rgba(22, 163, 74, 0.1)",
                        padding: "1px 5px",
                        borderRadius: "9999px",
                      }}
                    >
                      {score}%
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}
                    >
                      Pending
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* ── ERROR STATE BANNER ── */}
      {quizError && (
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderRadius: "0.5rem",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            color: "#fca5a5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.88rem" }}>
            <IconAlertTriangle size={18} color="#ef4444" />
            <span>{quizError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchQuizForDay(activeDay)}>
            Retry
          </Button>
        </div>
      )}

      {/* ── LOADING STATE ── */}
      {quizLoading ? (
        <div
          style={{
            padding: "3.5rem 1rem",
            textAlign: "center",
            borderRadius: "14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid var(--border-color)",
              borderTop: "3px solid var(--primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--text-secondary)" }}>
            Loading Day {activeDay} quiz questions...
          </p>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              VIEW 1: START SCREEN (When not yet started and not completed)
             ══════════════════════════════════════════════════════════════════ */}
          {quizState === "ready" && (
            <div
              style={{
                padding: "2.5rem 1.75rem",
                borderRadius: "14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.25rem",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "14px",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  border: "1px solid var(--primary-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconZap size={26} />
              </div>

              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--primary)",
                    letterSpacing: "0.04em",
                  }}
                >
                  Day {activeDay} Quiz
                </span>
                <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0.3rem 0 0.4rem 0", color: "var(--text-main)" }}>
                  {quizData?.topic || `Day ${activeDay} Technical Quiz`}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", maxWidth: "460px", margin: "0 auto", lineHeight: 1.5 }}>
                  Answer {totalQuestionsCount || 5} multiple-choice technical questions to test your understanding of today's learning concepts.
                </p>
              </div>

              {/* Quiz feature badges */}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    padding: "0.25rem 0.65rem",
                    borderRadius: "9999px",
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  ⏱ 5 Questions
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    padding: "0.25rem 0.65rem",
                    borderRadius: "9999px",
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  🎯 {quizData?.difficulty || "Intermediate"} Level
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    padding: "0.25rem 0.65rem",
                    borderRadius: "9999px",
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  ✓ Instant Explanations
                </span>
              </div>

              <Button
                variant="primary"
                onClick={handleStartQuiz}
                style={{
                  padding: "0.75rem 2.25rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 14px var(--primary-glow)",
                }}
              >
                <IconSparkles size={16} />
                <span>Start Quiz</span>
              </Button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 2: ACTIVE QUIZ QUESTIONS
             ══════════════════════════════════════════════════════════════════ */}
          {quizState === "active" && currentQ && (
            <div
              style={{
                borderRadius: "14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-card)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Question header with progress */}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderBottom: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--primary)",
                      background: "var(--primary-light)",
                      border: "1px solid var(--primary-border)",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "9999px",
                    }}
                  >
                    Question {currentQuestionIndex + 1} of {totalQuestionsCount}
                  </span>
                  {currentQ.tested_concept && (
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      • {currentQ.tested_concept}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {Object.keys(userAnswers).length}/{totalQuestionsCount} Answered
                  </span>
                  <div
                    style={{
                      width: "80px",
                      height: "6px",
                      borderRadius: "3px",
                      background: "var(--border-color)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${((currentQuestionIndex + 1) / totalQuestionsCount) * 100}%`,
                        background: "var(--primary)",
                        borderRadius: "3px",
                        transition: "width 0.25s ease",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Question Body */}
              <div style={{ padding: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    margin: "0 0 1.25rem 0",
                    color: "var(--text-main)",
                    lineHeight: 1.5,
                  }}
                >
                  {currentQ.question}
                </h3>

                {/* 4 Options Grid */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {(currentQ.options || []).map((opt, optIdx) => {
                    const letter = ["A", "B", "C", "D"][optIdx] || String(opt).trim().charAt(0);
                    const isSelected = userAnswers[String(currentQ.id)] === letter;

                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleOptionSelect(currentQ.id, letter)}
                        style={{
                          padding: "0.9rem 1.15rem",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                          background: isSelected ? "var(--primary-light)" : "var(--bg-surface)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.85rem",
                          transition: "all 0.15s ease",
                          boxShadow: isSelected ? "0 2px 8px var(--primary-glow)" : "none",
                        }}
                      >
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            flexShrink: 0,
                            background: isSelected ? "var(--primary)" : "var(--bg-secondary)",
                            color: isSelected ? "#fff" : "var(--text-secondary)",
                            border: isSelected ? "none" : "1px solid var(--border-color)",
                          }}
                        >
                          {letter}
                        </div>
                        <span
                          style={{
                            fontSize: "0.92rem",
                            color: isSelected ? "var(--text-main)" : "var(--text-secondary)",
                            fontWeight: isSelected ? 600 : 400,
                            lineHeight: 1.45,
                          }}
                        >
                          {String(opt).replace(/^[A-D]\)\s*/, "")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Error banner if any */}
              {submitError && (
                <div style={{ padding: "0.75rem 1.5rem", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.85rem" }}>
                  {submitError}
                </div>
              )}

              {/* Navigation Footer */}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderTop: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous Question
                </Button>

                {/* Quick question indicator dots */}
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  {questions.map((q, idx) => {
                    const isAnswered = !!userAnswers[String(q.id)];
                    const isCurrent = idx === currentQuestionIndex;
                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentQuestionIndex(idx)}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          border: isCurrent ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                          background: isCurrent ? "var(--primary)" : isAnswered ? "var(--primary-light)" : "var(--bg-surface)",
                          color: isCurrent ? "#fff" : isAnswered ? "var(--primary)" : "var(--text-secondary)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {currentQuestionIndex < totalQuestionsCount - 1 ? (
                  <Button variant="primary" size="sm" onClick={handleNextQuestion}>
                    <span>Next Question</span>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    style={{
                      background: "var(--success, #16a34a)",
                      borderColor: "var(--success, #16a34a)",
                      fontWeight: 700,
                    }}
                  >
                    <span>{submitting ? "Submitting..." : "Submit Quiz"}</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 3: QUIZ RESULTS & EXPLANATIONS REVIEW
             ══════════════════════════════════════════════════════════════════ */}
          {quizState === "result" && submitResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Result Summary Card */}
              <div
                style={{
                  padding: "1.5rem",
                  borderRadius: "14px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-card)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1.25rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: submitResult.percentage >= 60 ? "rgba(22, 163, 74, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: submitResult.percentage >= 60 ? "#16a34a" : "#dc2626",
                        border: `1px solid ${submitResult.percentage >= 60 ? "rgba(22, 163, 74, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                      }}
                    >
                      {submitResult.percentage >= 60 ? "✓ Quiz Passed" : "Needs Review"}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      Day {activeDay} Quiz Completed
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                    Performance Summary: {submitResult.topic || quizData?.topic}
                  </h3>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Review your answers below with short, technical explanations for each concept.
                  </p>
                </div>

                {/* Score Pills Grid */}
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                  {/* Total Score */}
                  <div
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "10px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 600 }}>Total Score</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>
                      {submitResult.correct_answers || 0} / {submitResult.total_questions || 5}
                    </div>
                  </div>

                  {/* Correct Answers */}
                  <div
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "10px",
                      background: "rgba(22, 163, 74, 0.08)",
                      border: "1px solid rgba(22, 163, 74, 0.25)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 600 }}>Correct Answers</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#16a34a" }}>
                      {submitResult.correct_answers || 0}
                    </div>
                  </div>

                  {/* Wrong Answers */}
                  <div
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "10px",
                      background: "rgba(220, 38, 38, 0.08)",
                      border: "1px solid rgba(220, 38, 38, 0.25)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", color: "#dc2626", fontWeight: 600 }}>Wrong Answers</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#dc2626" }}>
                      {submitResult.wrong_answers || 0}
                    </div>
                  </div>

                  {/* Percentage */}
                  <div
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "10px",
                      background: "var(--primary-light)",
                      border: "1px solid var(--primary-border)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", color: "var(--primary)", fontWeight: 600 }}>Percentage</div>
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 800,
                        color: getScoreColor(submitResult.percentage || submitResult.score_pct || 0),
                      }}
                    >
                      {submitResult.percentage || submitResult.score_pct || 0}%
                    </div>
                  </div>

                  {/* Retake Button */}
                  <Button variant="secondary" onClick={handleRetakeQuiz} style={{ fontSize: "0.85rem", padding: "0.55rem 0.9rem" }}>
                    <IconRotateCcw size={14} />
                    <span>Retake Quiz</span>
                  </Button>
                </div>
              </div>

              {/* ── QUESTION-BY-QUESTION REVIEW WITH EXPLANATIONS ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <h4 style={{ margin: "0.5rem 0 0.2rem 0", fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>
                  Question Review & Technical Explanations
                </h4>

                {(submitResult.review || []).map((item, idx) => {
                  const isCorrect = item.is_correct;
                  const correctLetter = item.correct_answer;
                  const userLetter = item.user_selected ? String(item.user_selected).charAt(0) : "None";

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "12px",
                        background: "var(--bg-surface)",
                        border: `1px solid ${isCorrect ? "rgba(22, 163, 74, 0.3)" : "rgba(220, 38, 38, 0.3)"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      {/* Question item header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.55rem",
                              borderRadius: "6px",
                              background: isCorrect ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)",
                              color: isCorrect ? "#16a34a" : "#dc2626",
                              border: `1px solid ${isCorrect ? "rgba(22, 163, 74, 0.25)" : "rgba(220, 38, 38, 0.25)"}`,
                              flexShrink: 0,
                            }}
                          >
                            Q{idx + 1}
                          </span>
                          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.45 }}>
                            {item.question}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.55rem",
                            borderRadius: "9999px",
                            background: isCorrect ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)",
                            color: isCorrect ? "#16a34a" : "#dc2626",
                            flexShrink: 0,
                          }}
                        >
                          {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                        </span>
                      </div>

                      {/* Options breakdown */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.5rem" }}>
                        {(item.options || []).map((opt, oIdx) => {
                          const letter = ["A", "B", "C", "D"][oIdx] || String(opt).charAt(0);
                          const isThisCorrect = letter === correctLetter;
                          const isThisUserSelected = letter === userLetter;

                          let optBg = "var(--bg-secondary)";
                          let optBorder = "var(--border-color)";
                          let optColor = "var(--text-secondary)";

                          if (isThisCorrect) {
                            optBg = "rgba(22, 163, 74, 0.1)";
                            optBorder = "rgba(22, 163, 74, 0.4)";
                            optColor = "#16a34a";
                          } else if (isThisUserSelected && !isCorrect) {
                            optBg = "rgba(220, 38, 38, 0.1)";
                            optBorder = "rgba(220, 38, 38, 0.4)";
                            optColor = "#dc2626";
                          }

                          return (
                            <div
                              key={oIdx}
                              style={{
                                padding: "0.5rem 0.75rem",
                                borderRadius: "8px",
                                background: optBg,
                                border: `1px solid ${optBorder}`,
                                fontSize: "0.85rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                color: optColor,
                                fontWeight: isThisCorrect || isThisUserSelected ? 600 : 400,
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{letter})</span>
                              <span>{String(opt).replace(/^[A-D]\)\s*/, "")}</span>
                              {isThisCorrect && <span style={{ marginLeft: "auto", fontSize: "0.75rem", fontWeight: 700 }}>✓ Correct Answer</span>}
                              {isThisUserSelected && !isThisCorrect && <span style={{ marginLeft: "auto", fontSize: "0.75rem", fontWeight: 700 }}>Your Choice</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Short Explanation Box */}
                      {item.explanation && (
                        <div
                          style={{
                            padding: "0.65rem 0.9rem",
                            borderRadius: "8px",
                            background: isCorrect ? "rgba(22, 163, 74, 0.05)" : "rgba(220, 38, 38, 0.05)",
                            borderLeft: `3px solid ${isCorrect ? "#16a34a" : "#dc2626"}`,
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                            lineHeight: 1.45,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "var(--text-main)", marginRight: "0.35rem" }}>
                            Explanation:
                          </span>
                          {item.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
