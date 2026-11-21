import React, { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";
import { IconSun, IconMoon } from "./Icons";
import theme from "../styles/theme";

/**
 * ThemeToggle Component
 *
 * Professional, accessible Light/Dark theme switcher with smooth animated state transitions.
 * - Icon: Sun (Light) / Moon (Dark)
 * - Accessible: role="switch", aria-checked, keyboard navigable (Enter / Space)
 * - Smooth transition micro-animation
 */
export default function ThemeToggle({ size = "md", showLabel = false, className = "", style = {} }) {
  const { darkMode, toggleTheme } = useContext(ThemeContext);

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={darkMode}
      aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
      title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      }}
      className={`theme-toggle-btn ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: isSmall ? 32 : 36,
        padding: showLabel ? "0 12px" : isSmall ? "0 8px" : "0 10px",
        borderRadius: theme.radius.full,
        background: "var(--bg-secondary)",
        border: `1px solid ${darkMode ? "rgba(155, 120, 245, 0.35)" : theme.border}`,
        color: darkMode ? "#9B78F5" : "#B45309",
        cursor: "pointer",
        position: "relative",
        outline: "none",
        boxShadow: darkMode
          ? "0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
          : "0 1px 3px rgba(0, 0, 0, 0.04)",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        userSelect: "none",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: darkMode ? "rotate(360deg) scale(1.05)" : "rotate(0deg) scale(1)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="theme-toggle-icon"
      >
        {darkMode ? (
          <IconMoon size={isSmall ? 16 : 18} />
        ) : (
          <IconSun size={isSmall ? 16 : 18} />
        )}
      </div>

      {showLabel && (
        <span
          style={{
            fontSize: isSmall ? 12 : 13,
            fontWeight: 600,
            color: theme.textSecondary,
            letterSpacing: "-0.01em",
          }}
        >
          {darkMode ? "Dark" : "Light"}
        </span>
      )}

      <style>{`
        .theme-toggle-btn:hover {
          transform: translateY(-1px);
          border-color: var(--primary) !important;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.16) !important;
        }
        .theme-toggle-btn:hover .theme-toggle-icon {
          transform: rotate(15deg) scale(1.08);
        }
        .theme-toggle-btn:active {
          transform: scale(0.97);
        }
        .theme-toggle-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
      `}</style>
    </button>
  );
}
