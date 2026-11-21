import React, { useState, useContext, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import theme from "../styles/theme";
import { AuthContext } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import {
  IconBot,
  IconMenu,
  IconLogOut,
  IconChevronDown,
  IconUser,
} from "./Icons";

function Navbar({ onToggleSidebar, sidebarOpen = false }) {
  const navigate = useNavigate();
  const { user, token, logout } = useContext(AuthContext);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fallback to localStorage user if context user is temporarily unset but token exists
  const effectiveUser = user || (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined" || stored === "null") return null;
      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  })();

  const isAuthenticated = Boolean(token || localStorage.getItem("token"));

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate("/");
  };

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const getUserInitials = () => {
    if (!effectiveUser?.name) return "U";
    return effectiveUser.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <header
      style={{
        height: theme.navbarHeight,
        background: "var(--bg-header, var(--bg-nav))",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${theme.border}`,
        position: "sticky",
        top: 0,
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(16px, 2.5vw, 36px)",
        boxSizing: "border-box",
        width: "100%",
        boxShadow: "var(--shadow-sm)",
        transition: "background-color 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* LEFT: Logo & Mobile Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Hamburger Menu button for mobile/tablet */}
        {onToggleSidebar && (
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={onToggleSidebar}
            style={{
              background: "var(--bg-header, var(--bg-surface))",
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              width: 40,
              height: 40,
              cursor: "pointer",
              color: theme.textSecondary,
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.18s ease",
              padding: 0,
            }}
            className="navbar-hamburger"
          >
            <IconMenu size={20} />
          </button>
        )}

        {/* Brand Logo & Name */}
        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          className="navbar-brand-link"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: theme.radius.sm,
              background: theme.gradientPrimary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 3px 12px rgba(124, 58, 237, 0.35)",
              transition: "transform 0.2s ease",
              flexShrink: 0,
            }}
            className="navbar-brand-icon"
          >
            <IconBot size={22} />
          </div>
          <span
            className="navbar-brand-text"
            style={{
              fontWeight: 800,
              fontSize: "clamp(18px, 1.8vw, 21px)",
              color: theme.text,
              letterSpacing: "-0.025em",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span>Intervexa</span>
            <span className="purple-gradient-text">AI</span>
          </span>
        </Link>
      </div>

      {/* RIGHT: Theme Toggle & Profile info / Auth Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* LIGHT / DARK THEME TOGGLE */}
        <ThemeToggle />

        {isAuthenticated ? (
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--bg-surface)",
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.full,
                padding: "5px 16px 5px 6px",
                cursor: "pointer",
                transition: "all 0.18s ease",
              }}
              className="navbar-profile-btn"
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: theme.gradientPrimary,
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 12.5,
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                {getUserInitials()}
              </div>
              <span
                className="navbar-profile-name"
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: theme.text,
                  maxWidth: 140,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {effectiveUser?.name || "Candidate"}
              </span>
              <span className="navbar-chevron-down" style={{ display: "inline-flex", alignItems: "center" }}>
                <IconChevronDown
                  size={14}
                  color={theme.muted}
                  style={{
                    transform: dropdownOpen ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </span>
            </button>

            {/* Profile Dropdown Menu */}
            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 220,
                  background: "var(--bg-surface)",
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow.elevated,
                  padding: "8px",
                  zIndex: 10000,
                  animation: "dropdownSlide 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px 10px",
                    borderBottom: `1px solid ${theme.borderLight}`,
                    marginBottom: 6,
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, color: theme.text, margin: 0 }}>
                    {effectiveUser?.name || "User"}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: theme.muted,
                      margin: "3px 0 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {effectiveUser?.email || "candidate@smartcoach.app"}
                  </p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: theme.radius.sm,
                    fontSize: 13,
                    color: theme.textSecondary,
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                  className="dropdown-menu-item"
                >
                  <IconUser size={16} color={theme.muted} />
                  <span>Profile</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: theme.radius.sm,
                    border: "none",
                    background: "transparent",
                    fontSize: 13,
                    color: theme.danger,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  className="dropdown-menu-item-danger"
                >
                  <IconLogOut size={16} color={theme.danger} />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              to="/login"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: theme.textSecondary,
                padding: "8px 14px",
                transition: "color 0.18s ease",
              }}
            >
              Sign In
            </Link>
            <Link
              to="/login"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#FFFFFF",
                background: theme.gradientPrimary,
                padding: "8px 18px",
                borderRadius: theme.radius.full,
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.28)",
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
              }}
              className="navbar-signup-btn"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .navbar-brand-icon:hover {
          transform: scale(1.05);
        }
        .navbar-profile-btn:hover {
          border-color: var(--primary-border) !important;
          box-shadow: 0 2px 8px var(--primary-glow);
        }
        .navbar-signup-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35) !important;
        }
        .dropdown-menu-item:hover {
          background-color: var(--primary-light) !important;
          color: var(--primary) !important;
        }
        .dropdown-menu-item-danger:hover {
          background-color: var(--error-light) !important;
        }
        @media (max-width: 1023px) {
          .navbar-hamburger {
            display: flex !important;
          }
          .app-main-layout .navbar-brand-link {
            display: flex !important;
          }
        }
        @media (min-width: 1024px) {
          .app-main-layout .navbar-brand-link {
            display: none !important;
          }
          .navbar-hamburger {
            display: none !important;
          }
        }
        @media (max-width: 540px) {
          .navbar-profile-name {
            display: none !important;
          }
          .navbar-chevron-down {
            display: none !important;
          }
          .navbar-profile-btn {
            padding: 4px !important;
          }
          .navbar-brand-text {
            font-size: 17px !important;
          }
        }
        @media (max-width: 360px) {
          .navbar-brand-text span:first-child {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}

export default Navbar;
