import React from "react";
import theme from "../styles/theme";

/**
 * ErrorBoundary
 *
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a graceful fallback UI instead of
 * unmounting the whole React root and showing a blank screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an unhandled render error]:", error, errorInfo);
    try {
      localStorage.setItem(
        "last_render_error",
        JSON.stringify({
          message: error?.message || String(error),
          name: error?.name || "Error",
          stack: error?.stack || "",
          componentStack: errorInfo?.componentStack || "",
          url: window.location.href,
          time: new Date().toISOString(),
        })
      );
    } catch {}
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (window.location.pathname.includes("interview") || window.location.pathname.includes("role")) {
      window.location.href = "/interview";
    } else {
      window.location.href = "/dashboard";
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "radial-gradient(circle at 50% 20%, rgba(150, 60, 250, 0.12) 0%, rgba(113, 56, 245, 0.05) 40%, var(--bg-main) 75%)",
            boxSizing: "border-box",
            color: "var(--text-color)",
          }}
        >
          <div
            style={{
              maxWidth: 520,
              width: "100%",
              background: "var(--card-bg)",
              border: `1px solid ${theme.borderPurple || "rgba(113, 56, 245, 0.25)"}`,
              borderRadius: theme.radius.lg || 16,
              padding: "36px 32px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.25)",
              textAlign: "center",
            }}
          >
            {/* Warning Icon Badge */}
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "var(--warning-light, rgba(245, 158, 11, 0.15))",
                border: "1px solid var(--warning-border, rgba(245, 158, 11, 0.3))",
                color: "var(--warning, #F59E0B)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                fontSize: 28,
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--text-color)",
                marginBottom: 10,
                letterSpacing: "-0.02em",
              }}
            >
              Something went wrong loading this view
            </h2>

            <p
              style={{
                color: "var(--text-muted, #94A3B8)",
                fontSize: 14,
                lineHeight: 1.6,
                margin: "0 0 24px",
              }}
            >
              An unexpected render issue occurred. Your saved progress, resume data, and interview history are safe.
            </p>

            {this.state.error && (
              <details
                open
                style={{
                  textAlign: "left",
                  background: "var(--bg-secondary, rgba(0,0,0,0.2))",
                  border: `1px solid ${theme.border || "rgba(255,255,255,0.08)"}`,
                  borderRadius: theme.radius.sm || 8,
                  padding: "10px 14px",
                  marginBottom: 24,
                  fontSize: 12,
                  color: "var(--text-muted, #94A3B8)",
                  cursor: "pointer",
                }}
              >
                <summary style={{ fontWeight: 600, color: "var(--primary)", marginBottom: 8 }}>
                  Technical Details
                </summary>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 11,
                    color: "var(--danger, #EF4444)",
                    maxHeight: 200,
                    overflowY: "auto",
                    fontFamily: "monospace",
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.error.stack ? `\n\n[Stack]:\n${this.state.error.stack}` : ""}
                  {this.state.errorInfo?.componentStack ? `\n\n[Component Stack]:\n${this.state.errorInfo.componentStack}` : ""}
                </pre>
              </details>
            )}

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  background: theme.gradientPrimary || "linear-gradient(135deg, #8054E8, #7043D5)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: theme.radius.full || 9999,
                  padding: "11px 22px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px var(--primary-glow, rgba(113, 56, 245, 0.3))",
                  transition: "transform 0.15s ease",
                }}
              >
                Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: "var(--bg-surface, rgba(255, 255, 255, 0.05))",
                  color: "var(--text-color)",
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.full || 9999,
                  padding: "11px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

