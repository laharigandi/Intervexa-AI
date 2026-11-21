import { useContext, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { InterviewContext } from "../context/InterviewContext";
import PageShell from "../components/PageShell";
import Card from "../components/Card";
import Button from "../components/Button";
import SkillChip from "../components/SkillChip";
import PageActions from "../components/PageActions";
import theme from "../styles/theme";
import { API_BASE_URL } from "../config/api";
import {
  IconBriefcase,
  IconBot,
  IconArrowRight,
  IconCheckCircle,
  IconSparkles,
} from "../components/Icons";

const ROLES = [
  {
    title: "Full Stack Developer",
    category: "Web & API",
    desc: "HTML, CSS, JavaScript, React, backend REST APIs, auth, SQL databases & system design",
    badge: "Web & API",
    skills: [
      "HTML",
      "CSS",
      "JavaScript",
      "React",
      "REST APIs",
      "Node.js",
      "SQL",
      "System Design",
    ],
  },
  {
    title: "Frontend Developer",
    category: "Web Development",
    desc: "HTML, CSS, JavaScript, React, responsive design, UI development, and frontend performance.",
    badge: "Web Development",
    skills: [
      "HTML",
      "CSS",
      "JavaScript",
      "React",
      "Responsive Design",
      "REST API Integration",
      "UI Development",
    ],
  },
  {
    title: "Backend Developer",
    category: "Backend Development",
    desc: "Python, Java, REST APIs, database management, authentication, server-side development, and backend architecture.",
    badge: "Backend Development",
    skills: [
      "Python",
      "Java",
      "REST APIs",
      "SQL",
      "Database Design",
      "Authentication",
      "Backend Architecture",
    ],
  },
  {
    title: "Java Developer",
    category: "Software Development",
    desc: "Core Java, object-oriented programming, collections, exception handling, Spring Boot, and database integration.",
    badge: "Software Development",
    skills: [
      "Core Java",
      "OOP",
      "Collections",
      "Exception Handling",
      "Spring Boot",
      "JDBC",
      "SQL",
    ],
  },
  {
    title: "Software Developer",
    category: "Software Engineering",
    desc: "System design, full-stack concepts, problem solving, debugging & clean code",
    badge: "Versatile",
    skills: [
      "Data Structures",
      "Algorithms",
      "System Design",
      "Problem Solving",
      "Clean Code",
      "Debugging",
      "Git",
    ],
  },
  {
    title: "Python Developer",
    category: "Core Tech",
    desc: "Data structures, OOP, API development, asynchronous programming & backend systems",
    badge: "Core Tech",
    skills: [
      "Python",
      "Data Structures",
      "OOP",
      "FastAPI / Flask",
      "Asyncio",
      "SQL & ORM",
    ],
  },
  {
    title: "Software Test Engineer",
    category: "QA & Testing",
    desc: "Testing fundamentals, test-case design, regression testing, defect lifecycle, API & automation",
    badge: "QA & Testing",
    skills: [
      "Testing Fundamentals",
      "Test-Case Design",
      "Regression Testing",
      "Defect Lifecycle",
      "API Testing",
      "Automation",
    ],
  },
  {
    title: "Machine Learning Engineer",
    category: "ML & AI",
    desc: "Python, supervised & unsupervised learning, feature engineering, model evaluation & production ML",
    badge: "ML & AI",
    skills: [
      "Python",
      "Machine Learning",
      "Feature Engineering",
      "Model Evaluation",
      "Production ML",
      "NumPy & Pandas",
    ],
  },
  {
    title: "AI/ML Engineer",
    category: "High Demand",
    desc: "Machine learning architectures, PyTorch/TensorFlow, model deployment & algorithms",
    badge: "High Demand",
    skills: [
      "Deep Learning",
      "PyTorch / TensorFlow",
      "Neural Networks",
      "Model Deployment",
      "Algorithms",
    ],
  },
  {
    title: "Data Analyst",
    category: "Analytics",
    desc: "SQL, data visualization, statistical analysis, dashboard reporting & business insights",
    badge: "Analytics",
    skills: [
      "SQL",
      "Data Visualization",
      "Pandas",
      "Statistical Analysis",
      "Dashboard Reporting",
      "Business Insights",
    ],
  },
  {
    title: "Data Scientist",
    category: "Data & AI",
    desc: "Statistical modeling, predictive analytics, machine learning algorithms & data insights",
    badge: "Data & AI",
    skills: [
      "Python",
      "Statistical Modeling",
      "Machine Learning",
      "Predictive Analytics",
      "Data Insights",
    ],
  },
  {
    title: "Cloud Engineer",
    category: "Cloud & DevOps",
    desc: "Cloud infrastructure (AWS/Azure/GCP), CI/CD pipelines, Docker, Kubernetes & scalability",
    badge: "Cloud & DevOps",
    skills: [
      "Cloud Infrastructure",
      "AWS / Azure / GCP",
      "CI/CD Pipelines",
      "Docker",
      "Kubernetes",
      "Scalability",
    ],
  },
];

const UNIQUE_ROLES = ROLES.filter(
  (roleOption, index, self) =>
    index === self.findIndex((r) => r.title.trim().toLowerCase() === roleOption.title.trim().toLowerCase())
);

function SelectRole() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const {
    role,
    setRole,
    setQuestions,
    jobDescription,
    jdMatchResult,
    setInterviewType,
    setAdaptiveSession,
    setAnswers,
  } = useContext(InterviewContext);

  const [selectedInterviewMode, setSelectedInterviewMode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get("mode");
      if (urlMode === "standard" || urlMode === "adaptive") {
        return urlMode;
      }
    } catch {
      // fallback
    }
    return localStorage.getItem("interviewType") || "adaptive";
  });

  const resumeSkills = useMemo(() => {
    try {
      const raw = localStorage.getItem("skills");
      if (!raw || raw === "undefined" || raw === "null") return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const selectedRoleObj = useMemo(() => {
    return UNIQUE_ROLES.find(
      (r) => r.title.trim().toLowerCase() === (role || "").trim().toLowerCase()
    );
  }, [role]);

  // Dynamically compute skills for selected role (enriched with resume skills if available)
  const displayedSkills = useMemo(() => {
    const roleSkills = selectedRoleObj?.skills || [];
    if (resumeSkills.length > 0) {
      const merged = [...roleSkills];
      resumeSkills.forEach((s) => {
        if (!merged.some((m) => m.toLowerCase() === s.toLowerCase())) {
          merged.push(s);
        }
      });
      return merged;
    }
    return roleSkills.length > 0 ? roleSkills : resumeSkills;
  }, [selectedRoleObj, resumeSkills]);

  const storedJd = jobDescription || localStorage.getItem("jobDescription") || "";
  const effectiveJdMatch = jdMatchResult || (() => {
    try {
      const stored = localStorage.getItem("jdMatchResult");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  const startInterview = async () => {
    if (!role) {
      alert("Please select a role");
      return;
    }

    try {
      setLoading(true);
      const resumeText = localStorage.getItem("resumeText") || "";
      const token = localStorage.getItem("token");
      const finalSkills = displayedSkills.length > 0 ? displayedSkills : resumeSkills;

      // Persist the selected role and its associated skills
      localStorage.setItem("role", role);
      localStorage.setItem("skills", JSON.stringify(finalSkills));

      if (selectedInterviewMode === "adaptive") {
        // Start Adaptive Session
        const response = await fetch(`${API_BASE_URL}/adaptive/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            role,
            skills: finalSkills,
            resume_text: resumeText,
            job_description: storedJd,
            max_questions: 10,
            initial_difficulty: "medium",
            personality: localStorage.getItem("interviewer_personality") || "technical",
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          alert(data.message || data.error || "Failed to initialize adaptive session. Please try again.");
          return;
        }

        setInterviewType("adaptive");
        setAdaptiveSession(data.session);
        setAnswers([]);
        localStorage.removeItem("interview_answers");
        localStorage.setItem("interviewType", "adaptive");
        localStorage.setItem("adaptiveSession", JSON.stringify(data.session));
        localStorage.setItem("role", role);

        navigate("/adaptive-interview");
      } else {
        // Standard Interview with 10 questions
        const response = await fetch(`${API_BASE_URL}/generate_questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            skills: finalSkills,
            resume_text: resumeText,
            job_description: storedJd,
            personality: localStorage.getItem("interviewer_personality") || "technical",
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.questions || !Array.isArray(data.questions) || data.questions.length !== 10) {
          alert(data.message || data.error || "Failed to generate questions. Please try again.");
          return;
        }

        setInterviewType("standard");
        setAnswers([]);
        localStorage.removeItem("interview_answers");
        localStorage.setItem("interviewType", "standard");
        localStorage.removeItem("adaptiveSession");
        setQuestions(data.questions);
        localStorage.setItem("role", role);
        localStorage.setItem("questions", JSON.stringify(data.questions));
        localStorage.setItem("standard_questions", JSON.stringify(data.questions));

        navigate("/standard-interview");
      }
    } catch (error) {
      console.error("Interview initialization error:", error);
      alert("Failed to start interview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      step={2}
      title="Select Target Role"
      subtitle="Choose your career track and interview format."
      actions={
        <PageActions>
          <Button variant="secondary" onClick={() => navigate("/upload")}>
            Back
          </Button>
          <Button
            size="lg"
            onClick={startInterview}
            disabled={!role || loading}
            loading={loading}
            icon={IconSparkles}
          >
            {loading ? "Preparing..." : "Start Interview"}
          </Button>
        </PageActions>
      }
    >
      {/* Interview Mode Selector Card */}
      <Card
        title="Interview Format"
        subtitle="Choose how questions are presented"
        icon={IconSparkles}
        style={{ marginBottom: 18 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
          {/* Adaptive Mode Option */}
          <div
            onClick={() => {
              setSelectedInterviewMode("adaptive");
              localStorage.setItem("interviewType", "adaptive");
            }}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              border: `2px solid ${selectedInterviewMode === "adaptive" ? "var(--primary)" : "var(--border-color)"}`,
              background: selectedInterviewMode === "adaptive" ? "var(--bg-selected)" : "var(--bg-surface)",
              boxShadow: selectedInterviewMode === "adaptive" ? "0 4px 14px var(--primary-glow)" : "var(--shadow-card)",
              cursor: "pointer",
              transition: "all 0.22s ease",
            }}
            className="mode-selection-box interactive-card"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: selectedInterviewMode === "adaptive" ? "var(--primary)" : "var(--text-main)" }}>
                🎯 Adaptive AI Mode
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: selectedInterviewMode === "adaptive" ? "var(--primary)" : "var(--primary-light)",
                  color: selectedInterviewMode === "adaptive" ? "#FFFFFF" : "var(--primary)",
                  border: `1px solid ${selectedInterviewMode === "adaptive" ? "var(--primary)" : "var(--primary-border)"}`,
                  padding: "2px 8px",
                  borderRadius: theme.radius.full,
                }}
              >
                Recommended
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              Questions dynamically adjust in difficulty based on your answers.
            </p>
          </div>

          {/* Standard Mode Option */}
          <div
            onClick={() => {
              setSelectedInterviewMode("standard");
              localStorage.setItem("interviewType", "standard");
            }}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              border: `2px solid ${selectedInterviewMode === "standard" ? "var(--primary)" : "var(--border-color)"}`,
              background: selectedInterviewMode === "standard" ? "var(--bg-selected)" : "var(--bg-surface)",
              boxShadow: selectedInterviewMode === "standard" ? "0 4px 14px var(--primary-glow)" : "var(--shadow-card)",
              cursor: "pointer",
              transition: "all 0.22s ease",
            }}
            className="mode-selection-box interactive-card"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: selectedInterviewMode === "standard" ? "var(--primary)" : "var(--text-main)" }}>
                📋 Standard Mode
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: selectedInterviewMode === "standard" ? "var(--primary)" : "var(--primary-light)",
                  color: selectedInterviewMode === "standard" ? "#FFFFFF" : "var(--primary)",
                  border: `1px solid ${selectedInterviewMode === "standard" ? "var(--primary)" : "var(--primary-border)"}`,
                  padding: "2px 8px",
                  borderRadius: theme.radius.full,
                }}
              >
                10 Questions
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              10 structured technical questions answered at your own pace.
            </p>
          </div>
        </div>
      </Card>

      {effectiveJdMatch && (
        <Card style={{ background: "var(--bg-selected)", borderColor: "var(--primary-border)", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  background: theme.gradientPrimary,
                  color: "#FFFFFF",
                  padding: "4px 12px",
                  borderRadius: theme.radius.full,
                  fontSize: 12,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <IconSparkles size={14} />
                JD Match: {effectiveJdMatch.match_score}%
              </span>
              <span style={{ fontSize: 14, color: theme.text, fontWeight: 600 }}>
                Matched against job description ({effectiveJdMatch.matching_skills?.length || 0} skills)
              </span>
            </div>
            <span style={{ fontSize: 13, color: theme.textSecondary }}>
              Questions reflect both role fundamentals and job posting requirements.
            </span>
          </div>
        </Card>
      )}

      {/* Target Roles 12-Card Responsive Grid */}
      <Card
        title="Target Roles"
        subtitle="Select your target career track (12 Professional Tracks Available)"
        icon={IconBriefcase}
      >
        <div className="target-roles-grid">
          {UNIQUE_ROLES.map((roleOption) => {
            const selected = role === roleOption.title;
            return (
              <div
                key={roleOption.title}
                onClick={() => {
                  setRole(roleOption.title);
                  // Immediately synchronize skills for the selected role
                  const roleSkills = roleOption.skills || [];
                  if (resumeSkills.length > 0) {
                    const merged = [...roleSkills];
                    resumeSkills.forEach((s) => {
                      if (!merged.some((m) => m.toLowerCase() === s.toLowerCase())) {
                        merged.push(s);
                      }
                    });
                    localStorage.setItem("skills", JSON.stringify(merged));
                  } else {
                    localStorage.setItem("skills", JSON.stringify(roleSkills));
                  }
                }}
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: `2px solid ${selected ? "var(--primary)" : "var(--border-color)"}`,
                  background: selected ? "var(--bg-selected)" : "var(--bg-card)",
                  boxShadow: selected ? "0 4px 16px var(--primary-glow)" : "var(--shadow-card)",
                  cursor: "pointer",
                  transition: "all 0.22s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  boxSizing: "border-box",
                }}
                className={`role-card interactive-card ${selected ? "selected" : ""}`}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: selected ? "var(--primary)" : "var(--primary-light)",
                        color: selected ? "#FFFFFF" : "var(--primary)",
                        border: `1px solid ${selected ? "var(--primary)" : "var(--primary-border)"}`,
                        padding: "3px 9px",
                        borderRadius: theme.radius.full,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {roleOption.badge}
                    </span>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: `2px solid ${selected ? "var(--primary)" : "var(--border-color)"}`,
                        background: selected ? "var(--primary)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFFFFF" }} />}
                    </div>
                  </div>

                  <h3
                    style={{
                      margin: "0 0 6px 0",
                      fontSize: 16.5,
                      fontWeight: 700,
                      color: selected ? "var(--primary)" : "var(--text-main)",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {roleOption.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {roleOption.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Skills to be Tested Section */}
      {displayedSkills.length > 0 && (
        <Card
          title="Skills to be Tested"
          subtitle={
            selectedRoleObj
              ? `Core technical skills evaluated for ${selectedRoleObj.title}${resumeSkills.length > 0 ? " (enriched from your active resume)" : ""}`
              : "Skills relevant to your interview session"
          }
          icon={IconSparkles}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {displayedSkills.map((skill, index) => (
              <SkillChip key={index} label={skill} />
            ))}
          </div>
        </Card>
      )}

      <style>{`
        .target-roles-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }

        @media (max-width: 1024px) {
          .target-roles-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }
        }

        @media (max-width: 640px) {
          .target-roles-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        .role-card {
          height: 100%;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          box-sizing: border-box;
        }

        .role-card:hover {
          border-color: var(--primary) !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -4px rgba(128, 84, 232, 0.12) !important;
        }

        .mode-selection-box:hover {
          border-color: var(--primary) !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px -4px rgba(128, 84, 232, 0.12) !important;
        }
      `}</style>
    </PageShell>
  );
}

export default SelectRole;
