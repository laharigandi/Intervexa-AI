import { useState, useEffect, useCallback } from "react";
import Card from "./Card";
import Button from "./Button";
import theme from "../styles/theme";
import { API_BASE_URL } from "../config/api";
import {
  IconSparkles,
  IconTarget,
  IconTrendingUp,
  IconCheckCircle,
  IconAlertTriangle,
  IconRefresh,
  IconAward,
  IconBriefcase,
  IconZap,
} from "./Icons";

export default function InterviewMemorySection({ onStartInterview }) {
  const [overview, setOverview] = useState(null);
  const [weakAreas, setWeakAreas] = useState([]);
  const [strongAreas, setStrongAreas] = useState([]);
  const [improvements, setImprovements] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  const fetchMemoryData = useCallback(async () => {
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

    try {
      const [ovRes, weakRes, strongRes, progRes, recRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/interview-memory/overview`, { headers }),
        fetch(`${API_BASE_URL}/api/interview-memory/weak-areas?limit=6`, { headers }),
        fetch(`${API_BASE_URL}/api/interview-memory/strong-areas?limit=6`, { headers }),
        fetch(`${API_BASE_URL}/api/interview-memory/progress`, { headers }),
        fetch(`${API_BASE_URL}/api/interview-memory/recommendations`, { headers }),
      ]);

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        setOverview(ovData.overview || null);
      }
      if (weakRes.ok) {
        const weakData = await weakRes.json();
        setWeakAreas(weakData.weak_areas || []);
      }
      if (strongRes.ok) {
        const strongData = await strongRes.json();
        setStrongAreas(strongData.strong_areas || []);
      }
      if (progRes.ok) {
        const progData = await progRes.json();
        setImprovements(progData.improvements || []);
      }
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData.recommendations || null);
      }
    } catch (err) {
      console.warn("[InterviewMemorySection fetch error]:", err);
      setFetchError("Unable to load interview memory. AI memory is running in local mode.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemoryData();
  }, [fetchMemoryData]);

  const handleResetMemory = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setResetting(true);
      const res = await fetch(`${API_BASE_URL}/api/interview-memory/reset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetMessage("AI interview memory has been reset successfully.");
        setShowResetModal(false);
        fetchMemoryData();
      } else {
        alert(data.message || "Failed to reset interview memory.");
      }
    } catch (err) {
      console.error("Reset error:", err);
      alert("Network error while resetting memory.");
    } finally {
      setResetting(false);
    }
  };

  const hasMemory = Boolean(overview && overview.has_memory && overview.total_interviews > 0);

  if (loading) {
    return (
      <Card style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: theme.primary }}>
          <div className="custom-spinner" style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Loading AI Interview Memory Engine...</span>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }} className="animate-fade-in">
      {/* SECTION HEADER & CONTROL BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "4px 2px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: theme.primaryLight,
              border: `1px solid ${theme.primaryBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.primary,
            }}
          >
            <IconSparkles size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: theme.text, margin: 0, letterSpacing: "-0.01em" }}>
              AI Interview Memory
            </h2>
            <span style={{ fontSize: 12, color: theme.textSecondary }}>
              Intelligent performance recall, weak area calibration & personalized follow-up engine
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: theme.radius.full,
              background: hasMemory ? theme.successLight : "var(--bg-secondary)",
              color: hasMemory ? theme.success : theme.muted,
              border: `1px solid ${hasMemory ? theme.successBorder : theme.border}`,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: hasMemory ? theme.success : theme.muted,
              }}
            />
            {hasMemory ? "Active Engine" : "Ready to Learn"}
          </span>

          {hasMemory && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              style={{
                background: "transparent",
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.sm,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 600,
                color: theme.muted,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme.danger;
                e.currentTarget.style.borderColor = theme.dangerBorder;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme.muted;
                e.currentTarget.style.borderColor = theme.border;
              }}
            >
              Reset Memory
            </button>
          )}
        </div>
      </div>

      {resetMessage && (
        <div
          style={{
            background: theme.successLight,
            border: `1px solid ${theme.successBorder}`,
            borderRadius: theme.radius.sm,
            padding: "10px 14px",
            fontSize: 12.5,
            color: theme.success,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{resetMessage}</span>
          <button
            type="button"
            onClick={() => setResetMessage(null)}
            style={{ background: "transparent", border: "none", color: theme.success, cursor: "pointer", fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* EMPTY STATE IF NO COMPLETED INTERVIEW */}
      {!hasMemory ? (
        <Card
          style={{
            padding: "36px 28px",
            textAlign: "center",
            background: "var(--gradient-card)",
            border: `1px solid ${theme.borderPurple}`,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: theme.primaryLight,
              border: `1px solid ${theme.primaryBorder}`,
              color: theme.primary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <IconSparkles size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
            AI Interview Memory Not Activated Yet
          </h3>
          <p
            style={{
              color: theme.textSecondary,
              maxWidth: 540,
              margin: "0 auto 20px",
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            Intervexa AI remembers your past answers, identifies weak concepts, and generates personalized follow-ups. Complete your first mock interview to activate AI memory tracking.
          </p>
          {onStartInterview && (
            <Button size="md" pill onClick={onStartInterview} icon={IconZap}>
              Start Mock Interview
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* CARD A: MEMORY OVERVIEW (4-column stat bar) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            {/* Total Interviews */}
            <div
              style={{
                background: "var(--card-bg)",
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: "16px 18px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Completed Sessions
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginTop: 4 }}>
                {overview.total_interviews}
              </div>
              <span style={{ fontSize: 11, color: theme.muted, marginTop: 4, display: "block" }}>
                Analyzed for memory patterns
              </span>
            </div>

            {/* Topics Remembered */}
            <div
              style={{
                background: "var(--card-bg)",
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: "16px 18px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Topics Tracked
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, color: theme.primary, marginTop: 4 }}>
                {overview.topics_remembered}
              </div>
              <span style={{ fontSize: 11, color: theme.muted, marginTop: 4, display: "block" }}>
                Active skill nodes in database
              </span>
            </div>

            {/* Strong Topics */}
            <div
              style={{
                background: "var(--card-bg)",
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: "16px 18px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.success, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Strong Areas
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, color: theme.success, marginTop: 4 }}>
                {overview.strong_topics_count}
              </div>
              <span style={{ fontSize: 11, color: theme.muted, marginTop: 4, display: "block" }}>
                Score ≥ 75% in recent sessions
              </span>
            </div>

            {/* Weak Areas Requiring Improvement */}
            <div
              style={{
                background: "var(--card-bg)",
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: "16px 18px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.warning, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Focus Needed
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, color: theme.warning, marginTop: 4 }}>
                {overview.weak_topics_count}
              </div>
              <span style={{ fontSize: 11, color: theme.muted, marginTop: 4, display: "block" }}>
                Prioritized for 50% follow-up weight
              </span>
            </div>
          </div>

          {/* TWO-COLUMN GRID: WEAK AREAS vs STRONG AREAS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {/* CARD B: YOUR WEAK AREAS */}
            <Card
              title="Identified Weak Areas"
              subtitle="Topics where AI detected concept gaps or scores below 60%."
              icon={IconAlertTriangle}
            >
              {weakAreas.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {weakAreas.map((w, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--bg-secondary)",
                        border: `1px solid ${theme.border}`,
                        borderRadius: theme.radius.sm,
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ fontSize: 13, color: theme.text }}>{w.topic}</strong>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: theme.radius.full,
                            background: theme.dangerLight,
                            color: theme.danger,
                            border: `1px solid ${theme.dangerBorder}`,
                          }}
                        >
                          {w.latest_score}%
                        </span>
                      </div>
                      {w.recent_mistake ? (
                        <p style={{ fontSize: 11.5, color: theme.muted, margin: 0, lineHeight: 1.4 }}>
                          <span style={{ color: theme.warning, fontWeight: 600 }}>Identified Gap: </span>
                          {w.recent_mistake}
                        </p>
                      ) : (
                        <span style={{ fontSize: 11, color: theme.muted }}>
                          {w.attempt_count} attempt{w.attempt_count > 1 ? "s" : ""} recorded
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "24px 0", textAlign: "center", color: theme.muted, fontSize: 13 }}>
                  No critical weak areas detected. All practiced topics currently meet the target threshold.
                </div>
              )}
            </Card>

            {/* CARD C: YOUR STRONG AREAS */}
            <Card
              title="Demonstrated Strengths"
              subtitle="Consistently high-performing topics (score ≥ 75%)."
              icon={IconAward}
            >
              {strongAreas.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {strongAreas.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: theme.successLight,
                        border: `1px solid ${theme.successBorder}`,
                        borderRadius: theme.radius.sm,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: theme.text, display: "block" }}>{s.topic}</strong>
                        <span style={{ fontSize: 11, color: theme.success, fontWeight: 600 }}>
                          Status: {s.mastery_status} ({s.attempt_count} practice{s.attempt_count > 1 ? "s" : ""})
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: theme.success,
                          background: "var(--card-bg)",
                          border: `1px solid ${theme.successBorder}`,
                          padding: "2px 8px",
                          borderRadius: theme.radius.full,
                        }}
                      >
                        {s.latest_score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "24px 0", textAlign: "center", color: theme.muted, fontSize: 13 }}>
                  Keep practicing to establish demonstrated mastery across role competencies.
                </div>
              )}
            </Card>
          </div>

          {/* CARD D: RECENT IMPROVEMENTS */}
          {improvements.length > 0 && (
            <Card
              title="Recent Improvements"
              subtitle="Score trajectory across multiple interview attempts."
              icon={IconTrendingUp}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {improvements.map((imp, idx) => {
                  const isPositive = imp.improvement_trend > 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: "var(--bg-secondary)",
                        border: `1px solid ${theme.border}`,
                        borderRadius: theme.radius.sm,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: theme.text, display: "block" }}>{imp.topic}</strong>
                        <span style={{ fontSize: 11, color: theme.muted }}>
                          {imp.previous_score}% → <span style={{ color: theme.text, fontWeight: 700 }}>{imp.latest_score}%</span>
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: theme.radius.full,
                          background: isPositive ? theme.successLight : "var(--bg-surface)",
                          color: isPositive ? theme.success : theme.muted,
                          border: `1px solid ${isPositive ? theme.successBorder : theme.border}`,
                        }}
                      >
                        {isPositive ? `+${imp.improvement_trend}%` : `${imp.improvement_trend}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* CARD E: NEXT INTERVIEW RECOMMENDATIONS & DISTRIBUTION */}
          {recommendations && recommendations.recommended_topics?.length > 0 && (
            <Card
              title="Next Interview Recommendations"
              subtitle="Personalized focus distribution calibrated for your upcoming session."
              icon={IconTarget}
            >
              {/* Distribution Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: "rgba(220, 38, 38, 0.12)",
                    color: theme.danger,
                    border: `1px solid ${theme.dangerBorder}`,
                    padding: "4px 10px",
                    borderRadius: theme.radius.full,
                  }}
                >
                  50% Focus: Previous Weak Topics
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: theme.primaryLight,
                    color: theme.primary,
                    border: `1px solid ${theme.primaryBorder}`,
                    padding: "4px 10px",
                    borderRadius: theme.radius.full,
                  }}
                >
                  30% Focus: Target Role Core
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: theme.accentLight,
                    color: theme.accent,
                    border: `1px solid ${theme.accentBorder}`,
                    padding: "4px 10px",
                    borderRadius: theme.radius.full,
                  }}
                >
                  20% Focus: Advanced / Stretch Concepts
                </span>
              </div>

              {/* Recommended Topic Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {recommendations.recommended_topics.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--bg-secondary)",
                      border: `1px solid ${theme.border}`,
                      borderRadius: theme.radius.sm,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong style={{ fontSize: 13, color: theme.text }}>{r.topic}</strong>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: r.category.includes("Weak") ? theme.danger : theme.primary,
                        }}
                      >
                        {r.priority}
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: theme.muted, margin: 0, lineHeight: 1.45 }}>
                      {r.reason}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* CARD F: MEMORY STATUS & TRANSPARENCY */}
          <div
            style={{
              background: "var(--bg-secondary)",
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: "14px 18px",
              fontSize: 11.5,
              color: theme.muted,
              lineHeight: 1.55,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <strong style={{ color: theme.text, display: "inline" }}>Transparent Memory Rules: </strong>
              <span>
                Mastery requires ≥ 85% across at least 2 distinct interviews. Memory updates only after a completed evaluation. Data is isolated to your account.
              </span>
            </div>
            {overview.last_updated && (
              <span style={{ fontSize: 11, color: theme.primary, fontWeight: 600 }}>
                Synced: {new Date(overview.last_updated).toLocaleDateString()}
              </span>
            )}
          </div>
        </>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card-bg)",
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.lg,
              padding: "28px 24px",
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginTop: 0, marginBottom: 8 }}>
              Reset AI Interview Memory?
            </h3>
            <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.5, marginBottom: 20 }}>
              This will clear your tracked weak areas, mastery statuses, and personalized follow-up weights. Your completed interview session history and PDF reports will remain safe.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                style={{
                  background: "transparent",
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: "8px 16px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: theme.text,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <Button
                variant="danger"
                size="sm"
                pill
                onClick={handleResetMemory}
                loading={resetting}
              >
                {resetting ? "Resetting..." : "Confirm Reset"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

