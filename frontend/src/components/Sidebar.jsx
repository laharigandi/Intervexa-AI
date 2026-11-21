import React, { useContext, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../context/ThemeContext";
import theme from "../styles/theme";
import {
  IconDashboard,
  IconUpload,
  IconInterview,
  IconResults,
  IconHistory,
  IconLearning,
  IconLogOut,
  IconX,
  IconBot,
  IconTarget,
  IconUser,
  IconChevronRight,
} from "./Icons";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { to: "/upload", label: "Resume Analysis", icon: IconUpload, matchPaths: ["/upload", "/resume", "/resume-analysis", "/upload-resume"] },
  { to: "/role", label: "Interview Setup", icon: IconTarget, matchPaths: ["/role", "/setup", "/interview-setup", "/select-role"] },
  { to: "/interview", label: "Interview", icon: IconInterview, matchPaths: ["/interview", "/interview-selection", "/standard-interview", "/interview/standard", "/adaptive-interview", "/interview/adaptive", "/adaptive"] },
  { to: "/results", label: "Interview Results", icon: IconResults, matchPaths: ["/results", "/interview-results"] },
  { to: "/history", label: "Interview History", icon: IconHistory, matchPaths: ["/history", "/interview-history"] },
  { to: "/learning", label: "Learning & Study Plan", icon: IconLearning, matchPaths: ["/learning", "/roadmap", "/learning-roadmap", "/study-planner", "/study-plan"] },
  { to: "/profile", label: "Profile & Account Settings", icon: IconUser, matchPaths: ["/profile", "/settings"] },
];

