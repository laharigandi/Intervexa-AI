import { useState, useEffect, useContext, useCallback, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import PageShell from "../components/PageShell";
import Card from "../components/Card";
import Button from "../components/Button";
import theme from "../styles/theme";
import { inputStyle } from "../styles/shared";
import { API_BASE_URL } from "../config/api";
import {
  IconLearning,
  IconBook,
  IconSparkles,
  IconExternalLink,
  IconCheckCircle,
  IconRefresh,
  IconZap,
  IconAlertTriangle,
  IconDownload,
  IconTrash,
} from "../components/Icons";

import StudyPlanOverview from "../components/study-planner/StudyPlanOverview";
import DailyTasksView from "../components/study-planner/DailyTasksView";
import CalendarScheduleView from "../components/study-planner/CalendarScheduleView";
import SkillImprovementRadar from "../components/study-planner/SkillImprovementRadar";
import AILearningAssistantModal from "../components/study-planner/AILearningAssistantModal";
import StudyPlanConfigModal from "../components/study-planner/StudyPlanConfigModal";
import DailyQuizSection from "../components/study-planner/DailyQuizSection";

const CAREER_TRACKS = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Machine Learning Engineer",
  "Software Engineer",
  "Data Analyst",
  "Python Developer",
  "Java Developer",
];

const SUGGESTED_TOPICS = [
  "System Design",
  "React Hooks & State",
  "SQL Optimization",
  "Data Structures",
  "Microservices",
  "REST APIs",
  "Python",
  "Java",
  "Machine Learning",
];

const RESOURCE_FILTER_TABS = [
  { id: "All", label: "All" },
  { id: "Course", label: "Courses" },
  { id: "Tutorial", label: "Tutorials" },
  { id: "Documentation", label: "Documentation" },
  { id: "Practice", label: "Practice" },
  { id: "Video", label: "Videos" },
];

const LEVEL_FILTER_TABS = [
  { id: "All", label: "All Levels" },
  { id: "Beginner", label: "Beginner" },
  { id: "Intermediate", label: "Intermediate" },
  { id: "Advanced", label: "Advanced" },
];

