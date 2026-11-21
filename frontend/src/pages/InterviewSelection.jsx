import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { InterviewContext } from "../context/InterviewContext";
import PageShell from "../components/PageShell";
import Button from "../components/Button";
import InterviewerPersonalitySelector from "../components/InterviewerPersonalitySelector";
import theme from "../styles/theme";
import { API_BASE_URL } from "../config/api";
import {
  IconZap,
  IconMic,
  IconSparkles,
  IconArrowRight,
  IconTarget,
  IconBriefcase,
  IconAlertTriangle,
  IconCheckCircle,
} from "../components/Icons";

const STANDARD_KEY_FEATURES = [
  "Role-based interview questions",
  "Fixed question sequence",
  "Text and voice interview",
  "Technical and communication feedback",
];

const ADAPTIVE_KEY_FEATURES = [
  "Dynamic AI question generation",
  "Adaptive difficulty levels",
  "Personalized follow-up questions",
  "Performance-based evaluation",
];

function InterviewSelection() {
  const navigate = useNavigate();
  const {
    role,
    setInterviewType,
    setAdaptiveSession,
    setQuestions,
    jobDescription,
    skills,
    resumeText,
  } = useContext(InterviewContext);

  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [standardLoading, setStandardLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [selectedPersonality, setSelectedPersonality] = useState(() => {
    return localStorage.getItem("interviewer_personality") || "technical";
  });
  const [memorySummary, setMemorySummary] = useState({
    hasMemory: false,
    totalInterviews: 0,
    weakAreas: [],
    strongAreas: [],
  });

  // Fetch candidate's AI memory summary to power personalized interview start experience
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE_URL}/api/interview-memory/overview`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE_URL}/api/interview-memory/weak-areas?limit=3`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE_URL}/api/interview-memory/strong-areas?limit=3`, { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([ovData, weakData, strongData]) => {
        const ov = ovData?.overview;
        if (ov && ov.has_memory && ov.total_interviews > 0) {
          setMemorySummary({
            hasMemory: true,
            totalInterviews: ov.total_interviews,
            weakAreas: weakData?.weak_areas || [],
            strongAreas: strongData?.strong_areas || [],
          });
        }
      })
      .catch((err) => {
        console.warn("[InterviewSelection] Could not load memory overview:", err);
      });
  }, []);

  const targetRole = role || localStorage.getItem("role") || "Software Developer";

  const handleStartStandard = async () => {
    localStorage.setItem("interviewType", "standard");
    if (setInterviewType) setInterviewType("standard");

    // 1. If standard questions already exist and has exactly 10 questions, go straight to standard interview
    try {
      const q = localStorage.getItem("standard_questions");
      if (q) {
        const parsed = JSON.parse(q);
        if (Array.isArray(parsed) && parsed.length === 10) {
          if (setQuestions) setQuestions(parsed);
          localStorage.setItem("questions", JSON.stringify(parsed));
          navigate("/standard-interview");
          return;
        }
      }
    } catch {}

    // 2. Otherwise generate standard questions directly with active role & resume
    try {
      setStandardLoading(true);
      setActionError(null);

      const effectiveRole = targetRole;
      const token = localStorage.getItem("token");
      const effectiveResumeText = resumeText || localStorage.getItem("resumeText") || "";
      const effectiveSkills = Array.isArray(skills) && skills.length > 0
        ? skills
        : (() => {
            try {
              const raw = localStorage.getItem("skills");
              return raw ? JSON.parse(raw) : [];
            } catch {
              return [];
            }
          })();
      const effectiveJd = jobDescription || localStorage.getItem("jobDescription") || "";

      const response = await fetch(`${API_BASE_URL}/generate_questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          role: effectiveRole,
          skills: effectiveSkills,
          resume_text: effectiveResumeText,
          job_description: effectiveJd,
          personality: selectedPersonality,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.questions || !Array.isArray(data.questions) || data.questions.length !== 10) {
        navigate("/role?mode=standard");
        return;
      }

      setInterviewType("standard");
      if (setQuestions) setQuestions(data.questions);
      localStorage.setItem("interviewType", "standard");
      localStorage.removeItem("adaptiveSession");
      localStorage.setItem("role", effectiveRole);
      localStorage.setItem("questions", JSON.stringify(data.questions));
      localStorage.setItem("standard_questions", JSON.stringify(data.questions));
      localStorage.removeItem("interview_answers");

      navigate("/standard-interview");
    } catch (err) {
      console.error("[Standard start exception]:", err);
      navigate("/role?mode=standard");
    } finally {
      setStandardLoading(false);
    }
  };

  const handleStartAdaptive = async ({ personalized = true } = {}) => {
    localStorage.setItem("interviewType", "adaptive");
    localStorage.setItem("isPersonalizedAdaptive", personalized ? "true" : "false");
    if (setInterviewType) setInterviewType("adaptive");

    // If starting fresh without personalization, clear previous adaptive session
    if (!personalized) {
      localStorage.removeItem("adaptiveSession");
    }

    // 1. If an active adaptive session already exists in storage and not starting fresh, launch directly
    if (personalized) {
      try {
        const stored = localStorage.getItem("adaptiveSession");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.session_id || parsed.current_question)) {
            navigate("/adaptive-interview");
            return;
          }
        }
      } catch {}
    }

    // 2. Otherwise initialize an adaptive session directly with the active role & resume
    try {
      setAdaptiveLoading(true);
      setActionError(null);

      const effectiveRole = targetRole;
      const token = localStorage.getItem("token");
      const effectiveResumeText = resumeText || localStorage.getItem("resumeText") || "";
      const effectiveSkills = Array.isArray(skills) && skills.length > 0
        ? skills
        : (() => {
            try {
              const raw = localStorage.getItem("skills");
              return raw ? JSON.parse(raw) : [];
            } catch {
              return [];
            }
          })();
      const effectiveJd = jobDescription || localStorage.getItem("jobDescription") || "";

      const response = await fetch(`${API_BASE_URL}/adaptive/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          role: effectiveRole,
          skills: effectiveSkills,
          resume_text: effectiveResumeText,
          job_description: effectiveJd,
          max_questions: 10,
          initial_difficulty: "medium",
          personalized: personalized,
          personality: selectedPersonality,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.session) {
        console.warn("[Adaptive start error]:", data);
        navigate("/role?mode=adaptive");
        return;
      }

      setInterviewType("adaptive");
      if (setAdaptiveSession) setAdaptiveSession(data.session);
      localStorage.setItem("interviewType", "adaptive");
      localStorage.setItem("adaptiveSession", JSON.stringify(data.session));
      localStorage.setItem("role", effectiveRole);

      navigate("/adaptive-interview");
    } catch (err) {
      console.error("[Adaptive start exception]:", err);
      navigate("/role?mode=adaptive");
    } finally {
      setAdaptiveLoading(false);
    }
  };

  return (
    <PageShell
      title="Select Interview Mode"
      containerStyle={{ padding: "clamp(10px, 1.6vh, 16px) clamp(16px, 2.5vw, 24px)", maxWidth: "920px" }}
      headerStyle={{ marginBottom: 10 }}
    >
      <div className="interview-selection-container animate-slide-up">
        {actionError && (
          <div
            style={{
              padding: "8px 14px",
              borderRadius: theme.radius.sm,
              background: theme.dangerLight,
              border: `1px solid ${theme.dangerBorder}`,
              color: theme.danger,
              marginBottom: 10,
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IconAlertTriangle size={14} />
            <span>{actionError}</span>
          </div>
        )}

        {/* Active Target Role Banner */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: `1px solid ${theme.border}`,
            borderRadius: "10px",
            padding: "6px 14px",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            boxShadow: theme.shadow.sm,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "8px",
                background: theme.primaryLight,
                color: theme.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconBriefcase size={15} />
            </div>
            <div>
              <span
                style={{
                  fontSize: "9.5px",
                  fontWeight: 700,
                  color: theme.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  lineHeight: 1,
                  display: "block",
                }}
              >
                Target Career Track
              </span>
              <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text, marginTop: 1 }}>
                {targetRole}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/role")}
            style={{
              background: "transparent",
              border: `1px solid ${theme.border}`,
              borderRadius: "6px",
              padding: "4px 9px",
              fontSize: "11.5px",
              fontWeight: 600,
              color: theme.primary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.18s ease",
            }}
          >
            <IconTarget size={12} />
            <span>Change Track</span>
          </button>
        </div>

        {/* AI Mock Interviewer Persona Selector */}
        <div style={{ marginBottom: 12 }}>
          <InterviewerPersonalitySelector
            selected={selectedPersonality}
            onSelect={(id) => setSelectedPersonality(id)}
          />
        </div>

        {/* =========================================================
            TWO-CARD INTERVIEW SELECTION GRID WITH KEY FEATURES
            ========================================================= */}
        <div className="interview-cards-grid">
          {/* CARD 1: STANDARD INTERVIEW */}
          <div className="interview-mode-card standard-card">
            <div className="card-top-stripe standard-stripe" />

            <div className="card-top-content">
              <div className="mode-header-row">
                <div className="mode-icon-badge standard-icon-badge">
                  <IconMic size={22} />
                </div>
                <div>
                  <h2 className="mode-title">Standard Interview</h2>
                  <span className="mode-badge">10 Structured Questions</span>
                </div>
              </div>
              <p className="mode-desc">
                Structured interview with predefined role questions, strict timing, and comprehensive multi-dimensional AI scoring.
              </p>

              {/* 4 Key Features */}
              <ul className="card-feature-list">
                {STANDARD_KEY_FEATURES.map((item, idx) => (
                  <li key={idx} className="card-feature-item">
                    <IconCheckCircle size={15} className="feature-bullet-icon standard-bullet" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-action-wrap">
              <Button
                variant="primary"
                size="lg"
                pill
                fullWidth
                onClick={handleStartStandard}
                loading={standardLoading}
                icon={IconArrowRight}
                style={{
                  height: 44,
                  fontSize: "14px",
                  fontWeight: 600,
                  boxShadow: "0 4px 14px var(--primary-glow)",
                }}
              >
                {standardLoading ? "Preparing Questions..." : "Start Standard Interview"}
              </Button>
            </div>
          </div>

          {/* CARD 2: ADAPTIVE AI INTERVIEW */}
          <div className="interview-mode-card adaptive-card">
            <div className="card-top-stripe adaptive-stripe" />

            <div className="card-top-content">
              <div className="mode-header-row">
                <div className="mode-icon-badge adaptive-icon-badge">
                  <IconZap size={22} />
                </div>
                <div>
                  <h2 className="mode-title">Adaptive AI Interview</h2>
                  <span className="mode-badge">Dynamic Difficulty</span>
                </div>
              </div>
              <p className="mode-desc">
                AI dynamically adapts subsequent questions based on your real-time responses, probing depth and edge-case mastery.
              </p>

              {/* 4 Key Features */}
              <ul className="card-feature-list">
                {ADAPTIVE_KEY_FEATURES.map((item, idx) => (
                  <li key={idx} className="card-feature-item">
                    <IconCheckCircle size={15} className="feature-bullet-icon adaptive-bullet" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-action-wrap">
              <Button
                variant="primary"
                size="lg"
                pill
                fullWidth
                onClick={() => handleStartAdaptive({ personalized: memorySummary.hasMemory })}
                loading={adaptiveLoading}
                icon={IconSparkles}
                style={{
                  height: 44,
                  fontSize: "14px",
                  fontWeight: 600,
                  boxShadow: "0 4px 14px var(--primary-glow)",
                }}
              >
                {adaptiveLoading ? "Calibrating Session..." : "Start Adaptive Interview"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Scoped Responsive Styles */}
      <style>{`
        .interview-selection-container {
          max-width: 960px;
          margin: 0 auto;
          width: 100%;
        }

        .interview-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          align-items: stretch;
        }

        @media (max-width: 768px) {
          .interview-cards-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }

        .interview-mode-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 24px 26px 22px;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-card);
          transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.24s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.24s ease;
          min-height: 310px;
          box-sizing: border-box;
        }

        .interview-mode-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -4px rgba(128, 84, 232, 0.14);
          border-color: var(--primary);
        }

        .card-top-stripe {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3.5px;
        }

        .standard-stripe,
        .adaptive-stripe {
          background: linear-gradient(90deg, var(--primary), #B89EFF);
        }

        .card-top-content {
          margin-bottom: 20px;
        }

        .mode-header-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .mode-icon-badge {
          width: 44px;
          height: 44px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s ease;
          background: var(--primary-light);
          color: var(--primary);
          border: 1px solid var(--primary-border);
        }

        .interview-mode-card:hover .mode-icon-badge {
          transform: scale(1.05);
        }

        .mode-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-color);
          margin: 0 0 2px 0;
          letter-spacing: -0.015em;
          line-height: 1.25;
        }

        .mode-badge {
          font-size: 11px;
          font-weight: 600;
          color: var(--primary);
          background: var(--primary-light);
          padding: 1px 7px;
          border-radius: 9999px;
          display: inline-block;
          border: 1px solid var(--primary-border);
        }

        .mode-desc {
          font-size: 13.5px;
          color: var(--text-muted);
          line-height: 1.5;
          margin: 0 0 16px 0;
          padding-left: 2px;
        }

        .card-feature-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8.5px;
        }

        .card-feature-item {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          color: var(--text-color);
          line-height: 1.45;
          font-weight: 500;
        }

        .card-feature-item span {
          white-space: normal;
        }

        .feature-bullet-icon {
          flex-shrink: 0;
          color: var(--primary);
        }

        .card-action-wrap {
          margin-top: auto;
          padding-top: 16px;
        }
      `}</style>
    </PageShell>
  );
}

export default InterviewSelection;
