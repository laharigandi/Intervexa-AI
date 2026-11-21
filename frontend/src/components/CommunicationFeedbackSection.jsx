import { useState } from "react";
import Card from "./Card";
import Button from "./Button";
import ScoreCard from "./ScoreCard";
import theme from "../styles/theme";
import { preStyle } from "../styles/shared";
import {
  IconMessageSquare,
  IconSparkles,
  IconCheckCircle,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconHelpCircle,
  IconMic,
  IconVolume2,
} from "./Icons";

export default function CommunicationFeedbackSection({ summary = {}, results = [] }) {
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState({});
  const [activeTabPerQuestion, setActiveTabPerQuestion] = useState({});

  // Extract overall communication feedback
  const commSummary = summary?.communication_feedback || {};
  const hasOverallComm = Boolean(commSummary && Object.keys(commSummary).length > 0 && commSummary.overall_score !== undefined);

  // Fallback calculation if commSummary is not present in legacy summary
  const validQuestionFeedbacks = results
    .map((r) => r.communication_feedback)
    .filter((fb) => fb && typeof fb === "object" && fb.communication_score !== undefined);

  const hasAnyCommData = hasOverallComm || validQuestionFeedbacks.length > 0;

  if (!hasAnyCommData) {
    return (
      <div style={{ marginTop: 28, marginBottom: 28 }} className="fade-in-up">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: theme.primaryLight,
              color: theme.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconMessageSquare size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>
              Communication & Speaking Feedback
            </h3>
            <p style={{ fontSize: 13, color: theme.muted, margin: "2px 0 0 0" }}>
              Speech delivery metrics (pace, fillers, and fluency) are available when responding via microphone.
            </p>
          </div>
        </div>
        <Card>
          <div style={{ padding: "20px 0", textAlign: "center", color: theme.muted }}>
            <IconMic size={28} style={{ margin: "0 auto 8px auto", opacity: 0.6 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary, margin: "0 0 4px 0" }}>
              No Voice Transcript Recorded
            </p>
            <p style={{ fontSize: 13, margin: 0 }}>
              Complete your next interview using voice input to receive detailed speech clarity, pace, and filler word analysis.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const overallScore = hasOverallComm
    ? commSummary.overall_score
    : validQuestionFeedbacks.length > 0
    ? Math.round(
        validQuestionFeedbacks.reduce((sum, f) => sum + (f.communication_score || 0), 0) /
          validQuestionFeedbacks.length
      )
    : 0;

  const totalFillers = hasOverallComm
    ? commSummary.total_fillers ?? 0
    : validQuestionFeedbacks.reduce((sum, f) => sum + (f.filler_analysis?.total_fillers || 0), 0);

  const topFillers = hasOverallComm && commSummary.top_fillers ? commSummary.top_fillers : [];

  const paceDisplay = hasOverallComm && commSummary.pace_display ? commSummary.pace_display : "Speaking pace unavailable";
  const paceStatus = hasOverallComm && commSummary.pace_status ? commSummary.pace_status : "unavailable";
  const paceAvgWpm = hasOverallComm && commSummary.avg_wpm ? commSummary.avg_wpm : null;

  // Real-time speaking coach metrics if available
  const spkMetrics = summary?.speaking_metrics || commSummary?.speaking_coach || {};
  const displayWpm = spkMetrics.average_wpm || paceAvgWpm;
  const displayPaceCategory = spkMetrics.pace_category || (paceStatus === "optimal" ? "Moderate" : paceStatus);
  const totalLongPauses = spkMetrics.total_long_pauses ?? 0;
  const totalPauseDuration = spkMetrics.total_pause_seconds ?? 0;

  const clarityAvg = hasOverallComm
    ? (commSummary.clarity_average ?? 0)
    : validQuestionFeedbacks.length > 0
    ? Math.round(validQuestionFeedbacks.reduce((s, f) => s + (f.rubric_breakdown?.clarity || 0), 0) / validQuestionFeedbacks.length)
    : 0;

  const structureAvg = hasOverallComm
    ? (commSummary.structure_average ?? 0)
    : validQuestionFeedbacks.length > 0
    ? Math.round(validQuestionFeedbacks.reduce((s, f) => s + (f.rubric_breakdown?.structure || 0), 0) / validQuestionFeedbacks.length)
    : 0;

  const concisenessAvg = hasOverallComm
    ? (commSummary.conciseness_average ?? 0)
    : validQuestionFeedbacks.length > 0
    ? Math.round(validQuestionFeedbacks.reduce((s, f) => s + (f.rubric_breakdown?.conciseness || 0), 0) / validQuestionFeedbacks.length)
    : 0;

  const fluencyAvg = hasOverallComm
    ? (commSummary.fluency_average ?? 0)
    : validQuestionFeedbacks.length > 0
    ? Math.round(validQuestionFeedbacks.reduce((s, f) => s + (f.rubric_breakdown?.fluency || 0), 0) / validQuestionFeedbacks.length)
    : 0;

  const recommendations =
    hasOverallComm && commSummary.key_recommendations?.length > 0
      ? commSummary.key_recommendations
      : validQuestionFeedbacks.length > 0
      ? Array.from(new Set(validQuestionFeedbacks.flatMap((f) => f.suggestions || []))).slice(0, 4)
      : [];

  const summaryStatement =
    hasOverallComm && commSummary.summary_statement
      ? commSummary.summary_statement
      : "Structured communication assessment based on clarity, logical progression, conciseness, and verbal fluency.";

  const toggleAnswerExpand = (idx) => {
    setExpandedAnswers((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return theme.success;
    if (score >= 60) return theme.primary;
    if (score >= 40) return theme.warning;
    return theme.danger;
  };

  const getScoreBadge = (score) => {
    if (score >= 85) return { text: "Executive & Fluent", bg: "var(--success-light)", color: "var(--success)", border: "var(--success-border)" };
    if (score >= 70) return { text: "Interview Ready", bg: "var(--primary-light)", color: "var(--primary)", border: "var(--primary-border)" };
    if (score >= 50) return { text: "Developing Fluency", bg: "var(--warning-light)", color: "var(--warning)", border: "var(--warning-border)" };
    return { text: "Needs Practice", bg: "var(--error-light)", color: "var(--error)", border: "var(--error-border)" };
  };

  const overallBadge = getScoreBadge(overallScore);

  return (
    <div style={{ marginTop: 28, marginBottom: 28 }} className="fade-in-up">
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: theme.primaryLight,
              color: theme.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconMessageSquare size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0 }}>
              Communication & Speaking Feedback
            </h3>
            <p style={{ fontSize: 13, color: theme.muted, margin: "2px 0 0 0" }}>
              In-depth transcript analysis assessing clarity, verbal fluency, answer structure, and pace.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRubricModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: `1px solid ${theme.border}`,
            padding: "6px 14px",
            borderRadius: theme.radius.full,
            fontSize: 12,
            fontWeight: 600,
            color: theme.primary,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <IconHelpCircle size={15} />
          <span>Scoring Rubric & Methodology</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* 1. Communication Score Card */}
        <Card style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Communication Quality
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: getScoreColor(overallScore), lineHeight: 1 }}>
                  {overallScore}
                </span>
                <span style={{ fontSize: 16, fontWeight: 600, color: theme.muted }}>/ 100</span>
              </div>
            </div>

            <span
              style={{
                background: overallBadge.bg,
                color: overallBadge.color,
                border: `1px solid ${overallBadge.border}`,
                padding: "4px 10px",
                borderRadius: theme.radius.full,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {overallBadge.text}
            </span>
          </div>

          <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.5, margin: "0 0 16px 0" }}>
            {summaryStatement}
          </p>

          {/* 4 Dimension Progress Bars */}
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 3 }}>
                <span>Answer Structure</span>
                <span>{structureAvg} / 25</span>
              </div>
              <div style={{ height: 6, background: theme.border, borderRadius: theme.radius.full, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(structureAvg / 25) * 100}%`,
                    background: theme.primary,
                    borderRadius: theme.radius.full,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 3 }}>
                <span>Clarity & Expression</span>
                <span>{clarityAvg} / 25</span>
              </div>
              <div style={{ height: 6, background: theme.border, borderRadius: theme.radius.full, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(clarityAvg / 25) * 100}%`,
                    background: "var(--success)",
                    borderRadius: theme.radius.full,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 3 }}>
                <span>Conciseness & Relevance</span>
                <span>{concisenessAvg} / 25</span>
              </div>
              <div style={{ height: 6, background: theme.border, borderRadius: theme.radius.full, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(concisenessAvg / 25) * 100}%`,
                    background: "var(--accent)",
                    borderRadius: theme.radius.full,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 3 }}>
                <span>Verbal Fluency (Filler Control)</span>
                <span>{fluencyAvg} / 25</span>
              </div>
              <div style={{ height: 6, background: theme.border, borderRadius: theme.radius.full, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(fluencyAvg / 25) * 100}%`,
                    background: "var(--primary)",
                    borderRadius: theme.radius.full,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Filler Word Analysis Card */}
        <Card style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Filler Word Frequency
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: totalFillers > 6 ? theme.warning : theme.text, lineHeight: 1 }}>
                  {totalFillers}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.muted }}>total occurrences</span>
              </div>
            </div>

            <span
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-color)",
                padding: "3px 8px",
                borderRadius: theme.radius.full,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Estimated from transcript
            </span>
          </div>

          <p style={{ fontSize: 13, color: theme.muted, margin: "0 0 14px 0", lineHeight: 1.5 }}>
            Identifies common verbal pauses (&quot;um&quot;, &quot;uh&quot;, &quot;you know&quot;, &quot;basically&quot;, &quot;actually&quot;, &quot;like&quot;) with contextual boundary filtering.
          </p>

          {/* Breakdown Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {topFillers.length > 0 ? (
              topFillers.map((tf, i) => (
                <span
                  key={i}
                  style={{
                    background: "var(--warning-light)",
                    color: "var(--warning)",
                    border: "1px solid var(--warning-border)",
                    padding: "5px 12px",
                    borderRadius: theme.radius.full,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  &quot;{tf.word}&quot; &bull; {tf.count}x
                </span>
              ))
            ) : totalFillers === 0 ? (
              <span
                style={{
                  background: "var(--success-light)",
                  color: "var(--success)",
                  border: "1px solid var(--success-border)",
                  padding: "5px 12px",
                  borderRadius: theme.radius.full,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ✓ Zero unnecessary filler words detected
              </span>
            ) : (
              <span style={{ fontSize: 13, color: theme.muted }}>No prominent filler patterns detected.</span>
            )}
          </div>

          <div
            style={{
              background: theme.background,
              padding: "10px 14px",
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.border}`,
              fontSize: 12,
              color: theme.textSecondary,
              lineHeight: 1.5,
            }}
          >
            💡 <strong>Pro Coach Tip:</strong> Replace fillers with a silent 1-second pause. Interviewers perceive brief pauses as thoughtful composure.
          </div>
        </Card>

        {/* 3. Speaking Pace & Delivery Card */}
        <Card style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Speaking Pace & Delivery
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: displayPaceCategory === "Moderate" ? "var(--success)" : theme.text, lineHeight: 1.2 }}>
                  {displayWpm ? `${displayWpm} WPM` : "Speaking pace unavailable"}
                </span>
              </div>
            </div>

            <span
              style={{
                background: displayPaceCategory === "Moderate" ? "var(--success-light)" : displayPaceCategory === "unavailable" ? "var(--bg-secondary)" : "var(--warning-light)",
                color: displayPaceCategory === "Moderate" ? "var(--success)" : displayPaceCategory === "unavailable" ? "var(--text-secondary)" : "var(--warning)",
                border: `1px solid ${displayPaceCategory === "Moderate" ? "var(--success-border)" : displayPaceCategory === "unavailable" ? "var(--border-color)" : "var(--warning-border)"}`,
                padding: "4px 10px",
                borderRadius: theme.radius.full,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "capitalize",
              }}
            >
              {displayPaceCategory === "Moderate" ? "Moderate (Optimal)" : displayPaceCategory}
            </span>
          </div>

          <p style={{ fontSize: 13, color: theme.textSecondary, margin: "0 0 14px 0", lineHeight: 1.5 }}>
            {paceStatus === "unavailable" && !displayWpm
              ? "Speaking pace estimation requires active microphone recording timing. For text-submitted responses, pace is omitted rather than estimated."
              : paceDisplay}
          </p>

          {/* Observable Speaking Coach Telemetry */}
          {(totalLongPauses > 0 || totalPauseDuration > 0 || spkMetrics.clarity_score) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: totalLongPauses > 2 ? "rgba(245, 158, 11, 0.12)" : theme.hoverBg,
                  color: totalLongPauses > 2 ? "#D97706" : theme.textSecondary,
                  border: `1px solid ${theme.border}`,
                }}
              >
                ⏸ {totalLongPauses} Long Pauses (≥2s) &bull; {totalPauseDuration}s silence
              </span>
              {spkMetrics.clarity_score && (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: theme.primaryLight,
                    color: theme.primary,
                  }}
                >
                  ⚡ Speech Clarity: {spkMetrics.clarity_score}%
                </span>
              )}
            </div>
          )}

          <div
            style={{
              background: "var(--bg-selected)",
              border: `1px solid ${theme.primaryBorder}`,
              padding: "10px 14px",
              borderRadius: theme.radius.sm,
              fontSize: 12,
              color: theme.primary,
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            🎯 <strong>Benchmark Range:</strong> 120–160 Words Per Minute is conversational and allows interviewers to follow technical rationale comfortably.
          </div>

          <div style={{ fontSize: 11, color: theme.muted, lineHeight: 1.4 }}>
            🔒 Note: Text analysis does not infer pronunciation, physical accent, confidence, or vocal emotion.
          </div>
        </Card>
      </div>

      {/* Recommendations Banner */}
      <Card
        style={{
          background: "var(--bg-surface)",
          border: `1px solid ${theme.primaryBorder}`,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <IconSparkles size={18} color={theme.primary} />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text }}>
            Personalized Communication Recommendations
          </h4>
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          {recommendations.map((rec, i) => (
            <li key={i} style={{ fontSize: 13, color: theme.text, lineHeight: 1.5 }}>
              {rec}
            </li>
          ))}
        </ul>
      </Card>

      {/* Answer-by-Answer Communication Breakdown */}
      <div style={{ marginTop: 24, marginBottom: 12 }}>
        <h4 style={{ fontSize: 16, fontWeight: 800, color: theme.text, margin: 0 }}>
          Question-by-Question Communication Analysis
        </h4>
        <p style={{ fontSize: 13, color: theme.muted, margin: "4px 0 0 0" }}>
          Expand each question card to view structure adherence, STAR behavioral breakdown, detected fillers, and improved phrasing.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {results.map((item, index) => {
          const qComm = item.communication_feedback || {};
          const qCommScore = qComm.communication_score !== undefined ? qComm.communication_score : Math.round(Number(item.communication_score || 0) * 10);
          const qRating = qComm.communication_rating || (qCommScore >= 80 ? "Proficient" : "Developing");
          const isExpanded = expandedAnswers[index];
          const activeTab = activeTabPerQuestion[index] || "structure"; // 'structure' | 'comparison' | 'fillers'

          const structureAnalysis = qComm.structure_analysis || {};
          const fillerAnalysis = qComm.filler_analysis || {};
          const clarityAnalysis = qComm.clarity_analysis || {};
          const starFormat = structureAnalysis.star_format;

          const isAnswerTooShort = !item.answer || item.answer.trim().split(/\s+/).filter(Boolean).length < 3;

          return (
            <Card key={index} style={{ marginBottom: 0, border: isExpanded ? `1px solid ${theme.primaryBorder}` : `1px solid ${theme.border}` }}>
              {/* Collapsible Card Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  cursor: "pointer",
                }}
                onClick={() => toggleAnswerExpand(index)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: theme.primaryLight,
                      color: theme.primary,
                      border: `1px solid ${theme.primaryBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Q{index + 1}
                  </span>
                  <div>
                    <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>
                      {item.question ? (item.question.length > 75 ? `${item.question.slice(0, 75)}...` : item.question) : `Question ${index + 1}`}
                    </h5>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {isAnswerTooShort ? (
                    <span
                      style={{
                        background: "var(--error-light)",
                        color: "var(--error)",
                        border: "1px solid var(--error-border)",
                        padding: "3px 10px",
                        borderRadius: theme.radius.full,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      Answer Too Brief
                    </span>
                  ) : (
                    <>
                      <span
                        style={{
                          background: qCommScore >= 80 ? "var(--success-light)" : qCommScore >= 60 ? "var(--primary-light)" : "var(--warning-light)",
                          color: qCommScore >= 80 ? "var(--success)" : qCommScore >= 60 ? "var(--primary)" : "var(--warning)",
                          border: `1px solid ${qCommScore >= 80 ? "var(--success-border)" : qCommScore >= 60 ? "var(--primary-border)" : "var(--warning-border)"}`,
                          padding: "3px 10px",
                          borderRadius: theme.radius.full,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Communication: {qCommScore}/100
                      </span>
                      {starFormat?.is_applicable && (
                        <span
                          style={{
                            background: "var(--primary-light)",
                            color: "var(--primary)",
                            border: `1px solid ${theme.primaryBorder}`,
                            padding: "3px 9px",
                            borderRadius: theme.radius.full,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          STAR Framework
                        </span>
                      )}
                    </>
                  )}
                  <span style={{ color: theme.muted, display: "flex", alignItems: "center" }}>
                    {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                  </span>
                </div>
              </div>

              {/* Collapsed Preview Question Text */}
              {!isExpanded && (
                <p style={{ margin: "10px 0 0 0", fontSize: 13, color: theme.muted, lineHeight: 1.4 }}>
                  {item.answer ? `Your answer: "${item.answer.slice(0, 90)}..."` : "No answer provided"}
                </p>
              )}

              {/* Expanded Card Body */}
              {isExpanded && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${theme.border}`, animation: "fadeIn 0.2s ease" }}>
                  {/* Full Question Banner */}
                  <div
                    style={{
                      background: theme.background,
                      padding: "12px 14px",
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.border}`,
                      marginBottom: 14,
                    }}
                  >
                    <strong style={{ fontSize: 11, color: theme.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                      Full Question
                    </strong>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: theme.text, lineHeight: 1.5 }}>
                      {item.question}
                    </p>
                  </div>

                  {isAnswerTooShort ? (
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "var(--warning-light)",
                        border: "1px solid var(--warning-border)",
                        borderRadius: theme.radius.sm,
                        color: "var(--warning)",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      ⚠️ <strong>Response Too Brief:</strong> A complete answer requires at least 4–5 words to evaluate structural progression, clarity, and verbal fluency. In future mock sessions, aim to provide a complete sentence with a clear technical or experiential explanation.
                    </div>
                  ) : (
                    <>
                      {/* Sub-tab Navigation */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setActiveTabPerQuestion((prev) => ({ ...prev, [index]: "structure" }))}
                          style={{
                            padding: "6px 14px",
                            borderRadius: theme.radius.sm,
                            fontSize: 12,
                            fontWeight: 600,
                            border: `1px solid ${activeTab === "structure" ? theme.primary : theme.border}`,
                            background: activeTab === "structure" ? theme.primaryLight : "transparent",
                            color: activeTab === "structure" ? theme.primary : theme.textSecondary,
                            cursor: "pointer",
                          }}
                        >
                          Answer Structure & Rubric
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabPerQuestion((prev) => ({ ...prev, [index]: "comparison" }))}
                          style={{
                            padding: "6px 14px",
                            borderRadius: theme.radius.sm,
                            fontSize: 12,
                            fontWeight: 600,
                            border: `1px solid ${activeTab === "comparison" ? theme.primary : theme.border}`,
                            background: activeTab === "comparison" ? theme.primaryLight : "transparent",
                            color: activeTab === "comparison" ? theme.primary : theme.textSecondary,
                            cursor: "pointer",
                          }}
                        >
                          Transcript vs. Improved Answer
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabPerQuestion((prev) => ({ ...prev, [index]: "fillers" }))}
                          style={{
                            padding: "6px 14px",
                            borderRadius: theme.radius.sm,
                            fontSize: 12,
                            fontWeight: 600,
                            border: `1px solid ${activeTab === "fillers" ? theme.primary : theme.border}`,
                            background: activeTab === "fillers" ? theme.primaryLight : "transparent",
                            color: activeTab === "fillers" ? theme.primary : theme.textSecondary,
                            cursor: "pointer",
                          }}
                        >
                          Verbal Fillers & Clarity
                        </button>
                      </div>

                      {/* TAB 1: STRUCTURE & RUBRIC */}
                      {activeTab === "structure" && (
                        <div style={{ display: "grid", gap: 12 }}>
                          {/* Behavioral STAR Framework (if applicable) */}
                          {starFormat?.is_applicable && (
                            <div
                              style={{
                                background: "var(--bg-secondary)",
                                border: `1px solid ${theme.primaryBorder}`,
                                padding: "14px 16px",
                                borderRadius: theme.radius.sm,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <strong style={{ fontSize: 13, color: theme.text }}>
                                  STAR Behavioral Framework Assessment
                                </strong>
                                <span style={{ fontSize: 12, fontWeight: 700, color: theme.primary }}>
                                  {starFormat.star_score}
                                </span>
                              </div>
                              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: theme.textSecondary }}>
                                {starFormat.recommendation}
                              </p>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                                <div style={{ background: starFormat.situation ? "var(--success-light)" : "var(--warning-light)", border: `1px solid ${starFormat.situation ? "var(--success-border)" : "var(--warning-border)"}`, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: starFormat.situation ? "var(--success)" : "var(--warning)" }}>
                                  {starFormat.situation ? "✓ Situation" : "○ Situation missing"}
                                </div>
                                <div style={{ background: starFormat.task ? "var(--success-light)" : "var(--warning-light)", border: `1px solid ${starFormat.task ? "var(--success-border)" : "var(--warning-border)"}`, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: starFormat.task ? "var(--success)" : "var(--warning)" }}>
                                  {starFormat.task ? "✓ Task" : "○ Task missing"}
                                </div>
                                <div style={{ background: starFormat.action ? "var(--success-light)" : "var(--warning-light)", border: `1px solid ${starFormat.action ? "var(--success-border)" : "var(--warning-border)"}`, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: starFormat.action ? "var(--success)" : "var(--warning)" }}>
                                  {starFormat.action ? "✓ Action" : "○ Action missing"}
                                </div>
                                <div style={{ background: starFormat.result ? "var(--success-light)" : "var(--warning-light)", border: `1px solid ${starFormat.result ? "var(--success-border)" : "var(--warning-border)"}`, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: starFormat.result ? "var(--success)" : "var(--warning)" }}>
                                  {starFormat.result ? "✓ Result" : "○ Result missing"}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Technical Structure Progression */}
                          {!starFormat?.is_applicable && (
                            <div
                              style={{
                                background: theme.background,
                                border: `1px solid ${theme.border}`,
                                padding: "14px 16px",
                                borderRadius: theme.radius.sm,
                              }}
                            >
                              <strong style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>
                                Structural Progression (Technical Response)
                              </strong>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                                <div style={{ background: structureAnalysis.has_opening ? "var(--success-light)" : "var(--warning-light)", border: `1px solid ${structureAnalysis.has_opening ? "var(--success-border)" : "var(--warning-border)"}`, padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: structureAnalysis.has_opening ? "var(--success)" : "var(--warning)" }}>
                                  {structureAnalysis.has_opening ? "✓ Direct Opening" : "○ Needs Direct Opening"}
                                </div>
                                <div style={{ background: structureAnalysis.has_explanation ? "var(--success-light)" : "var(--warning-light)", border: `1px solid ${structureAnalysis.has_explanation ? "var(--success-border)" : "var(--warning-border)"}`, padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: structureAnalysis.has_explanation ? "var(--success)" : "var(--warning)" }}>
                                  {structureAnalysis.has_explanation ? "✓ Logical Mechanism" : "○ Needs Deep Mechanism"}
                                </div>
                                <div style={{ background: structureAnalysis.has_example ? "var(--success-light)" : "var(--bg-secondary)", border: `1px solid ${structureAnalysis.has_example ? "var(--success-border)" : "var(--border-color)"}`, padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: structureAnalysis.has_example ? "var(--success)" : "var(--text-secondary)" }}>
                                  {structureAnalysis.has_example ? "✓ Concrete Example Cited" : "○ Optional: Add Example"}
                                </div>
                                <div style={{ background: structureAnalysis.has_conclusion ? "var(--success-light)" : "var(--warning-light)", border: `1px solid ${structureAnalysis.has_conclusion ? "var(--success-border)" : "var(--warning-border)"}`, padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: structureAnalysis.has_conclusion ? "var(--success)" : "var(--warning)" }}>
                                  {structureAnalysis.has_conclusion ? "✓ Clear Wrap-up" : "○ Needs Brief Conclusion"}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Actionable suggestions */}
                          {qComm.suggestions?.length > 0 && (
                            <div style={{ background: "var(--bg-secondary)", border: `1px solid ${theme.border}`, padding: "12px 14px", borderRadius: theme.radius.sm }}>
                              <strong style={{ fontSize: 12, color: theme.text, display: "block", marginBottom: 6 }}>
                                Actionable Improvements:
                              </strong>
                              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                                {qComm.suggestions.map((sug, sIdx) => (
                                  <li key={sIdx}>{sug}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: TRANSCRIPT VS IMPROVED */}
                      {activeTab === "comparison" && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <strong style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase" }}>
                                Your Answer Transcript
                              </strong>
                              <span style={{ fontSize: 11, color: theme.muted }}>
                                {item.answer?.split(/\s+/).filter(Boolean).length || 0} words
                              </span>
                            </div>
                            <pre
                              style={{
                                ...preStyle,
                                background: "var(--bg-surface)",
                                border: `1px solid ${theme.border}`,
                                color: theme.text,
                                minHeight: 90,
                                fontSize: 13,
                              }}
                            >
                              {item.answer || "No response submitted."}
                            </pre>
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <strong style={{ fontSize: 12, color: theme.primary, textTransform: "uppercase" }}>
                                Refined Professional Formulation
                              </strong>
                              <span style={{ fontSize: 11, color: theme.primary, fontWeight: 600 }}>
                                Preserves facts & achievements
                              </span>
                            </div>
                            <pre
                              style={{
                                ...preStyle,
                                background: theme.primaryLight,
                                border: `1px solid ${theme.primaryBorder}`,
                                color: theme.text,
                                minHeight: 90,
                                fontSize: 13,
                              }}
                            >
                              {item.improved_answer || "Refined response formulation will be generated upon full evaluation."}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: VERBAL FILLERS & CLARITY */}
                      {activeTab === "fillers" && (
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ background: theme.background, padding: "12px 14px", borderRadius: theme.radius.sm, border: `1px solid ${theme.border}` }}>
                            <strong style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                              Detected Fillers in this Response
                            </strong>
                            {fillerAnalysis.detected_list?.length > 0 ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {fillerAnalysis.detected_list.map((dl, dIdx) => (
                                  <span
                                    key={dIdx}
                                    style={{
                                      background: "var(--warning-light)",
                                      color: "var(--warning)",
                                      border: "1px solid var(--warning-border)",
                                      padding: "4px 10px",
                                      borderRadius: theme.radius.full,
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {dl}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                                ✓ No verbal fillers detected in this answer transcript.
                              </span>
                            )}
                          </div>

                          {clarityAnalysis.long_sentences?.length > 0 && (
                            <div style={{ background: "var(--error-light)", border: "1px solid var(--error-border)", padding: "12px 14px", borderRadius: theme.radius.sm }}>
                              <strong style={{ fontSize: 12, color: "var(--error)", display: "block", marginBottom: 4 }}>
                                ⚠ Overly Long Sentence Detected ({clarityAnalysis.long_sentences[0].word_count} words):
                              </strong>
                              <p style={{ margin: "0 0 6px 0", fontSize: 12, color: theme.text, fontStyle: "italic" }}>
                                &quot;{clarityAnalysis.long_sentences[0].snippet}&quot;
                              </p>
                              <span style={{ fontSize: 12, color: "var(--error)", fontWeight: 600 }}>
                                Suggestion: Split into two sentences to make your points crisper and easier to follow.
                              </span>
                            </div>
                          )}

                          {qComm.speaking_pace && (
                            <div style={{ fontSize: 12, color: theme.muted }}>
                              <strong>Speaking Pace:</strong>{" "}
                              {qComm.speaking_pace.is_measured
                                ? qComm.speaking_pace.display
                                : "Speaking pace unavailable (text-submitted answer)."}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Rubric Explanation Modal */}
      {showRubricModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowRubricModal(false)}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.border}`,
              maxWidth: 600,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px 28px",
              boxShadow: theme.shadow.elevated,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>
                Communication Scoring Rubric (100-Point Standard)
              </h3>
              <button
                type="button"
                onClick={() => setShowRubricModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: theme.muted,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: theme.muted, lineHeight: 1.5, margin: "0 0 16px 0" }}>
              The Communication Score assesses the rhetorical quality, conciseness, and organization of your submitted transcript. It is <strong>not</strong> an objective measurement of your personality, intellect, or employability.
            </p>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ background: theme.background, padding: "12px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.border}` }}>
                <strong style={{ fontSize: 13, color: theme.primary, display: "block", marginBottom: 2 }}>
                  1. Answer Structure & Flow (25 Points)
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                  Evaluates clear opening statement, logical progression of thoughts, concrete examples/reasoning, and a concise wrap-up. Prompts behavioral questions with the STAR framework (Situation, Task, Action, Result).
                </p>
              </div>

              <div style={{ background: theme.background, padding: "12px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.border}` }}>
                <strong style={{ fontSize: 13, color: "var(--success)", display: "block", marginBottom: 2 }}>
                  2. Clarity & Expression (25 Points)
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                  Evaluates sentence readability and balanced length. Flags confusing run-on sentences (&gt;32 words) and excessive keyword repetition.
                </p>
              </div>

              <div style={{ background: theme.background, padding: "12px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.border}` }}>
                <strong style={{ fontSize: 13, color: "var(--accent)", display: "block", marginBottom: 2 }}>
                  3. Conciseness & Relevance (25 Points)
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                  Rewards focused responses that directly address the prompt without unnecessary rambling or excessive brevity. Optimal interview length is 40–180 words.
                </p>
              </div>

              <div style={{ background: theme.background, padding: "12px 16px", borderRadius: theme.radius.sm, border: `1px solid ${theme.border}` }}>
                <strong style={{ fontSize: 13, color: "var(--primary)", display: "block", marginBottom: 2 }}>
                  4. Verbal Fluency & Filler Control (25 Points)
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>
                  Uses word-boundary matching and contextual checks to detect verbal fillers (&quot;um&quot;, &quot;uh&quot;, &quot;like&quot;, &quot;you know&quot;, &quot;basically&quot;, &quot;actually&quot;). Scores fluency density on transcript data.
                </p>
              </div>
            </div>

            <div style={{ marginTop: 20, textAlign: "right" }}>
              <Button onClick={() => setShowRubricModal(false)}>Got It</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
