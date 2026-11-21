import { createContext, useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../config/api";

export const AuthContext = createContext();

/**
 * AuthProvider
 *
 * Manages authentication state with persistent localStorage storage.
 * On mount it performs a token validation request against /auth/verify
 * to detect expired or invalid tokens from a previous session.
 * Until verification completes, isAuthLoading is true, and isAuthenticated is false.
 */
export function AuthProvider({ children }) {
  // Stored user object from localStorage
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined" || stored === "null") return null;
      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === "object" && (parsed.id || parsed.email) ? parsed : null;
    } catch {
      return null;
    }
  });

  // Stored JWT token from localStorage
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);

  // True while actively verifying stored token against the backend
  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    return Boolean(localStorage.getItem("token"));
  });

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } catch (e) {
      console.error("[AuthContext] Error removing credentials:", e);
    }
    setIsAuthLoading(false);
  }, []);

  const login = useCallback((userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    try {
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("token", userToken);
    } catch (e) {
      console.error("[AuthContext] Error storing credentials:", e);
    }
    setIsAuthLoading(false);
  }, []);

  /**
   * Validate the stored token against /auth/verify.
   * If rejected with 401 or 403, immediately cleans auth state.
   */
  const validateStoredToken = useCallback(
    async (storedToken) => {
      if (!storedToken) {
        setIsAuthLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.user && data.user.id) {
            setUser(data.user);
            try {
              localStorage.setItem("user", JSON.stringify(data.user));
            } catch {
              // ignore storage quota issues
            }
          } else {
            console.warn("[AuthContext] /auth/verify missing valid user payload — clearing auth state.");
            logout();
          }
        } else if (response.status === 401 || response.status === 403) {
          console.warn("[AuthContext] Stored token rejected by server (401/403) — clearing auth state.");
          logout();
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("[AuthContext] Token validation request ended (network or timeout):", err?.message || err);
      } finally {
        setIsAuthLoading(false);
      }
    },
    [logout]
  );

  // Run validation on initial mount
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      validateStoredToken(storedToken);
    } else {
      setIsAuthLoading(false);
    }
  }, [validateStoredToken]);

  const isAuthenticated = Boolean(
    !isAuthLoading && token && user && typeof user === "object" && (user.id || user.email)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthLoading,
        isAuthenticated,
        login,
        logout,
        validateStoredToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
