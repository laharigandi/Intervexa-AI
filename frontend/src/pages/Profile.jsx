import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../context/ThemeContext";
import PageShell from "../components/PageShell";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import Button from "../components/Button";
import theme from "../styles/theme";
import {
  statRow,
  inputStyle,
  getScoreColor,
  getScoreBackground,
  getScoreBorder,
} from "../styles/shared";
import { API_BASE_URL } from "../config/api";
import {
  IconUser,
  IconBriefcase,
  IconAward,
  IconSparkles,
  IconLogOut,
  IconArrowRight,
  IconCheckCircle,
  IconTrendingUp,
  IconTarget,
  IconMessageSquare,
  IconClock,
  IconResults,
  IconAlertTriangle,
  IconAlertCircle,
  IconChevronRight,
  IconMail,
  IconCalendar,
  IconSun,
  IconMoon,
  IconLock,
  IconBell,
  IconShield,
  IconEye,
  IconEyeOff,
  IconMic,
  IconFileText,
  IconRefresh,
} from "../components/Icons";

// ---------------------------------------------------------------------------
// Skeletons for Loading State
// ---------------------------------------------------------------------------
function ProfileSkeleton() {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div className="skeleton-box" style={{ height: 160, borderRadius: theme.radius.md }} />
      <div style={statRow}>
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton-box" style={{ height: 110, borderRadius: theme.radius.md }} />
        ))}
      </div>
      <div className="skeleton-box" style={{ height: 220, borderRadius: theme.radius.md }} />
      <div className="skeleton-box" style={{ height: 260, borderRadius: theme.radius.md }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Unified Profile Component
// ---------------------------------------------------------------------------
function Profile() {
  const navigate = useNavigate();
  const { user: authUser, logout, login: updateAuthUser, isAuthLoading } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useContext(ThemeContext);

  const [activeTab, setActiveTab] = useState("account"); // "account" (Profile & Settings) | "analytics" (Performance & History)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, average: 0, best: 0, createdAt: null });
  const [history, setHistory] = useState([]);
  const [profileData, setProfileData] = useState(null);

  // Retrieve user with fallback to localStorage
  const user = useMemo(() => {
    if (authUser && (authUser.name || authUser.email)) return authUser;
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, [authUser]);

  // Section 1: Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState(() => localStorage.getItem("role") || "Software Engineer");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Sync editName when user changes
  useEffect(() => {
    setEditName(user?.name || profileData?.name || "");
  }, [user, profileData]);

  // Section 2: Account Preferences State
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem("userNotifications");
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      emailReminders: true,
      scoreAlerts: true,
      studyRoadmapAlerts: true,
    };
  });

  const [defaultInterviewType, setDefaultInterviewType] = useState(() => {
    return localStorage.getItem("interviewType") || "standard";
  });

  const [defaultInterviewMode, setDefaultInterviewMode] = useState(() => {
    return localStorage.getItem("interviewMode") || "text";
  });

  const [autoSpeakQuestions, setAutoSpeakQuestions] = useState(() => {
    return localStorage.getItem("autoSpeakQuestions") === "true";
  });

  const [prefNotice, setPrefNotice] = useState(null);

  // Section 3: Security State (Change Password)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  // Fetch performance metrics and interview history
  useEffect(() => {
    if (isAuthLoading) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      // 1. Dashboard metrics (total, average, best, created_at)
      fetch(`${API_BASE_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (res) => {
        if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
        if (!res.ok) throw new Error("DASHBOARD_ERROR");
        return res.json();
      }),
      // 2. Full interview history
      fetch(`${API_BASE_URL}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (res) => {
        if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
        if (!res.ok) throw new Error("HISTORY_ERROR");
        return res.json();
      }),
      // 3. User profile details
      fetch(`${API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([dashData, historyData, userProf]) => {
        if (dashData && typeof dashData === "object") {
          setStats({
            total: Number(dashData.total) || 0,
            average: Number(dashData.average) || 0,
            best: Number(dashData.best) || 0,
            createdAt: dashData.created_at || null,
          });
        }
        if (Array.isArray(historyData)) {
          setHistory(historyData);
        }
        if (userProf?.success && userProf.user) {
          setProfileData(userProf.user);
        }
      })
      .catch((err) => {
        console.error("[Profile] Data fetch failure:", err);
        if (err.message === "UNAUTHORIZED") {
          setError("Your session has expired. Please sign in again.");
        } else {
          setError("Unable to load interview metrics. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [isAuthLoading]);

  // Derived user initials
  const getUserInitials = () => {
    const displayName = user?.name || profileData?.name;
    if (!displayName) return "U";
    return displayName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Date formatters
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers for Section 1: Edit Profile
  // ---------------------------------------------------------------------------
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    if (!editName.trim()) {
      setProfileError("Full name cannot be empty.");
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to update profile.");
      }

      // Update AuthContext user & localStorage
      const updatedUser = {
        ...user,
        name: editName.trim(),
      };
      if (updateAuthUser) {
        updateAuthUser(updatedUser, token);
      } else {
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      // Save role preference
      localStorage.setItem("role", editRole);
      setProfileData((prev) => ({ ...prev, name: editName.trim() }));

      setProfileSuccess("Profile updated successfully!");
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err) {
      console.error("[Profile save error]:", err);
      setProfileError(err.message || "Failed to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers for Section 2: Account Preferences
  // ---------------------------------------------------------------------------
  const handleToggleNotification = (key) => {
    setNotifications((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("userNotifications", JSON.stringify(updated));
      triggerPrefNotice("Notification preferences updated");
      return updated;
    });
  };

  const handleInterviewTypeChange = (type) => {
    setDefaultInterviewType(type);
    localStorage.setItem("interviewType", type);
    triggerPrefNotice(`Default interview set to ${type === "adaptive" ? "Adaptive AI" : "Standard Mock"}`);
  };

  const handleInterviewModeChange = (mode) => {
    setDefaultInterviewMode(mode);
    localStorage.setItem("interviewMode", mode);
    triggerPrefNotice(`Preferred mode set to ${mode === "voice" ? "Voice" : "Text"}`);
  };

  const handleToggleAutoSpeak = () => {
    setAutoSpeakQuestions((prev) => {
      const next = !prev;
      localStorage.setItem("autoSpeakQuestions", String(next));
      triggerPrefNotice(`Question audio read-aloud ${next ? "enabled" : "disabled"}`);
      return next;
    });
  };

  const triggerPrefNotice = (msg) => {
    setPrefNotice(msg);
    setTimeout(() => setPrefNotice(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // Handlers for Section 3: Change Password
  // ---------------------------------------------------------------------------
  const handleChangePassword = async (e) => {
    e?.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setPasswordLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/change_password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to change password.");
      }

      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err) {
      console.error("[Change password error]:", err);
      setPasswordError(err.message || "Failed to change password. Please check your current password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Check if account is linked via Google
  const isGoogleAccount = Boolean(
    user?.is_google ||
    user?.provider === "google" ||
    (user?.email && user.email.toLowerCase().endsWith("@gmail.com"))
  );

  // ---------------------------------------------------------------------------
  // Derived Analytics (Computed purely from actual history records)
  // ---------------------------------------------------------------------------
  const totalCompleted = stats.total > 0 ? stats.total : history.length;
  const hasCompletedInterviews = totalCompleted > 0;

  const validScores = useMemo(() => {
    return history
      .map((item) => Number(item.avg_score))
      .filter((s) => !isNaN(s) && s > 0);
  }, [history]);

  const avgTechnicalScore = useMemo(() => {
    if (validScores.length === 0) return null;
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    return (sum / validScores.length).toFixed(1);
  }, [validScores]);

  const avgCommunicationScore = useMemo(() => {
    const scores = [];
    history.forEach((item) => {
      if (item.communication_score !== null && item.communication_score !== undefined) {
        const val = Number(item.communication_score);
        if (!isNaN(val) && val > 0) scores.push(val);
      } else if (item.communication_feedback?.overall_score !== undefined) {
        const val = Number(item.communication_feedback.overall_score);
        if (!isNaN(val) && val > 0) scores.push(val);
      }
    });
    if (scores.length === 0) return null;
    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / scores.length);
  }, [history]);

  const mostPracticed = useMemo(() => {
    if (history.length === 0) return null;
    const counts = {};
    history.forEach((item) => {
      const roleName = (item.role || "General Technical").trim();
      counts[roleName] = (counts[roleName] || 0) + 1;
    });
    let topRole = "";
    let maxCount = 0;
    Object.entries(counts).forEach(([roleName, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topRole = roleName;
      }
    });
    return { role: topRole, count: maxCount };
  }, [history]);

  const memberSinceFormatted = formatMemberSince(
    profileData?.created_at || stats.createdAt || user?.created_at
  );

  return (
    <PageShell
      title="Profile"
      subtitle="Manage your personal information, account preferences, security, and interview performance."
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", width: "100%" }}>
        {/* Error Notification if API fails */}
        {error && (
          <div
            className="animate-fade-in"
            style={{
              padding: "14px 18px",
              borderRadius: theme.radius.sm,
              background: theme.dangerLight,
              border: `1px solid ${theme.dangerBorder}`,
              color: theme.danger,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconAlertTriangle size={18} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{error}</span>
            </div>
            {error.includes("session") && (
              <Button size="sm" variant="secondary" onClick={handleLogout}>
                Sign In Again
              </Button>
            )}
          </div>
        )}

        {/* Floating Preference Toast Notification */}
        {prefNotice && (
          <div
            className="animate-fade-in"
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              background: "var(--bg-surface)",
              color: theme.text,
              border: `1px solid ${theme.borderPurple}`,
              padding: "12px 20px",
              borderRadius: theme.radius.md,
              boxShadow: theme.shadow.elevated,
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 1100,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <IconCheckCircle size={17} color={theme.success} />
            <span>{prefNotice}</span>
          </div>
        )}

        {/* Tab Navigation Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 22,
            borderBottom: `1px solid ${theme.border}`,
            paddingBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: theme.radius.sm,
              border: activeTab === "account" ? `1px solid ${theme.primary}` : "1px solid transparent",
              background: activeTab === "account" ? theme.primaryLight : "transparent",
              color: activeTab === "account" ? theme.primary : theme.textSecondary,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <IconUser size={16} />
            <span>Profile & Account Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: theme.radius.sm,
              border: activeTab === "analytics" ? `1px solid ${theme.primary}` : "1px solid transparent",
              background: activeTab === "analytics" ? theme.primaryLight : "transparent",
              color: activeTab === "analytics" ? theme.primary : theme.textSecondary,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <IconTrendingUp size={16} />
            <span>Interview Performance & History</span>
            {hasCompletedInterviews && (
              <span
                style={{
                  fontSize: 11,
                  background: theme.primary,
                  color: "#FFFFFF",
                  padding: "1px 7px",
                  borderRadius: theme.radius.full,
                  fontWeight: 800,
                }}
              >
                {totalCompleted}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <ProfileSkeleton />
        ) : activeTab === "account" ? (
          /* ===================================================================
              UNIFIED PROFILE & SETTINGS TAB
             =================================================================== */
          <div style={{ display: "grid", gap: 24 }} className="animate-slide-up">
            {/* ---------------------------------------------------------------
                SECTION 1: PERSONAL INFORMATION
               --------------------------------------------------------------- */}
            <Card
              title="Personal Information"
              subtitle="Your candidate identity, profile avatar, and primary career focus."
              icon={IconUser}
              accent="purple"
              accentBorder={true}
              action={
                !isEditingProfile ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIsEditingProfile(true);
                      setProfileError(null);
                      setProfileSuccess(null);
                    }}
                    icon={IconUser}
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingProfile(false)}
                  >
                    Cancel
                  </Button>
                )
              }
            >
              {profileSuccess && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: theme.radius.sm,
                    background: theme.successLight,
                    border: `1px solid ${theme.successBorder}`,
                    color: theme.success,
                    marginBottom: 16,
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <IconCheckCircle size={16} />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: theme.radius.sm,
                    background: theme.dangerLight,
                    border: `1px solid ${theme.dangerBorder}`,
                    color: theme.danger,
                    marginBottom: 16,
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <IconAlertTriangle size={16} />
                  <span>{profileError}</span>
                </div>
              )}

              {!isEditingProfile ? (
                /* Profile Summary View */
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 20,
                  }}
                >
                  {/* Left: Avatar + Details */}
                  <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                    {/* User Avatar Circle with Initials */}
                    <div
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--primary) 0%, #6366F1 100%)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 24,
                        letterSpacing: "-0.02em",
                        boxShadow: "0 8px 24px -4px rgba(124, 58, 237, 0.4)",
                        border: "3px solid var(--bg-surface)",
                        flexShrink: 0,
                      }}
                    >
                      {getUserInitials()}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: theme.text }}>
                          {user.name || profileData?.name || "Candidate"}
                        </h3>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: theme.successLight,
                            color: theme.success,
                            border: `1px solid ${theme.successBorder}`,
                            padding: "2px 9px",
                            borderRadius: theme.radius.full,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: theme.success,
                            }}
                          />
                          Active Candidate
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", fontSize: 13, color: theme.textSecondary }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <IconMail size={14} color={theme.muted} />
                          {user.email || profileData?.email || "No email on record"}
                        </span>

                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <IconBriefcase size={14} color={theme.muted} />
                          {editRole || "Software Engineer"}
                        </span>

                        {memberSinceFormatted && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <IconCalendar size={14} color={theme.muted} />
                            Member since {memberSinceFormatted}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Pill */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIsEditingProfile(true);
                      }}
                      icon={IconUser}
                    >
                      Edit Info
                    </Button>
                  </div>
                </div>
              ) : (
                /* Inline Edit Profile Form */
                <form onSubmit={handleSaveProfile} style={{ display: "grid", gap: 16, maxWidth: 560 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Alex Johnson"
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
                      Email Address (Account Identifier)
                    </label>
                    <input
                      type="email"
                      value={user.email || profileData?.email || ""}
                      disabled
                      style={{
                        ...inputStyle,
                        background: "var(--bg-secondary)",
                        cursor: "not-allowed",
                        opacity: 0.8,
                      }}
                    />
                    <span style={{ fontSize: 11, color: theme.muted, marginTop: 4, display: "block" }}>
                      Email is tied to your account credentials and cannot be changed here.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
                      Primary Career Focus / Target Track
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="Software Engineer">Software Engineer</option>
                      <option value="Frontend Developer">Frontend Developer</option>
                      <option value="Backend Developer">Backend Developer</option>
                      <option value="Full Stack Developer">Full Stack Developer</option>
                      <option value="Data Scientist">Data Scientist</option>
                      <option value="Machine Learning Engineer">Machine Learning Engineer</option>
                      <option value="DevOps Engineer">DevOps Engineer</option>
                      <option value="Cloud Engineer">Cloud Engineer</option>
                      <option value="Product Manager">Product Manager</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <Button
                      type="submit"
                      loading={savingProfile}
                      disabled={savingProfile}
                      icon={IconCheckCircle}
                    >
                      Save Profile
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>

            {/* ---------------------------------------------------------------
                SECTION 2: ACCOUNT PREFERENCES
               --------------------------------------------------------------- */}
            <Card
              title="Account Preferences"
              subtitle="Theme customization, interview defaults, and notification settings."
              icon={IconSun}
              accent="purple"
              accentBorder={true}
            >
              <div style={{ display: "grid", gap: 20 }}>
                {/* 1. Theme Customization */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: theme.radius.sm,
                    background: "var(--bg-secondary)",
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>
                        Color Theme
                      </h4>
                      <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: theme.textSecondary }}>
                        Toggle between luminous light and royal dark purple theme modes.
                      </p>
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: theme.primaryLight,
                        color: theme.primary,
                        border: `1px solid ${theme.primaryBorder}`,
                        padding: "2px 8px",
                        borderRadius: theme.radius.full,
                      }}
                    >
                      {darkMode ? "Dark Theme Active" : "Light Theme Active"}
                    </span>
                  </div>

                  {/* Dual Theme Selector Buttons */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, maxWidth: 440 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (darkMode) toggleTheme();
                        triggerPrefNotice("Light theme activated");
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: theme.radius.sm,
                        border: !darkMode ? `2px solid ${theme.primary}` : `1px solid ${theme.border}`,
                        background: !darkMode ? "var(--bg-surface)" : "var(--bg-secondary)",
                        color: !darkMode ? theme.primary : theme.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        fontWeight: !darkMode ? 700 : 500,
                        fontSize: 13,
                        boxShadow: !darkMode ? "0 4px 14px var(--primary-glow)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: !darkMode ? theme.primaryLight : "rgba(148, 163, 184, 0.15)",
                          color: !darkMode ? theme.primary : theme.muted,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconSun size={16} />
                      </div>
                      <span>Light Theme</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!darkMode) toggleTheme();
                        triggerPrefNotice("Dark theme activated");
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: theme.radius.sm,
                        border: darkMode ? `2px solid ${theme.primary}` : `1px solid ${theme.border}`,
                        background: darkMode ? "var(--bg-surface)" : "var(--bg-secondary)",
                        color: darkMode ? theme.primary : theme.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        fontWeight: darkMode ? 700 : 500,
                        fontSize: 13,
                        boxShadow: darkMode ? "0 4px 14px var(--primary-glow)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: darkMode ? theme.primaryLight : "rgba(148, 163, 184, 0.15)",
                          color: darkMode ? theme.primary : theme.muted,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconMoon size={16} />
                      </div>
                      <span>Dark Theme</span>
                    </button>
                  </div>
                </div>

                {/* 2. Notification Preferences */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: theme.radius.sm,
                    background: "var(--bg-secondary)",
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconBell size={16} color={theme.primary} />
                    Notification Preferences
                  </h4>

                  <div style={{ display: "grid", gap: 14 }}>
                    {/* Toggle Item: Email Reminders */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                          Interview Session Reminders
                        </div>
                        <div style={{ fontSize: 12, color: theme.muted }}>
                          Receive alerts for scheduled practice sessions and preparation checkpoints.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotification("emailReminders")}
                        aria-label="Toggle Interview Session Reminders"
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: theme.radius.full,
                          background: notifications.emailReminders ? theme.primary : "var(--border-color)",
                          border: "none",
                          cursor: "pointer",
                          position: "relative",
                          transition: "background 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: notifications.emailReminders ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>

                    {/* Toggle Item: Score Alerts */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                          AI Performance & Readiness Updates
                        </div>
                        <div style={{ fontSize: 12, color: theme.muted }}>
                          Get notified when your placement readiness score or skill evaluation is updated.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotification("scoreAlerts")}
                        aria-label="Toggle Performance Updates"
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: theme.radius.full,
                          background: notifications.scoreAlerts ? theme.primary : "var(--border-color)",
                          border: "none",
                          cursor: "pointer",
                          position: "relative",
                          transition: "background 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: notifications.scoreAlerts ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>

                    {/* Toggle Item: Study Roadmap Alerts */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                          Weekly Study Plan Alerts
                        </div>
                        <div style={{ fontSize: 12, color: theme.muted }}>
                          Daily task checklists and reminders from your AI Personalized Study Planner.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleNotification("studyRoadmapAlerts")}
                        aria-label="Toggle Study Plan Alerts"
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: theme.radius.full,
                          background: notifications.studyRoadmapAlerts ? theme.primary : "var(--border-color)",
                          border: "none",
                          cursor: "pointer",
                          position: "relative",
                          transition: "background 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: notifications.studyRoadmapAlerts ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Interview Preferences */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: theme.radius.sm,
                    background: "var(--bg-secondary)",
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconTarget size={16} color={theme.primary} />
                    Interview Defaults
                  </h4>

                  <div style={{ display: "grid", gap: 16 }}>
                    {/* Default Type: Standard vs Adaptive */}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
                        Default Interview Format
                      </label>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {[
                          { id: "standard", label: "Standard Mock Interview" },
                          { id: "adaptive", label: "Adaptive AI Interview" },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleInterviewTypeChange(t.id)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: theme.radius.sm,
                              border: defaultInterviewType === t.id ? `1.5px solid ${theme.primary}` : `1px solid ${theme.border}`,
                              background: defaultInterviewType === t.id ? theme.primaryLight : "var(--bg-surface)",
                              color: defaultInterviewType === t.id ? theme.primary : theme.textSecondary,
                              fontSize: 13,
                              fontWeight: defaultInterviewType === t.id ? 700 : 500,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Default Mode: Text vs Voice */}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
                        Preferred Input Mode
                      </label>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {[
                          { id: "text", label: "Text-Based", icon: IconFileText },
                          { id: "voice", label: "Voice Practice", icon: IconMic },
                        ].map((m) => {
                          const Icon = m.icon;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleInterviewModeChange(m.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 14px",
                                borderRadius: theme.radius.sm,
                                border: defaultInterviewMode === m.id ? `1.5px solid ${theme.primary}` : `1px solid ${theme.border}`,
                                background: defaultInterviewMode === m.id ? theme.primaryLight : "var(--bg-surface)",
                                color: defaultInterviewMode === m.id ? theme.primary : theme.textSecondary,
                                fontSize: 13,
                                fontWeight: defaultInterviewMode === m.id ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Icon size={14} />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Audio speech synthesis toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, paddingTop: 4 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                          Auto-Play AI Question Audio
                        </div>
                        <div style={{ fontSize: 12, color: theme.muted }}>
                          Speak questions aloud using text-to-speech when starting each question.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleAutoSpeak}
                        aria-label="Toggle Question Audio Auto-play"
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: theme.radius.full,
                          background: autoSpeakQuestions ? theme.primary : "var(--border-color)",
                          border: "none",
                          cursor: "pointer",
                          position: "relative",
                          transition: "background 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: autoSpeakQuestions ? 22 : 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ---------------------------------------------------------------
                SECTION 3: SECURITY & ACCOUNT ACTIONS
               --------------------------------------------------------------- */}
            <Card
              title="Security & Sign-In"
              subtitle="Password management, connected accounts, and session termination."
              icon={IconShield}
              accent="red"
              accentBorder={true}
            >
              <div style={{ display: "grid", gap: 20 }}>
                {/* 1. Connected Account Status */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: theme.radius.sm,
                    background: "var(--bg-secondary)",
                    border: `1px solid ${theme.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(59, 130, 246, 0.12)",
                        color: "#3B82F6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconShield size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                        {isGoogleAccount ? "Google OAuth Account" : "Standard Email & Password"}
                      </div>
                      <div style={{ fontSize: 12, color: theme.muted }}>
                        {isGoogleAccount
                          ? "Secured via Google Authentication with single sign-on."
                          : "Authenticated with personal email credentials."}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: theme.successLight,
                      color: theme.success,
                      border: `1px solid ${theme.successBorder}`,
                      padding: "3px 10px",
                      borderRadius: theme.radius.full,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <IconCheckCircle size={12} />
                    Connected
                  </span>
                </div>

                {/* 2. Change Password Form */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: theme.radius.sm,
                    background: "var(--bg-secondary)",
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconLock size={16} color={theme.primary} />
                    Change Account Password
                  </h4>

                  {passwordSuccess && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: theme.radius.sm,
                        background: theme.successLight,
                        border: `1px solid ${theme.successBorder}`,
                        color: theme.success,
                        marginBottom: 14,
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <IconCheckCircle size={16} />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  {passwordError && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: theme.radius.sm,
                        background: theme.dangerLight,
                        border: `1px solid ${theme.dangerBorder}`,
                        color: theme.danger,
                        marginBottom: 14,
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <IconAlertTriangle size={16} />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 14, maxWidth: 520 }}>
                    {/* Current Password */}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
                        Current Password
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          style={{ ...inputStyle, paddingRight: 40 }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          style={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            color: theme.muted,
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                          }}
                        >
                          {showCurrentPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
                        New Password (minimum 6 characters)
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          style={{ ...inputStyle, paddingRight: 40 }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            color: theme.muted,
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                          }}
                        >
                          {showNewPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
                        Confirm New Password
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          style={{ ...inputStyle, paddingRight: 40 }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            color: theme.muted,
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                          }}
                        >
                          {showConfirmPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Button
                        type="submit"
                        loading={passwordLoading}
                        disabled={passwordLoading}
                        icon={IconLock}
                        size="sm"
                      >
                        Update Password
                      </Button>
                    </div>
                  </form>
                </div>

                {/* 3. Logout Section */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: theme.radius.sm,
                    background: "var(--bg-secondary)",
                    border: `1px solid ${theme.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 14,
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>
                      Sign Out of Intervexa AI
                    </h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: theme.textSecondary }}>
                      End your active browser session and return to the sign-in screen.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={handleLogout}
                    icon={IconLogOut}
                    size="sm"
                    style={{
                      color: theme.danger,
                      borderColor: theme.dangerBorder,
                    }}
                  >
                    Log Out
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          /* ===================================================================
              INTERVIEW PERFORMANCE & HISTORY TAB (Preserved Existing Analytics)
             =================================================================== */
          <div style={{ display: "grid", gap: 22 }} className="animate-slide-up">
            {/* Main Stat Cards Row */}
            <div style={statRow}>
              <StatCard
                label="Total Interviews"
                value={totalCompleted}
                accent="purple"
                icon={IconBriefcase}
                subtext={hasCompletedInterviews ? "Completed mock sessions" : "No completed sessions yet"}
              />

              <StatCard
                label="Average Score"
                value={hasCompletedInterviews && stats.average > 0 ? `${stats.average}/10` : "—"}
                accent={hasCompletedInterviews ? "purple" : theme.muted}
                icon={IconAward}
                subtext={hasCompletedInterviews ? "Cumulative evaluation average" : "Requires completed session"}
              />

              <StatCard
                label="Personal Best"
                value={hasCompletedInterviews && stats.best > 0 ? `${stats.best}/10` : "—"}
                accent={hasCompletedInterviews ? "purple" : theme.muted}
                icon={IconSparkles}
                subtext={hasCompletedInterviews ? "Highest rating achieved" : "No evaluations recorded"}
              />
            </div>

            {/* Career Progress Breakdown */}
            <Card
              title="Your Interview Progress"
              subtitle="Performance trends, communication ratings, and primary role focus."
              icon={IconTrendingUp}
              accent="purple"
              accentBorder={true}
              style={{ marginBottom: 0 }}
            >
              {!hasCompletedInterviews ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 20px",
                    background: "var(--bg-secondary)",
                    borderRadius: theme.radius.sm,
                    border: `1px dashed ${theme.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "var(--primary-light)",
                      color: theme.primary,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <IconTarget size={24} />
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: theme.text }}>
                    No Interview Data Yet
                  </h4>
                  <p style={{ margin: "0 auto 18px", fontSize: 13, color: theme.textSecondary, maxWidth: 420, lineHeight: 1.5 }}>
                    Your interview progress will appear here after you complete your first mock interview.
                  </p>
                  <Button size="sm" onClick={() => navigate("/role")} icon={IconBriefcase}>
                    Start Interview
                  </Button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                    gap: 16,
                  }}
                >
                  {/* Technical Average */}
                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      padding: "16px 18px",
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Technical Mastery
                      </span>
                      <IconTarget size={16} color={theme.primary} />
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>
                        {avgTechnicalScore || stats.average || "—"}
                      </span>
                      <span style={{ fontSize: 13, color: theme.muted }}>/ 10</span>
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: 12, color: theme.textSecondary }}>
                      Mean across {validScores.length} technical evaluations
                    </p>
                  </div>

                  {/* Communication Average */}
                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      padding: "16px 18px",
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Communication Score
                      </span>
                      <IconMessageSquare size={16} color={theme.accent} />
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>
                        {avgCommunicationScore !== null ? `${avgCommunicationScore}%` : "N/A"}
                      </span>
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: 12, color: theme.textSecondary }}>
                      {avgCommunicationScore !== null ? "Speech clarity, pacing & structure" : "Pending voice interview session"}
                    </p>
                  </div>

                  {/* Most Practiced Role */}
                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      padding: "16px 18px",
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Primary Focus
                      </span>
                      <IconBriefcase size={16} color={theme.primary} />
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: theme.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={mostPracticed?.role}
                    >
                      {mostPracticed ? mostPracticed.role : "General Candidate"}
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: 12, color: theme.textSecondary }}>
                      {mostPracticed
                        ? `${mostPracticed.count} ${mostPracticed.count === 1 ? "session completed" : "sessions completed"}`
                        : "No sessions recorded"}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Recent Interviews List */}
            <Card
              title="Recent Interviews"
              subtitle="Your latest completed mock sessions and direct evaluation results."
              icon={IconResults}
              accent="purple"
              accentBorder={true}
              action={
                hasCompletedInterviews && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/history")}
                    icon={IconArrowRight}
                  >
                    View All History
                  </Button>
                )
              }
              style={{ marginBottom: 0 }}
            >
              {!hasCompletedInterviews ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "28px 16px",
                    background: "var(--bg-secondary)",
                    borderRadius: theme.radius.sm,
                    border: `1px dashed ${theme.border}`,
                  }}
                >
                  <p style={{ margin: "0 0 14px 0", fontSize: 13, color: theme.muted }}>
                    No recorded interview sessions found. Practice technical questions to build your history.
                  </p>
                  <Button size="sm" onClick={() => navigate("/role")} icon={IconBriefcase}>
                    Start First Interview
                  </Button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {history.slice(0, 4).map((item) => {
                    const score = Number(item.avg_score || 0);
                    const scoreColor = getScoreColor(score);
                    const scoreBg = getScoreBackground(score);
                    const scoreBorder = getScoreBorder(score);

                    return (
                      <div
                        key={item.id}
                        className="card-lift"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 14,
                          padding: "14px 18px",
                          background: "var(--bg-secondary)",
                          borderRadius: "14px",
                          border: `1px solid ${theme.border}`,
                          borderLeft: `3.5px solid ${scoreColor}`,
                          transition: "all 0.18s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: scoreBg,
                              color: scoreColor,
                              border: `1px solid ${scoreBorder}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <IconBriefcase size={18} />
                          </div>

                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                                {item.role || "Technical Interview"}
                              </span>

                              {item.interview_mode === "adaptive" && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: "var(--primary-light)",
                                    color: theme.primary,
                                    border: `1px solid ${theme.primaryBorder}`,
                                    padding: "1px 7px",
                                    borderRadius: theme.radius.full,
                                  }}
                                >
                                  Adaptive
                                </span>
                              )}
                              {item.interview_mode === "voice" && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: "rgba(16, 185, 129, 0.12)",
                                    color: "#10B981",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                    padding: "1px 7px",
                                    borderRadius: theme.radius.full,
                                  }}
                                >
                                  Voice
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: theme.muted, marginTop: 3 }}>
                              <IconClock size={12} />
                              <span>{formatDate(item.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <span
                            style={{
                              background: scoreBg,
                              color: scoreColor,
                              border: `1px solid ${scoreBorder}`,
                              padding: "4px 10px",
                              borderRadius: theme.radius.full,
                              fontWeight: 800,
                              fontSize: 13,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span>{score}</span>
                            <span style={{ fontSize: 11, opacity: 0.8 }}>/10</span>
                          </span>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/history/${item.id}`)}
                            icon={IconChevronRight}
                          >
                            View Results
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export default Profile;
