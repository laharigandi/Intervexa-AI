import { useEffect, useState, useCallback, useContext } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import PageShell from "../components/PageShell";
import Card from "../components/Card";
import Button from "../components/Button";
import StatCard from "../components/StatCard";
import ScoreCard from "../components/ScoreCard";
import PageActions from "../components/PageActions";
import theme from "../styles/theme";
import {
  preStyle,
  statRow,
  getScoreColor,
  getScoreBackground,
  getScoreBorder,
} from "../styles/shared";
import { API_BASE_URL } from "../config/api";
import { AuthContext } from "../context/AuthContext";
import {
  IconHistory,
  IconBriefcase,
  IconAward,
  IconSparkles,
  IconUpload,
  IconArrowLeft,
  IconChevronRight,
  IconDownload,
  IconResults,
  IconAlertTriangle,
  IconCheckCircle,
  IconMessageSquare,
  IconTrash,
} from "../components/Icons";
import CommunicationFeedbackSection from "../components/CommunicationFeedbackSection";
import AnswerVerificationSection from "../components/AnswerVerificationSection";

// ---------------------------------------------------------------------------
// Skeleton loader for the list view
// ---------------------------------------------------------------------------
function HistorySkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Stat row skeleton */}
      <div style={statRow}>
        {[1, 2].map((n) => (
          <div
            key={n}
            className="skeleton-box"
            style={{ height: 96, borderRadius: theme.radius.md }}
          />
        ))}
      </div>
      {/* Card skeletons */}
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="skeleton-box"
          style={{ height: 100, borderRadius: theme.radius.md }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main History Component
// ---------------------------------------------------------------------------
function History() {
  const navigate = useNavigate();
  const { id: urlInterviewId } = useParams();
  const { logout, isAuthLoading } = useContext(AuthContext);

  // History list state
  const [history, setHistory] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  // "auth" | "forbidden" | "server" | "network" | null
  const [listErrorType, setListErrorType] = useState(null);

  // Detail view state
  const [selectedId, setSelectedId] = useState(
    urlInterviewId ? Number(urlInterviewId) : null
  );
  const [detailCache, setDetailCache] = useState({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletingId, setDeletingId] = useState(false);

  const confirmDeleteInterview = (e, interviewId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setDeleteTargetId(interviewId);
  };

  const executeDeleteInterview = async () => {
    if (!deleteTargetId) return;
    setDeletingId(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${API_BASE_URL}/history/${deleteTargetId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || "Failed to delete interview.");
      }

      // Remove from history state
      setHistory((prev) => prev.filter((item) => item.id !== deleteTargetId));

      // Remove from detailCache
      setDetailCache((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });

      // If this interview was currently selected in detail view, return to list view
      if (selectedId === deleteTargetId) {
        setSelectedId(null);
        navigate("/history");
      }

      setDeleteTargetId(null);
    } catch (err) {
      console.error("[History] Delete error:", err);
      alert(err.message || "Failed to delete interview.");
    } finally {
      setDeletingId(false);
    }
  };

  // Sync selectedId with URL parameter if it changes
  useEffect(() => {
    if (urlInterviewId) {
      const parsedId = Number(urlInterviewId);
      if (!isNaN(parsedId) && parsedId !== selectedId) {
        setSelectedId(parsedId);
      }
    } else if (!urlInterviewId && selectedId !== null) {
      setSelectedId(null);
    }
  }, [urlInterviewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Fetch all user interviews
  // ---------------------------------------------------------------------------
  const fetchHistoryList = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setListError("You are not signed in. Please log in to view your interview history.");
      setListErrorType("auth");
      setLoadingList(false);
      return;
    }

    setLoadingList(true);
    setListError(null);
    setListErrorType(null);

    fetch(`${API_BASE_URL}/history`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (response.status === 401) {
          // Token is invalid or expired — clear it and prompt re-login
          console.warn("[History] 401 Unauthorized — clearing stored token.");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          throw Object.assign(
            new Error("Your session has expired. Please sign in again to continue."),
            { errorType: "auth" }
          );
        }
        if (response.status === 403) {
          throw Object.assign(
            new Error("Access denied. You do not have permission to view this resource."),
            { errorType: "forbidden" }
          );
        }
        if (!response.ok) {
          throw Object.assign(
            new Error(`Server error (HTTP ${response.status}). Please try again.`),
            { errorType: "server" }
          );
        }
        return response.json();
      })
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
        setListError(null);
        setListErrorType(null);
      })
      .catch((error) => {
        console.error("[History] Fetch error:", error.message);
        setListError(error.message || "Could not retrieve your interview history.");
        setListErrorType(error.errorType || "network");
        setHistory([]);
      })
      .finally(() => setLoadingList(false));
  }, []);

  // Don't trigger the fetch until auth validation on mount is complete
  useEffect(() => {
    if (!isAuthLoading) {
      fetchHistoryList();
    }
  }, [isAuthLoading, fetchHistoryList]);

  // ---------------------------------------------------------------------------
  // Fetch individual interview detail when selectedId is set
  // ---------------------------------------------------------------------------
  const fetchInterviewDetail = useCallback(
    (interviewId) => {
      if (!interviewId) return;

      // Return early if already cached to prevent duplicate requests
      if (detailCache[interviewId]) {
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        setDetailError("You are not signed in. Please log in.");
        return;
      }

      setLoadingDetail(true);
      setDetailError(null);

      fetch(`${API_BASE_URL}/history/${interviewId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (response) => {
          if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            throw new Error("Your session has expired. Please sign in again.");
          }
          if (response.status === 404) {
            throw new Error(
              "Interview session not found or you do not have permission to view it."
            );
          }
          if (!response.ok) {
            throw new Error(`Failed to fetch session details (HTTP ${response.status})`);
          }
          return response.json();
        })
        .then((data) => {
          if (data && data.success && data.interview) {
            setDetailCache((prev) => ({
              ...prev,
              [interviewId]: data,
            }));
          } else {
            throw new Error(
              data.message || data.error || "Unexpected data format received from server."
            );
          }
        })
        .catch((error) => {
          console.error("[History] Detail error:", error.message);
          setDetailError(error.message || "Failed to load session details.");
        })
        .finally(() => setLoadingDetail(false));
    },
    [detailCache]
  );

  useEffect(() => {
    if (selectedId && !isAuthLoading) {
      fetchInterviewDetail(selectedId);
    }
  }, [selectedId, isAuthLoading, fetchInterviewDetail]);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------
  const handleSelectInterview = (interviewId) => {
    setSelectedId(interviewId);
    navigate(`/history/${interviewId}`);
  };

  const handleBackToList = () => {
    setSelectedId(null);
    setDetailError(null);
    navigate("/history");
  };

  const handleLogoutAndLogin = () => {
    logout();
    navigate("/login");
  };

  // ---------------------------------------------------------------------------
  // Formatters / helpers
  // ---------------------------------------------------------------------------
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getPersonalityLabel = (p) => {
    if (!p) return "Technical Coach";
    const map = {
      technical: "Technical Lead",
      behavioral: "HR / Behavioral",
      challenging: "Challenging / Stress",
      supportive: "Supportive Mentor",
      faang: "FAANG Bar Raiser",
      executive: "Executive / Director",
      speed: "Rapid Fire",
      panel: "AI Interview Panel",
    };
    return map[String(p).toLowerCase()] || String(p);
  };

  const getRecommendationBadge = (recommendation) => {
    const rec = (recommendation || "").toLowerCase();
    if (
      rec.includes("ready") &&
      !rec.includes("almost") &&
      !rec.includes("not") &&
      !rec.includes("needs")
    ) {
      return {
        bg: theme.successLight,
        color: theme.success,
        border: theme.successBorder,
        text: recommendation || "Interview Ready",
      };
    }
    if (rec.includes("almost") || rec.includes("moderate")) {
      return {
        bg: theme.warningLight,
        color: theme.warning,
        border: theme.warningBorder,
        text: recommendation || "Almost Ready",
      };
    }
    if (rec.includes("need") || rec.includes("improvement")) {
      return {
        bg: theme.dangerLight,
        color: theme.danger,
        border: theme.dangerBorder,
        text: recommendation || "Needs Practice",
      };
    }
    return null;
  };

  const handleDownloadPdf = async (interview, questions) => {
    try {
      setDownloadingPdf(true);
      const summaryPayload = {
        summary: interview.summary || "",
        recommendation: interview.recommendation || "",
        strengths: interview.strengths || "",
        weaknesses: interview.weaknesses || "",
        advice: interview.advice || "",
      };

      const response = await fetch(`${API_BASE_URL}/download_report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: questions,
          summary: summaryPayload,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to download PDF report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Interview_Report_${
        interview.role ? interview.role.replace(/\s+/g, "_") : "Session"
      }_#${interview.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF report. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Auth loading — show neutral spinner while token is being validated on mount
  // ---------------------------------------------------------------------------
  if (isAuthLoading) {
    return (
      <PageShell title="Interview History" subtitle="Loading your session…">
        <HistorySkeleton />
      </PageShell>
    );
  }

  // ---------------------------------------------------------------------------
  // DETAIL VIEW: When an interview session is selected
  // ---------------------------------------------------------------------------
  if (selectedId) {
    const cached = detailCache[selectedId];
    const interview = cached?.interview;
    const questions = cached?.questions || cached?.details || [];

    const recBadge = interview?.recommendation
      ? getRecommendationBadge(interview.recommendation)
      : null;
    const avgScore = Number(interview?.avg_score || 0);

    const chartData = (questions || []).map((q, idx) => ({
      question: `Q${idx + 1}`,
      score: Number(q.technical_score || 0),
    }));

    const historyCommScore =
      interview?.communication_feedback?.overall_score ??
      (questions.some(
        (q) => q.communication_feedback?.communication_score !== undefined
      )
        ? Math.round(
            questions
              .filter(
                (q) =>
                  q.communication_feedback?.communication_score !== undefined
              )
              .reduce(
                (s, q) => s + q.communication_feedback.communication_score,
                0
              ) /
              questions.filter(
                (q) =>
                  q.communication_feedback?.communication_score !== undefined
              ).length
          )
        : interview?.communication_score
        ? Math.min(100, Math.round(Number(interview.communication_score) * 10))
        : null);

    return (
      <PageShell
        title="Session Review"
        subtitle={
          interview
            ? `Performance breakdown for ${interview.role}`
            : "Loading session breakdown..."
        }
        actions={
          <PageActions>
            <Button variant="secondary" onClick={handleBackToList} icon={IconArrowLeft}>
              Back to History
            </Button>
            {questions.length > 0 && (
              <Button
                variant="primary"
                onClick={() => handleDownloadPdf(interview, questions)}
                loading={downloadingPdf}
                disabled={downloadingPdf}
                icon={IconDownload}
              >
                {downloadingPdf ? "Generating..." : "Download PDF"}
              </Button>
            )}
            {interview && (
              <Button
                variant="danger"
                onClick={(e) => confirmDeleteInterview(e, interview.id)}
                icon={IconTrash}
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                }}
              >
                Delete Interview
              </Button>
            )}
          </PageActions>
        }
      >
        {loadingDetail && !cached ? (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "28px 0" }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  border: `3px solid ${theme.border}`,
                  borderTop: `3px solid ${theme.primary}`,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: theme.text }}>
                  Loading interview details...
                </p>
                <span style={{ fontSize: 13, color: theme.muted }}>
                  Retrieving question-by-question scoring and feedback.
                </span>
              </div>
            </div>
          </Card>
        ) : detailError ? (
          <Card style={{ borderLeft: `4px solid ${theme.danger}` }}>
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0" }}
            >
              <div style={{ color: theme.danger }}>
                <IconAlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 16, color: theme.text }}>
                  Unable to load session breakdown
                </h3>
                <p style={{ margin: "0 0 16px 0", color: theme.muted, fontSize: 14 }}>
                  {detailError}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button
                    onClick={() => {
                      // Clear cache entry so it re-fetches
                      setDetailCache((prev) => {
                        const next = { ...prev };
                        delete next[selectedId];
                        return next;
                      });
                      fetchInterviewDetail(selectedId);
                    }}
                    size="sm"
                  >
                    Retry
                  </Button>
                  <Button variant="secondary" onClick={handleBackToList} size="sm">
                    Back to History List
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : interview ? (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Header Metrics Stat Cards */}
            <div style={statRow} className="fade-in-up stagger-1">
              <ScoreCard
                score={avgScore.toFixed(1)}
                maxScore={10}
                label="Technical Score"
                subtext={formatDate(interview.created_at)}
                size={110}
                strokeWidth={9}
                color="var(--primary)"
              />
              {historyCommScore !== null && (
                <StatCard
                  label="Communication"
                  value={`${historyCommScore} / 100`}
                  accent="purple"
                  icon={IconMessageSquare}
                  subtext="Verbal fluency & structure"
                />
              )}
              <StatCard
                label="Questions Evaluated"
                value={questions.length}
                accent="purple"
                icon={IconResults}
                subtext={`Target Role: ${interview.role}`}
              />
              {recBadge && (
                <StatCard
                  label="Recommendation"
                  value={recBadge.text}
                  accent="purple"
                  icon={IconSparkles}
                  subtext="AI assessment evaluation"
                />
              )}
            </div>

            {/* Performance Bar Chart */}
            {chartData.length > 0 && (
              <div className="fade-in-up stagger-2">
                <Card
                  title="Score Breakdown by Question"
                  subtitle="Technical scores per question"
                  icon={IconResults}
                  accent="purple"
                  accentBorder={true}
                >
                  <div style={{ width: "100%", height: 240, marginTop: 10 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="question"
                          tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                        />
                        <YAxis domain={[0, 10]} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #ede9fe",
                            boxShadow: "0 10px 25px -5px rgba(124, 58, 237, 0.12)",
                            backgroundColor: "#ffffff",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        />
                        <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={index} fill={getScoreColor(entry.score)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}

            {/* Overall Assessment Card */}
            {(interview.summary ||
              interview.recommendation ||
              interview.strengths ||
              interview.weaknesses ||
              interview.advice) && (
              <Card
                title="AI Assessment & Recommendation"
                subtitle="Feedback and recommendations"
                icon={IconSparkles}
                accent="purple"
                accentBorder={true}
              >
                {recBadge && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 14px",
                      borderRadius: theme.radius.full,
                      background: recBadge.bg,
                      color: recBadge.color,
                      border: `1px solid ${recBadge.border}`,
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    <IconSparkles size={15} />
                    <span>{recBadge.text}</span>
                  </div>
                )}

                <div style={{ display: "grid", gap: 14 }}>
                  {interview.summary && (
                    <div
                      style={{
                        background: theme.background,
                        padding: "14px 16px",
                        borderRadius: theme.radius.sm,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 12,
                          color: theme.muted,
                          textTransform: "uppercase",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Executive Summary
                      </strong>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          color: theme.text,
                          lineHeight: 1.6,
                        }}
                      >
                        {interview.summary}
                      </p>
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                      gap: 14,
                    }}
                  >
                    {interview.strengths && (
                      <div
                        style={{
                          background: theme.successLight,
                          padding: "14px 16px",
                          borderRadius: theme.radius.sm,
                          border: `1px solid ${theme.successBorder}`,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 12,
                            color: theme.success,
                            textTransform: "uppercase",
                            display: "block",
                            marginBottom: 4,
                          }}
                        >
                          Key Strengths
                        </strong>
                        <p style={{ margin: 0, fontSize: 13, color: theme.text, lineHeight: 1.5 }}>
                          {interview.strengths}
                        </p>
                      </div>
                    )}

                    {interview.weaknesses && (
                      <div
                        style={{
                          background: theme.warningLight,
                          padding: "14px 16px",
                          borderRadius: theme.radius.sm,
                          border: `1px solid ${theme.warningBorder}`,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 12,
                            color: theme.warning,
                            textTransform: "uppercase",
                            display: "block",
                            marginBottom: 4,
                          }}
                        >
                          Areas for Improvement
                        </strong>
                        <p style={{ margin: 0, fontSize: 13, color: theme.text, lineHeight: 1.5 }}>
                          {interview.weaknesses}
                        </p>
                      </div>
                    )}
                  </div>

                  {interview.advice && (
                    <div
                      style={{
                        background: theme.primaryLight,
                        padding: "14px 16px",
                        borderRadius: theme.radius.sm,
                        border: `1px solid ${theme.primaryBorder}`,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 12,
                          color: theme.primary,
                          textTransform: "uppercase",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Placement Coach Advice
                      </strong>
                      <p style={{ margin: 0, fontSize: 13, color: theme.text, lineHeight: 1.5 }}>
                        {interview.advice}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Communication & Speaking Feedback Section */}
            {questions.length > 0 && (
              <CommunicationFeedbackSection summary={interview} results={questions} />
            )}

            {/* Question Breakdown Heading */}
            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text, margin: 0 }}>
                  Question-by-Question Breakdown
                </h3>
                <p style={{ fontSize: 13, color: theme.muted, margin: "4px 0 0 0" }}>
                  Detailed comparison between your responses and benchmark solutions.
                </p>
              </div>
            </div>

            {/* Legacy Session Notice when questions array is empty */}
            {questions.length === 0 ? (
              <Card
                style={{
                  padding: "32px 24px",
                  textAlign: "center",
                  border: `1px dashed ${theme.border}`,
                  background: theme.background,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: theme.warningLight,
                    color: theme.warning,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <IconAlertTriangle size={24} />
                </div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: theme.text }}>
                  Detailed Question Breakdown Unavailable
                </h4>
                <p
                  style={{
                    color: theme.muted,
                    fontSize: 14,
                    maxWidth: 520,
                    margin: "0 auto 16px",
                    lineHeight: 1.5,
                  }}
                >
                  This mock session was recorded prior to detailed question tracking. The overall
                  score and AI summary are preserved above, but question-by-question responses were
                  not captured.
                </p>
                <Button variant="secondary" onClick={handleBackToList} icon={IconArrowLeft} size="sm">
                  Return to History List
                </Button>
              </Card>
            ) : (
              questions.map((item, index) => {
                const score = Number(item.technical_score || 0);
                const scoreBg = getScoreBackground(score);
                const scoreBorder = getScoreBorder(score);
                const scoreColor = getScoreColor(score);

                return (
                  <Card
                    key={item.id || index}
                    accentBorder={true}
                    accentColor={scoreColor}
                    style={{ marginBottom: 0 }}
                  >
                    {/* Header with Question Number and Score Pills */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: scoreBg,
                            color: scoreColor,
                            border: `1px solid ${scoreBorder}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {index + 1}
                        </span>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
                          Question {index + 1}
                        </h4>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {item.difficulty && (
                          <span
                            style={{
                              background:
                                item.difficulty === "hard"
                                  ? "#faf5ff"
                                  : item.difficulty === "easy"
                                  ? "#ecfdf5"
                                  : "#eff6ff",
                              color:
                                item.difficulty === "hard"
                                  ? "#7e22ce"
                                  : item.difficulty === "easy"
                                  ? "#059669"
                                  : "#2563eb",
                              border: `1px solid ${
                                item.difficulty === "hard"
                                  ? "#e9d5ff"
                                  : item.difficulty === "easy"
                                  ? "#a7f3d0"
                                  : "#bfdbfe"
                              }`,
                              padding: "4px 10px",
                              borderRadius: theme.radius.full,
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform: "capitalize",
                            }}
                          >
                            Difficulty: {item.difficulty}
                          </span>
                        )}
                        {item.topic && (
                          <span
                            style={{
                              background: theme.background,
                              color: theme.textSecondary,
                              border: `1px solid ${theme.border}`,
                              padding: "4px 10px",
                              borderRadius: theme.radius.full,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Topic: {item.topic}
                          </span>
                        )}
                        <span
                          style={{
                            background: scoreBg,
                            color: scoreColor,
                            border: `1px solid ${scoreBorder}`,
                            padding: "4px 10px",
                            borderRadius: theme.radius.full,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Technical: {item.technical_score ?? 0}/10
                        </span>

                        {item.communication_score !== undefined &&
                          item.communication_score !== null && (
                            <span
                              style={{
                                background: theme.background,
                                color: theme.textSecondary,
                                border: `1px solid ${theme.border}`,
                                padding: "4px 10px",
                                borderRadius: theme.radius.full,
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Communication: {item.communication_score}/10
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <p
                      style={{
                        marginBottom: 16,
                        fontWeight: 600,
                        color: theme.text,
                        fontSize: 14,
                        lineHeight: 1.6,
                        background: theme.background,
                        padding: "12px 14px",
                        borderRadius: theme.radius.sm,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      {item.question}
                    </p>

                    {/* Side-by-Side Answers Comparison */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                        gap: 14,
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: 12,
                            color: theme.muted,
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          Your Submitted Answer
                        </p>
                        <pre
                          style={{
                            ...preStyle,
                            background: scoreBg,
                            border: `1px solid ${scoreBorder}`,
                            color: theme.text,
                            minHeight: 80,
                          }}
                        >
                          {item.candidate_answer || item.answer || "No response submitted."}
                        </pre>
                      </div>

                      {(item.ideal_answer || item.correct_answer) && (
                        <div>
                          <p
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: theme.primary,
                              textTransform: "uppercase",
                              marginBottom: 6,
                            }}
                          >
                            Ideal Model Answer
                          </p>
                          <pre
                            style={{
                              ...preStyle,
                              background: theme.primaryLight,
                              border: `1px solid ${theme.primaryBorder}`,
                              color: theme.text,
                              minHeight: 80,
                            }}
                          >
                            {item.ideal_answer || item.correct_answer}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Strengths & Mistakes */}
                    {(item.strengths || item.mistakes) && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                          gap: 12,
                          marginBottom: item.improved_answer ? 14 : 0,
                        }}
                      >
                        {item.strengths && (
                          <div
                            style={{
                              background: theme.successLight,
                              padding: "10px 14px",
                              borderRadius: theme.radius.sm,
                              border: `1px solid ${theme.successBorder}`,
                            }}
                          >
                            <strong
                              style={{ fontSize: 12, color: theme.success, display: "block", marginBottom: 2 }}
                            >
                              ✓ Strong Aspects:
                            </strong>
                            <p style={{ margin: 0, fontSize: 13, color: theme.text }}>
                              {item.strengths}
                            </p>
                          </div>
                        )}

                        {item.mistakes && (
                          <div
                            style={{
                              background: theme.dangerLight,
                              padding: "10px 14px",
                              borderRadius: theme.radius.sm,
                              border: `1px solid ${theme.dangerBorder}`,
                            }}
                          >
                            <strong
                              style={{ fontSize: 12, color: theme.danger, display: "block", marginBottom: 2 }}
                            >
                              ✕ Potential Mistakes / Missing Points:
                            </strong>
                            <p style={{ margin: 0, fontSize: 13, color: theme.text }}>
                              {item.mistakes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Correct Concepts & Missing Concepts Badges */}
                    {((item.correct_concepts && item.correct_concepts.length > 0) ||
                      (item.missing_concepts && item.missing_concepts.length > 0)) && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12, marginTop: 12, marginBottom: 12 }}>
                        {item.correct_concepts && item.correct_concepts.length > 0 && (
                          <div style={{ background: theme.successLight, border: `1px solid ${theme.successBorder}`, borderRadius: theme.radius.sm, padding: "10px 14px" }}>
                            <strong style={{ fontSize: 11, color: theme.success, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                              ✓ Correct Concepts
                            </strong>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {(Array.isArray(item.correct_concepts) ? item.correct_concepts : [item.correct_concepts]).map((c, ci) => (
                                <span key={ci} style={{ background: "var(--card-bg)", color: theme.success, border: `1px solid ${theme.successBorder}`, padding: "2px 8px", borderRadius: theme.radius.full, fontSize: 11, fontWeight: 600 }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.missing_concepts && item.missing_concepts.length > 0 && (
                          <div style={{ background: theme.warningLight, border: `1px solid ${theme.warningBorder}`, borderRadius: theme.radius.sm, padding: "10px 14px" }}>
                            <strong style={{ fontSize: 11, color: theme.warning, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                              ⚠ Missing / Incomplete Concepts
                            </strong>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {(Array.isArray(item.missing_concepts) ? item.missing_concepts : [item.missing_concepts]).map((m, mi) => (
                                <span key={mi} style={{ background: "var(--card-bg)", color: theme.warning, border: `1px solid ${theme.warningBorder}`, padding: "2px 8px", borderRadius: theme.radius.full, fontSize: 11, fontWeight: 600 }}>
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actionable Improvement Suggestions */}
                    {item.improvement_suggestions && (Array.isArray(item.improvement_suggestions) ? item.improvement_suggestions.length > 0 : Boolean(item.improvement_suggestions)) && (
                      <div style={{ background: "var(--card-bg)", border: `1px solid ${theme.border}`, borderRadius: theme.radius.sm, padding: "10px 14px", marginTop: 10, marginBottom: 10 }}>
                        <strong style={{ fontSize: 11, color: theme.primary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                          💡 Improvement Suggestions
                        </strong>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: theme.text }}>
                          {(Array.isArray(item.improvement_suggestions) ? item.improvement_suggestions : [item.improvement_suggestions]).map((s, si) => (
                            <li key={si} style={{ marginBottom: 2 }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improved Answer */}
                    {item.improved_answer && (
                      <div style={{ marginTop: 10 }}>
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: 12,
                            color: theme.muted,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Refined Response Formulation
                        </p>
                        <pre style={{ ...preStyle, fontSize: 13 }}>{item.improved_answer}</pre>
                      </div>
                    )}

                    {/* Key Takeaways */}
                    {item.key_takeaways && (Array.isArray(item.key_takeaways) ? item.key_takeaways.length > 0 : Boolean(item.key_takeaways)) && (
                      <div style={{ background: theme.primaryLight, border: `1px solid ${theme.primaryBorder}`, borderRadius: theme.radius.sm, padding: "10px 14px", marginTop: 10 }}>
                        <strong style={{ fontSize: 11, color: theme.primary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                          🎯 Key Takeaways
                        </strong>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: theme.text }}>
                          {(Array.isArray(item.key_takeaways) ? item.key_takeaways : [item.key_takeaways]).map((kt, kti) => (
                            <li key={kti} style={{ marginBottom: 2 }}>{kt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Technical Answer Verification & Evidence Grounding */}
                    <AnswerVerificationSection
                      verification={item.verification_result}
                    />
                  </Card>
                );
              })
            )}

            {/* Bottom Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 10,
              }}
            >
              <Button variant="secondary" onClick={handleBackToList} icon={IconArrowLeft}>
                Back
              </Button>
              <div style={{ display: "flex", gap: 10 }}>
                {questions.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => handleDownloadPdf(interview, questions)}
                    loading={downloadingPdf}
                    disabled={downloadingPdf}
                    icon={IconDownload}
                  >
                    {downloadingPdf ? "Generating..." : "Download PDF"}
                  </Button>
                )}
                <Button onClick={() => navigate("/role")} icon={IconUpload}>
                  Start Interview
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </PageShell>
    );
  }

  // ---------------------------------------------------------------------------
  // LIST VIEW: All Previous Interviews
  // ---------------------------------------------------------------------------
  const totalInterviews = history.length;
  const avgOverallScore =
    totalInterviews > 0
      ? (
          history.reduce((sum, item) => sum + Number(item.avg_score || 0), 0) /
          totalInterviews
        ).toFixed(1)
      : 0;

  // Count completed (those that have a summary or recommendation set)
  const completedInterviews = history.filter(
    (item) => item.summary || item.recommendation
  ).length;

  return (
    <PageShell
      title="Interview History"
      subtitle="Past interview sessions and score trends."
      actions={
        <PageActions>
          <Button onClick={() => navigate("/role")} icon={IconUpload}>
            Start Interview
          </Button>
        </PageActions>
      }
    >
      {/* -------- LOADING STATE -------- */}
      {loadingList ? (
        <HistorySkeleton />
      ) : listError ? (
        /* -------- ERROR STATES -------- */
        <div style={{ display: "grid", gap: 16 }}>
          <Card
            style={{
              borderLeft: `4px solid ${
                listErrorType === "auth" ? theme.primary : theme.danger
              }`,
              padding: "28px 24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    listErrorType === "auth" ? theme.primaryLight : theme.dangerLight,
                  color: listErrorType === "auth" ? theme.primary : theme.danger,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconAlertTriangle size={24} />
              </div>

              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 17,
                    fontWeight: 700,
                    color: theme.text,
                  }}
                >
                  {listErrorType === "auth"
                    ? "Session Expired"
                    : listErrorType === "forbidden"
                    ? "Access Denied"
                    : "Failed to Load History"}
                </h3>
                <p
                  style={{
                    margin: "0 0 20px 0",
                    color: theme.muted,
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {listError}
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {listErrorType === "auth" ? (
                    <>
                      <Button onClick={handleLogoutAndLogin} icon={IconCheckCircle}>
                        Sign In Again
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => navigate("/dashboard")}
                      >
                        Go to Dashboard
                      </Button>
                    </>
                  ) : listErrorType === "forbidden" ? (
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/dashboard")}
                    >
                      Go to Dashboard
                    </Button>
                  ) : (
                    <>
                      <Button onClick={fetchHistoryList} size="sm">
                        Retry
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => navigate("/dashboard")}
                        size="sm"
                      >
                        Go to Dashboard
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : history.length === 0 ? (
        /* -------- EMPTY STATE -------- */
        <Card
          style={{
            padding: "48px 32px",
            textAlign: "center",
            background: "var(--gradient-card)",
            border: `1px solid ${theme.borderPurple}`,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: theme.primaryLight,
              color: theme.primary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              border: `1px solid ${theme.primaryBorder}`,
            }}
          >
            <IconHistory size={30} />
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: theme.text,
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}
          >
            No interview history available. Complete an interview to view your performance history.
          </h2>
          <p
            style={{
              color: theme.textSecondary,
              maxWidth: 480,
              margin: "0 auto 28px",
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            Start a mock interview to evaluate your technical and communication skills with AI. All completed sessions and question-by-question analysis will appear here.
          </p>
          <Button size="lg" pill onClick={() => navigate("/role")} icon={IconBriefcase}>
            Start Interview
          </Button>
        </Card>
      ) : (
        /* -------- SUCCESS STATE: History list -------- */
        <div style={{ display: "grid", gap: 16 }}>
          {/* Summary Stat Cards */}
          <div style={statRow} className="fade-in-up stagger-1">
            <StatCard
              label="Total Interviews"
              value={totalInterviews}
              accent="purple"
              icon={IconBriefcase}
              subtext="Completed mock sessions"
            />
            <StatCard
              label="Average Score"
              value={`${avgOverallScore}/10`}
              accent="purple"
              icon={IconAward}
              subtext="Across all interview rounds"
            />
            {completedInterviews > 0 && completedInterviews !== totalInterviews && (
              <StatCard
                label="With AI Review"
                value={completedInterviews}
                accent="purple"
                icon={IconCheckCircle}
                subtext="Sessions with full feedback"
              />
            )}
          </div>

          {/* List of Previous Interview Sessions */}
          <div style={{ display: "grid", gap: 14 }} className="fade-in-up stagger-2">
            {history.map((item) => {
              const score = Number(item.avg_score || 0);
              const scoreBg = getScoreBackground(score);
              const scoreBorder = getScoreBorder(score);
              const scoreColor = getScoreColor(score);
              const recBadge = item.recommendation
                ? getRecommendationBadge(item.recommendation)
                : null;

              return (
                <Card
                  key={item.id}
                  className="card-lift"
                  accentBorder={true}
                  accentColor={scoreColor}
                  style={{
                    marginBottom: 0,
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onClick={() => handleSelectInterview(item.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: item.summary ? 12 : 0,
                    }}
                  >
                    {/* Left: role + metadata badges + date */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: "1 1 340px" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: scoreBg,
                          color: scoreColor,
                          border: `1px solid ${scoreBorder}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <IconBriefcase size={20} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <h3
                            style={{
                              margin: 0,
                              color: theme.text,
                              fontSize: 16,
                              fontWeight: 700,
                            }}
                          >
                            {item.role || "General Technical Interview"}
                          </h3>

                          {/* Interview Type Badge */}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: (item.interview_type === "Adaptive" || item.interview_mode === "adaptive") ? "#faf5ff" : "#f0fdf4",
                              color: (item.interview_type === "Adaptive" || item.interview_mode === "adaptive") ? "#7e22ce" : "#166534",
                              border: `1px solid ${(item.interview_type === "Adaptive" || item.interview_mode === "adaptive") ? "#e9d5ff" : "#bbf7d0"}`,
                              padding: "2px 8px",
                              borderRadius: theme.radius.full,
                            }}
                          >
                            {item.interview_type || (item.interview_mode === "adaptive" ? "Adaptive" : "Standard")}
                          </span>

                          {/* Interview Mode Badge */}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: theme.background,
                              color: theme.textSecondary,
                              border: `1px solid ${theme.border}`,
                              padding: "2px 8px",
                              borderRadius: theme.radius.full,
                              textTransform: "capitalize",
                            }}
                          >
                            Mode: {item.interview_mode === "voice" ? "Voice" : item.interview_mode === "adaptive" ? "Adaptive" : "Text"}
                          </span>

                          {/* Interviewer Personality */}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: "rgba(99, 102, 241, 0.08)",
                              color: "#6366f1",
                              border: "1px solid rgba(99, 102, 241, 0.25)",
                              padding: "2px 8px",
                              borderRadius: theme.radius.full,
                            }}
                          >
                            {getPersonalityLabel(item.interviewer_personality)}
                          </span>

                          {/* Question Count Badge */}
                          {item.questions_count > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: theme.background,
                                color: theme.muted,
                                border: `1px solid ${theme.border}`,
                                padding: "2px 8px",
                                borderRadius: theme.radius.full,
                              }}
                            >
                              {item.questions_count} Questions
                            </span>
                          )}
                        </div>

                        <span style={{ fontSize: 12, color: theme.muted }}>
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Right: scores + actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {recBadge && (
                        <span
                          style={{
                            background: recBadge.bg,
                            color: recBadge.color,
                            border: `1px solid ${recBadge.border}`,
                            padding: "4px 10px",
                            borderRadius: theme.radius.full,
                            fontSize: 12,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <IconSparkles size={12} />
                          {recBadge.text}
                        </span>
                      )}

                      <span
                        title="Overall Score"
                        style={{
                          background: scoreBg,
                          color: scoreColor,
                          border: `1px solid ${scoreBorder}`,
                          padding: "5px 12px",
                          borderRadius: theme.radius.full,
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        Overall: {score.toFixed(1)} / 10
                      </span>

                      {item.technical_score != null && (
                        <span
                          title="Technical Score"
                          style={{
                            background: theme.background,
                            color: theme.textSecondary,
                            border: `1px solid ${theme.border}`,
                            padding: "5px 10px",
                            borderRadius: theme.radius.full,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Tech: {Number(item.technical_score).toFixed(1)}/10
                        </span>
                      )}

                      {item.communication_score != null && (
                        <span
                          title="Communication Score"
                          style={{
                            background: theme.background,
                            color: theme.muted,
                            border: `1px solid ${theme.border}`,
                            padding: "5px 10px",
                            borderRadius: theme.radius.full,
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <IconMessageSquare size={12} />
                          Comm: {Math.round(Number(item.communication_score))}
                        </span>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        icon={IconChevronRight}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectInterview(item.id);
                        }}
                      >
                        View Details
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        icon={IconTrash}
                        onClick={(e) => confirmDeleteInterview(e, item.id)}
                        style={{
                          background: "rgba(239, 68, 68, 0.12)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.35)",
                          padding: "6px 10px",
                        }}
                        title="Delete this interview"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* AI Summary snippet */}
                  {item.summary && (
                    <div
                      style={{
                        background: theme.background,
                        padding: "12px 14px",
                        borderRadius: theme.radius.sm,
                        border: `1px solid ${theme.border}`,
                        marginTop: 4,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          color: theme.muted,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        AI Performance Summary
                      </strong>
                      <p
                        style={{
                          margin: 0,
                          lineHeight: 1.5,
                          color: theme.text,
                          fontSize: 13,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.summary}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Interview Confirmation Modal */}
      {deleteTargetId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) {
              setDeleteTargetId(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              borderRadius: "1rem",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)",
              width: "100%",
              maxWidth: "480px",
              padding: "1.75rem",
              color: "var(--text-main)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconTrash size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>
                  Delete Interview History
                </h3>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Permanent Action
                </span>
              </div>
            </div>

            <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Are you sure you want to permanently delete this interview and its associated details?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Button
                variant="secondary"
                onClick={() => setDeleteTargetId(null)}
                disabled={deletingId}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={executeDeleteInterview}
                disabled={deletingId}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "1px solid #b91c1c",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <IconTrash size={15} />
                <span>{deletingId ? "Deleting..." : "Delete"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default History;
