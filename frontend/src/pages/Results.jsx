import { useContext, useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { InterviewContext } from "../context/InterviewContext";
import PageShell from "../components/PageShell";
import Card from "../components/Card";
import Button from "../components/Button";
import PageActions from "../components/PageActions";
import theme from "../styles/theme";
import { API_BASE_URL } from "../config/api";
import {
  IconResults,
  IconSparkles,
  IconDownload,
  IconCheckCircle,
  IconAlertTriangle,
  IconHistory,
  IconChevronDown,
  IconChevronRight,
  IconTrendingUp,
  IconTarget,
  IconBook,
  IconBriefcase,
} from "../components/Icons";

/**
 * Robust string converter helper to safeguard against rendering objects as React children
 * and calling string methods on non-string inputs from Groq/LLMs.
 */
const toSafeString = (val, fallback = "") => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    const joined = val.map((item) => toSafeString(item)).filter(Boolean).join(". ");
    return joined || fallback;
  }
  if (typeof val === "object") {
    if (val.summary || val.one_liner || val.message || val.text || val.feedback) {
      return toSafeString(val.summary || val.one_liner || val.message || val.text || val.feedback, fallback);
    }
    const joined = Object.values(val).map((item) => toSafeString(item)).filter(Boolean).join(". ");
    return joined || fallback;
  }
  return fallback;
};

/**
 * Safely parse list items from strings, arrays of strings, arrays of objects, or dictionaries
 */
const parsePointsList = (source) => {
  if (!source) return [];
  const list = [];
  if (typeof source === "string") {
    source
      .split(/\n|•|\*|-|;/)
      .map((s) => s.replace(/^[0-9]+[.)]\s*/, "").trim())
      .filter((s) => s.length > 5)
      .forEach((s) => list.push(s));
  } else if (Array.isArray(source)) {
    source.forEach((item) => {
      const str = toSafeString(
        item?.strength || item?.weakness || item?.point || item?.text || item
      ).trim();
      if (str.length > 5 && !list.includes(str)) list.push(str);
    });
  } else if (typeof source === "object") {
    Object.values(source).forEach((val) => {
      const str = toSafeString(val).trim();
      if (str.length > 5 && !list.includes(str)) list.push(str);
    });
  }
  return list;
};

/**
 * Safe score parser
 */
