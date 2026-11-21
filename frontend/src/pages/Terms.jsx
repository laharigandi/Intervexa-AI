import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconBot, IconArrowRight, IconShield, IconCheckCircle } from "../components/Icons";
import ThemeToggle from "../components/ThemeToggle";
import Button from "../components/Button";
import theme from "../styles/theme";

export default function Terms() {
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
            <IconShield size={16} /> User Agreement
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: theme.textSecondary, marginBottom: 36 }}>
          Welcome to <strong>Intervexa AI – Smart Interview Coach & Placement Prep</strong>. By using our application, websites, and AI evaluation services, you agree to comply with and be bound by the following Terms of Service.
        </p>

        {/* Section 1 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>1. Purpose & Educational Use</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary }}>
            Intervexa AI provides automated interview coaching, speech analysis, ATS resume evaluation, and study plans for educational and career preparation purposes. While our AI evaluation algorithms simulate industry interview standards, mock interview results do not guarantee employment or hiring offers from external employers.
          </p>
        </section>

        {/* Section 2 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>2. User Conduct & Security</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary }}>
            You agree to use the platform ethically. You may not attempt to reverse engineer AI scoring algorithms, upload malicious or harmful payloads within resume files, or abuse API endpoints beyond reasonable mock interview practice limits.
          </p>
        </section>

        {/* Section 3 */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>3. AI Generated Feedback</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary }}>
            Our adaptive questions, scoring models, and career insights are powered by Large Language Models and specialized evaluators. Feedback is intended to assist candidates in identifying blind spots, refining communication clarity, and improving technical precision.
          </p>
        </section>

        {/* Section 4 */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>4. Inquiries & Support</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.textSecondary }}>
            For enterprise inquiries, career partnership opportunities, or service questions, please contact{" "}
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

