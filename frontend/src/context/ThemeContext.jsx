import {
  createContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  lightTheme,
  darkTheme,
} from "../styles/theme";

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Synchronous initialization to prevent visual flashing
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") return true;
      if (savedTheme === "light") return false;

      const savedDarkMode = localStorage.getItem("darkMode");
      if (savedDarkMode !== null) {
        return JSON.parse(savedDarkMode);
      }

      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    } catch {
      // fallback
    }
    return false;
  });

  // Apply data-theme attribute and dark class to document element
  const applyThemeToDOM = useCallback((isDark) => {
    if (typeof document === "undefined") return;
    const themeName = isDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", themeName);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Update DOM whenever darkMode changes
  useEffect(() => {
    applyThemeToDOM(darkMode);
  }, [darkMode, applyThemeToDOM]);

  // Listen for system theme changes if user has not set an explicit preference
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      const userHasExplicit = localStorage.getItem("theme") !== null || localStorage.getItem("darkMode") !== null;
      if (!userHasExplicit) {
        setDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
        localStorage.setItem("darkMode", JSON.stringify(next));
      } catch (err) {
        console.error("Failed to save theme to localStorage", err);
      }
      applyThemeToDOM(next);
      return next;
    });
  }, [applyThemeToDOM]);

  const setTheme = useCallback((themeName) => {
    const isDark = themeName === "dark";
    setDarkMode(isDark);
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
      localStorage.setItem("darkMode", JSON.stringify(isDark));
    } catch (err) {
      console.error("Failed to save theme to localStorage", err);
    }
    applyThemeToDOM(isDark);
  }, [applyThemeToDOM]);

  return (
    <ThemeContext.Provider
      value={{
        darkMode,
        isDark: darkMode,
        toggleTheme,
        setTheme,
        theme: darkMode ? darkTheme : lightTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}