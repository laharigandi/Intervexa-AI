import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import theme from "../styles/theme";

/**
 * ProtectedRoute
 *
 * Renders children when an authenticated user exists.
 * While verification is in progress (isAuthLoading = true),
 * shows a clean loading spinner to avoid premature redirection.
 * If unauthenticated or token/user is absent, redirects to /login.
 */
function ProtectedRoute({ children }) {
  const { token, user, isAuthLoading, isAuthenticated } = useContext(AuthContext);

  // Still verifying the stored token on initial load — show a neutral spinner
  if (isAuthLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "var(--bg-main)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: `3px solid ${theme.border}`,
            borderTop: `3px solid ${theme.primary}`,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: 13, color: "var(--text-muted, #94A3B8)", fontWeight: 500 }}>
          Loading your workspace...
        </span>
      </div>
    );
  }

  if (!isAuthenticated || !token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
