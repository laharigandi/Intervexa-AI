import React from "react";
import theme from "../styles/theme";

const variants = {
  primary: {
    background: "var(--gradient-primary)",
    color: "#FFFFFF",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 2px 10px rgba(124, 58, 237, 0.28)",
  },
  accent: {
    background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
    color: "#FFFFFF",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 2px 10px rgba(139, 92, 246, 0.28)",
  },
  secondary: {
    background: "var(--bg-surface)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
    boxShadow: "var(--shadow-sm)",
  },
  outline: {
    background: "transparent",
    color: "var(--primary)",
    border: "1px solid var(--primary-border)",
    boxShadow: "none",
  },
  ghost: {
    background: "transparent",
    color: "var(--primary)",
    border: "1px solid transparent",
    boxShadow: "none",
  },
  danger: {
    background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
    color: "#FFFFFF",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 2px 10px rgba(239, 68, 68, 0.28)",
  },
  success: {
    background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    color: "#FFFFFF",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 2px 10px rgba(16, 185, 129, 0.28)",
  },
};

function Button({
  children,
  variant = "primary",
  disabled = false,
  loading = false,
  onClick,
  type = "button",
  style = {},
  icon: Icon,
  className = "",
  size = "md",
  pill = false,
}) {
  const sizeStyles = {
    sm: { padding: "6px 14px", fontSize: 13, gap: 6, borderRadius: pill ? 9999 : theme.radius.sm },
    md: { padding: "9px 18px", fontSize: 14, gap: 7, borderRadius: pill ? 9999 : theme.radius.sm },
    lg: { padding: "11px 22px", fontSize: 14, gap: 8, borderRadius: pill ? 9999 : theme.radius.md },
  };

  const isDisabled = disabled || loading;

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: isDisabled ? 0.65 : 1,
    transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
    textDecoration: "none",
    boxSizing: "border-box",
    lineHeight: 1.4,
    position: "relative",
    ...(sizeStyles[size] || sizeStyles.md),
    ...(variants[variant] || variants.primary),
    ...style,
  };

  return (
    <>
      <button
        type={type}
        style={base}
        onClick={isDisabled ? undefined : onClick}
        disabled={isDisabled}
        className={`app-btn btn-${variant} ${className}`}
      >
        {loading ? (
          <span
            style={{
              width: size === "sm" ? 14 : 16,
              height: size === "sm" ? 14 : 16,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              display: "inline-block",
              animation: "spin 0.7s linear infinite",
            }}
          />
        ) : (
          Icon && <Icon size={size === "sm" ? 15 : 17} />
        )}
        <span>{children}</span>
      </button>

      <style>{`
        .app-btn {
          user-select: none;
        }
        .app-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .app-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
        }
        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35) !important;
        }
        .btn-secondary:hover:not(:disabled) {
          background-color: var(--primary-light) !important;
          border-color: var(--primary-border) !important;
          color: var(--primary) !important;
        }
        .btn-outline:hover:not(:disabled) {
          background-color: var(--primary-light) !important;
          border-color: var(--primary) !important;
        }
        .btn-ghost:hover:not(:disabled) {
          background-color: var(--primary-light) !important;
        }
      `}</style>
    </>
  );
}

export default Button;