const safeScore = (val, fallback = 0) => {
  const n = Number(val);
  if (isNaN(n) || !isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
};

/**
 * Normalize each evaluation question item to ensure zero React rendering crashes
 */
const normalizeResultItem = (item, index) => {
  if (!item || typeof item !== "object") return null;
  const question = toSafeString(
    item.question || item.question_text || item.prompt || item.text,
    `Question ${index + 1}`
  ).trim();
  if (!question) return null;

  const rawScore = item.technical_score ?? item.score ?? item.rating ?? 0;
  const parsedScore = Number(rawScore);
  const technical_score = !isNaN(parsedScore) && isFinite(parsedScore)
    ? Math.min(10, Math.max(0, Math.round(parsedScore)))
    : 0;

  const rawCommScore = item.communication_score ?? item.comm_score;
  const parsedCommScore = rawCommScore !== undefined && rawCommScore !== null ? Number(rawCommScore) : null;
  const communication_score =
    parsedCommScore !== null && !isNaN(parsedCommScore) && isFinite(parsedCommScore)
      ? Math.min(10, Math.max(0, Math.round(parsedCommScore)))
      : null;

  const candidateAnswer = toSafeString(item.answer || item.candidate_answer, "No answer provided");
  const improvedAnswer = toSafeString(item.improved_answer || item.correct_answer || item.ideal_answer);
  const feedback = toSafeString(item.feedback || item.strengths || item.summary, "Answer evaluated against role standards.");

  return {
    ...item,
    question,
    answer: candidateAnswer,
    candidate_answer: candidateAnswer,
    technical_score,
    communication_score,
    feedback,
    improved_answer: improvedAnswer,
    correct_answer: improvedAnswer,
  };
};

/**
 * Resilient horizontal performance benchmark chart component
 * Renders flawlessly in React 19 without ResizeObserver or negative-width errors
 */
function PerformanceBreakdownChart({ data = [], theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
      {data.map((item, idx) => (
        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: theme.text }}>
              {item.name}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: item.color,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {item.score} / 100
              </span>
            </div>
          </div>
          {/* Horizontal Track Bar */}
          <div
            style={{
              width: "100%",
              height: 16,
              background: "var(--border-color, rgba(148, 163, 184, 0.15))",
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, item.score))}%`,
                height: "100%",
                background: item.color,
                borderRadius: 8,
                transition: "width 0.5s ease-out",
              }}
            />
          </div>
        </div>
      ))}

      {/* Benchmark Axis Scale */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          fontWeight: 600,
          color: theme.muted,
          marginTop: 2,
          paddingTop: 6,
          borderTop: "1px dashed var(--border-color, rgba(148, 163, 184, 0.2))",
        }}
      >
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const { results: contextResults = [] } = useContext(InterviewContext);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showReview, setShowReview] = useState(false); // Collapsed by default

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlInterviewId = searchParams.get("id");
  const stateInterviewId = location.state?.interviewId;
  const lastInterviewId = localStorage.getItem("last_interview_id");
  const targetInterviewId = urlInterviewId || stateInterviewId || lastInterviewId;

  const [dbResults, setDbResults] = useState(null);
  const [dbSummary, setDbSummary] = useState(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [dbError, setDbError] = useState(null);

  // Retrieve initial results from state, context, or localStorage
  let rawResults = location.state?.results || contextResults;
  if (!rawResults || rawResults.length === 0) {
    try {
      const stored = localStorage.getItem("results");
      if (stored) {
        rawResults = JSON.parse(stored);
      }
    } catch {
      rawResults = [];
    }
  }

  // Parse initial summary
  let rawSummary = location.state?.summary || {};
  if (!rawSummary || Object.keys(rawSummary).length === 0) {
    try {
      const storedSummary = localStorage.getItem("summary");
      if (storedSummary && storedSummary !== "undefined") {
        rawSummary = JSON.parse(storedSummary);
      }
    } catch {
      rawSummary = {};
    }
  }

  // If initial results empty but targetInterviewId exists, fetch from server
  useEffect(() => {
    const hasInitial = (Array.isArray(rawResults) && rawResults.length > 0) || (Array.isArray(dbResults) && dbResults.length > 0);
    if (!hasInitial && targetInterviewId) {
      let isMounted = true;
      setLoadingDb(true);
      setDbError(null);

      const fetchResults = async () => {
        try {
          const token = localStorage.getItem("token");
          const headers = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };

          let res = await fetch(`${API_BASE_URL}/interview_results/${targetInterviewId}`, { headers });
          if (!res.ok) {
            res = await fetch(`${API_BASE_URL}/api/interview_results/${targetInterviewId}`, { headers });
          }
          if (!res.ok) {
            res = await fetch(`${API_BASE_URL}/history/${targetInterviewId}`, { headers });
          }

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success && isMounted) {
            const fetchedResults = data.results || data.questions || data.details || [];
            const fetchedSummary = data.summary || data.interview || {};
            setDbResults(fetchedResults);
            setDbSummary(fetchedSummary);
            try {
              localStorage.setItem("results", JSON.stringify(fetchedResults));
              localStorage.setItem("summary", JSON.stringify(fetchedSummary));
              localStorage.setItem("last_interview_id", String(targetInterviewId));
            } catch (e) {
              console.warn("Could not cache results to localStorage:", e);
            }
          } else if (isMounted) {
            setDbError(data.message || data.error || "Could not retrieve saved interview results.");
          }
        } catch (err) {
          console.error("Failed to fetch interview results:", err);
          if (isMounted) {
            setDbError("Network issue loading saved results.");
          }
        } finally {
          if (isMounted) setLoadingDb(false);
        }
      };

      fetchResults();
      return () => {
        isMounted = false;
      };
    }
  }, [targetInterviewId]);

  // Combine active results and summary
  const effectiveRawResults = (Array.isArray(dbResults) && dbResults.length > 0) ? dbResults : rawResults;
  const summary = (dbSummary && Object.keys(dbSummary).length > 0) ? dbSummary : rawSummary;

  // Filter and normalize to valid completed-interview evaluation items
  const results = useMemo(() => {
    if (!Array.isArray(effectiveRawResults)) return [];
    return effectiveRawResults
      .map((item, index) => normalizeResultItem(item, index))
      .filter(Boolean);
  }, [effectiveRawResults]);

  // Calculate scores safely
  const totalTechnicalScore = results.reduce(
    (sum, item) => sum + Number(item.technical_score || 0),
    0
  );
  const averageTechnicalScore = results.length > 0 ? totalTechnicalScore / results.length : 0;
  const techScore100 = safeScore(averageTechnicalScore * 10);

  // Communication score (0–100)
  const commScoreRaw =
    summary?.communication_feedback?.overall_score ??
    summary?.communication_score ??
    (results.some((r) => r.communication_score !== null && r.communication_score !== undefined)
      ? Math.round(
          (results
            .filter((r) => r.communication_score !== null && r.communication_score !== undefined)
            .reduce((s, r) => s + Number(r.communication_score), 0) /
            results.filter((r) => r.communication_score !== null && r.communication_score !== undefined).length) * 10
        )
      : null);

  const commScore =
    commScoreRaw !== null && !isNaN(Number(commScoreRaw)) && isFinite(Number(commScoreRaw))
      ? safeScore(commScoreRaw)
      : safeScore(techScore100 * 0.92);

  // Overall Score (0–100)
  const rawOverall = summary?.overall_score ?? summary?.avg_score;
  const overallScore = safeScore(
    rawOverall !== undefined && rawOverall !== null && !isNaN(Number(rawOverall)) && isFinite(Number(rawOverall))
      ? Number(rawOverall) <= 10
        ? Number(rawOverall) * 10
        : Number(rawOverall)
      : techScore100 * 0.7 + commScore * 0.3
  );

  // Performance tier details
  const performance = useMemo(() => {
    const summaryText = toSafeString(summary?.one_liner || summary?.summary);

    if (overallScore >= 85) {
      return {
        label: "Excellent",
        color: "#10B981",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.35)",
        summary:
          summaryText ||
          "Outstanding technical depth and articulate explanations. Ready for top-tier placement interviews.",
      };
    }
    if (overallScore >= 70) {
      return {
        label: "Good",
        color: "#6366F1",
        bg: "rgba(99, 102, 241, 0.12)",
        border: "rgba(99, 102, 241, 0.35)",
        summary:
          summaryText ||
          "Solid technical competence and clear communication. Minor fine-tuning will maximize your offer potential.",
      };
    }
    if (overallScore >= 50) {
      return {
        label: "Average",
        color: "#F59E0B",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.35)",
        summary:
          summaryText ||
          "Core foundations demonstrated, but key technical concepts and answer structuring need reinforcement.",
      };
    }
    return {
      label: "Needs Improvement",
      color: "#EF4444",
      bg: "rgba(239, 68, 68, 0.12)",
      border: "rgba(239, 68, 68, 0.35)",
      summary:
        summaryText ||
        "Foundational knowledge gaps identified. Targeted practice and roadmap review recommended before interviewing.",
    };
  }, [overallScore, summary]);

  // SINGLE Performance Breakdown Chart Data (Technical, Communication, Overall)
  const performanceBreakdownData = useMemo(() => [
    { name: "Technical", score: techScore100, color: "var(--primary)" },
    { name: "Communication", score: commScore, color: "#936DF0" },
    { name: "Overall", score: overallScore, color: performance.color },
  ], [techScore100, commScore, overallScore, performance.color]);

  // Extract Top 3 Key Strengths (from real AI evaluation)
  const topStrengths = useMemo(() => {
    const list = parsePointsList(summary?.strengths);
    if (list.length < 3) {
      results.forEach((r) => {
        const s = toSafeString(r.strengths).trim();
        if (s.length > 6 && !list.includes(s)) {
          list.push(s);
        }
      });
    }
    return list.slice(0, 3);
  }, [summary, results]);

  // Extract Top 3 Areas to Improve (from real AI evaluation)
  const topImprovements = useMemo(() => {
    const list = parsePointsList(summary?.weaknesses || summary?.areas_for_improvement);
    if (list.length < 3) {
      results.forEach((r) => {
        if (Array.isArray(r.improvement_suggestions)) {
          r.improvement_suggestions.forEach((s) => {
            const str = toSafeString(s).trim();
            if (str.length > 6 && !list.includes(str)) list.push(str);
          });
        } else {
          const m = toSafeString(r.mistakes).trim();
          if (m.length > 6 && !list.includes(m)) list.push(m);
        }
      });
    }
    return list.slice(0, 3);
  }, [summary, results]);

  // Recommended Next Steps derived from actual evaluation results
  const recommendedNextSteps = useMemo(() => {
    const targetRoleSafe = toSafeString(summary?.role || localStorage.getItem("role"), "Software Engineer");
    const steps = [];

    // Derive from top improvement areas
    if (topImprovements.length > 0) {
      topImprovements.forEach((imp, i) => {
        const safeImp = toSafeString(imp);
        let topicName = "Technical Concepts";
        let reason = safeImp;
        let action = "Review foundational concepts and practice interview answers";

        const lower = safeImp.toLowerCase();
        if (lower.includes("sql") || lower.includes("query") || lower.includes("database")) {
          topicName = "SQL Optimization";
          action = "Practice query indexing, joins, and execution plan analysis";
        } else if (lower.includes("design") || lower.includes("architecture") || lower.includes("scalable")) {
          topicName = "System Design";
          action = "Practice high-level architecture, caching, and database partitioning";
        } else if (lower.includes("structure") || lower.includes("algorithm") || lower.includes("complexity")) {
          topicName = "Data Structures & Algorithms";
          action = "Solve core algorithmic problems and analyze time/space tradeoffs";
        } else if (lower.includes("react") || lower.includes("frontend") || lower.includes("hook")) {
          topicName = "Frontend Architecture & React";
          action = "Build component state management and custom hook workflows";
        } else if (lower.includes("communicat") || lower.includes("explain") || lower.includes("structure")) {
          topicName = "Interview Communication";
          action = "Structure answers using the STAR method (Situation, Task, Action, Result)";
        } else {
          topicName = `${targetRoleSafe} Core Competencies`;
          action = "Deepen topic mastery and practice timed speaking exercises";
        }

        if (!steps.some((s) => s.topic === topicName) && steps.length < 3) {
          steps.push({
            id: i + 1,
            topic: topicName,
            reason: reason.length > 90 ? `${reason.substring(0, 90)}...` : reason,
            action,
          });
        }
      });
    }

    // Default relevant next steps if evaluation was concise
    if (steps.length === 0) {
      steps.push(
        {
          id: 1,
          topic: "Core Role Fundamentals",
          reason: "Strengthen primary technical competencies required for placement",
          action: "Review high-frequency interview topics in your study planner",
        },
        {
          id: 2,
          topic: "Answer Structuring (STAR)",
          reason: "Improve conciseness and technical articulation under pressure",
          action: "Practice structured problem breakdowns before answering",
        }
      );
    }

    return steps;
  }, [topImprovements, summary]);

  // Interview Metadata Summary
  const interviewMode = toSafeString(
    summary?.interview_mode || localStorage.getItem("interview_mode"),
    "Standard Interview"
  );
  const targetRole = toSafeString(
    summary?.role || localStorage.getItem("role"),
    "Software Engineer"
  );
  const answeredCount = results.filter((r) => {
    const ans = toSafeString(r.answer || r.candidate_answer).trim();
    return ans.length > 0;
  }).length;

  // Download PDF Report
  const downloadReport = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch(`${API_BASE_URL}/download_report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, summary }),
      });

      if (!response.ok) {
        throw new Error("Failed to download PDF report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanRoleName = targetRole.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `Intervexa_Interview_Report_${cleanRoleName || "Placement"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF download error:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <PageShell
      title="Interview Results"
      subtitle="Concise summary and actionable performance breakdown."
      actions={
        <PageActions>
          {results.length > 0 && (
            <Button
              onClick={downloadReport}
              loading={downloadingPdf}
              disabled={downloadingPdf}
              icon={IconDownload}
            >
              {downloadingPdf ? "Generating..." : "Download PDF"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate("/learning")} icon={IconBook}>
            Study Planner
          </Button>
          <Button variant="ghost" onClick={() => navigate("/history")} icon={IconHistory}>
            History
          </Button>
        </PageActions>
      }
    >
      {loadingDb ? (
        <Card style={{ padding: "48px 24px", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <IconSparkles size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: "0 0 8px 0" }}>
            Loading Interview Evaluation...
          </h3>
          <p style={{ color: theme.muted, fontSize: 14, maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
            Retrieving all evaluated questions, scoring breakdown, and feedback.
          </p>
        </Card>
      ) : results.length === 0 ? (
        <Card style={{ padding: "48px 24px", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <IconResults size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: "0 0 8px 0" }}>
            No Completed Interview Found
          </h3>
          <p style={{ color: theme.muted, fontSize: 14, maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.5 }}>
            {dbError || "Complete an interview session to view your evaluation scores and performance breakdown."}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <Button onClick={() => navigate("/role")}>Start Interview</Button>
            <Button variant="secondary" onClick={() => navigate("/history")}>View History</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ═════════════════════════════════════════════════════════════════
              1. OVERALL INTERVIEW SCORE HERO BANNER
             ═════════════════════════════════════════════════════════════════ */}
          <div
            className="fade-in-up"
            style={{
              padding: "24px 28px",
              borderRadius: "14px",
              background: "var(--bg-surface)",
              border: `1.5px solid ${performance.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 20,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.muted }}>
                  Overall Performance Score
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    background: performance.bg,
                    color: performance.color,
                    border: `1px solid ${performance.border}`,
                  }}
                >
                  {performance.label}
                </span>
              </div>
              <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, color: theme.text, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span>{overallScore}</span>
                <span style={{ fontSize: "1.1rem", fontWeight: 500, color: theme.muted }}>/ 100</span>
              </h2>
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: theme.textSecondary, maxWidth: "600px", lineHeight: 1.5 }}>
                {performance.summary}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={() => navigate("/role")} variant="secondary" style={{ padding: "8px 18px", fontSize: "13px" }}>
                Retake Interview
              </Button>
              <Button onClick={() => navigate("/learning")} variant="primary" style={{ padding: "8px 18px", fontSize: "13px" }}>
                <IconSparkles size={15} />
                <span>Practice Skills</span>
              </Button>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              2. ONLY ONE VISUALIZATION: PERFORMANCE BREAKDOWN CHART
             ═════════════════════════════════════════════════════════════════ */}
          <div className="fade-in-up stagger-1">
            <Card
              title="Interview Performance Breakdown"
              subtitle="Technical, communication, and overall benchmark comparison"
              icon={IconTrendingUp}
              accent="purple"
              accentBorder={true}
              style={{ marginBottom: 0 }}
            >
              <PerformanceBreakdownChart data={performanceBreakdownData} theme={theme} />

              {/* Score Badges Underneath Chart */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border-color, rgba(148, 163, 184, 0.15))",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3B82F6" }} />
                  <span style={{ fontSize: "13px", color: theme.textSecondary }}>Technical:</span>
                  <strong style={{ fontSize: "13.5px", color: theme.text }}>{techScore100} / 100</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#8B5CF6" }} />
                  <span style={{ fontSize: "13px", color: theme.textSecondary }}>Communication:</span>
                  <strong style={{ fontSize: "13.5px", color: theme.text }}>{commScore} / 100</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: performance.color }} />
                  <span style={{ fontSize: "13px", color: theme.textSecondary }}>Overall:</span>
                  <strong style={{ fontSize: "13.5px", color: theme.text }}>{overallScore} / 100</strong>
                </div>
              </div>
            </Card>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              3. KEY STRENGTHS & AREAS TO IMPROVE (TWO-COLUMN LAYOUT)
             ═════════════════════════════════════════════════════════════════ */}
          <div
            className="fade-in-up stagger-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 16,
            }}
          >
            {/* Key Strengths */}
            <Card
              title="Key Strengths"
              subtitle="Top 3 demonstrated proficiencies"
              icon={IconCheckCircle}
              accent="green"
              accentBorder={true}
              style={{ marginBottom: 0 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topStrengths.length > 0 ? (
                  topStrengths.map((strength, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <span style={{ color: "#10B981", fontWeight: 700, fontSize: "14px", marginTop: "1px" }}>✓</span>
                      <span style={{ fontSize: "13px", color: theme.text, lineHeight: 1.5, fontWeight: 500 }}>
                        {strength}
                      </span>
                    </div>
                  ))
                ) : (
                  <p style={{ margin: 0, fontSize: "13px", color: theme.muted }}>
                    Solid overall effort across answered questions.
                  </p>
                )}
              </div>
            </Card>

            {/* Areas to Improve */}
            <Card
              title="Areas to Improve"
              subtitle="Top 3 high-impact focus areas"
              icon={IconAlertTriangle}
              accent="orange"
              accentBorder={true}
              style={{ marginBottom: 0 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topImprovements.length > 0 ? (
                  topImprovements.map((area, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <span style={{ color: "#F59E0B", fontWeight: 700, fontSize: "14px", marginTop: "1px" }}>•</span>
                      <span style={{ fontSize: "13px", color: theme.text, lineHeight: 1.5, fontWeight: 500 }}>
                        {area}
                      </span>
                    </div>
                  ))
                ) : (
                  <p style={{ margin: 0, fontSize: "13px", color: theme.muted }}>
                    No critical weaknesses identified. Continue practicing advanced problems.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              4. RECOMMENDED NEXT STEPS
             ═════════════════════════════════════════════════════════════════ */}
          <div className="fade-in-up stagger-3">
            <Card
              title="Recommended Next Steps"
              subtitle="Priority topics and action items to improve your placement readiness"
              icon={IconTarget}
              accent="cyan"
              accentBorder={true}
              style={{ marginBottom: 0 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
                {recommendedNextSteps.map((step) => (
                  <div
                    key={step.id}
                    style={{
                      padding: "16px 18px",
                      borderRadius: "12px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "var(--primary-light, rgba(118, 80, 216, 0.15))",
                            color: "var(--primary, #7650D8)",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {step.id}
                        </span>
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: theme.text }}>
                          {step.topic}
                        </h4>
                      </div>
                      <p style={{ margin: "0 0 6px 0", fontSize: "12.5px", color: theme.textSecondary, lineHeight: 1.45 }}>
                        <strong>Why:</strong> {step.reason}
                      </p>
                      <p style={{ margin: 0, fontSize: "12.5px", color: theme.text, lineHeight: 1.45 }}>
                        <strong>Action:</strong> {step.action}
                      </p>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => navigate("/learning")}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--primary, #7650D8)",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: 0,
                        }}
                      >
                        <span>Practice in Study Planner</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              5. COMPACT INTERVIEW SUMMARY
             ═════════════════════════════════════════════════════════════════ */}
          <div
            className="fade-in-up stagger-4"
            style={{
              padding: "16px 20px",
              borderRadius: "12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "var(--primary-light, rgba(118, 80, 216, 0.12))",
                  color: "var(--primary, #7650D8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconBriefcase size={18} />
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: theme.muted }}>
                  Interview Summary
                </span>
                <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text }}>
                  {targetRole} • {interviewMode}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: "13px", color: theme.textSecondary }}>
                Total Questions: <strong style={{ color: theme.text }}>{results.length}</strong>
              </div>
              <div style={{ fontSize: "13px", color: theme.textSecondary }}>
                Answered: <strong style={{ color: theme.text }}>{answeredCount} / {results.length}</strong>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#10B981",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                100% Evaluated
              </span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              6. REVIEW MY ANSWERS (COLLAPSIBLE ACCORDION)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="fade-in-up stagger-5">
            <div
              onClick={() => setShowReview((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowReview((prev) => !prev)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderRadius: "12px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.2s ease",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: 700, color: theme.text }}>
                  Review All Answers ({results.length} Questions)
                </h3>
                <span style={{ fontSize: "12.5px", color: theme.muted }}>
                  {showReview ? "Click to collapse" : "Click to view questions & answers"}
                </span>
              </div>
              <div style={{ color: theme.muted, display: "flex", alignItems: "center" }}>
                {showReview ? <IconChevronDown size={20} /> : <IconChevronRight size={20} />}
              </div>
            </div>

            {showReview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
                {results.map((item, index) => {
                  const score = Number(item.technical_score || 0);
                  const candidateAnswer = toSafeString(item.answer || item.candidate_answer, "No answer provided");
                  const improvedAnswer = toSafeString(item.improved_answer || item.correct_answer || item.ideal_answer);
                  const feedback = toSafeString(item.feedback || item.strengths || item.summary, "Answer evaluated against role standards.");

                  return (
                    <Card key={index} style={{ marginBottom: 0, padding: "18px 20px" }}>
                      {/* Question Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "var(--primary-light, rgba(118, 80, 216, 0.15))",
                              color: "var(--primary, #7650D8)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {index + 1}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: theme.muted, textTransform: "uppercase" }}>
                            Question {index + 1}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "2px 10px",
                            borderRadius: "9999px",
                            background: score >= 7 ? "rgba(16, 185, 129, 0.12)" : score >= 5 ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)",
                            color: score >= 7 ? "#10B981" : score >= 5 ? "#F59E0B" : "#EF4444",
                            border: `1px solid ${score >= 7 ? "rgba(16, 185, 129, 0.3)" : score >= 5 ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          }}
                        >
                          Score: {score} / 10
                        </span>
                      </div>

                      {/* Question Text */}
                      <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: theme.text, lineHeight: 1.5 }}>
                        {item.question}
                      </h4>

                      {/* Candidate Answer */}
                      <div style={{ marginBottom: 10, background: "var(--bg-secondary, rgba(255,255,255,0.02))", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: theme.muted, display: "block", marginBottom: 4 }}>
                          Your Answer:
                        </span>
                        <p style={{ margin: 0, fontSize: "13px", color: theme.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          {candidateAnswer}
                        </p>
                      </div>

                      {/* Short Feedback */}
                      {feedback && (
                        <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6366F1", display: "block", marginBottom: 2 }}>
                            Key Feedback:
                          </span>
                          <p style={{ margin: 0, fontSize: "12.5px", color: theme.text, lineHeight: 1.45 }}>
                            {feedback}
                          </p>
                        </div>
                      )}

                      {/* Improved Sample Answer */}
                      {improvedAnswer && (
                        <div style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#10B981", display: "block", marginBottom: 2 }}>
                            Recommended Answer Structure:
                          </span>
                          <p style={{ margin: 0, fontSize: "12.5px", color: theme.textSecondary, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                            {improvedAnswer}
                          </p>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default Results;
