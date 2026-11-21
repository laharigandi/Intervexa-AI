import { useEffect, useState, useContext, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AuthContext } from "../context/AuthContext";
import PageShell from "../components/PageShell";
import Card from "../components/Card";
import Button from "../components/Button";
import theme from "../styles/theme";
import { getScoreColor, getScoreBackground, getScoreBorder } from "../styles/shared";
import { classifyAtsScore, classifySkillScore } from "../utils/atsScoreClassification";
import { API_BASE_URL } from "../config/api";
import {
  IconBriefcase,
  IconAward,
  IconSparkles,
  IconTarget,
  IconInterview,
  IconLearning,
  IconHistory,
  IconChevronRight,
  IconArrowRight,
  IconAlertTriangle,
  IconZap,
  IconTrendingUp,
  IconCheckCircle,
  IconFileText,
  IconUpload,
  IconClock,
} from "../components/Icons";

// Custom Tooltip for the Interview Performance Trend Line Chart
function PerformanceTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const scoreVal = typeof data.score === "number" ? data.score.toFixed(1) : data.score;
    return (
      <div
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          border: "1px solid var(--border-color, #E5E7EB)",
          borderRadius: 10,
          padding: "9px 13px",
          boxShadow: "var(--shadow-elevated, 0 10px 25px -4px rgba(0, 0, 0, 0.15))",
          fontSize: 12,
          minWidth: 145,
          zIndex: 100,
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: 2 }}>
          {data.session || `Session ${data.index}`}
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: 11, marginBottom: 5 }}>
          {data.role || "Technical Role"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--primary, #8054E8)" }}>
          <span>Score:</span>
          <span>{data.score_pct}%</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
            ({scoreVal} / 10)
          </span>
        </div>
        {data.created_at && (
          <div style={{ color: "var(--text-secondary)", fontSize: 10.5, marginTop: 4, opacity: 0.85 }}>
            {new Date(data.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
      </div>
    );
  }
  return null;
}

function Dashboard() {
  const navigate = useNavigate();
  const { user: authUser, isAuthLoading, logout } = useContext(AuthContext);

  const [stats, setStats] = useState({
    total: 0,
    average: null,
    best: null,
    latest_score: 0,
    latest_interview: null,
    most_practiced_role: "Software Engineer",
    has_active_resume: false,
    active_resume: null,
    readiness_score: 0,
    technical_pct: 0,
    communication_pct: 0,
    avg_communication: null,
    score_trends: [],
    topic_breakdown: [],
    strong_skills: [],
    weak_skills: [],
    skill_improvements: [],
    skill_performance: null,
    target_role: "Full Stack Developer",
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Safe user resolution
  const user = useMemo(() => {
    if (authUser && typeof authUser === "object") return authUser;
    try {
      const raw = localStorage.getItem("user");
      if (!raw || raw === "undefined" || raw === "null") return { name: "Candidate" };
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : { name: "Candidate" };
    } catch {
      return { name: "Candidate" };
    }
  }, [authUser]);

  // Load real user dashboard statistics, recent sessions, and active study plan
  const loadDashboardData = useCallback(() => {
    if (isAuthLoading) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);

    const savedRole = localStorage.getItem("role") || "";
    const dashUrl = savedRole
      ? `${API_BASE_URL}/dashboard?role=${encodeURIComponent(savedRole)}`
      : `${API_BASE_URL}/dashboard`;

    Promise.all([
      fetch(dashUrl, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        if (r.status === 401) throw new Error("UNAUTHORIZED");
        if (!r.ok) throw new Error(`Dashboard request failed: ${r.status}`);
        return r.json();
      }),
      fetch(`${API_BASE_URL}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${API_BASE_URL}/study-planner/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([dashData, historyData, plannerData]) => {
        if (dashData && typeof dashData === "object") {
          setStats({
            total: Number(dashData.total) || 0,
            average:
              dashData.average !== null && dashData.average !== undefined
                ? Number(dashData.average)
                : null,
            best:
              dashData.best !== null && dashData.best !== undefined
                ? Number(dashData.best)
                : null,
            latest_score: Number(dashData.latest_score) || 0,
            latest_interview: dashData.latest_interview || null,
            most_practiced_role: dashData.most_practiced_role || "Software Engineer",
            target_role: dashData.target_role || dashData.most_practiced_role || "Full Stack Developer",
            has_active_resume: Boolean(dashData.has_active_resume),
            active_resume: dashData.active_resume || null,
            readiness_score: Number(dashData.readiness_score) || 0,
            technical_pct: Number(dashData.technical_pct) || 0,
            communication_pct: Number(dashData.communication_pct) || 0,
            avg_communication:
              dashData.avg_communication !== null && dashData.avg_communication !== undefined
                ? Number(dashData.avg_communication)
                : null,
            score_trends: Array.isArray(dashData.score_trends) ? dashData.score_trends : [],
            topic_breakdown: Array.isArray(dashData.topic_breakdown) ? dashData.topic_breakdown : [],
            strong_skills: Array.isArray(dashData.strong_skills) ? dashData.strong_skills : [],
            weak_skills: Array.isArray(dashData.weak_skills) ? dashData.weak_skills : [],
            skill_improvements: Array.isArray(dashData.skill_improvements) ? dashData.skill_improvements : [],
            skill_performance: dashData.skill_performance || null,
          });
        }
        if (Array.isArray(historyData)) {
          // Filter to completed evaluated interviews only and take latest 4
          const validHistory = historyData.filter(
            (s) => (s.status === "completed" || !s.status) && s.avg_score !== null && s.avg_score !== undefined
          );
          setRecentSessions(validHistory.slice(0, 4));
        }
        if (plannerData && plannerData.success && plannerData.data && plannerData.data.has_active_plan) {
          setStudyPlan(plannerData.data);
        } else {
          setStudyPlan(null);
        }
      })
      .catch((error) => {
        console.warn("[Dashboard fetch warning]:", error?.message || error);
        if (error?.message === "UNAUTHORIZED") {
          setFetchError("Your session has expired. Please sign in again.");
          if (logout) logout();
          navigate("/login", { replace: true });
        } else {
          setFetchError("Unable to load latest interview statistics. Please check your network connection.");
        }
      })
      .finally(() => setLoading(false));
  }, [isAuthLoading, logout, navigate]);

  useEffect(() => {
    if (!isAuthLoading) {
      loadDashboardData();
    }
  }, [loadDashboardData, isAuthLoading]);

  // Section 1: Preparation Status (Derived strictly from genuine user data)
  const preparationStatus = useMemo(() => {
    if (stats.total > 0 && stats.readiness_score > 0) {
      if (stats.readiness_score >= 80) {
        return {
          label: `Interview Ready • ${stats.readiness_score}%`,
          level: "Advanced",
          icon: IconCheckCircle,
          badgeColor: "var(--primary)",
        };
      }
      if (stats.readiness_score >= 60) {
        return {
          label: `Competitive Prep • ${stats.readiness_score}%`,
          level: "Intermediate",
          icon: IconTarget,
          badgeColor: "var(--primary)",
        };
      }
      return {
        label: `Foundational Stage • ${stats.readiness_score}%`,
        level: "Foundational",
        icon: IconZap,
        badgeColor: "var(--text-secondary)",
      };
    }
    if (stats.has_active_resume) {
      const atsClass = classifyAtsScore(stats.active_resume?.ats_score);
      return {
        label: atsClass.isValid ? `Resume Analyzed (${atsClass.percentageDisplay} • ${atsClass.category})` : "Resume Active",
        level: "Ready for Mock Round",
        icon: IconFileText,
        badgeColor: atsClass.isValid ? atsClass.color : "var(--primary)",
      };
    }
    return {
      label: "Initial Baseline Needed",
      level: "Getting Started",
      icon: IconSparkles,
      badgeColor: "var(--text-secondary)",
    };
  }, [stats]);

  // Section 5: Recommended Next Step (Prioritized strictly from genuine user data)
  const nextAction = useMemo(() => {
    // 1. No resume uploaded
    if (!stats.has_active_resume) {
      return {
        title: "Upload Your Resume",
        desc: "Upload your CV to calculate your ATS compatibility score and align keywords with top tech roles.",
        btnText: "Upload Resume",
        action: () => navigate("/resume"),
        icon: IconUpload,
        priority: "High Priority",
      };
    }
    // 2. Resume uploaded but ATS analysis not completed
    if (!stats.active_resume?.ats_score || stats.active_resume?.ats_score === 0) {
      return {
        title: "Analyze Your Resume",
        desc: "Your resume is uploaded. Run ATS analysis to verify keyword coverage and match target job descriptions.",
        btnText: "Analyze Resume",
        action: () => navigate("/resume"),
        icon: IconFileText,
        priority: "Recommended",
      };
    }
    // 3. Resume analyzed but no interview completed
    if (stats.total === 0) {
      return {
        title: "Start Your First Mock Interview",
        desc: "Establish your baseline technical score with an AI interviewer tailored to your target role.",
        btnText: "Start First Interview",
        action: () => navigate("/role"),
        icon: IconInterview,
        priority: "Essential Next Step",
      };
    }
    // 4. Low technical average
    if (stats.average !== null && stats.average < 6.0) {
      const avgPct = Math.round(stats.average * 10);
      return {
        title: "Practice Technical Questions",
        desc: `Your current technical average is ${avgPct}%. Practice targeted role questions to build core concept depth.`,
        btnText: "Practice Questions",
        action: () => navigate("/role"),
        icon: IconZap,
        priority: "Focus Area",
      };
    }
    // 5. Low communication feedback
    if (stats.avg_communication !== null && stats.avg_communication < 6.5) {
      const commPct = Math.round(stats.avg_communication * 10);
      return {
        title: "Improve Communication Skills",
        desc: `Your average communication score is ${commPct}%. Practice structuring answers with Definition → Mechanism → Trade-offs.`,
        btnText: "Practice Communication",
        action: () => navigate("/role"),
        icon: IconInterview,
        priority: "Focus Area",
      };
    }
    // 6. Active study plan in progress
    if (studyPlan && studyPlan.has_active_plan && (studyPlan.completion_rate_pct || 0) < 100) {
      return {
        title: "Continue Your Study Plan",
        desc: `You have completed ${studyPlan.completed_tasks || 0} of ${studyPlan.total_tasks || 0} topics in your ${studyPlan.target_role || "targeted"} roadmap. Stay on course today.`,
        btnText: "Continue Learning",
        action: () => navigate("/learning"),
        icon: IconLearning,
        priority: "Daily Curriculum",
      };
    }
    // 7. High performers ready for adaptive mock rounds
    if (stats.total >= 1 && (stats.average === null || stats.average >= 7.0)) {
      return {
        title: "Try an Adaptive Interview",
        desc: "Strong preparation progress. Challenge yourself with an AI round that dynamically increases question difficulty.",
        btnText: "Start Adaptive Interview",
        action: () => navigate("/role?mode=adaptive"),
        icon: IconSparkles,
        priority: "Advanced Challenge",
      };
    }
    // 8. General practice
    return {
      title: "Take a Practice Interview",
      desc: "Keep your interview readiness sharp with a standard mock interview session.",
      btnText: "Start Practice Interview",
      action: () => navigate("/role"),
      icon: IconInterview,
      priority: "Recommended",
    };
  }, [stats, studyPlan, navigate]);

  // Section 3: Normalized chart data from genuine evaluated interviews (chronological order)
  const trendChartData = useMemo(() => {
    if (!Array.isArray(stats.score_trends) || stats.score_trends.length === 0) {
      return [];
    }
    return stats.score_trends.map((item, idx) => ({
      id: item.id,
      index: idx + 1,
      session: item.session || `Session ${idx + 1}`,
      role: item.role || "Technical Role",
      score: Number(item.score || 0),
      score_pct:
        item.score_pct !== undefined
          ? Number(item.score_pct)
          : Math.min(100, Math.max(0, Math.round(Number(item.score || 0) * 10))),
      created_at: item.created_at,
    }));
  }, [stats.score_trends]);

  // Performance trajectory calculation
  const performanceTrajectory = useMemo(() => {
    if (trendChartData.length < 2) return null;
    const firstScore = trendChartData[0].score_pct;
    const latestScore = trendChartData[trendChartData.length - 1].score_pct;
    const delta = latestScore - firstScore;
    return {
      delta,
      text: delta > 0 ? `+${delta}% score improvement` : delta < 0 ? `${delta}% score change` : "Consistent score across sessions",
      improving: delta > 0,
    };
  }, [trendChartData]);

  // Section 4: Categorized skills (role-aligned, evaluated & non-evaluated states)
  const skillAnalysis = useMemo(() => {
    if (stats.skill_performance && Array.isArray(stats.skill_performance.skills)) {
      const sp = stats.skill_performance;
      const allSkills = sp.skills.map((item) => ({
        name: item.skill,
        scorePct: item.percentage !== null && item.percentage !== undefined ? item.percentage : item.score_pct,
        scoreDisplay: item.score_display,
        recommendation: item.recommendation || item.feedback,
        status: item.status, // "strong" | "needs_improvement" | "insufficient_data" | "not_evaluated"
        statusLabel: item.status_label,
        count: item.count || 0,
        isEvaluated: Boolean(item.is_evaluated),
        isStrong: Boolean(item.is_strong),
        needsImprovement: Boolean(item.needs_improvement),
        insufficientData: Boolean(item.insufficient_data),
        progressWidth: item.progress_width || 0,
      }));

      const strong = allSkills.filter((s) => s.isStrong && !s.insufficientData);
      const weak = allSkills.filter((s) => s.needsImprovement && !s.insufficientData);
      const insufficient = allSkills.filter((s) => s.insufficientData);
      const notEvaluated = allSkills.filter((s) => !s.isEvaluated);
      const evaluated = allSkills.filter((s) => s.isEvaluated);

      return {
        all: allSkills,
        strong,
        weak,
        insufficient,
        notEvaluated,
        evaluated,
        totalEvaluated: evaluated.length,
        hasEvaluations: Boolean(sp.has_evaluations),
        targetRole: sp.target_role || stats.target_role || stats.most_practiced_role || "Technical Role",
      };
    }

    // Fallback for legacy data or when skill_performance is not yet populated
    const list = [];
    if (Array.isArray(stats.skill_improvements) && stats.skill_improvements.length > 0) {
      stats.skill_improvements.forEach((item) => {
        list.push({
          name: item.skill,
          scorePct: item.percentage || Math.round((item.score || 0) * 10),
          scoreDisplay: item.score_display || `${item.score} / 10`,
          recommendation: item.recommendation,
          status: (item.score || 0) >= 7.0 ? "strong" : "needs_improvement",
          statusLabel: (item.score || 0) >= 7.0 ? "Strong Area" : "Needs Focus",
          isEvaluated: true,
          isStrong: (item.score || 0) >= 7.0,
          needsImprovement: (item.score || 0) < 7.0,
          insufficientData: false,
          progressWidth: item.percentage || Math.round((item.score || 0) * 10),
        });
      });
    }

    const strong = list.filter((s) => s.isStrong);
    const weak = list.filter((s) => s.needsImprovement);
    return {
      all: list,
      strong,
      weak,
      insufficient: [],
      notEvaluated: [],
      evaluated: list,
      totalEvaluated: list.length,
      hasEvaluations: list.length > 0,
      targetRole: stats.target_role || stats.most_practiced_role || "Technical Role",
    };
  }, [stats]);

  // Section 7: Extract missing/improvement skills from active resume
  const resumeMissingSkills = useMemo(() => {
    if (!stats.active_resume) return [];
    const jdMissing = stats.active_resume.jd_match?.missing_skills;
    if (Array.isArray(jdMissing) && jdMissing.length > 0) return jdMissing.slice(0, 4);

    const analysisMissing = stats.active_resume.analysis?.missing_skills;
    if (Array.isArray(analysisMissing) && analysisMissing.length > 0) return analysisMissing.slice(0, 4);
    if (typeof analysisMissing === "string" && analysisMissing.trim()) {
      return analysisMissing.split(/[,;•\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    }
    return [];
  }, [stats.active_resume]);

  return (
    <PageShell
      title={null}
      subtitle={null}
      containerStyle={{ maxWidth: "1140px", width: "100%", margin: "0 auto", paddingBottom: 32 }}
    >
      {/* Fetch Error Banner */}
      {fetchError && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            color: theme.text,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IconAlertTriangle size={17} color="#F59E0B" />
            <span>{fetchError}</span>
          </div>
          <Button variant="secondary" onClick={loadDashboardData} style={{ padding: "4px 10px", fontSize: "12px" }}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        /* Loading Skeleton matching the new multi-row dashboard layout */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="skeleton-box" style={{ height: 72, borderRadius: 14 }} />
          <div className="dashboard-stats-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-box" style={{ height: 104, borderRadius: 14 }} />
            ))}
          </div>
          <div className="dashboard-row2-grid">
            <div className="skeleton-box" style={{ height: 280, borderRadius: 14 }} />
            <div className="skeleton-box" style={{ height: 280, borderRadius: 14 }} />
          </div>
          <div className="dashboard-two-col-grid">
            <div className="skeleton-box" style={{ height: 260, borderRadius: 14 }} />
            <div className="skeleton-box" style={{ height: 260, borderRadius: 14 }} />
          </div>
          <div className="dashboard-two-col-grid">
            <div className="skeleton-box" style={{ height: 260, borderRadius: 14 }} />
            <div className="skeleton-box" style={{ height: 260, borderRadius: 14 }} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="animate-fade-in">
          {/* ═════════════════════════════════════════════════════════════════
              1. DASHBOARD HEADER (WELCOME & PREPARATION STATUS)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="dashboard-welcome-card">
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <h1 className="dashboard-welcome-title">
                  Welcome back, {user?.name || "Candidate"}! 👋
                </h1>
                {/* Current Preparation Status Pill */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "11.5px",
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: "6px",
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                  }}
                >
                  <preparationStatus.icon size={12} />
                  <span>{preparationStatus.label}</span>
                </span>
                {stats.most_practiced_role && (
                  <span className="dashboard-role-badge">
                    <IconBriefcase size={12} />
                    <span>Target: {stats.most_practiced_role}</span>
                  </span>
                )}
              </div>
              <p className="dashboard-welcome-subtitle">
                Track your interview preparation, improve your skills, and stay on course for your career goals.
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              <Button
                onClick={() => navigate("/role")}
                icon={IconInterview}
                size="sm"
                style={{ whiteSpace: "nowrap", padding: "8px 16px" }}
              >
                Start New Interview
              </Button>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              2. KEY PERFORMANCE METRICS (ROW 2: FOUR UNIFORM CARDS)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="dashboard-stats-grid">
            {/* Metric 1: Total Interviews Completed */}
            <div className="dashboard-stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard-stat-title">Total Completed</span>
                <div className="dashboard-stat-icon-wrap">
                  <IconBriefcase size={16} />
                </div>
              </div>
              <div className="dashboard-stat-value">
                {stats.total}
              </div>
              <div className="dashboard-stat-subtext">
                {stats.total === 0
                  ? "No interviews completed yet"
                  : stats.total === 1
                  ? "1 evaluated session"
                  : `${stats.total} evaluated sessions`}
              </div>
            </div>

            {/* Metric 2: Average Interview Score */}
            <div className="dashboard-stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard-stat-title">Average Score</span>
                <div className="dashboard-stat-icon-wrap">
                  <IconAward size={16} />
                </div>
              </div>
              <div className="dashboard-stat-value">
                {stats.total > 0 && stats.average !== null ? (
                  `${Math.round(stats.average * 10)}%`
                ) : (
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)" }}>
                    Not enough data yet
                  </span>
                )}
              </div>
              <div className="dashboard-stat-subtext">
                {stats.total > 0 && stats.average !== null ? (
                  stats.total >= 2 && performanceTrajectory ? (
                    <span>{performanceTrajectory.text}</span>
                  ) : (
                    <span>{stats.average.toFixed(1)} / 10 • All sessions</span>
                  )
                ) : (
                  "Complete an interview"
                )}
              </div>
            </div>

            {/* Metric 3: Best Interview Score */}
            <div className="dashboard-stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard-stat-title">Best Score</span>
                <div className="dashboard-stat-icon-wrap">
                  <IconSparkles size={16} />
                </div>
              </div>
              <div className="dashboard-stat-value">
                {stats.total > 0 && stats.best !== null ? (
                  `${Math.round(stats.best * 10)}%`
                ) : (
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)" }}>
                    Not enough data yet
                  </span>
                )}
              </div>
              <div className="dashboard-stat-subtext">
                {stats.total > 0 && stats.best !== null ? (
                  stats.total >= 2 && stats.average !== null ? (
                    `${Math.max(0, Math.round((stats.best - stats.average) * 10))}% above average`
                  ) : (
                    `${stats.best.toFixed(1)} / 10 personal peak`
                  )
                ) : (
                  "Personal peak score"
                )}
              </div>
            </div>

            {/* Metric 4: Overall Interview Readiness */}
            <div className="dashboard-stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard-stat-title">Overall Readiness</span>
                <div className="dashboard-stat-icon-wrap">
                  <IconTarget size={16} />
                </div>
              </div>
              <div className="dashboard-stat-value">
                {stats.total > 0 && stats.readiness_score > 0 ? (
                  `${stats.readiness_score}%`
                ) : (
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)" }}>
                    Not enough data yet
                  </span>
                )}
              </div>
              <div className="dashboard-stat-subtext">
                {stats.total > 0 && stats.readiness_score > 0
                  ? "60% Tech + 40% Comm"
                  : "Requires 1 mock session"}
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              ROW 3: FIRST ROW (TREND & RESUME / JOB READINESS SIDE-BY-SIDE)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="dashboard-two-col-grid">
{/* ─── 3. INTERVIEW PERFORMANCE TREND ─── */}
            <Card
              compact
              topAccent={true}
              title="Interview Performance Trend"
              subtitle="Score progression across evaluated sessions in chronological order"
              icon={IconTrendingUp}
              accent="purple"
              action={
                performanceTrajectory && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                      border: "1px solid var(--primary-border)",
                    }}
                  >
                    {performanceTrajectory.text}
                  </span>
                )
              }
              style={{ marginBottom: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              {trendChartData.length > 0 ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ width: "100%", height: 215 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ top: 8, right: 16, left: -22, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #E5E7EB)" vertical={false} opacity={0.6} />
                        <XAxis
                          dataKey="session"
                          stroke="var(--text-secondary, #68738A)"
                          tick={{ fontSize: 11, fill: "var(--text-secondary, #68738A)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border-color, #E5E7EB)" }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          ticks={[0, 25, 50, 75, 100]}
                          tickFormatter={(v) => `${v}%`}
                          stroke="var(--text-secondary, #68738A)"
                          tick={{ fontSize: 11, fill: "var(--text-secondary, #68738A)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border-color, #E5E7EB)" }}
                        />
                        <Tooltip content={<PerformanceTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="score_pct"
                          name="Evaluation Score"
                          stroke="var(--primary, #8054E8)"
                          strokeWidth={2.5}
                          dot={{ fill: "var(--primary, #8054E8)", r: 4, strokeWidth: 2, stroke: "var(--bg-surface, #FFFFFF)" }}
                          activeDot={{ r: 6, fill: "var(--primary, #8054E8)", stroke: "var(--bg-surface, #FFFFFF)", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {trendChartData.length === 1 && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "var(--primary-light)",
                        border: "1px solid var(--primary-border)",
                        fontSize: "11.5px",
                        color: "var(--primary)",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      1 interview evaluated ({trendChartData[0].score_pct}%). Complete more sessions to visualize your trajectory.
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: "36px 16px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--primary-border)",
                    }}
                  >
                    <IconZap size={22} />
                  </div>
                  <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "var(--text-main)" }}>
                    No interview evaluation data yet
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", maxWidth: 360, lineHeight: 1.45 }}>
                    Complete your first evaluated interview to track your performance trend and score progression over time.
                  </p>
                  <Button onClick={() => navigate("/role")} size="sm" icon={IconInterview} style={{ marginTop: 4 }}>
                    Start First Interview
                  </Button>
                </div>
              )}
            </Card>

{/* ─── 7. RESUME & JOB READINESS ─── */}
            <Card
              compact
              topAccent={true}
              title="Resume & Job Readiness"
              subtitle="ATS score, target role alignment, and missing skills"
              icon={IconFileText}
              accent="purple"
              style={{ marginBottom: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              {stats.has_active_resume && stats.active_resume ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                  {/* File information bar */}
                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "10px",
                      padding: "9px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <IconFileText size={16} color="var(--primary)" />
                      <span
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {stats.active_resume.filename || "Active Resume"}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "6px",
                        background: "var(--primary-light)",
                        color: "var(--primary)",
                        border: "1px solid var(--primary-border)",
                        flexShrink: 0,
                      }}
                    >
                      Active Resume
                    </span>
                  </div>

                  {/* 3 Mini-Metric Cells */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                    <div className="dashboard-mini-metric">
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>
                        ATS Score
                      </span>
                      {(() => {
                        const atsCls = classifyAtsScore(stats.active_resume?.ats_score);
                        if (!atsCls.isValid) {
                          return (
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-muted)" }}>
                              Pending
                            </span>
                          );
                        }
                        return (
                          <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "17px", fontWeight: 800, color: atsCls.color }}>
                              {atsCls.percentageDisplay}
                            </span>
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: 700,
                                color: atsCls.color,
                                background: atsCls.bg,
                                border: `1px solid ${atsCls.border}`,
                                padding: "1px 4px",
                                borderRadius: "4px",
                                lineHeight: 1.2,
                              }}
                            >
                              {atsCls.category}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="dashboard-mini-metric">
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>
                        Target Role
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {stats.active_resume.jd_match?.role || stats.most_practiced_role || "Software Eng."}
                      </span>
                    </div>

                    <div className="dashboard-mini-metric">
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>
                        JD Match
                      </span>
                      <span style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-main)" }}>
                        {stats.active_resume.jd_match?.match_score !== undefined
                          ? `${stats.active_resume.jd_match.match_score}%`
                          : "Not matched"}
                      </span>
                    </div>
                  </div>

                  {/* Missing or Improvement Skills */}
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--text-secondary)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Missing Skills to Add
                    </span>
                    {resumeMissingSkills.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {resumeMissingSkills.map((sk, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: "6px",
                              background: "var(--bg-secondary)",
                              border: "1px solid var(--border-color)",
                              color: "var(--text-main)",
                            }}
                          >
                            + {sk}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        All core role skills currently present in resume.
                      </span>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => navigate("/resume")}
                    size="sm"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "12.5px",
                      fontWeight: 600,
                      padding: "9px 16px",
                    }}
                  >
                    <span>Open Resume Analysis</span>
                    <IconArrowRight size={13} />
                  </Button>
                </div>
              ) : (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                    No active resume uploaded
                  </p>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-secondary)", maxWidth: 320, lineHeight: 1.45 }}>
                    Upload your CV to calculate your ATS score, check Job Description alignment, and receive keyword suggestions.
                  </p>
                  <Button onClick={() => navigate("/resume")} size="sm" icon={IconUpload} style={{ marginTop: 4 }}>
                    Upload & Analyze Resume
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              ROW 4: SECOND ROW (RECOMMENDED NEXT STEP - PROMINENT FULL-WIDTH)
             ═════════════════════════════════════════════════════════════════ */}
          <div style={{ width: "100%" }}>
            {/* ─── 5. RECOMMENDED NEXT STEP ─── */}
            <Card
              compact
              topAccent={true}
              title="Recommended Next Step"
              subtitle="Personalized action based on your actual progress"
              icon={nextAction.icon}
              accent="purple"
              badge={nextAction.priority}
              badgeType="primary"
              style={{ marginBottom: 0, width: "100%" }}
            >
              <div
                style={{
                  background: "var(--primary-light)",
                  border: "1px solid var(--primary-border)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginTop: 4,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--primary)",
                      }}
                    >
                      Why This Matters
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
                    {nextAction.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {nextAction.desc}
                  </p>
                </div>

                <div style={{ flexShrink: 0, minWidth: 160 }}>
                  <Button
                    onClick={nextAction.action}
                    size="sm"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 20px",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    <span>{nextAction.btnText}</span>
                    <IconArrowRight size={13} />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              ROW 5: THIRD ROW (YOUR SKILL PERFORMANCE - FULL-WIDTH BREAKDOWN)
             ═════════════════════════════════════════════════════════════════ */}
          <div style={{ width: "100%" }}>
{/* ─── 4. YOUR SKILL PERFORMANCE ─── */}
            <Card
              compact
              topAccent={true}
              title="Your Skill Performance"
              subtitle={`Evaluated skills for ${skillAnalysis.targetRole || "Target Role"}`}
              icon={IconAward}
              accent="purple"
              style={{ marginBottom: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              {skillAnalysis.hasEvaluations || skillAnalysis.totalEvaluated > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                  {/* Strongest Skills (>= 70%) */}
                  {skillAnalysis.strong.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--primary)",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>Strongest Areas</span>
                        <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.8 }}>• ≥ 70% proficiency</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 8 }}>
                        {skillAnalysis.strong.map((item, idx) => {
                          const cls = classifySkillScore(item.scorePct, true, item.count);
                          return (
                            <div key={idx} className="dashboard-skill-item">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)" }}>
                                  {item.name}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      color: cls.color,
                                      background: cls.bg,
                                      border: `1px solid ${cls.border}`,
                                      padding: "1px 6px",
                                      borderRadius: "9999px",
                                    }}
                                  >
                                    {cls.category}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      color: cls.color,
                                      background: cls.bg,
                                      border: `1px solid ${cls.border}`,
                                      padding: "1px 7px",
                                      borderRadius: "9999px",
                                    }}
                                  >
                                    {item.scorePct}%
                                  </span>
                                </div>
                              </div>
                              {/* Visual Progress Bar */}
                              <div
                                style={{
                                  width: "100%",
                                  height: 4,
                                  borderRadius: 2,
                                  background: "var(--border-color)",
                                  overflow: "hidden",
                                  margin: "1px 0 2px 0",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.max(0, Math.min(100, item.scorePct))}%`,
                                    height: "100%",
                                    background: cls.color,
                                    borderRadius: 2,
                                    transition: "width 0.4s ease",
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                {item.recommendation}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Areas Needing Improvement (< 70%) */}
                  {skillAnalysis.weak.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--text-secondary)",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>Needs Focus & Practice</span>
                        <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.8 }}>• &lt; 70% score</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 8 }}>
                        {skillAnalysis.weak.map((item, idx) => {
                          const cls = classifySkillScore(item.scorePct, true, item.count);
                          return (
                            <div key={idx} className="dashboard-skill-item">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)" }}>
                                  {item.name}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      color: cls.color,
                                      background: cls.bg,
                                      border: `1px solid ${cls.border}`,
                                      padding: "1px 6px",
                                      borderRadius: "9999px",
                                    }}
                                  >
                                    {cls.category}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      color: cls.color,
                                      background: cls.bg,
                                      border: `1px solid ${cls.border}`,
                                      padding: "1px 7px",
                                      borderRadius: "9999px",
                                    }}
                                  >
                                    {item.scorePct}%
                                  </span>
                                </div>
                              </div>
                              {/* Visual Progress Bar */}
                              <div
                                style={{
                                  width: "100%",
                                  height: 4,
                                  borderRadius: 2,
                                  background: "var(--border-color)",
                                  overflow: "hidden",
                                  margin: "1px 0 2px 0",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.max(0, Math.min(100, item.scorePct))}%`,
                                    height: "100%",
                                    background: cls.color,
                                    borderRadius: 2,
                                    transition: "width 0.4s ease",
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                {item.recommendation}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Insufficient Data Skills (1 Question) */}
                  {skillAnalysis.insufficient && skillAnalysis.insufficient.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--text-secondary)",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>Emerging Competencies</span>
                        <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.8 }}>• Single question evaluated</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 8 }}>
                        {skillAnalysis.insufficient.map((item, idx) => {
                          const cls = classifySkillScore(item.scorePct, true, 1);
                          return (
                            <div key={idx} className="dashboard-skill-item">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)" }}>
                                  {item.name}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      color: cls.color,
                                      background: cls.bg,
                                      border: `1px solid ${cls.border}`,
                                      padding: "1px 6px",
                                      borderRadius: "9999px",
                                    }}
                                  >
                                    {cls.category} (1 Q)
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      color: cls.color,
                                      background: cls.bg,
                                      border: `1px solid ${cls.border}`,
                                      padding: "1px 7px",
                                      borderRadius: "9999px",
                                    }}
                                  >
                                    {item.scorePct}%
                                  </span>
                                </div>
                              </div>
                              {/* Visual Progress Bar */}
                              <div
                                style={{
                                  width: "100%",
                                  height: 4,
                                  borderRadius: 2,
                                  background: "var(--border-color)",
                                  overflow: "hidden",
                                  margin: "1px 0 2px 0",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.max(0, Math.min(100, item.scorePct))}%`,
                                    height: "100%",
                                    background: cls.color,
                                    borderRadius: 2,
                                    transition: "width 0.4s ease",
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                {item.recommendation}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Not Evaluated Skills (0 Questions) */}
                  {skillAnalysis.notEvaluated && skillAnalysis.notEvaluated.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--text-secondary)",
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>Not Evaluated Yet</span>
                        <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.8 }}>• Practice role questions to evaluate</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 8 }}>
                        {skillAnalysis.notEvaluated.map((item, idx) => {
                          const cls = classifySkillScore(null, false, 0);
                          return (
                            <div key={idx} className="dashboard-skill-item" style={{ opacity: 0.88 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)" }}>
                                  {item.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "10.5px",
                                    fontWeight: 600,
                                    color: cls.color,
                                    background: cls.bg,
                                    border: `1px solid ${cls.border}`,
                                    padding: "1px 7px",
                                    borderRadius: "9999px",
                                  }}
                                >
                                  Not evaluated yet
                                </span>
                              </div>
                              {/* Visual Progress Bar - 0% neutral track */}
                              <div
                                style={{
                                  width: "100%",
                                  height: 4,
                                  borderRadius: 2,
                                  background: "var(--border-color)",
                                  overflow: "hidden",
                                  margin: "1px 0 2px 0",
                                }}
                              >
                                <div
                                  style={{
                                    width: "0%",
                                    height: "100%",
                                    background: cls.color,
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                {item.recommendation}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                    No skill evaluations recorded yet
                  </p>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-secondary)", maxWidth: 320, lineHeight: 1.45 }}>
                    Complete your first evaluated interview. The AI evaluates technical concepts and communication clarity across each response.
                  </p>
                  <Button onClick={() => navigate("/role")} size="sm" icon={IconInterview} style={{ marginTop: 4 }}>
                    Start Mock Interview
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              6 & 8. ROW 5: RECENT INTERVIEWS & LEARNING PROGRESS
             ═════════════════════════════════════════════════════════════════ */}
          <div className="dashboard-two-col-grid">
            {/* ─── 6. RECENT INTERVIEWS ─── */}
            <Card
              compact
              topAccent={true}
              title="Recent Interviews"
              subtitle="Latest completed interview sessions"
              icon={IconHistory}
              accent="purple"
              action={
                <button
                  type="button"
                  onClick={() => navigate("/history")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 4px",
                  }}
                >
                  <span>View All History</span>
                  <IconChevronRight size={13} />
                </button>
              }
              style={{ marginBottom: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              {recentSessions.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {recentSessions.map((session) => {
                    const score = Number(session.avg_score || 0);
                    const scorePct = Math.round(score * 10);
                    const color = getScoreColor(score);
                    const bg = getScoreBackground(score);
                    const border = getScoreBorder(score);
                    const isAdaptive = (session.interview_type || session.interview_mode || "").toLowerCase().includes("adaptive");
                    const qCount = session.questions_count || 10;

                    return (
                      <div
                        key={session.id}
                        onClick={() => navigate(`/history/${session.id}`)}
                        className="dashboard-list-item"
                        style={{
                          background: "var(--bg-surface)",
                          borderRadius: "10px",
                          border: "1px solid var(--border-color)",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "8px",
                              background: "var(--primary-light)",
                              color: "var(--primary)",
                              border: "1px solid var(--primary-border)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isAdaptive ? <IconZap size={15} /> : <IconInterview size={15} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  color: "var(--text-main)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {session.role || "Technical Role"}
                              </h4>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  background: "var(--primary-light)",
                                  color: "var(--primary)",
                                  border: "1px solid var(--primary-border)",
                                }}
                              >
                                {isAdaptive ? "Adaptive" : "Standard"}
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                              {session.created_at
                                ? new Date(session.created_at).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "Recent"}{" "}
                              • {qCount} {qCount === 1 ? "question" : "questions"}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 700,
                              color,
                              background: bg,
                              border: `1px solid ${border}`,
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {scorePct}%
                          </span>
                          <span
                            style={{
                              fontSize: "11.5px",
                              color: "var(--primary, #8054E8)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <span>Results</span>
                            <IconChevronRight size={12} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                  <p style={{ margin: "0 0 10px 0" }}>
                    You haven't completed an evaluated interview yet. Start your first session.
                  </p>
                  <Button onClick={() => navigate("/role")} size="sm" icon={IconInterview}>
                    Start First Interview
                  </Button>
                </div>
              )}
            </Card>

            {/* ─── 8. STUDY PLAN PROGRESS ─── */}
            <Card
              compact
              topAccent={true}
              title="Learning Progress"
              subtitle="Study planner roadmap and topic completion"
              icon={IconLearning}
              accent="purple"
              action={
                studyPlan && studyPlan.has_active_plan && (
                  <button
                    type="button"
                    onClick={() => navigate("/learning")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      padding: "2px 4px",
                    }}
                  >
                    <span>View Plan</span>
                    <IconChevronRight size={13} />
                  </button>
                )
              }
              style={{ marginBottom: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              {studyPlan && studyPlan.has_active_plan ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                        {studyPlan.plan_title || `${studyPlan.duration_days}-Day Targeted Plan`}
                      </span>
                      <span
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 700,
                          color: "var(--primary)",
                        }}
                      >
                        {Math.round(studyPlan.completion_rate_pct || 0)}% Complete
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: 6,
                        borderRadius: 3,
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, studyPlan.completion_rate_pct || 0))}%`,
                          height: "100%",
                          background: "var(--primary)",
                          borderRadius: 3,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)", marginTop: 5 }}>
                      <span>{studyPlan.completed_tasks || 0} completed</span>
                      <span>{Math.max(0, (studyPlan.total_tasks || 0) - (studyPlan.completed_tasks || 0))} remaining</span>
                    </div>
                  </div>

                  {/* Next Recommended Topic */}
                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>
                        Next Recommended Topic
                      </span>
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 1,
                        }}
                      >
                        {studyPlan.today_tasks?.[0]?.topic ||
                          studyPlan.tasks?.find((t) => t.status === "pending")?.topic ||
                          "Core Technical Concepts"}
                      </div>
                    </div>
                    {studyPlan.streak_days > 0 && (
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                          border: "1px solid var(--primary-border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {studyPlan.streak_days}d streak 🔥
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={() => navigate("/learning")}
                    size="sm"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "12px",
                    }}
                  >
                    <span>Continue Study Plan</span>
                    <IconArrowRight size={12} />
                  </Button>
                </div>
              ) : (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                    No active study plan
                  </p>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-secondary)", maxWidth: 320, lineHeight: 1.45 }}>
                    Generate an AI-curated curriculum tailored to your target role and skill gaps with structured daily exercises.
                  </p>
                  <Button onClick={() => navigate("/learning")} size="sm" icon={IconLearning} style={{ marginTop: 4 }}>
                    Create Study Plan
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              9. QUICK ACTIONS (COMPACT BOTTOM BAR)
             ═════════════════════════════════════════════════════════════════ */}
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-secondary)",
                marginBottom: 10,
              }}
            >
              Quick Actions
            </div>
            <div className="dashboard-quick-actions-bar">
              {/* Action 1: Standard Mock */}
              <div
                className="dashboard-quick-action-item"
                onClick={() => navigate("/role")}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconInterview size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                    Standard Mock
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    10-question round
                  </div>
                </div>
              </div>

              {/* Action 2: Adaptive Mock */}
              <div
                className="dashboard-quick-action-item"
                onClick={() => navigate("/role?mode=adaptive")}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconSparkles size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                    Adaptive Mock
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    Dynamic difficulty
                  </div>
                </div>
              </div>

              {/* Action 3: Resume Analysis */}
              <div
                className="dashboard-quick-action-item"
                onClick={() => navigate("/resume")}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconFileText size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                    Analyze Resume
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    ATS & JD matching
                  </div>
                </div>
              </div>

              {/* Action 4: Study Plan */}
              <div
                className="dashboard-quick-action-item"
                onClick={() => navigate("/learning")}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconLearning size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                    Study Planner
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    Daily curriculum
                  </div>
                </div>
              </div>

              {/* Action 5: Interview History */}
              <div
                className="dashboard-quick-action-item"
                onClick={() => navigate("/history")}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconHistory size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                    History
                  </div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    Past evaluations
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default Dashboard;
