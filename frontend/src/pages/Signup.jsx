import { useState, useContext, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Button from "../components/Button";
import ThemeToggle from "../components/ThemeToggle";
import theme from "../styles/theme";
import { inputStyle } from "../styles/shared";
import { API_BASE_URL } from "../config/api";
import { IconBot, IconEye, IconEyeOff, IconAlertTriangle } from "../components/Icons";

function Signup() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (formData.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.message || data.error || "Signup failed. Please try a different email.");
        return;
      }
      if (data.token && data.user) {
        login(data.user, data.token);
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Unable to connect to server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 15%, rgba(150, 60, 250, 0.14) 0%, rgba(113, 56, 245, 0.06) 45%, var(--bg-main) 80%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: "100%", maxWidth: "440px" }} className="animate-slide-up">
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link to="/" style={{ textDecoration: "none", display: "inline-block" }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: theme.radius.sm,
                background: theme.gradientPrimary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 8px 24px var(--primary-glow)",
                marginBottom: 8,
                transition: "transform 0.2s ease",
              }}
              className="auth-logo-badge"
            >
              <IconBot size={28} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme.text, marginBottom: 8 }}>
              Intervexa <span className="purple-gradient-text">AI</span>
            </div>
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.text, letterSpacing: "-0.03em" }}>
            Create Your Account
          </h1>
          <p style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>
            Start practicing AI mock interviews today
          </p>
        </div>

        {/* Signup Card */}
        <div
          className="auth-card-container"
          style={{
            background: "var(--bg-surface)",
            borderRadius: theme.radius.xl,
            padding: "clamp(22px, 5vw, 36px) clamp(16px, 4vw, 30px)",
            boxShadow: theme.shadow.elevated,
            border: `1px solid ${theme.borderPurple}`,
          }}
        >
          {/* Auth Tab Switcher */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              background: "var(--bg-main)",
              padding: 4,
              borderRadius: theme.radius.full,
              border: `1px solid ${theme.border}`,
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                padding: "8px 16px",
                borderRadius: theme.radius.full,
                border: "none",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                background: "transparent",
                color: theme.textSecondary,
                transition: "all 0.18s ease",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              style={{
                padding: "8px 16px",
                borderRadius: theme.radius.full,
                border: "none",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                background: theme.gradientPrimary,
                color: "#FFFFFF",
                boxShadow: "0 2px 8px var(--primary-glow)",
                transition: "all 0.18s ease",
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Error notification */}
          {errorMessage && (
            <div
              style={{
                background: theme.dangerLight,
                border: `1px solid ${theme.dangerBorder}`,
                color: theme.danger,
                padding: "11px 14px",
                borderRadius: theme.radius.sm,
                fontSize: 13,
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
              className="animate-fade-in"
            >
              <IconAlertTriangle size={17} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSignup} style={{ display: "grid", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 7 }}>
                Full Name
              </label>
              <input
                type="text"
                name="name"
                placeholder="Alex Johnson"
                value={formData.name}
                onChange={handleChange}
                required
                style={inputStyle}
                className="auth-input-field"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 7 }}>
                Email Address
              </label>
              <input
                type="email"
                name="email"
                placeholder="alex@university.edu"
                value={formData.email}
                onChange={handleChange}
                required
                style={inputStyle}
                className="auth-input-field"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  style={{ ...inputStyle, paddingRight: 44 }}
                  className="auth-input-field"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: theme.muted,
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              style={{ width: "100%", padding: "12px", fontSize: 15, marginTop: 4 }}
              pill
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <p style={{ textAlign: "center", marginTop: 26, fontSize: 14, color: theme.textSecondary }}>
            Already have an account?{" "}
            <Link to="/login" style={{ fontWeight: 600, color: theme.primary }}>
              Log in
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        .auth-input-field:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3.5px var(--primary-glow) !important;
        }
        .auth-logo-badge:hover {
          transform: scale(1.06);
        }
      `}</style>
    </div>
  );
}

export default Signup;