function Learning() {
  const { token } = useContext(AuthContext);

  // ── Main Tab Navigation: 'plan' (Study Plan) vs 'resources' (Resources) ──
  const [activeMainTab, setActiveMainTab] = useState("plan");

  const [plannerSubView, setPlannerSubView] = useState("tasks"); // 'tasks', 'calendar', 'radar'

  // ── Study Planner State (Study Plan Tab) ──
  const [studyPlan, setStudyPlan] = useState(null);
  const [studyPlanLoading, setStudyPlanLoading] = useState(true);
  const [studyPlanError, setStudyPlanError] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [planGeneratedNotice, setPlanGeneratedNotice] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [assistantModal, setAssistantModal] = useState({
    isOpen: false,
    topic: "",
    taskId: null,
  });
  const [quizSelectedDay, setQuizSelectedDay] = useState(1);

  // ── Curated Resource Explorer State (Resources Tab) ──
  const [role, setRole] = useState(() => localStorage.getItem("role") || CAREER_TRACKS[0]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [resources, setResources] = useState([]);
  const [resourceFilter, setResourceFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");

  // Fetch active study plan on mount
  const fetchStudyPlan = useCallback(async () => {
    const authToken = token || localStorage.getItem("token");
    if (!authToken) {
      setStudyPlanLoading(false);
      return;
    }
    try {
      setStudyPlanLoading(true);
      const res = await fetch(`${API_BASE_URL}/study-planner/overview`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && json.data.has_active_plan) {
          setStudyPlan(json.data);
        } else {
          setStudyPlan(null);
        }
      }
    } catch (err) {
      console.error("Study plan fetch error:", err);
    } finally {
      setStudyPlanLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStudyPlan();
  }, [fetchStudyPlan]);

  const handleGenerateStudyPlan = async (config) => {
    setStudyPlanError(null);
    setStudyPlanLoading(true);
    const authToken = token || localStorage.getItem("token");

    const resumeText = localStorage.getItem("resumeText") || "";
    let resumeSkills = [];
    try {
      const parsed = JSON.parse(localStorage.getItem("skills"));
      if (Array.isArray(parsed)) resumeSkills = parsed;
    } catch {}
    const jobDescription = localStorage.getItem("jobDescription") || "";

    const payload = {
      ...config,
      resume_text: config.include_resume !== false ? resumeText : "",
      resume_skills: config.include_resume !== false ? resumeSkills : [],
      job_description: config.include_resume !== false ? jobDescription : "",
    };

    try {
      const res = await fetch(`${API_BASE_URL}/study-planner/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.plan) {
        setStudyPlan(json.plan);
        setShowConfigModal(false);
        setStudyPlanError(null);
        setPlanGeneratedNotice(true);
      } else {
        const errMsg = json.error || json.message || "Failed to generate study plan. Please retry.";
        setStudyPlanError(errMsg);
      }
    } catch (err) {
      console.error("Study plan generate error:", err);
      setStudyPlanError("Network error or AI service unavailable. Please check your connection and retry.");
    } finally {
      setStudyPlanLoading(false);
    }
  };

  const handleDownloadPdf = async (customPlan = null) => {
    try {
      setPdfLoading(true);
      const authToken = token || localStorage.getItem("token");
      const planToExport = customPlan || studyPlan;

      if (!planToExport) {
        alert("No active study plan found to export. Please generate a study plan first.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/study-planner/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          plan: planToExport,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || "Failed to generate roadmap PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Intervexa_AI_Learning_Roadmap.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      alert(err.message || "Failed to download roadmap PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, status, skipReason = null) => {
    const authToken = token || localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/study-planner/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ status, skip_reason: skipReason }),
      });
      if (res.ok) {
        fetchStudyPlan();
      }
    } catch (err) {
      console.error("Task status update error:", err);
    }
  };

  const handleRescheduleTask = async (taskId, newDate) => {
    const authToken = token || localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/study-planner/tasks/${taskId}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ new_date: newDate }),
      });
      if (res.ok) {
        fetchStudyPlan();
      }
    } catch (err) {
      console.error("Reschedule task error:", err);
    }
  };

  const handleRegenerateCurrentPlan = async () => {
    if (!studyPlan) return;
    handleGenerateStudyPlan({
      topic: studyPlan.requested_topic || "",
      target_role: studyPlan.target_role,
      duration_days: studyPlan.duration_days,
      daily_study_minutes: studyPlan.daily_study_minutes,
      preparation_level: studyPlan.preparation_level,
    });
  };

  const handleOpenDeleteModal = (targetId) => {
    const idToUse = targetId || studyPlan?.plan_id || studyPlan?.id || null;
    setDeletePlanId(idToUse);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteStudyPlan = async () => {
    if (isDeletingPlan) return;
    setIsDeletingPlan(true);
    setDeleteError(null);
    const authToken = token || localStorage.getItem("token");
    const targetId = deletePlanId || studyPlan?.plan_id || studyPlan?.id;
    const url = targetId
      ? `${API_BASE_URL}/study-planner/plan/${targetId}?plan_id=${targetId}`
      : `${API_BASE_URL}/study-planner/plan`;

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setStudyPlan(null);
        setPlanGeneratedNotice(false);
        setStudyPlanError(null);
        setDeletePlanId(null);
        setDeleteError(null);
        setShowDeleteModal(false);
      } else {
        const errMsg = json.error || json.message || "Failed to delete study roadmap. Please try again.";
        setDeleteError(errMsg);
      }
    } catch (err) {
      console.error("Delete roadmap error:", err);
      setDeleteError("Network error. Could not delete roadmap.");
    } finally {
      setIsDeletingPlan(false);
    }
  };

  // ── Curated Resource Explorer Handlers ──
  const handleAddTopic = (topicName) => {
    const clean = topicName.trim();
    if (!clean) return;
    setSelectedTopics((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  };

  const handleRemoveTopic = (topicToRemove) => {
    setSelectedTopics((prev) => prev.filter((t) => t !== topicToRemove));
  };

  const handleToggleSuggested = (sugg) => {
    setSelectedTopics((prev) =>
      prev.includes(sugg) ? prev.filter((t) => t !== sugg) : [...prev, sugg]
    );
  };

  const handleTopicKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parts = topicInput
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        setSelectedTopics((prev) => {
          const next = [...prev];
          parts.forEach((p) => {
            if (!next.includes(p)) next.push(p);
          });
          return next;
        });
        setTopicInput("");
      }
    }
  };

  const handleSearchResources = async () => {
    if (!role) {
      alert("Please select a target career track.");
      return;
    }

    // Include any typed text that wasn't submitted with Enter
    let finalTopics = [...selectedTopics];
    if (topicInput.trim()) {
      const extra = topicInput
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      extra.forEach((e) => {
        if (!finalTopics.includes(e)) finalTopics.push(e);
      });
      setSelectedTopics(finalTopics);
      setTopicInput("");
    }

    if (finalTopics.length === 0) {
      alert("Please enter or select at least one skill or topic to search.");
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError(null);

      const res = await fetch(`${API_BASE_URL}/learning`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role, weak_skills: finalTopics }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(
          data.message || data.error || data.msg || "Failed to search learning resources. Please try again."
        );
      }

      const list = Array.isArray(data.resources) ? data.resources : [];
      setResources(list);
      setHasSearched(true);
      setResourceFilter("All");
    } catch (err) {
      console.error("Resource search error:", err);
      setSearchError(err.message || "Failed to retrieve resources. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Filtered resources based on selected filter tab & level filter
  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      const matchType =
        resourceFilter === "All" ||
        (item.type || "").toLowerCase() === resourceFilter.toLowerCase();
      const matchLevel =
        levelFilter === "All" ||
        (item.level || "").toLowerCase() === levelFilter.toLowerCase();
      return matchType && matchLevel;
    });
  }, [resources, resourceFilter, levelFilter]);

  // Counts for type tabs
  const tabCounts = useMemo(() => {
    const counts = { All: resources.length, Course: 0, Tutorial: 0, Documentation: 0, Practice: 0, Video: 0 };
    resources.forEach((r) => {
      const t = r.type || "";
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [resources]);

  // Counts for level tabs
  const levelCounts = useMemo(() => {
    const counts = { All: resources.length, Beginner: 0, Intermediate: 0, Advanced: 0 };
    resources.forEach((r) => {
      const l = r.level || "";
      if (counts[l] !== undefined) counts[l]++;
    });
    return counts;
  }, [resources]);

  const getTypeBadgeStyle = (type) => {
    const t = (type || "").toLowerCase();
    if (t === "video") {
      return {
        background: "var(--error-light)",
        color: "var(--error)",
        border: "1px solid var(--error-border)",
      };
    }
    if (t === "documentation") {
      return {
        background: "var(--success-light)",
        color: "var(--success)",
        border: "1px solid var(--success-border)",
      };
    }
    if (t === "practice") {
      return {
        background: "rgba(245, 158, 11, 0.15)",
        color: "#f59e0b",
        border: "1px solid rgba(245, 158, 11, 0.35)",
      };
    }
    if (t === "course") {
      return {
        background: "rgba(99, 102, 241, 0.15)",
        color: "#818cf8",
        border: "1px solid rgba(99, 102, 241, 0.35)",
      };
    }
    // Tutorial and others: Standard Brand Purple
    return {
      background: "var(--primary-light)",
      color: "var(--primary)",
      border: "1px solid var(--primary-border)",
    };
  };

  const getLevelBadgeStyle = (level) => {
    const l = (level || "").toLowerCase();
    if (l === "beginner") {
      return {
        background: "rgba(16, 185, 129, 0.12)",
        color: "#10b981",
        border: "1px solid rgba(16, 185, 129, 0.3)",
      };
    }
    if (l === "intermediate") {
      return {
        background: "rgba(59, 130, 246, 0.12)",
        color: "#3b82f6",
        border: "1px solid rgba(59, 130, 246, 0.3)",
      };
    }
    if (l === "advanced") {
      return {
        background: "rgba(168, 85, 247, 0.12)",
        color: "#a855f7",
        border: "1px solid rgba(168, 85, 247, 0.3)",
      };
    }
    return {
      background: "var(--bg-surface)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-color)",
    };
  };

  return (
    <PageShell
      title="AI Personalized Learning & Study Planner"
      subtitle="Build your skills with personalized roadmaps and curated learning resources."
      containerStyle={{ maxWidth: "1600px", width: "100%", paddingBottom: 32 }}
    >
      {/* ─── Top Segmented Navigation Tabs: Study Plan vs Resources ─── */}
      <div
        role="tablist"
        aria-label="Learning View Selection"
        className="learning-segmented-nav"
      >
        <button
          role="tab"
          id="tab-study-plan"
          aria-selected={activeMainTab === "plan"}
          aria-controls="panel-study-plan"
          type="button"
          onClick={() => setActiveMainTab("plan")}
          className={`learning-segment-btn ${activeMainTab === "plan" ? "active" : ""}`}
        >
          <IconLearning
            size={18}
            color={activeMainTab === "plan" ? "var(--primary, #7650D8)" : "currentColor"}
          />
          <span>Study Plan</span>
        </button>

        <button
          role="tab"
          id="tab-resources"
          aria-selected={activeMainTab === "resources"}
          aria-controls="panel-resources"
          type="button"
          onClick={() => setActiveMainTab("resources")}
          className={`learning-segment-btn ${activeMainTab === "resources" ? "active" : ""}`}
        >
          <IconBook
            size={18}
            color={activeMainTab === "resources" ? "var(--primary, #7650D8)" : "currentColor"}
          />
          <span>Resources</span>
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          OPTION 1: STUDY PLAN CONTENT ONLY
         ═════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === "plan" && (
        <div
          role="tabpanel"
          id="panel-study-plan"
          aria-labelledby="tab-study-plan"
          className="fade-in-up"
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* Error Banner when generation fails */}
          {studyPlanError && !showConfigModal && (
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
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.9rem" }}>
                <IconAlertTriangle size={18} color="#ef4444" />
                <span>{studyPlanError}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  variant="secondary"
                  onClick={() => setShowConfigModal(true)}
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                >
                  Retry Generation
                </Button>
                <button
                  onClick={() => setStudyPlanError(null)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1rem" }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {studyPlanLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: theme.muted }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: `3px solid ${theme.border}`,
                  borderTop: `3px solid #6366f1`,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              <p style={{ margin: 0, fontSize: 15 }}>Loading your personalized AI study plan...</p>
            </div>
          ) : !studyPlan || !studyPlan.has_active_plan ? (
            /* Compact Empty State: Create Study Plan */
            <div
              style={{
                padding: "3rem 1.75rem",
                textAlign: "center",
                borderRadius: "1rem",
                background: "var(--bg-card, rgba(255,255,255,0.02))",
                border: "1px dashed var(--border-color, rgba(255,255,255,0.15))",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "16px",
                  background: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  marginBottom: "1rem",
                  boxShadow: "0 6px 18px var(--primary-glow)",
                }}
              >
                <IconZap size={26} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 0.5rem 0", color: "var(--text-main)" }}>
                No Learning Roadmap Yet
              </h2>
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  maxWidth: "480px",
                  marginBottom: "1.5rem",
                }}
              >
                Generate a personalized learning roadmap based on your target role and skill requirements.
              </p>
              <Button
                variant="primary"
                onClick={() => setShowConfigModal(true)}
                style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem" }}
              >
                <IconSparkles size={16} />
                <span>Generate New Roadmap</span>
              </Button>
            </div>
          ) : (
            /* Active Plan Content */
            <>
              {/* Post-generation notification banner */}
              {planGeneratedNotice && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "0.75rem",
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "#10b981",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconCheckCircle size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: theme.text }}>
                        AI Learning Roadmap Generated Successfully!
                      </h4>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: theme.textSecondary }}>
                        Your customized {studyPlan.duration_days}-day curriculum for {studyPlan.target_role} is ready to explore.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setPlanGeneratedNotice(false);
                        setPlannerSubView("tasks");
                      }}
                      style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}
                    >
                      View Roadmap
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleDownloadPdf(studyPlan)}
                      disabled={pdfLoading}
                      style={{
                        fontSize: "0.85rem",
                        padding: "0.45rem 1rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <IconDownload size={14} />
                      <span>{pdfLoading ? "Generating PDF..." : "Download PDF"}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Overview & Metric Cards */}
              <StudyPlanOverview
                plan={studyPlan}
                onOpenConfig={() => setShowConfigModal(true)}
                onRegenerate={handleRegenerateCurrentPlan}
                onDownloadPdf={() => handleDownloadPdf(studyPlan)}
                onDeleteRoadmap={handleOpenDeleteModal}
                onOpenAssistant={(topic, taskId) =>
                  setAssistantModal({ isOpen: true, topic, taskId })
                }
                onCompleteTodayTask={(taskId) => handleUpdateTaskStatus(taskId, "completed")}
                onOpenQuiz={(dayNum) => {
                  setQuizSelectedDay(dayNum || 1);
                  setPlannerSubView("quiz");
                }}
                loading={studyPlanLoading}
                pdfDownloading={pdfLoading}
                isDeleting={isDeletingPlan}
              />

              {/* Sub-view Switcher (Tasks, Quiz, Calendar, Skill Radar) */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  borderBottom: `1px solid ${theme.border}`,
                  paddingBottom: "0.6rem",
                  marginTop: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { id: "tasks", label: "Daily Tasks & Checklist" },
                  { id: "quiz", label: "Daily Quiz Preparation" },
                  { id: "calendar", label: "Calendar Schedule" },
                  { id: "radar", label: "Skill Mastery Radar" },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setPlannerSubView(v.id)}
                    style={{
                      padding: "0.45rem 1rem",
                      borderRadius: "0.5rem",
                      border: plannerSubView === v.id ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: plannerSubView === v.id ? "var(--primary)" : "var(--bg-surface)",
                      color: plannerSubView === v.id ? "#ffffff" : "var(--text-secondary)",
                      boxShadow: plannerSubView === v.id ? "0 2px 8px var(--primary-glow)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {/* Sub-view Body */}
              {plannerSubView === "tasks" && (
                <DailyTasksView
                  tasks={studyPlan.tasks || []}
                  dailyStudyMinutes={studyPlan.daily_study_minutes}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onReschedule={handleRescheduleTask}
                  onOpenAssistant={(topic, taskId) =>
                    setAssistantModal({ isOpen: true, topic, taskId })
                  }
                  onOpenQuiz={(dayNum) => {
                    setQuizSelectedDay(dayNum || 1);
                    setPlannerSubView("quiz");
                  }}
                />
              )}

              {plannerSubView === "quiz" && (
                <DailyQuizSection
                  plan={studyPlan}
                  selectedDay={quizSelectedDay}
                  onSelectDay={(dayNum) => setQuizSelectedDay(dayNum)}
                  onQuizCompleted={() => fetchStudyPlan()}
                  onBackToTasks={() => setPlannerSubView("tasks")}
                />
              )}

              {plannerSubView === "calendar" && (
                <CalendarScheduleView
                  tasks={studyPlan.tasks || []}
                  onOpenAssistant={(topic, taskId) =>
                    setAssistantModal({ isOpen: true, topic, taskId })
                  }
                  onUpdateStatus={handleUpdateTaskStatus}
                />
              )}

              {plannerSubView === "radar" && (
                <SkillImprovementRadar
                  topicMasteryList={studyPlan.topic_mastery_list || []}
                  targetRole={studyPlan.target_role}
                  onPracticeTopic={(topic) =>
                    setAssistantModal({ isOpen: true, topic, taskId: null })
                  }
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          OPTION 2: RESOURCES CONTENT ONLY (CENTERED & NARROWER WIDTH)
         ═════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === "resources" && (
        <div
          role="tabpanel"
          id="panel-resources"
          aria-labelledby="tab-resources"
          className="fade-in-up resources-centered-container"
        >
          {/* Main Curated Resource Explorer Card (Compact & Centered) */}
          <Card
            compact
            title="Curated Resource Explorer"
            subtitle="Find tutorials, videos, and documentation for your target skills."
            icon={IconLearning}
            accent="purple"
            accentBorder={true}
            style={{ width: "100%", marginBottom: 0, padding: "16px 20px", height: "auto", minHeight: "unset" }}
          >
            <div style={{ display: "grid", gap: 11 }}>
              {/* Career Track Dropdown */}
              <div>
                <label style={compactLabelStyle}>Target Career Track</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={compactInputStyle}
                >
                  <option value="">-- Choose Target Role --</option>
                  {CAREER_TRACKS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills / Topics input & tag chips */}
              <div>
                <label style={compactLabelStyle}>
                  Skills / Topics to Strengthen
                  <span style={{ color: theme.muted, fontWeight: 400, fontSize: 11.5, marginLeft: 6 }}>
                    (type topic and press Enter or comma)
                  </span>
                </label>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="e.g. System Design, React Hooks, SQL Optimization"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={handleTopicKeyDown}
                    style={{ ...compactInputStyle, flex: 1 }}
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      if (topicInput.trim()) {
                        handleAddTopic(topicInput);
                        setTopicInput("");
                      }
                    }}
                    style={{ height: "42px", padding: "0 14px", fontSize: "13px" }}
                  >
                    Add
                  </Button>
                </div>

                {/* Selected Topic Tag Chips */}
                {selectedTopics.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                    {selectedTopics.map((item) => (
                      <span
                        key={item}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: "var(--primary-light, rgba(118, 80, 216, 0.15))",
                          color: "var(--primary, #7650D8)",
                          border: "1px solid var(--primary-border, rgba(118, 80, 216, 0.35))",
                          fontSize: "11.5px",
                          fontWeight: 600,
                        }}
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTopic(item)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "currentColor",
                            cursor: "pointer",
                            fontSize: "12px",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            lineHeight: 1,
                          }}
                          title={`Remove ${item}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested Topics Chips */}
                <div style={{ marginTop: 9 }}>
                  <span style={{ fontSize: "11.5px", color: theme.textSecondary, fontWeight: 500, display: "block", marginBottom: 5 }}>
                    Suggested Focus Topics:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {SUGGESTED_TOPICS.map((sugg) => {
                      const isSelected = selectedTopics.includes(sugg);
                      return (
                        <button
                          key={sugg}
                          type="button"
                          onClick={() => handleToggleSuggested(sugg)}
                          style={{
                            background: isSelected
                              ? "var(--primary, #7650D8)"
                              : "var(--bg-surface, rgba(255, 255, 255, 0.04))",
                            color: isSelected ? "#ffffff" : "var(--text-secondary, #94a3b8)",
                            border: isSelected
                              ? "1px solid var(--primary, #7650D8)"
                              : "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                            borderRadius: "9999px",
                            padding: "3px 8px",
                            fontSize: "11.5px",
                            fontWeight: isSelected ? 700 : 500,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <span>{isSelected ? "✓" : "+"}</span>
                          <span>{sugg}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Search Button */}
              <div>
                <Button
                  onClick={handleSearchResources}
                  loading={searchLoading}
                  disabled={searchLoading || !role || (selectedTopics.length === 0 && !topicInput.trim())}
                  icon={IconSparkles}
                  style={{ width: "100%", height: "42px", justifyContent: "center", fontSize: "13.5px" }}
                >
                  {searchLoading ? "Searching Resources..." : "Search Resources"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Search Error Banner */}
          {searchError && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem" }}>
                <IconAlertTriangle size={16} color="#ef4444" />
                <span>{searchError}</span>
              </div>
              <Button variant="secondary" onClick={handleSearchResources} style={{ padding: "0.25rem 0.65rem", fontSize: "0.75rem" }}>
                Retry
              </Button>
            </div>
          )}

          {/* Loading Indicator */}
          {searchLoading && (
            <Card compact style={{ marginBottom: 0, padding: "20px 18px", height: "auto" }}>
              <div style={{ textAlign: "center", color: theme.muted }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    border: `2.5px solid ${theme.border}`,
                    borderTop: `2.5px solid #06B6D4`,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 10px",
                  }}
                />
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: theme.text, marginBottom: 2 }}>
                  Retrieving Verified Resources...
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: theme.textSecondary }}>
                  Curating top tutorials, videos, and reference documentation.
                </p>
              </div>
            </Card>
          )}

          {/* Compact Initial State Guidance Card (Shown ONLY when no search has been executed and no results exist) */}
          {!hasSearched && !searchLoading && resources.length === 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: "var(--bg-surface)",
                border: "1px dashed var(--border-color)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                height: "auto",
                minHeight: "unset",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(6, 182, 212, 0.12)",
                  color: "#06B6D4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconLearning size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: "0 0 2px 0", fontSize: 13, fontWeight: 700, color: theme.text }}>
                  Curated Skill & Topic Resources
                </h4>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: theme.textSecondary }}>
                  Select a career track and choose topics above to explore top video tutorials, official documentation, and courses.
                </p>
              </div>
            </div>
          )}

          {/* Resource Search Results Section */}
          {hasSearched && !searchLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Results Header & Filter Tabs */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>
                      Targeted Learning Results
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: "9999px",
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "#818cf8",
                      }}
                    >
                      {filteredResources.length} {filteredResources.length === 1 ? "resource" : "resources"}
                    </span>
                  </div>

                  {/* Level Filter Tabs */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 500 }}>
                      Level:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {LEVEL_FILTER_TABS.map((lvl) => {
                        const count = levelCounts[lvl.id] || 0;
                        const isActive = levelFilter === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setLevelFilter(lvl.id)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              border: isActive ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              background: isActive ? "var(--primary)" : "transparent",
                              color: isActive ? "#ffffff" : "var(--text-secondary)",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {lvl.label} {lvl.id !== "All" ? `(${count})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Resource Type Filter Tabs */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border-color)", paddingTop: 8 }}>
                  <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 500 }}>
                    Type:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {RESOURCE_FILTER_TABS.map((tab) => {
                      const count = tabCounts[tab.id] || 0;
                      const isActive = resourceFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setResourceFilter(tab.id)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            border: isActive ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                            background: isActive ? "var(--primary)" : "transparent",
                            color: isActive ? "#ffffff" : "var(--text-secondary)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {tab.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* No resources match current filter */}
              {filteredResources.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    borderRadius: 10,
                    background: "var(--bg-surface)",
                    border: "1px dashed var(--border-color)",
                    color: "var(--text-secondary)",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  <IconAlertTriangle size={24} color="#f59e0b" style={{ margin: "0 auto 8px", display: "block" }} />
                  <div>No relevant resources found for this skill.</div>
                </div>
              ) : (
                /* Resource Cards Responsive Grid */
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
                    gap: 12,
                  }}
                >
                  {filteredResources.map((res, idx) => (
                    <div
                      key={res.id || idx}
                      className="resource-result-card"
                      style={{
                        padding: "16px 18px",
                        borderRadius: "12px",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "var(--shadow-card)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "12px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* Card Header: Type Badge, Topic, Provider */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 6,
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span
                              style={{
                                ...getTypeBadgeStyle(res.type),
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "5px",
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                              }}
                            >
                              {res.type || "Resource"}
                            </span>
                            {res.level && (
                              <span
                                style={{
                                  ...getLevelBadgeStyle(res.level),
                                  fontSize: "10.5px",
                                  fontWeight: 600,
                                  padding: "2px 7px",
                                  borderRadius: "5px",
                                }}
                              >
                                {res.level}
                              </span>
                            )}
                            {res.topic && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: "9999px",
                                  background: "var(--primary-light)",
                                  color: "var(--primary)",
                                  border: "1px solid var(--primary-border)",
                                }}
                              >
                                {res.topic}
                              </span>
                            )}
                          </div>

                          {res.provider && (
                            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>
                              {res.provider}
                            </span>
                          )}
                        </div>

                        {/* Card Title & Description */}
                        <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
                          {res.title}
                        </h4>
                        <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                          {res.description}
                        </p>
                      </div>

                      {/* Card Action */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="open-resource-btn"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#fff",
                            background: "var(--primary)",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            textDecoration: "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span>Open Resource</span>
                          <IconExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Assistant Modal */}
      <AILearningAssistantModal
        isOpen={assistantModal.isOpen}
        onClose={() => setAssistantModal({ isOpen: false, topic: "", taskId: null })}
        topic={assistantModal.topic}
        role={studyPlan?.target_role || "Full Stack Developer"}
        taskId={assistantModal.taskId}
        token={token}
        onActivityRecorded={fetchStudyPlan}
      />

      {/* Config Modal */}
      <StudyPlanConfigModal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setStudyPlanError(null);
        }}
        onGenerate={handleGenerateStudyPlan}
        initialRole={studyPlan?.target_role || role || "Full Stack Developer"}
        loading={studyPlanLoading}
        error={studyPlanError}
      />

      {/* Delete Roadmap Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingPlan) {
              setShowDeleteModal(false);
              setDeletePlanId(null);
              setDeleteError(null);
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
              maxWidth: "460px",
              padding: "1.75rem",
              color: "var(--text-main)",
            }}
            onClick={(e) => e.stopPropagation()}
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
                  Delete Learning Roadmap
                </h3>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Permanent Action
                </span>
              </div>
            </div>

            <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Are you sure you want to permanently delete this roadmap?
            </p>

            {deleteError && (
              <div
                style={{
                  marginBottom: "1.25rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePlanId(null);
                  setDeleteError(null);
                }}
                disabled={isDeletingPlan}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteStudyPlan}
                disabled={isDeletingPlan}
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
                <span>{isDeletingPlan ? "Deleting..." : "Delete"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
  fontSize: 13,
  color: theme.text,
};

const compactLabelStyle = {
  display: "block",
  marginBottom: 4,
  fontWeight: 600,
  fontSize: 12.5,
  color: theme.text,
};

const compactInputStyle = {
  ...inputStyle,
  padding: "9px 12px",
  height: "42px",
  fontSize: "13.5px",
};

export default Learning;