function Sidebar({ isOpen = false, onClose = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { darkMode } = useContext(ThemeContext);

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

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/");
  };

  const isItemActive = (item) => {
    if (item.matchPaths) {
      return item.matchPaths.some((p) => location.pathname === p);
    }
    return location.pathname === item.to;
  };

  const getUserInitials = () => {
    if (!effectiveUser?.name) return "U";
    return effectiveUser.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Lock body scroll and listen for Escape key when mobile sidebar is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Harmonized premium gradients:
  // Dark mode: Deep, rich royal purple gradient
  // Light mode: Vibrant, luminous purple-to-violet gradient
  const sidebarBackground = darkMode
    ? "linear-gradient(180deg, #431A9E 0%, #5426B8 35%, #6C36CB 70%, #8048DC 100%)"
    : "linear-gradient(180deg, #5426B8 0%, #6E3CD4 40%, #824FE0 75%, #925CF5 100%)";

  return (
    <>
      {/* Mobile Backdrop - strictly behind sidebar (z-index: 1040) with subtle dark overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            zIndex: 1040,
            transition: "opacity 0.25s ease",
            cursor: "pointer",
          }}
          className="mobile-backdrop"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container - strictly above backdrop (z-index: 1050 on mobile, 1000 on desktop) */}
      <aside
        id="app-sidebar"
        className={`app-sidebar ${isOpen ? "open" : ""}`}
        aria-label="Main Navigation"
        style={{
          width: theme.sidebarWidth,
          maxWidth: "calc(100vw - 48px)",
          background: `var(--sidebar-gradient, ${sidebarBackground})`,
          borderRight: "1px solid rgba(255, 255, 255, 0.16)",
          boxShadow: isOpen ? "4px 0 28px rgba(0, 0, 0, 0.25)" : "4px 0 28px rgba(0, 0, 0, 0.18)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 1050,
          boxSizing: "border-box",
          flexShrink: 0,
          overflow: "hidden",
          transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease",
        }}
      >
        {/* Subtle Decorative Ambient Glows */}
        <div
          style={{
            position: "absolute",
            top: -50,
            right: -40,
            width: 170,
            height: 170,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.18) 0%, rgba(167, 139, 250, 0.08) 60%, transparent 100%)",
            filter: "blur(22px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "44%",
            left: -40,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167, 139, 250, 0.22) 0%, transparent 70%)",
            filter: "blur(24px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 70,
            right: -30,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.14) 0%, rgba(146, 92, 245, 0.15) 60%, transparent 100%)",
            filter: "blur(20px)",
            pointerEvents: "none",
          }}
        />
        {/* Delicate Geometric Decorative Rings */}
        <svg
          style={{
            position: "absolute",
            top: 14,
            right: -10,
            width: 110,
            height: 110,
            pointerEvents: "none",
            opacity: 0.12,
          }}
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="46" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="3 4" />
          <circle cx="50" cy="50" r="32" stroke="#FFFFFF" strokeWidth="1" />
        </svg>

        {/* ─── BRAND / LOGO HEADER AT TOP ─── */}
        <div
          className="sidebar-brand-header"
          style={{
            height: theme.navbarHeight,
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.14)",
            flexShrink: 0,
            background: "rgba(0, 0, 0, 0.08)",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 2,
          }}
        >
          <Link
            to="/dashboard"
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
            }}
          >
            {/* Logo Icon with Glass Glow */}
            <div
              className="sidebar-brand-icon"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.38)",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                flexShrink: 0,
                transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease",
              }}
            >
              <IconBot size={22} color="#FFFFFF" />
            </div>

            {/* Brand Title and Tagline */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 16.5,
                  color: "#FFFFFF",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                Intervexa
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 6,
                    background: "rgba(255, 255, 255, 0.22)",
                    border: "1px solid rgba(255, 255, 255, 0.32)",
                    color: "#FFFFFF",
                    letterSpacing: "0.02em",
                  }}
                >
                  AI
                </span>
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.75)",
                  marginTop: 2,
                }}
              >
                Practice • Improve • Win
              </span>
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="sidebar-close-btn"
            style={{
              background: "rgba(255, 255, 255, 0.14)",
              border: "1px solid rgba(255, 255, 255, 0.24)",
              color: "#FFFFFF",
              cursor: "pointer",
              padding: 6,
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              transition: "background 0.15s ease",
            }}
          >
            <IconX size={18} color="#FFFFFF" />
          </button>
        </div>

        {/* ─── NAVIGATION ITEMS LIST (SCROLLABLE) ─── */}
        <div
          className="sidebar-nav-scroll"
          style={{
            flex: 1,
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            overflowY: "auto",
            minHeight: 0,
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              padding: "2px 12px 6px 12px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255, 255, 255, 0.55)",
            }}
          >
            Main Navigation
          </div>

          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`sidebar-nav-item ${active ? "active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#FFFFFF" : "rgba(255, 255, 255, 0.82)",
                  background: active
                    ? "linear-gradient(90deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.14) 100%)"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(255, 255, 255, 0.35)"
                    : "1px solid transparent",
                  boxShadow: active
                    ? "0 4px 16px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.28)"
                    : "none",
                  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <Icon
                    size={18}
                    color={active ? "#FFFFFF" : "rgba(255, 255, 255, 0.8)"}
                  />
                  <span>{item.label}</span>
                </div>

                {/* Active Indicator Capsule */}
                {active && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      boxShadow: "0 0 8px rgba(255, 255, 255, 0.95)",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* ─── USER PROFILE & LOGOUT SECTION AT BOTTOM ─── */}
        <div
          style={{
            padding: "14px 12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.14)",
            background: "rgba(0, 0, 0, 0.1)",
            flexShrink: 0,
            position: "relative",
            zIndex: 2,
          }}
        >
          {effectiveUser && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                marginBottom: 9,
                boxSizing: "border-box",
              }}
            >
              {/* User Avatar Initials */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.15) 100%)",
                  border: "1.5px solid rgba(255, 255, 255, 0.45)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                  flexShrink: 0,
                }}
              >
                {getUserInitials()}
              </div>

              {/* User Info (Truncated) */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.3,
                  }}
                  title={effectiveUser?.name || "Candidate"}
                >
                  {effectiveUser?.name || "Candidate"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255, 255, 255, 0.72)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: 1,
                  }}
                  title={effectiveUser?.email || "candidate@smartcoach.app"}
                >
                  {effectiveUser?.email || "candidate@smartcoach.app"}
                </div>
              </div>
            </div>
          )}

          {/* Logout Button with subtle red accent */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "9px 14px",
              borderRadius: 10,
              border: "1px solid rgba(239, 68, 68, 0.32)",
              background: "rgba(239, 68, 68, 0.16)",
              color: "#FECACA",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              boxSizing: "border-box",
            }}
            className="sidebar-logout-btn"
          >
            <IconLogOut size={16} color="#FECACA" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <style>{`
        /* Smooth Hover on Navigation Items */
        .sidebar-nav-item:hover:not(.active) {
          background: rgba(255, 255, 255, 0.14) !important;
          border-color: rgba(255, 255, 255, 0.24) !important;
          color: #FFFFFF !important;
          transform: translateX(4px);
        }
        .sidebar-nav-item:hover:not(.active) svg {
          color: #FFFFFF !important;
        }

        /* Active Item Micro-Hover */
        .sidebar-nav-item.active:hover {
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.18) 100%) !important;
          border-color: rgba(255, 255, 255, 0.45) !important;
        }

        /* Brand Logo Hover */
        .sidebar-brand-header a:hover .sidebar-brand-icon {
          transform: scale(1.06) rotate(-3deg);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
        }

        /* Logout Button Hover */
        .sidebar-logout-btn:hover {
          background: rgba(239, 68, 68, 0.28) !important;
          border-color: rgba(239, 68, 68, 0.5) !important;
          color: #FFFFFF !important;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25) !important;
          transform: translateY(-1px);
        }
        .sidebar-logout-btn:hover svg {
          color: #FFFFFF !important;
        }
        .sidebar-logout-btn:active {
          transform: translateY(0);
        }

        /* Sleek Translucent Scrollbar */
        .sidebar-nav-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.22);
          border-radius: 9999px;
          transition: background 0.2s ease;
        }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }

        /* Responsive Drawer on Tablets & Mobile */
        @media (max-width: 1023px) {
          .app-sidebar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            width: min(280px, calc(100vw - 48px)) !important;
            max-width: calc(100vw - 48px) !important;
            transform: translateX(-100%) !important;
            z-index: 1050 !important;
            box-shadow: 0 20px 30px -5px rgba(0, 0, 0, 0.45) !important;
          }
          .app-sidebar.open {
            transform: translateX(0) !important;
            z-index: 1050 !important;
          }
          .sidebar-close-btn {
            display: flex !important;
          }
          .mobile-backdrop {
            display: block !important;
            z-index: 1040 !important;
          }
        }
        @media (min-width: 1024px) {
          .app-sidebar {
            transform: translateX(0) !important;
            z-index: 1000 !important;
            box-shadow: none !important;
          }
          .sidebar-close-btn {
            display: none !important;
          }
          .mobile-backdrop {
            display: none !important;
            pointer-events: none !important;
          }
        }
      `}</style>
    </>
  );
}

export default Sidebar;
