import { useNavigate, Link } from "react-router-dom";
import { useContext, useState, useRef, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { InterviewContext } from "../context/InterviewContext";
import Button from "../components/Button";
import ThemeToggle from "../components/ThemeToggle";
import LiveSessionPreview from "../components/LiveSessionPreview";
import CursorFollowGlow from "../components/CursorFollowGlow";
import Footer from "../components/Footer";
import theme from "../styles/theme";
import {
  IconUpload,
  IconInterview,
  IconSparkles,
  IconAward,
  IconLearning,
  IconArrowRight,
  IconBriefcase,
  IconBot,
  IconCheckCircle,
  IconVolume2,
  IconMic,
  IconZap,
  IconTarget,
  IconShield,
  IconMenu,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconPlay,
  IconPause,
  IconCode,
  IconSettings,
  IconTrendingUp,
} from "../components/Icons";

const FEATURES = [
  {
    title: "ATS Resume Analysis",
    desc: "Evaluate resume keyword alignment, identify detected technical skills, and review ATS suggestions.",
    icon: IconUpload,
    tag: "Resume",
    badgeType: "success",
  },
  {
    title: "Technical Question Generation",
    desc: "Targeted technical challenges for Full Stack, ML/AI, Python, Cloud, and Data roles.",
    icon: IconBriefcase,
    tag: "Technical",
    badgeType: "primary",
  },
  {
    title: "Real-Time Speech Recognition",
    desc: "Practice answering verbally with live speech-to-text transcription.",
    icon: IconMic,
    tag: "Voice",
    badgeType: "accent",
  },
  {
    title: "Adaptive Difficulty",
    desc: "Questions calibrate dynamically (Easy, Medium, Hard) based on your answer depth.",
    icon: IconZap,
    tag: "Adaptive",
    badgeType: "warning",
  },
  {
    title: "Scoring & Model Answers",
    desc: "Detailed evaluation on technical accuracy and communication structure with model answers.",
    icon: IconAward,
    tag: "Evaluation",
    badgeType: "success",
  },
  {
    title: "Targeted Learning Roadmaps",
    desc: "Curated learning resources and tutorials mapped directly to identified skill gaps.",
    icon: IconLearning,
    tag: "Roadmaps",
    badgeType: "primary",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Upload Resume & Job Description",
    desc: "Upload a PDF resume to analyze ATS alignment and match job descriptions.",
    icon: IconUpload,
  },
  {
    num: "02",
    title: "Select Role & Interview Mode",
    desc: "Choose your career track and select standard or adaptive interview mode.",
    icon: IconTarget,
  },
  {
    num: "03",
    title: "Practice Mock Interview",
    desc: "Answer prompts in a focused environment with optional camera preview and voice input.",
    icon: IconInterview,
  },
  {
    num: "04",
    title: "Review Results & Report",
    desc: "Examine detailed scoring, download a PDF report, and view study recommendations.",
    icon: IconAward,
  },
];

const POPULAR_TRACKS = [
  { role: "Full Stack Developer", icon: IconCode },
  { role: "Frontend Developer", icon: IconCode },
  { role: "Backend Developer", icon: IconSettings },
  { role: "Java Developer", icon: IconZap },
  { role: "Machine Learning Engineer", icon: IconBot },
  { role: "Software Developer", icon: IconSettings },
  { role: "Python Developer", icon: IconZap },
  { role: "Cloud & DevOps", icon: IconShield },
  { role: "Data Scientist", icon: IconTarget },
  { role: "Data Analyst", icon: IconTrendingUp },
  { role: "Software Test Engineer", icon: IconCheckCircle },
];

function Home() {
  const navigate = useNavigate();
  const { user, token, isAuthLoading, isAuthenticated } = useContext(AuthContext);
  const { setRole } = useContext(InterviewContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Practice tracks carousel state
  const carouselViewportRef = useRef(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const pauseTimeoutRef = useRef(null);

  // Pause carousel when document is hidden to conserve GPU/CPU resources
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Lock body scroll and listen for Escape key when mobile menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleManualNudge = (direction) => {
    if (carouselViewportRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      carouselViewportRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      setCarouselPaused(true);
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => {
        setCarouselPaused(false);
      }, 3500);
    }
  };

  const handleRoleSelect = (roleName) => {
    if (setRole) setRole(roleName);
    localStorage.setItem("role", roleName);
    navigate("/role");
  };

  const renderTrackCard = (t, index, isDuplicate = false) => {
    const Icon = t.icon || IconBriefcase;
    return (
      <div
        key={`${t.role}-${isDuplicate ? "dup" : "orig"}-${index}`}
        className="practice-track-card"
        onClick={() => handleRoleSelect(t.role)}
        tabIndex={isDuplicate ? -1 : 0}
        role="button"
        aria-label={`Practice ${t.role}`}
        onKeyDown={(e) => {
          if (!isDuplicate && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleRoleSelect(t.role);
          }
        }}
      >
        <span className="practice-track-icon">
          <Icon size={18} />
        </span>
        <span className="practice-track-title">
          {t.role}
        </span>
      </div>
    );
  };

  const handleGetStarted = () => {
    navigate("/signup");
  };

  const handleSignIn = () => {
    navigate("/login");
  };

  const handleStartInterview = () => {
    if (isAuthenticated) {
      navigate("/interview");
    } else {
      navigate("/login");
    }
  };

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--bg-main)",
        color: theme.text,
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* FLOATING PILL NAVBAR - Scaled Full-Width Container */}
      <div
        className="home-navbar-container"
        style={{
          position: "sticky",
          top: 18,
          zIndex: 1000,
          display: "flex",
          justifyContent: "center",
          padding: "0 clamp(16px, 3vw, 40px)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <header
          className="navbar-entrance home-header-pill"
          style={{
            width: "100%",
            maxWidth: 1420,
            minHeight: 78,
            background: "var(--bg-nav)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.full,
            boxShadow: theme.shadow.pill,
            padding: "12px clamp(20px, 2.5vw, 36px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxSizing: "border-box",
            transition: "all 0.25s ease",
          }}
        >
          {/* Brand Logo & Name */}
          <Link
            to="/"
            className="home-brand-link"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "inherit",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                background: theme.gradientPrimary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 14px rgba(113, 56, 245, 0.35)",
                flexShrink: 0,
                transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="navbar-brand-icon home-brand-icon"
            >
              <IconBot size={24} />
            </div>
            <span
              className="home-brand-title"
              style={{
                fontWeight: 800,
                fontSize: "clamp(19px, 1.8vw, 22px)",
                letterSpacing: "-0.025em",
                color: theme.text,
                whiteSpace: "nowrap",
              }}
            >
              Intervexa <span className="purple-gradient-text">AI</span>
            </span>
          </Link>

          {/* Center Navigation Links */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
            className="home-nav-links"
          >
            <button
              onClick={() => scrollToSection("features")}
              className="nav-link-btn"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("workflow")}
              className="nav-link-btn"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("tracks")}
              className="nav-link-btn"
            >
              Practice Tracks
            </button>
            <button
              onClick={() => scrollToSection("demo")}
              className="nav-link-btn"
            >
              AI Demo
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="home-right-cluster" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="home-theme-toggle-desktop">
              <ThemeToggle size="sm" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="nav-desktop-actions">
              <Button
                variant="secondary"
                size="md"
                pill
                onClick={handleSignIn}
                style={{
                  padding: "9px 20px",
                  fontSize: 14.5,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
                className="nav-signin-btn"
              >
                Sign In
              </Button>
              <Button
                size="md"
                pill
                onClick={handleGetStarted}
                icon={IconArrowRight}
                style={{
                  padding: "9px 22px",
                  fontSize: 14.5,
                  fontWeight: 700,
                  boxShadow: "0 4px 14px var(--primary-glow)",
                  whiteSpace: "nowrap",
                }}
                className="nav-getstarted-btn"
              >
                Get Started
              </Button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              style={{
                width: 42,
                height: 42,
                borderRadius: theme.radius.sm,
                background: "var(--bg-surface)",
                border: `1px solid ${theme.border}`,
                color: theme.text,
                cursor: "pointer",
                padding: 0,
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.18s ease",
                boxShadow: theme.shadow.sm,
              }}
              className="home-mobile-toggle"
            >
              {mobileMenuOpen ? <IconX size={22} /> : <IconMenu size={22} />}
            </button>
          </div>
        </header>
      </div>

      {/* Mobile Drawer & Backdrop */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(11, 17, 32, 0.6)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 10001,
            }}
          />
          <div
            className="home-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
            style={{
              position: "fixed",
              top: 80,
              left: 14,
              right: 14,
              maxWidth: 480,
              maxHeight: "calc(100vh - 100px)",
              overflowY: "auto",
              margin: "0 auto",
              background: "var(--bg-surface)",
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.borderPurple}`,
              boxShadow: theme.shadow.elevated,
              padding: "20px 22px",
              zIndex: 10002,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              animation: "modalFadeIn 0.2s ease-out",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: theme.textSecondary }}>Appearance</span>
                <ThemeToggle size="sm" />
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 6,
                  color: theme.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: theme.radius.sm,
                }}
              >
                <IconX size={20} />
              </button>
            </div>
            <button
              onClick={() => scrollToSection("features")}
              className="mobile-nav-link"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("workflow")}
              className="mobile-nav-link"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("tracks")}
              className="mobile-nav-link"
            >
              Practice Tracks
            </button>
            <button
              onClick={() => scrollToSection("demo")}
              className="mobile-nav-link"
            >
              AI Demo
            </button>
            <div style={{ height: 1, background: theme.border, margin: "4px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              <Button
                variant="secondary"
                size="md"
                pill
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignIn();
                }}
                style={{
                  width: "100%",
                  padding: "10px 20px",
                  fontSize: 14.5,
                  fontWeight: 600,
                  justifyContent: "center",
                }}
                className="nav-mobile-signin-btn"
              >
                Sign In
              </Button>
              <Button
                size="md"
                pill
                icon={IconArrowRight}
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleGetStarted();
                }}
                style={{
                  width: "100%",
                  padding: "10px 22px",
                  fontSize: 14.5,
                  fontWeight: 700,
                  boxShadow: "0 4px 14px var(--primary-glow)",
                  justifyContent: "center",
                }}
                className="nav-mobile-getstarted-btn"
              >
                Get Started
              </Button>
            </div>
          </div>
        </>
      )}

      {/* HERO SECTION - Full-Width Canvas with Soft Lavender Ambient Glow */}
      <section
        style={{
          position: "relative",
          textAlign: "center",
          padding: "clamp(64px, 8vw, 108px) clamp(16px, 3.5vw, 48px) clamp(44px, 5vw, 68px)",
          maxWidth: 1440,
          margin: "0 auto",
          overflow: "visible",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Soft Lavender Background Glow Accent & Interactive Cursor Tracker */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: 1100,
            height: 480,
            background: "radial-gradient(circle, rgba(150, 60, 250, 0.16) 0%, rgba(113, 56, 245, 0.08) 45%, transparent 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <CursorFollowGlow />

        <div style={{ position: "relative", zIndex: 1 }} className="animate-slide-up">
          {/* Pill Badge */}
          <div
            className="stagger-1"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 18px",
              borderRadius: theme.radius.full,
              background: "var(--bg-selected)",
              color: theme.primary,
              border: `1px solid ${theme.primaryBorder}`,
              fontSize: 12.5,
              fontWeight: 700,
              boxShadow: "0 2px 8px var(--primary-glow)",
              marginBottom: 22,
            }}
          >
            <IconSparkles size={16} />
            <span>AI Interview Preparation Platform</span>
          </div>

          {/* Hero Heading with selective purple gradient */}
          <h1
            className="stagger-2"
            style={{
              fontSize: "clamp(34px, 5.2vw, 62px)",
              fontWeight: 800,
              color: theme.text,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              maxWidth: 960,
              margin: "0 auto 20px",
            }}
          >
            Ace Your Next Tech Interview with{" "}
            <span className="purple-gradient-text">AI Practice & Coaching</span>
          </h1>

          {/* Subtitle */}
          <p
            className="stagger-3"
            style={{
              fontSize: "clamp(16px, 1.8vw, 19px)",
              color: theme.textSecondary,
              maxWidth: 720,
              margin: "0 auto 34px",
              lineHeight: 1.6,
            }}
          >
            Practice role-specific technical questions, speak your answers with live voice transcription, and receive instant AI evaluation with actionable feedback.
          </p>

          {/* CTA Buttons */}
          <div
            className="stagger-4"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 36,
            }}
          >
            <Button
              size="lg"
              pill
              onClick={handleStartInterview}
              icon={IconArrowRight}
              style={{
                padding: "14px 30px",
                fontSize: 16,
                fontWeight: 700,
                boxShadow: "0 6px 20px var(--primary-glow)",
              }}
            >
              Start Free Interview
            </Button>
            <Button
              size="lg"
              variant="secondary"
              pill
              onClick={() => scrollToSection("demo")}
              icon={IconSparkles}
              style={{
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Explore AI Demo
            </Button>
          </div>

          {/* Platform Capability Highlights */}
          <div
            className="stagger-5"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 24,
              flexWrap: "wrap",
              fontSize: 13.5,
              fontWeight: 600,
              color: theme.textSecondary,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconCheckCircle size={16} color={theme.success} /> Real-Time Technical Scoring
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconShield size={16} color={theme.primary} /> 100% Local Privacy (No Media Saved)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconCheckCircle size={16} color={theme.success} /> Adaptive & Voice Input Modes
            </span>
          </div>
        </div>
      </section>

      {/* DEDICATED AI INTERVIEW DEMO SECTION */}
      <section
        id="demo"
        style={{
          padding: "clamp(48px, 6vw, 84px) clamp(16px, 3.5vw, 48px)",
          maxWidth: 1440,
          margin: "0 auto",
          textAlign: "center",
          width: "100%",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div style={{ marginBottom: 30 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              borderRadius: theme.radius.full,
              background: "var(--bg-selected)",
              color: theme.primary,
              border: `1px solid ${theme.primaryBorder}`,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            <IconSparkles size={14} />
            <span>Interactive AI Showcase</span>
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 3.5vw, 40px)",
              fontWeight: 800,
              color: theme.text,
              letterSpacing: "-0.025em",
              marginBottom: 10,
            }}
          >
            Experience the AI Interview
          </h2>
          <p
            style={{
              fontSize: "clamp(15px, 1.6vw, 17px)",
              color: theme.textSecondary,
              maxWidth: 680,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Explore how our AI-powered interview system evaluates answers and adapts to your performance.
          </p>
        </div>

        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            width: "100%",
          }}
          className="animate-slide-up"
        >
          <LiveSessionPreview />
        </div>
      </section>

      {/* FEATURES SECTION - Fluid Grid spanning up to 1420px */}
      <section
        id="features"
        style={{
          padding: "clamp(40px, 5vw, 60px) clamp(16px, 3.5vw, 48px)",
          maxWidth: 1440,
          margin: "0 auto",
          textAlign: "center",
          width: "100%",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <CursorFollowGlow />
        <div style={{ marginBottom: 26, position: "relative", zIndex: 1 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 34px)",
              fontWeight: 800,
              color: theme.text,
              letterSpacing: "-0.025em",
              marginBottom: 8,
            }}
          >
            Platform Features
          </h2>
          <p style={{ fontSize: 14.5, color: theme.textSecondary, maxWidth: 600, margin: "0 auto", lineHeight: 1.5 }}>
            Core tools to practice technical questions, speak your responses, and identify skill gaps.
          </p>
        </div>

        <div className="features-grid-3x2">
          {FEATURES.map((feat, index) => {
            const Icon = feat.icon;
            const b = { bg: "var(--primary-light)", text: "var(--primary)", border: "var(--primary-border)" };

            return (
              <div
                key={feat.title}
                className={`platform-feature-card stagger-${(index % 6) + 1}`}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 16,
                    }}
                  >
                    <div className="feature-icon-badge">
                      <Icon size={20} />
                    </div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: b.bg,
                        color: b.text,
                        border: `1px solid ${b.border}`,
                        padding: "3.5px 11px",
                        borderRadius: theme.radius.full,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {feat.tag}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: theme.text,
                      marginBottom: 8,
                      letterSpacing: "-0.015em",
                      lineHeight: 1.35,
                    }}
                  >
                    {feat.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: theme.textSecondary,
                      lineHeight: 1.55,
                    }}
                  >
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* WORKFLOW SECTION - Fluid 4-Step Pipeline */}
      <section
        id="workflow"
        style={{
          padding: "clamp(40px, 5vw, 60px) clamp(16px, 3.5vw, 48px)",
          background: "var(--bg-secondary)",
          borderTop: `1px solid ${theme.border}`,
          borderBottom: `1px solid ${theme.border}`,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}>
          <div style={{ marginBottom: 26 }}>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 34px)",
                fontWeight: 800,
                color: theme.text,
                letterSpacing: "-0.025em",
                marginBottom: 8,
              }}
            >
              How It Works
            </h2>
            <p style={{ fontSize: 14.5, color: theme.textSecondary, maxWidth: 600, margin: "0 auto", lineHeight: 1.5 }}>
              A 4-step workflow from resume parsing to comprehensive interview evaluation.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              textAlign: "left",
            }}
          >
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="interactive-card"
                  style={{
                    background: "var(--bg-surface)",
                    borderRadius: theme.radius.md,
                    padding: "20px 22px",
                    border: `1px solid ${theme.border}`,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: theme.radius.sm,
                        background: theme.gradientPrimary,
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 6px var(--primary-glow)",
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: theme.primary,
                        opacity: 0.8,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {step.num}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
                    {step.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, color: theme.textSecondary, lineHeight: 1.5 }}>
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRACTICE TRACKS SECTION - Horizontal Auto-Moving Carousel */}
      <section
        id="tracks"
        style={{
          padding: "clamp(36px, 4.5vw, 56px) 0",
          width: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto 20px",
            padding: "0 clamp(16px, 3.5vw, 40px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div style={{ textAlign: "left", maxWidth: 620 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: theme.primary,
                background: theme.primaryLight,
                border: `1px solid ${theme.primaryBorder}`,
                padding: "3px 12px",
                borderRadius: theme.radius.full,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "inline-block",
                marginBottom: 10,
              }}
            >
              8 Practice Tracks
            </span>
            <h2
              style={{
                fontSize: "clamp(24px, 3.2vw, 36px)",
                fontWeight: 800,
                color: theme.text,
                letterSpacing: "-0.02em",
                margin: "0 0 10px 0",
              }}
            >
              Practice Tracks
            </h2>
            <p style={{ fontSize: 15, color: theme.textSecondary, margin: 0, lineHeight: 1.6 }}>
              Technical question sets designed for campus placements and engineering interviews. Hover over any card to pause scrolling.
            </p>
          </div>

          {/* Carousel Navigation Controls (Prev / Play-Pause / Next) */}
          <div className="practice-carousel-ctrls">
            <button
              type="button"
              className="practice-carousel-nav-btn"
              onClick={() => handleManualNudge("left")}
              aria-label="Previous tracks"
              title="Previous tracks"
            >
              <IconChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="practice-carousel-nav-btn"
              onClick={() => setCarouselPaused((prev) => !prev)}
              aria-label={carouselPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
              title={carouselPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
            >
              {carouselPaused ? <IconPlay size={15} /> : <IconPause size={15} />}
            </button>
            <button
              type="button"
              className="practice-carousel-nav-btn"
              onClick={() => handleManualNudge("right")}
              aria-label="Next tracks"
              title="Next tracks"
            >
              <IconChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Carousel Viewport Container with Edge Masks */}
        <div className="practice-carousel-container">
          <div
            ref={carouselViewportRef}
            className="practice-carousel-viewport"
            aria-label="Practice tracks carousel"
          >
            <div
              className={`practice-carousel-track ${carouselPaused || isTabHidden ? "is-paused" : ""}`}
            >
              {/* Group 1: Primary accessible cards */}
              <div className="practice-carousel-group">
                {POPULAR_TRACKS.map((t, idx) => renderTrackCard(t, idx, false))}
              </div>

              {/* Group 2: Seamless loop duplicates (hidden from screen readers to prevent duplicate announcements) */}
              <div className="practice-carousel-group" aria-hidden="true">
                {POPULAR_TRACKS.map((t, idx) => renderTrackCard(t, idx, true))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION - Wide Deep Gradient Banner */}
      <section
        style={{
          padding: "10px clamp(16px, 3.5vw, 40px) clamp(50px, 7vw, 80px)",
          maxWidth: 1280,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #110E2E 0%, #2E1065 50%, #4C1D95 100%)",
            borderRadius: theme.radius.lg,
            padding: "clamp(36px, 5vw, 60px) clamp(20px, 4vw, 48px)",
            textAlign: "center",
            color: "#FFFFFF",
            boxShadow: "0 20px 48px -10px rgba(76, 29, 149, 0.35)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -80,
              width: 280,
              height: 280,
              background: "rgba(167, 139, 250, 0.25)",
              borderRadius: "50%",
              filter: "blur(60px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -60,
              left: -60,
              width: 240,
              height: 240,
              background: "rgba(113, 56, 245, 0.25)",
              borderRadius: "50%",
              filter: "blur(50px)",
            }}
          />
          <h2
            style={{
              fontSize: "clamp(26px, 3.8vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              marginBottom: 12,
              position: "relative",
              zIndex: 1,
            }}
          >
            Start Preparing for Your Next Interview
          </h2>
          <p
            style={{
              fontSize: "clamp(14px, 1.5vw, 16px)",
              color: "#C7D2FE",
              maxWidth: 580,
              margin: "0 auto 28px",
              lineHeight: 1.6,
              position: "relative",
              zIndex: 1,
            }}
          >
            Upload your resume, select your target role, and get actionable AI evaluation in minutes.
          </p>
          <div style={{ position: "relative", zIndex: 1 }}>
            <Button
              size="lg"
              pill
              style={{
                background: "#FFFFFF",
                color: "#4C1D95",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
                border: "none",
                fontWeight: 700,
              }}
              onClick={handleStartInterview}
              icon={IconArrowRight}
            >
              Start Interview
            </Button>
          </div>
        </div>
      </section>

      {/* PROFESSIONAL MULTI-COLUMN FOOTER */}
      <Footer />

      <style>{`
        .nav-link-btn:hover {
          color: var(--primary) !important;
        }
        .nav-login-link:hover {
          color: var(--primary) !important;
          background: var(--primary-light) !important;
        }
      `}</style>
    </div>
  );
}

export default Home;
