import React, { useState, useEffect } from "react";
import Button from "../Button";
import { API_BASE_URL } from "../../config/api";
import {
  IconZap,
  IconCheckCircle,
  IconX,
  IconRefresh,
  IconSparkles,
  IconClock,
  IconTarget,
} from "../Icons";

export default function AILearningAssistantModal({
  isOpen,
  onClose,
  topic = "Core Technical Concepts",
  role = "Full Stack Developer",
  taskId = null,
  token = null,
  onActivityRecorded = () => {},
}) {
  const [activeTab, setActiveTab] = useState("explain"); // 'explain', 'examples', 'mcqs', 'exercise'
  const [loading, setLoading] = useState(false);
  const [explainData, setExplainData] = useState(null);
  const [examplesData, setExamplesData] = useState(null);
  const [mcqData, setMcqData] = useState(null);
  const [exerciseData, setExerciseData] = useState(null);

  // MCQ state
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);

  // Exercise evaluation state
  const [candidateExerciseAnswer, setCandidateExerciseAnswer] = useState("");
  const [evaluatingExercise, setEvaluatingExercise] = useState(false);
  const [exerciseEvaluation, setExerciseEvaluation] = useState(null);

  // Fetch initial explanation when modal opens
  useEffect(() => {
    if (isOpen && topic) {
      loadContent("explain");
    } else {
      // reset state on close
      setExplainData(null);
      setExamplesData(null);
      setMcqData(null);
      setExerciseData(null);
      setSelectedAnswers({});
      setMcqSubmitted(false);
      setCandidateExerciseAnswer("");
      setExerciseEvaluation(null);
      setActiveTab("explain");
    }
  }, [isOpen, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadContent = async (contentType) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/study-planner/practice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic,
          role,
          content_type: contentType,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          if (contentType === "explain") setExplainData(json.data);
          else if (contentType === "examples") setExamplesData(json.data);
          else if (contentType === "mcqs") setMcqData(json.data);
          else if (contentType === "exercise") {
            setExerciseData(json.data);
            if (json.data.starter_code && !candidateExerciseAnswer) {
              setCandidateExerciseAnswer(json.data.starter_code);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error loading ${contentType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "explain" && !explainData) loadContent("explain");
    if (tab === "examples" && !examplesData) loadContent("examples");
    if (tab === "mcqs" && !mcqData) loadContent("mcqs");
    if (tab === "exercise" && !exerciseData) loadContent("exercise");
  };

  // Submit MCQs
  const handleMcqSelect = (questionId, optionKey) => {
    if (mcqSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const submitMcqs = async () => {
    if (!mcqData?.questions) return;
    let correctCount = 0;
    const questions = mcqData.questions;

    questions.forEach((q) => {
      const selected = selectedAnswers[q.id];
      const correct = q.correct_answer?.trim()?.toUpperCase();
      if (selected && selected.startsWith(correct)) {
        correctCount += 1;
      }
    });

    const scorePct = Math.round((correctCount / questions.length) * 100);
    setMcqScore(scorePct);
    setMcqSubmitted(true);

    // Record activity in backend
    try {
      await fetch(`${API_BASE_URL}/study-planner/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          task_id: taskId,
          topic,
          activity_type: "mcq_practice",
          practice_score: scorePct,
          total_questions: questions.length,
          correct_answers: correctCount,
          activity_data: {
            user_selections: selectedAnswers,
          },
        }),
      });
      onActivityRecorded();
    } catch (e) {
      console.error("Failed to record MCQ activity:", e);
    }
  };

  // Submit Exercise for AI Evaluation
  const submitExerciseForEvaluation = async () => {
    if (!candidateExerciseAnswer.trim()) return;
    try {
      setEvaluatingExercise(true);
      const res = await fetch(`${API_BASE_URL}/study-planner/practice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic,
          role,
          content_type: "evaluate_answer",
          user_answer: candidateExerciseAnswer,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setExerciseEvaluation(json.data);

          // Record in backend
          await fetch(`${API_BASE_URL}/study-planner/activity`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              task_id: taskId,
              topic,
              activity_type: "coding_exercise",
              practice_score: json.data.score || 75.0,
              total_questions: 1,
              correct_answers: (json.data.score || 75.0) >= 70 ? 1 : 0,
              activity_data: {
                answer: candidateExerciseAnswer,
                evaluation: json.data,
              },
            }),
          });
          onActivityRecorded();
        }
      }
    } catch (err) {
      console.error("Failed to evaluate exercise:", err);
    } finally {
      setEvaluatingExercise(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 17, 32, 0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "1rem",
          maxWidth: "850px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          color: "var(--text-main)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-surface)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--primary)",
                  letterSpacing: "0.05em",
                }}
              >
                AI Learning Assistant
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>•</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{role}</span>
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0.2rem 0 0 0", color: "var(--text-main)" }}>{topic}</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "0.35rem",
              borderRadius: "6px",
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.75rem clamp(0.75rem, 2vw, 1.75rem)",
            borderBottom: "1px solid var(--border-color)",
            background: "var(--bg-surface)",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {[
            { id: "explain", label: "Concept Guide" },
            { id: "examples", label: "Code & Architecture" },
            { id: "mcqs", label: "Practice MCQs (5)" },
            { id: "exercise", label: "Challenge & Evaluation" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: activeTab === t.id ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === t.id ? "var(--primary)" : "var(--bg-surface)",
                color: activeTab === t.id ? "#ffffff" : "var(--text-secondary)",
                boxShadow: activeTab === t.id ? "0 2px 8px var(--primary-glow)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.75rem" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem" }}>
              <IconRefresh className="animate-spin" size={32} style={{ color: "#6366f1", marginBottom: "1rem" }} />
              <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.9rem" }}>
                AI Assistant is preparing customized learning content for {topic}...
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: EXPLAIN */}
              {activeTab === "explain" && explainData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "0.75rem",
                      background: "var(--primary-light)",
                      border: "1px solid var(--primary-border)",
                    }}
                  >
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.4rem 0", color: "var(--primary)" }}>
                      Executive Overview
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-main)" }}>
                      {explainData.overview}
                    </p>
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-main)" }}>Core Concepts to Master</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(explainData.core_concepts || []).map((c, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "0.95rem 1.15rem",
                            borderRadius: "0.5rem",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-main)", marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ color: "var(--primary)" }}>•</span>
                            <span>{c.title}</span>
                          </div>
                          <div style={{ fontSize: "0.85rem", lineHeight: 1.55, color: "var(--text-secondary)" }}>
                            {c.explanation}
                          </div>
                          {c.key_takeaway && (
                            <div
                              style={{
                                marginTop: "0.45rem",
                                fontSize: "0.8rem",
                                color: "var(--primary)",
                                fontWeight: 600,
                              }}
                            >
                              💡 Takeaway: {c.key_takeaway}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {explainData.common_pitfalls_and_mistakes?.length > 0 && (
                    <div
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "0.5rem",
                        background: "var(--error-light)",
                        border: "1px solid var(--error-border)",
                      }}
                    >
                      <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--error)", fontSize: "0.9rem", fontWeight: 700 }}>
                        ⚠️ Common Interview Pitfalls & Misconceptions
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text-main)" }}>
                        {explainData.common_pitfalls_and_mistakes.map((p, idx) => (
                          <li key={idx} style={{ marginBottom: "0.25rem" }}>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {explainData.interview_pro_tips?.length > 0 && (
                    <div
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "0.5rem",
                        background: "var(--primary-light)",
                        border: "1px solid var(--primary-border)",
                      }}
                    >
                      <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--primary)", fontSize: "0.9rem", fontWeight: 700 }}>
                        🎯 Senior Interviewer Pro-Tips
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text-main)" }}>
                        {explainData.interview_pro_tips.map((tip, idx) => (
                          <li key={idx} style={{ marginBottom: "0.25rem" }}>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EXAMPLES */}
              {activeTab === "examples" && examplesData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {(examplesData.examples || []).map((ex, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "0.75rem",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>{ex.title}</h4>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            textTransform: "uppercase",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "4px",
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-secondary)",
                            fontWeight: 600,
                          }}
                        >
                          {ex.language || "Code"}
                        </span>
                      </div>
                      <pre
                        style={{
                          background: "#0F172A",
                          padding: "1rem",
                          borderRadius: "0.5rem",
                          overflowX: "auto",
                          fontSize: "0.82rem",
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                          color: "#F8FAFC",
                          margin: "0.5rem 0 0.75rem 0",
                          border: "1px solid #1E293B",
                          lineHeight: 1.6,
                        }}
                      >
                        {ex.code}
                      </pre>
                      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                        {ex.explanation}
                      </p>
                      {ex.best_practices?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {ex.best_practices.map((bp, bIdx) => (
                            <span
                              key={bIdx}
                              style={{
                                fontSize: "0.75rem",
                                background: "var(--primary-light)",
                                color: "var(--primary)",
                                border: "1px solid var(--primary-border)",
                                padding: "0.2rem 0.55rem",
                                borderRadius: "4px",
                                fontWeight: 600,
                              }}
                            >
                              ✓ {bp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: MCQS */}
              {activeTab === "mcqs" && mcqData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {mcqSubmitted && (
                    <div
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "0.75rem",
                        background: mcqScore >= 80 ? "var(--success-light)" : "var(--warning-light)",
                        border: `1px solid ${mcqScore >= 80 ? "var(--success-border)" : "var(--warning-border)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-main)" }}>
                          Practice Score: {mcqScore}%
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                          {mcqScore >= 80
                            ? "Excellent! Topic proficiency verified and synced to your study plan."
                            : "Keep practicing! Review the detailed answer explanations below."}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          padding: "0.35rem 0.75rem",
                          borderRadius: "9999px",
                          background: mcqScore >= 80 ? "var(--success)" : "var(--warning)",
                          color: "#fff",
                        }}
                      >
                        {mcqScore >= 80 ? "Proficient" : "Learning"}
                      </span>
                    </div>
                  )}

                  {(mcqData.questions || []).map((q, idx) => {
                    const selected = selectedAnswers[q.id];
                    const correctLetter = q.correct_answer?.trim()?.toUpperCase();

                    return (
                      <div
                        key={q.id || idx}
                        style={{
                          padding: "1.25rem",
                          borderRadius: "0.75rem",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-color)",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 700, marginBottom: "0.3rem" }}>
                          Question {idx + 1}
                        </div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.85rem", lineHeight: 1.5 }}>
                          {q.question}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {(q.options || []).map((opt, optIdx) => {
                            const optLetter = opt.trim().charAt(0).toUpperCase();
                            const isSelected = selected === opt;
                            const isCorrectOpt = optLetter === correctLetter;

                            let optBg = "var(--bg-secondary)";
                            let optBorder = "1px solid var(--border-color)";
                            let optColor = "var(--text-main)";

                            if (mcqSubmitted) {
                              if (isCorrectOpt) {
                                optBg = "var(--success-light)";
                                optBorder = "1px solid var(--success-border)";
                                optColor = "var(--success)";
                              } else if (isSelected && !isCorrectOpt) {
                                optBg = "var(--error-light)";
                                optBorder = "1px solid var(--error-border)";
                                optColor = "var(--error)";
                              }
                            } else if (isSelected) {
                              optBg = "var(--primary-light)";
                              optBorder = "1px solid var(--primary)";
                              optColor = "var(--primary)";
                            }

                            return (
                              <div
                                key={optIdx}
                                onClick={() => handleMcqSelect(q.id, opt)}
                                style={{
                                  padding: "0.75rem 1rem",
                                  borderRadius: "0.5rem",
                                  background: optBg,
                                  border: optBorder,
                                  color: optColor,
                                  fontWeight: isSelected ? 600 : 400,
                                  cursor: mcqSubmitted ? "default" : "pointer",
                                  fontSize: "0.85rem",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {opt}
                              </div>
                            );
                          })}
                        </div>

                        {mcqSubmitted && (
                          <div
                            style={{
                              marginTop: "0.85rem",
                              padding: "0.75rem",
                              borderRadius: "0.5rem",
                              background: "var(--bg-secondary)",
                              border: "1px solid var(--border-color)",
                              fontSize: "0.82rem",
                              color: "var(--text-secondary)",
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ fontWeight: 700, color: "var(--primary)" }}>Explanation: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!mcqSubmitted && (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        variant="primary"
                        onClick={submitMcqs}
                        disabled={Object.keys(selectedAnswers).length === 0}
                      >
                        Submit Answers & Check Score
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: EXERCISE & EVALUATION */}
              {activeTab === "exercise" && exerciseData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div
                    style={{
                      padding: "1.25rem",
                      borderRadius: "0.75rem",
                      background: "var(--primary-light)",
                      border: "1px solid var(--primary-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--primary)" }}>{exerciseData.exercise_title}</h4>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          background: "var(--primary)",
                          color: "#fff",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "9999px",
                          fontWeight: 700,
                        }}
                      >
                        {exerciseData.difficulty || "Intermediate"}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-main)" }}>
                      {exerciseData.problem_statement}
                    </p>
                    {exerciseData.expected_solution_hints?.length > 0 && (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        💡 <strong style={{ color: "var(--primary)" }}>Hints:</strong> {exerciseData.expected_solution_hints.join(" • ")}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.4rem" }}>
                      Your Solution / Answer:
                    </label>
                    <textarea
                      rows={8}
                      value={candidateExerciseAnswer}
                      onChange={(e) => setCandidateExerciseAnswer(e.target.value)}
                      placeholder="Write your code, solution, or architectural explanation here..."
                      style={{
                        width: "100%",
                        padding: "0.9rem 1rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #1E293B",
                        background: "#0F172A",
                        color: "#F8FAFC",
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                        fontSize: "0.85rem",
                        lineHeight: 1.6,
                        resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                      <Button
                        variant="primary"
                        onClick={submitExerciseForEvaluation}
                        disabled={evaluatingExercise || !candidateExerciseAnswer.trim()}
                      >
                        {evaluatingExercise ? (
                          <>
                            <IconRefresh className="animate-spin" size={16} />
                            <span>Evaluating with AI...</span>
                          </>
                        ) : (
                          <>
                            <IconSparkles size={16} />
                            <span>Evaluate Solution with AI</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Evaluation Result */}
                  {exerciseEvaluation && (
                    <div
                      style={{
                        padding: "1.25rem",
                        borderRadius: "0.75rem",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-sm)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
                            Score: {exerciseEvaluation.score}/100
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            Mastery Assessment: {exerciseEvaluation.mastery_level}
                          </div>
                        </div>
                        <span
                          style={{
                            padding: "0.35rem 0.85rem",
                            borderRadius: "9999px",
                            background: exerciseEvaluation.score >= 75 ? "var(--success)" : "var(--warning)",
                            color: "#fff",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                          }}
                        >
                          {exerciseEvaluation.mastery_level}
                        </span>
                      </div>

                      {exerciseEvaluation.strengths?.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--success)", marginBottom: "0.25rem" }}>
                            ✓ Key Strengths
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.82rem", lineHeight: 1.5, color: "var(--text-main)" }}>
                            {exerciseEvaluation.strengths.map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {exerciseEvaluation.mistakes?.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--error)", marginBottom: "0.25rem" }}>
                            ⚠️ Identified Mistakes / Omissions
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.82rem", lineHeight: 1.5, color: "var(--text-main)" }}>
                            {exerciseEvaluation.mistakes.map((m, idx) => (
                              <li key={idx}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {exerciseEvaluation.ideal_answer && (
                        <div
                          style={{
                            padding: "0.9rem 1.15rem",
                            borderRadius: "0.5rem",
                            background: "var(--primary-light)",
                            border: "1px solid var(--primary-border)",
                          }}
                        >
                          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)", marginBottom: "0.3rem" }}>
                            Staff Engineer Ideal Answer:
                          </div>
                          <div style={{ fontSize: "0.85rem", lineHeight: 1.55, color: "var(--text-main)" }}>
                            {exerciseEvaluation.ideal_answer}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

