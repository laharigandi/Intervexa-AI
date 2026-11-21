import { useState, useEffect, useCallback } from "react";
import Card from "./Card";
import Button from "./Button";
import theme from "../styles/theme";
import { API_BASE_URL } from "../config/api";
import {
  IconTarget,
  IconSparkles,
  IconTrendingUp,
  IconCheckCircle,
  IconAlertTriangle,
  IconHelpCircle,
  IconBriefcase,
  IconAward,
  IconArrowRight,
  IconChevronRight,
  IconZap,
} from "./Icons";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function ReadinessRadarSection({ onStartInterview, selectedRole }) {
  const [readiness, setReadiness] = useState(null);
  const [skillGaps, setSkillGaps] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [activeTab, setActiveTab] = useState("critical"); // 'critical' | 'missing' | 'improving' | 'strong'

  // Fetch optional JD match score from localStorage
  const jdMatchScore = (() => {
    try {
      const stored = localStorage.getItem("jdMatchResult");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.match_score ?? null;
      }
    } catch {}
    return null;
  })();

  const fetchReadinessData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const roleParam = selectedRole ? `?role=${encodeURIComponent(selectedRole)}` : "";
    const resumeParam = jdMatchScore !== null ? `&resume_match_score=${jdMatchScore}` : "";
    const queryStr = roleParam ? `${roleParam}${resumeParam}` : (resumeParam ? `?${resumeParam.slice(1)}` : "");

    try {
      const [ovRes, gapsRes, recRes, histRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/readiness/overview${queryStr}`, { headers }),
        fetch(`${API_BASE_URL}/api/readiness/skill-gaps${queryStr}`, { headers }),
        fetch(`${API_BASE_URL}/api/readiness/recommendations${queryStr}`, { headers }),
        fetch(`${API_BASE_URL}/api/readiness/history`, { headers }),
      ]);

      if (ovRes.ok) {
        const data = await ovRes.json();
        setReadiness(data.readiness || null);
      }
      if (gapsRes.ok) {
        const data = await gapsRes.json();
        setSkillGaps(data.skill_gaps || null);
      }
      if (recRes.ok) {
        const data = await recRes.json();
        setRecommendations(data.recommendations || []);
      }
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.warn("[Readiness Section fetch error]:", err);
      setFetchError("Unable to load latest readiness metrics. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  }, [selectedRole, jdMatchScore]);

  useEffect(() => {
    fetchReadinessData();
  }, [fetchReadinessData]);

  // Loading Skeleton State
  if (loading) {
    return (
      <Card style={{ marginBottom: 24, padding: "24px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div className="skeleton-box" style={{ height: 26, width: 260, borderRadius: theme.radius.sm }} />
          <div className="skeleton-box" style={{ height: 32, width: 120, borderRadius: theme.radius.full }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <div className="skeleton-box" style={{ height: 300, borderRadius: theme.radius.md }} />
          <div className="skeleton-box" style={{ height: 300, borderRadius: theme.radius.md }} />
        </div>
      </Card>
    );
  }

  // Error State
  if (fetchError) {
    return (
      <Card style={{ marginBottom: 24, border: `1px solid var(--warning-border, #F59E0B)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--warning, #F59E0B)" }}>
            <IconAlertTriangle size={20} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{fetchError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchReadinessData}>
            Retry Analysis
          </Button>
        </div>
      </Card>
    );
  }

  // Honest Empty State: candidate has 0 completed interviews
  if (!readiness || !readiness.has_sufficient_data) {
    return (
      <Card
        style={{
          marginBottom: 24,
          padding: "36px 24px",
          textAlign: "center",
          background: "var(--bg-surface)",
          border: `1px solid var(--border-color)`,
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "var(--primary-light)",
            color: "var(--primary)",
            border: "1px solid var(--primary-border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <IconTarget size={28} />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 8, letterSpacing: "-0.01em" }}>
          AI Interview Readiness Prediction & Skill Gap Radar
        </h3>
        <p
          style={{
            color: theme.textSecondary,
            maxWidth: 580,
            margin: "0 auto 24px",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Complete your first mock interview to calibrate your role-specific proficiency benchmarks, unlock the interactive Skill Gap Radar, and receive personalized preparation activity plans.
        </p>
        <Button
          variant="primary"
          pill
          size="md"
          icon={IconSparkles}
          onClick={() => (onStartInterview ? onStartInterview() : (window.location.href = "/role"))}
        >
          Start Your First Interview
        </Button>
      </Card>
    );
  }

  const {
    overall_score,
    readiness_category,
    category_color,
    category_description,
    previous_score,
    score_improvement,
    target_role,
    metrics_breakdown,
    weights_used,
    disclaimer,
  } = readiness;

  const radarData = skillGaps?.radar_data || [];
  const strongSkills = skillGaps?.strong_skills || [];
  const improvingSkills = skillGaps?.skills_requiring_improvement || [];
  const criticalGaps = skillGaps?.critical_gaps || [];
  const missingSkills = skillGaps?.missing_skills || [];

  // Custom Radar Tooltip
  const CustomRadarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            background: "var(--bg-surface)",
            border: `1px solid ${theme.border}`,
            padding: "10px 14px",
            borderRadius: theme.radius.sm,
            fontSize: 12,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            color: theme.text,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: theme.text }}>{data.skill}</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#10B981" }}>
            <span>Current:</span>
            <span style={{ fontWeight: 700 }}>{data.current}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--primary)" }}>
            <span>Target:</span>
            <span style={{ fontWeight: 700 }}>{data.target}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: data.gap > 0 ? "var(--warning, #F59E0B)" : "#10B981", marginTop: 4, borderTop: `1px solid ${theme.border}`, paddingTop: 4 }}>
            <span>Skill Gap:</span>
            <span style={{ fontWeight: 700 }}>{data.gap}%</span>
          </div>
          <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
            Status: {data.mastery_status} ({data.attempts} attempts)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "grid", gap: 22, marginBottom: 28 }} className="animate-fade-in">
      {/* ─── SECTION HEADER ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--primary-light)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
                padding: "3px 10px",
                borderRadius: theme.radius.full,
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              <IconTarget size={13} />
              Readiness Engine
            </span>
            <span style={{ fontSize: 12.5, color: theme.textSecondary, fontWeight: 500 }}>
              Benchmarked for <strong>{target_role}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: "clamp(20px, 2vw, 24px)", fontWeight: 800, color: theme.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>
            AI Interview Readiness & Skill Gap Radar
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setShowFormulaModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg-surface)",
            border: `1px solid ${theme.border}`,
            padding: "6px 14px",
            borderRadius: theme.radius.sm,
            fontSize: 12,
            fontWeight: 600,
            color: theme.textSecondary,
            cursor: "pointer",
            transition: "all 0.18s ease",
          }}
          title="Inspect Readiness Calculation Methodology"
        >
          <IconHelpCircle size={15} color="var(--primary)" />
          How is this calculated?
        </button>
      </div>

      {/* ─── ROW 1: OVERALL READINESS SCORE & SKILL GAP RADAR ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        {/* CARD A: OVERALL READINESS CARD */}
        <Card
          style={{
            background: "var(--gradient-card, linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%))",
            border: `1px solid var(--border-purple, rgba(113, 56, 245, 0.25))`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            marginBottom: 0,
            padding: "24px 22px",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Prediction Level
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: `${category_color}18`,
                  color: category_color,
                  border: `1px solid ${category_color}40`,
                  padding: "4px 12px",
                  borderRadius: theme.radius.full,
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: category_color }} />
                {readiness_category}
              </span>
            </div>

            {/* Large Score Display */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: "clamp(46px, 5vw, 56px)",
                  fontWeight: 900,
                  color: theme.text,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                {overall_score}
              </span>
              <span style={{ fontSize: 20, fontWeight: 700, color: theme.muted }}>/100</span>

              {previous_score !== null && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginLeft: "auto",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: score_improvement >= 0 ? "var(--success, #10B981)" : "var(--danger, #EF4444)",
                    background: score_improvement >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    padding: "4px 10px",
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${score_improvement >= 0 ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                  }}
                >
                  <IconTrendingUp size={14} />
                  {score_improvement >= 0 ? `+${score_improvement}` : score_improvement} pts
                </div>
              )}
            </div>

            {/* Progress Bar with Category Markings */}
            <div
              style={{
                width: "100%",
                height: 10,
                background: "rgba(148, 163, 184, 0.15)",
                borderRadius: theme.radius.full,
                overflow: "hidden",
                margin: "12px 0 16px",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${overall_score}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, #8054E8 0%, ${category_color || "#8054E8"} 100%)`,
                  borderRadius: theme.radius.full,
                  transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>

            <p style={{ margin: "0 0 18px", fontSize: 13, color: theme.textSecondary, lineHeight: 1.55 }}>
              {category_description}
            </p>

            {/* Component Breakdown Bars */}
            <div style={{ display: "grid", gap: 10 }}>
              {Object.entries(metrics_breakdown).map(([key, data]) => {
                if (!data || data.score === null) return null;
                return (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: theme.text, fontWeight: 600 }}>{data.label}</span>
                      <span style={{ color: theme.textSecondary, fontWeight: 700 }}>
                        {data.score}% <span style={{ fontSize: 10.5, color: theme.muted }}>({Math.round(data.weight * 100)}% wt)</span>
                      </span>
                    </div>
                    <div style={{ width: "100%", height: 5, background: "rgba(148, 163, 184, 0.12)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, data.score))}%`,
                          height: "100%",
                          background: data.score >= 75 ? "var(--success, #10B981)" : data.score >= 55 ? "var(--primary)" : "var(--warning, #F59E0B)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Educational Disclaimer */}
          <div
            style={{
              marginTop: 18,
              paddingTop: 12,
              borderTop: `1px solid ${theme.borderLight}`,
              fontSize: 11,
              color: theme.muted,
              lineHeight: 1.45,
            }}
          >
            {disclaimer}
          </div>
        </Card>

        {/* CARD B: SKILL GAP RADAR CHART */}
        <Card
          style={{
            background: "var(--gradient-card, linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%))",
            border: `1px solid ${theme.border}`,
            marginBottom: 0,
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text }}>
                  Skill Competency Radar
                </h3>
              </div>
              <span style={{ fontSize: 11.5, color: theme.muted }}>
                Current vs Target Benchmark
              </span>
            </div>

            {/* Radar Canvas */}
            <div style={{ width: "100%", height: 320, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                  <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "var(--text, #E2E8F0)", fontSize: 11, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    stroke="rgba(148, 163, 184, 0.2)"
                    tick={{ fill: "var(--muted, #94A3B8)", fontSize: 10 }}
                  />
                  <Radar
                    name="Target Proficiency"
                    dataKey="target"
                    stroke="#8054E8"
                    fill="#8054E8"
                    fillOpacity={0.12}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name="Current Proficiency"
                    dataKey="current"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.35}
                  />
                  <Tooltip content={<CustomRadarTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                    formatter={(val) => <span style={{ color: theme.text, fontWeight: 600 }}>{val}</span>}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              marginTop: 10,
              paddingTop: 12,
              borderTop: `1px solid ${theme.borderLight}`,
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ color: theme.muted }}>Evaluated: </span>
              <strong style={{ color: theme.text }}>{radarData.length} Skills</strong>
            </div>
            <div>
              <span style={{ color: theme.muted }}>Critical Gaps: </span>
              <strong style={{ color: criticalGaps.length > 0 ? "var(--danger, #EF4444)" : "var(--success, #10B981)" }}>
                {criticalGaps.length}
              </strong>
            </div>
            <div>
              <span style={{ color: theme.muted }}>Strong: </span>
              <strong style={{ color: "var(--success, #10B981)" }}>{strongSkills.length}</strong>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── ROW 2: SKILL GAP BREAKDOWN TABS ─── */}
      <Card style={{ marginBottom: 0, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
            Role Competency Breakdown
          </h3>
          {/* Tab Selector */}
          <div
            style={{
              display: "inline-flex",
              background: "var(--bg-secondary)",
              padding: 4,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.border}`,
              gap: 4,
            }}
          >
            {[
              { id: "critical", label: `Critical Gaps (${criticalGaps.length})` },
              { id: "missing", label: `Missing (${missingSkills.length})` },
              { id: "improving", label: `Developing (${improvingSkills.length})` },
              { id: "strong", label: `Strong (${strongSkills.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: theme.radius.sm - 2,
                  background: activeTab === tab.id ? "var(--primary)" : "transparent",
                  color: activeTab === tab.id ? "#FFFFFF" : theme.textSecondary,
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Cards */}
        {activeTab === "critical" && (
          criticalGaps.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: theme.textSecondary, fontSize: 13 }}>
              <IconCheckCircle size={28} color="var(--success, #10B981)" style={{ marginBottom: 8 }} />
              <div>No critical skill gaps identified. Keep reinforcing your active topics!</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {criticalGaps.map((g, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "14px 16px",
                    borderRadius: theme.radius.sm,
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>{g.skill}</h4>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger, #EF4444)", background: "rgba(239, 68, 68, 0.15)", padding: "2px 8px", borderRadius: theme.radius.full }}>
                      Gap: -{g.gap}%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
                    Current: <strong>{g.current}%</strong> (Target: {g.target}%)
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted }}>
                    Attempts: {g.attempts} • Status: {g.mastery_status}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "missing" && (
          missingSkills.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: theme.textSecondary, fontSize: 13 }}>
              <IconCheckCircle size={28} color="var(--success, #10B981)" style={{ marginBottom: 8 }} />
              <div>All core competencies for this role have been attempted in mock interviews.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {missingSkills.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "14px 16px",
                    borderRadius: theme.radius.sm,
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>{m.skill}</h4>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warning, #F59E0B)", background: "rgba(245, 158, 11, 0.15)", padding: "2px 8px", borderRadius: theme.radius.full }}>
                      Unattempted
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
                    Target Benchmark: <strong>{m.target}%</strong>
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted }}>
                    Required for {target_role}. Start a practice round to calibrate.
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "improving" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {improvingSkills.map((imp, idx) => (
              <div
                key={idx}
                style={{
                  padding: "14px 16px",
                  borderRadius: theme.radius.sm,
                  background: "rgba(113, 56, 245, 0.06)",
                  border: "1px solid rgba(113, 56, 245, 0.2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>{imp.skill}</h4>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", padding: "2px 8px", borderRadius: theme.radius.full }}>
                    {imp.current}%
                  </span>
                </div>
                <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>
                  Target: {imp.target}% (Remaining gap: {imp.gap}%)
                </div>
                <div style={{ fontSize: 11, color: theme.muted }}>
                  Attempts: {imp.attempts} • Trend: {imp.trend >= 0 ? `+${imp.trend}%` : `${imp.trend}%`}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "strong" && (
          strongSkills.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: theme.textSecondary, fontSize: 13 }}>
              <div>Continue practicing to elevate your competencies into the Strong category!</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {strongSkills.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "14px 16px",
                    borderRadius: theme.radius.sm,
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>{s.skill}</h4>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", background: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: theme.radius.full }}>
                      Mastered
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>
                    Proficiency: <strong>{s.current}%</strong> (Target: {s.target}%)
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted }}>
                    Verified across {s.attempts} session attempts
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </Card>

      {/* ─── ROW 3: PERSONALIZED PREPARATION RECOMMENDATIONS ─── */}
      {recommendations.length > 0 && (
        <Card style={{ marginBottom: 0, padding: "22px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--primary-light)",
                color: "var(--primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSparkles size={16} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
                Personalized Preparation Recommendations
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary }}>
                Actionable study items prioritized by highest skill gaps and historical interview errors
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  padding: "16px 18px",
                  borderRadius: theme.radius.md,
                  background: "var(--bg-surface)",
                  border: `1px solid ${theme.border}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: rec.priority_color,
                        background: `${rec.priority_color}18`,
                        padding: "2px 8px",
                        borderRadius: theme.radius.full,
                        border: `1px solid ${rec.priority_color}35`,
                      }}
                    >
                      {rec.priority} Priority
                    </span>
                    <span style={{ fontSize: 11.5, color: theme.muted }}>
                      Gap: {rec.skill_gap}%
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 14.5, fontWeight: 700, color: theme.text }}>
                    {rec.skill}
                  </h4>
                  <p style={{ margin: "0 0 8px 0", fontSize: 12.5, color: theme.textSecondary, lineHeight: 1.5 }}>
                    {rec.action_plan}
                  </p>
                  <div style={{ fontSize: 11.5, color: theme.muted, fontStyle: "italic", marginBottom: 12 }}>
                    Reason: {rec.reason}
                  </div>
                </div>

                <div style={{ paddingTop: 10, borderTop: `1px solid ${theme.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--primary)" }}>
                    {rec.suggested_track}
                  </span>
                  <button
                    type="button"
                    onClick={() => (onStartInterview ? onStartInterview() : (window.location.href = "/role"))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--primary)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    Practice <IconChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── ROW 4: HISTORICAL READINESS SCORE PROGRESSION ─── */}
      {history.length >= 2 && (
        <Card style={{ marginBottom: 0, padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text }}>
                Readiness Progression Over Time
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary }}>
                Calculated readiness score snapshots across completed mock interview rounds
              </p>
            </div>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="readinessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8054E8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8054E8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis
                  dataKey="created_at"
                  tick={{ fill: "var(--muted, #94A3B8)", fontSize: 10 }}
                  tickFormatter={(val) => val ? val.split(" ")[0].slice(5) : ""}
                />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--muted, #94A3B8)", fontSize: 10 }} />
                <Tooltip
                  formatter={(val) => [`${val}/100`, "Readiness Score"]}
                  labelFormatter={(lbl) => `Recorded: ${lbl}`}
                  contentStyle={{ background: "var(--bg-surface)", borderColor: theme.border, color: theme.text, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="overall_score" stroke="#8054E8" strokeWidth={2.5} fillOpacity={1} fill="url(#readinessGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ─── MODAL: METHODOLOGY & WEIGHTS BREAKDOWN ─── */}
      {showFormulaModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowFormulaModal(false)}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.lg,
              maxWidth: 580,
              width: "100%",
              padding: "28px 24px",
              color: theme.text,
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>
                Interview Readiness Scoring Engine
              </h3>
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                style={{ background: "transparent", border: "none", color: theme.muted, cursor: "pointer", fontSize: 18, fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
              The Interview Readiness Score provides a verified, normalized (0–100) prediction of your mock interview performance using a multi-factor weighted formula:
            </p>

            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Technical Knowledge", weight: "30%", desc: "Average conceptual accuracy across all completed technical questions." },
                { label: "Problem Solving Ability", weight: "20%", desc: "Performance on scenario, algorithmic, and architectural trade-off questions." },
                { label: "Role-Specific Skills", weight: "20%", desc: "Mastery across benchmark competencies for your selected job track." },
                { label: "Communication Skills", weight: "15%", desc: "Clarity, STAR structure, terminology precision, and conciseness." },
                { label: "Resume & Job Match", weight: "10%", desc: "ATS keyword alignment against target job descriptions (redistributed if unperformed)." },
                { label: "Performance Consistency", weight: "5%", desc: "Stability of scores over repeated attempts (penalizes wide variance)." },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(148, 163, 184, 0.06)", borderRadius: theme.radius.sm }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: theme.muted }}>{item.desc}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>{item.weight}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 14px", background: "var(--primary-light)", borderRadius: theme.radius.sm, border: "1px solid var(--primary-border)", fontSize: 12, color: theme.textSecondary, marginBottom: 20 }}>
              <strong>Missing Metric Handling:</strong> If an optional component (such as Resume & Job Match) has not yet been performed, its weight is proportionally redistributed among the active technical and communication metrics so your score is never penalized as zero.
            </div>

            <div style={{ textAlign: "right" }}>
              <Button size="sm" variant="primary" onClick={() => setShowFormulaModal(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

