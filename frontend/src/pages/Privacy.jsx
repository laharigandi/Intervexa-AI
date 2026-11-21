import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconBot, IconArrowRight, IconShield, IconLock, IconCheckCircle } from "../components/Icons";
import ThemeToggle from "../components/ThemeToggle";
import Button from "../components/Button";
import theme from "../styles/theme";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)",
        color: theme.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          borderBottom: `1px solid ${theme.border}`,
          background: "var(--bg-nav)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          padding: "16px clamp(16px, 4vw, 48px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: theme.radius.sm,
              background: theme.gradientPrimary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 2px 10px rgba(113, 56, 245, 0.35)",
            }}
          >
            <IconBot size={22} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em" }}>
            Intervexa <span className="purple-gradient-text">AI</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ThemeToggle size="sm" />
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          maxWidth: 900,
          width: "100%",
          margin: "0 auto",
          padding: "clamp(32px, 5vw, 64px) clamp(16px, 4vw, 32px)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(124, 58, 237, 0.12)",
              color: "var(--primary)",
              padding: "6px 14px",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <IconShield size={16} /> Privacy & Security Guarantee
          </span>
          <span style={{ fontSize: 13, color: theme.muted }}>Last Updated: March 2026</span>
        </div>

        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 38px)",
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: 20,
            letterSpacing: "-0.025em",
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: theme.textSecondary, marginBottom: 36 }}>
          At <strong>Intervexa AI</strong>, your privacy and interview confidentiality are foundational. This policy explains how our AI-powered interview coaching and placement prep platform collects, processes, and safeguards your candidate information.
        </p>

        {/* Highlight Card */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-purple, rgba(124, 58, 237, 0.3))",
            borderRadius: theme.radius.lg,
            padding: "24px 28px",
            marginBottom: 40,
            boxShadow: theme.shadow.sm,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <IconLock size={20} color="var(--primary)" />
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Core Privacy Principles</h3>
          </div>
          <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: theme.textSecondary, lineHeight: 1.8, fontSize: 14.5 }}>
            <li><strong>Local Audio & Video Processing:</strong> Your speech recognition and facial engagement monitoring run entirely within your browser or via secure ephemeral inference. Video feeds are never recorded or stored on any server.</li>
            <li><strong>ATS Resume Confidentiality:</strong> Uploaded resumes are parsed strictly for keyword extraction and skill-gap recommendations. We never sell or share candidate resumes with third parties.</li>
            <li><strong>Zero Tracking for Marketing:</strong> We do not sell your personal interview data to advertisers, recruiters, or data brokers.</li>
          </ul>
        </div>

        {/* Section 1 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>1. Information We Collect</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary, marginBottom: 10 }}>
            To deliver personalized interview evaluations, we collect:
          </p>
          <ul style={{ paddingLeft: 20, color: theme.textSecondary, lineHeight: 1.8, fontSize: 14.5 }}>
            <li><strong>Account Information:</strong> Name, email address, and hashed authentication credentials.</li>
            <li><strong>Resume Details:</strong> Text and skills extracted from uploaded PDF/DOCX resumes for ATS scoring.</li>
            <li><strong>Interview Transcripts:</strong> Spoken or typed responses submitted during mock interviews to compute feedback metrics.</li>
            <li><strong>Performance Analytics:</strong> Aggregate scores such as clarity, technical depth, filler word frequency, and pacing.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>2. How We Use Your Information</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary }}>
            Candidate data is utilized solely to power your AI coaching experience: generating dynamic follow-up questions, creating customized 7-day study roadmaps, and providing actionable feedback for improvement.
          </p>
        </section>

        {/* Section 3 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>3. Data Retention & Deletion</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary }}>
            You maintain full ownership of your interview history. You can reset interview attempts, delete resumes, or request full profile deletion at any time from your Profile settings or by contacting our team.
          </p>
        </section>

        {/* Section 4 */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>4. Contact Us</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary }}>
            If you have questions regarding this Privacy Policy or your data, reach out directly to:{" "}
            <a href="mailto:support@intervexa.ai" style={{ color: "var(--primary)", fontWeight: 600 }}>
              support@intervexa.ai
            </a>
          </p>
        </section>

        <div style={{ paddingTop: 20, borderTop: `1px solid ${theme.border}` }}>
          <Button onClick={() => navigate("/")} icon={IconArrowRight}>
            Back to Home
          </Button>
        </div>
      </main>
    </div>
  );
}

