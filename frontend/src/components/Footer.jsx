import React, { useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { InterviewContext } from "../context/InterviewContext";
import {
  IconBot,
  IconGithub,
  IconLinkedin,
  IconTwitter,
  IconMail,
} from "./Icons";

function Footer() {
  const location = useLocation();
  const navigate = useNavigate();
  const interviewContext = useContext(InterviewContext);
  const setRole = interviewContext?.setRole;

  const handleScrollToSection = (sectionId, e) => {
    e?.preventDefault();
    if (location.pathname === "/") {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate("/");
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  const handleRoleSelect = (roleName, e) => {
    e?.preventDefault();
    if (setRole) setRole(roleName);
    try {
      localStorage.setItem("role", roleName);
    } catch {}
    navigate("/role");
  };

  const handleOpenAiAssistant = (e) => {
    e?.preventDefault();
    window.dispatchEvent(new CustomEvent("intervexa-open-chatbot"));
  };

  return (
    <footer
      className="intervexa-footer"
      style={{
        width: "100%",
        background: "#091833",
        color: "#94A3B8",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        position: "relative",
        boxSizing: "border-box",
        fontFamily: "inherit",
        zIndex: 20,
      }}
    >
      <div
        className="footer-content-wrap"
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "clamp(48px, 6vw, 72px) clamp(20px, 4vw, 64px) 32px",
          boxSizing: "border-box",
        }}
      >
        {/* Main 5-Column Grid */}
        <div className="footer-columns-grid">
          {/* COLUMN 1: Intervexa AI Branding */}
          <div className="footer-column branding-col">
            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #7C3AED 0%, #9061F9 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  flexShrink: 0,
                }}
              >
                <IconBot size={22} />
              </div>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: "-0.025em",
                  color: "#FFFFFF",
                }}
              >
                Intervexa <span className="purple-gradient-text">AI</span>
              </span>
            </Link>

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: "#94A3B8",
                margin: "0 0 22px 0",
                maxWidth: 320,
              }}
            >
              Practice smarter. Prepare confidently. Ace your next interview with AI-powered interview coaching.
            </p>

            {/* Social Media Links */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="footer-social-links">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Repository"
                className="footer-social-btn"
              >
                <IconGithub size={17} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn Page"
                className="footer-social-btn"
              >
                <IconLinkedin size={17} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter / X Profile"
                className="footer-social-btn"
              >
                <IconTwitter size={17} />
              </a>
              <a
                href="mailto:support@intervexa.ai"
                aria-label="Email Support"
                className="footer-social-btn"
              >
                <IconMail size={17} />
              </a>
            </div>
          </div>

          {/* COLUMN 2: PRODUCT */}
          <div className="footer-column">
            <h4 className="footer-heading">Product</h4>
            <ul className="footer-links-list">
              <li>
                <a
                  href="#workflow"
                  onClick={(e) => handleScrollToSection("workflow", e)}
                  className="footer-link"
                >
                  How It Works
                </a>
              </li>
              <li>
                <Link to="/upload" className="footer-link">
                  Resume Analysis
                </Link>
              </li>
              <li>
                <Link to="/standard-interview" className="footer-link">
                  Standard Interview
                </Link>
              </li>
              <li>
                <Link to="/adaptive-interview" className="footer-link">
                  Adaptive Interview
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={handleOpenAiAssistant}
                  className="footer-link footer-link-btn"
                  title="Open AI Career Assistant"
                >
                  AI Interview Assistant
                </button>
              </li>
              <li>
                <Link to="/results" className="footer-link">
                  Interview Results
                </Link>
              </li>
              <li>
                <Link to="/learning" className="footer-link">
                  Study Planner
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: PRACTICE BY ROLE */}
          <div className="footer-column">
            <h4 className="footer-heading">Practice By Role</h4>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Full Stack Developer", e)}
                  className="footer-link footer-link-btn"
                >
                  Full Stack Developer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Frontend Developer", e)}
                  className="footer-link footer-link-btn"
                >
                  Frontend Developer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Backend Developer", e)}
                  className="footer-link footer-link-btn"
                >
                  Backend Developer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Machine Learning Engineer", e)}
                  className="footer-link footer-link-btn"
                >
                  Machine Learning Engineer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Python Developer", e)}
                  className="footer-link footer-link-btn"
                >
                  Python Developer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Java Developer", e)}
                  className="footer-link footer-link-btn"
                >
                  Java Developer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Data Analyst", e)}
                  className="footer-link footer-link-btn"
                >
                  Data Analyst
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => handleRoleSelect("Software Engineer", e)}
                  className="footer-link footer-link-btn"
                >
                  Software Engineer
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: INTERVIEW PREPARATION */}
          <div className="footer-column">
            <h4 className="footer-heading">Interview Preparation</h4>
            <ul className="footer-links-list">
              <li>
                <Link to="/standard-interview" className="footer-link">
                  Technical Interview
                </Link>
              </li>
              <li>
                <Link to="/adaptive-interview" className="footer-link">
                  HR Interview
                </Link>
              </li>
              <li>
                <Link to="/learning" className="footer-link">
                  Coding Practice
                </Link>
              </li>
              <li>
                <a
                  href="#features"
                  onClick={(e) => handleScrollToSection("features", e)}
                  className="footer-link"
                >
                  Communication Skills
                </a>
              </li>
              <li>
                <Link to="/results" className="footer-link">
                  AI Interview Evaluation
                </Link>
              </li>
              <li>
                <Link to="/learning" className="footer-link">
                  Learning Resources
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 5: COMPANY */}
          <div className="footer-column">
            <h4 className="footer-heading">Company</h4>
            <ul className="footer-links-list">
              <li>
                <a
                  href="#features"
                  onClick={(e) => handleScrollToSection("features", e)}
                  className="footer-link"
                >
                  About Intervexa AI
                </a>
              </li>
              <li>
                <a href="mailto:support@intervexa.ai" className="footer-link">
                  Contact
                </a>
              </li>
              <li>
                <Link to="/privacy" className="footer-link">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="footer-link">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/login" className="footer-link">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/signup" className="footer-link">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Subtle Horizontal Divider */}
        <div
          style={{
            height: 1,
            background: "rgba(255, 255, 255, 0.08)",
            margin: "44px 0 28px 0",
          }}
        />

        {/* Footer Bottom Section: Copyright & Legal */}
        <div className="footer-bottom-row">
          <div className="footer-copyright">
            © {new Date().getFullYear()} Intervexa AI. All rights reserved.
          </div>
          <div className="footer-legal-links">
            <Link to="/privacy" className="footer-legal-link">
              Privacy Policy
            </Link>
            <span style={{ color: "rgba(255, 255, 255, 0.2)", fontSize: 12 }}>•</span>
            <Link to="/terms" className="footer-legal-link">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Embedded Component Scoped Styles */}
      <style>{`
        .intervexa-footer {
          --footer-bg: #091833;
          --footer-text: #94A3B8;
          --footer-heading: #FFFFFF;
          --footer-link: #94A3B8;
          --footer-link-hover: #FFFFFF;
          --footer-accent: #A78BFA;
        }

        .footer-columns-grid {
          display: grid;
          grid-template-columns: 1.8fr 1fr 1.15fr 1.15fr 0.95fr;
          gap: clamp(24px, 3.5vw, 48px);
          align-items: flex-start;
        }

        .footer-column {
          display: flex;
          flex-direction: column;
        }

        .footer-heading {
          color: var(--footer-heading);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 18px 0;
          white-space: nowrap;
        }

        .footer-links-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .footer-link {
          color: var(--footer-link);
          text-decoration: none;
          font-size: 14px;
          line-height: 1.45;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
        }

        .footer-link:hover {
          color: var(--footer-link-hover) !important;
          transform: translateX(2px);
        }

        .footer-link-btn {
          background: transparent;
          border: none;
          padding: 0;
          font-family: inherit;
          text-align: left;
        }

        .footer-social-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #CBD5E1;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .footer-social-btn:hover {
          background: rgba(124, 58, 237, 0.3);
          border-color: rgba(139, 92, 246, 0.5);
          color: #FFFFFF;
          transform: translateY(-2px);
        }

        .footer-bottom-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 13.5px;
          color: #64748B;
        }

        .footer-copyright {
          color: #94A3B8;
          font-size: 13.5px;
        }

        .footer-legal-links {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .footer-legal-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 13.5px;
          transition: color 0.2s ease;
        }

        .footer-legal-link:hover {
          color: #FFFFFF;
          text-decoration: underline;
        }

        /* Tablet Responsive (768px – 1023px) */
        @media (max-width: 1023px) and (min-width: 768px) {
          .footer-columns-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 36px 28px;
          }
          .footer-column.branding-col {
            grid-column: span 3;
            max-width: 100%;
            margin-bottom: 8px;
          }
          .footer-column.branding-col p {
            max-width: 520px;
          }
        }

        /* Mobile Responsive (<= 767px) */
        @media (max-width: 767px) {
          .footer-columns-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 32px 20px;
          }
          .footer-column.branding-col {
            grid-column: span 2;
            margin-bottom: 12px;
          }
          .footer-column.branding-col p {
            max-width: 100%;
          }
          .footer-bottom-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 14px;
          }
        }

        /* Small Mobile (<= 374px, iPhone SE / 320px) */
        @media (max-width: 374px) {
          .footer-content-wrap {
            padding: 40px 14px 28px !important;
          }
          .footer-columns-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .footer-column.branding-col {
            grid-column: span 1;
          }
          .footer-link {
            font-size: 13.5px;
            padding: 2px 0;
          }
          .footer-heading {
            margin-bottom: 12px;
          }
        }
      `}</style>
    </footer>
  );
}

export default Footer;
