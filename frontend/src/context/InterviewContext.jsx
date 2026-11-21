import { createContext, useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../config/api";

export const InterviewContext = createContext();

export const InterviewProvider = ({ children }) => {
  // Helper to validate whether stored string is genuinely non-empty
  const isNonEmptyString = (val) =>
    typeof val === "string" && val.trim().length > 0 && val !== "null" && val !== "undefined";

  // Active Resume ID: unique identifier ensuring strict resume-specific data association
  const [activeResumeId, setActiveResumeIdState] = useState(() => {
    const rawId = localStorage.getItem("activeResumeId");
    const rawResume = localStorage.getItem("resumeText");
    if (!isNonEmptyString(rawResume) || !isNonEmptyString(rawId)) {
      if (rawId !== null) localStorage.removeItem("activeResumeId");
      return "";
    }
    return rawId.trim();
  });

  // Resume Text: source of truth for whether a resume is loaded
  const [resumeText, setResumeTextState] = useState(() => {
    const raw = localStorage.getItem("resumeText");
    if (!isNonEmptyString(raw)) {
      if (raw !== null) localStorage.removeItem("resumeText");
      return "";
    }
    return raw.trim();
  });

  const [resumeFileName, setResumeFileNameState] = useState(() => {
    const rawResume = localStorage.getItem("resumeText");
    const rawName = localStorage.getItem("resumeFileName");
    if (!isNonEmptyString(rawResume) || !isNonEmptyString(rawName)) {
      if (rawName !== null) localStorage.removeItem("resumeFileName");
      return "";
    }
    return rawName.trim();
  });

  // Skills: only load if a valid resumeText is present
  const [skills, setSkillsState] = useState(() => {
    try {
      const storedResume = localStorage.getItem("resumeText");
      const storedSkills = localStorage.getItem("skills");
      if (!isNonEmptyString(storedResume) || !storedSkills) {
        if (!isNonEmptyString(storedResume) && storedSkills) localStorage.removeItem("skills");
        return [];
      }
      const parsed = JSON.parse(storedSkills);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      localStorage.removeItem("skills");
      return [];
    }
  });

  // ATS Resume Analysis: strictly bound to active resumeText and verified association
  const [resumeAnalysis, setResumeAnalysisState] = useState(() => {
    try {
      const storedResume = localStorage.getItem("resumeText");
      const storedAnalysis = localStorage.getItem("resumeAnalysis");
      const storedFileName = localStorage.getItem("resumeFileName");
      if (!isNonEmptyString(storedResume) || !storedAnalysis) {
        if (!isNonEmptyString(storedResume) && storedAnalysis) localStorage.removeItem("resumeAnalysis");
        return null;
      }
      const parsed = JSON.parse(storedAnalysis);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        parsed.ats_score === undefined ||
        parsed.ats_score === null ||
        isNaN(Number(parsed.ats_score))
      ) {
        localStorage.removeItem("resumeAnalysis");
        return null;
      }
      if (parsed._associatedFileName && storedFileName && parsed._associatedFileName !== storedFileName) {
        localStorage.removeItem("resumeAnalysis");
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem("resumeAnalysis");
      return null;
    }
  });

  const [role, setRoleState] = useState(() => {
    return localStorage.getItem("role") || "";
  });

  const setRole = (newRole) => {
    setRoleState(newRole);
    if (newRole) {
      localStorage.setItem("role", newRole);
    } else {
      localStorage.removeItem("role");
    }
  };

  const setResumeText = (text) => {
    const clean = isNonEmptyString(text) ? text.trim() : "";
    setResumeTextState(clean);
    if (clean) {
      localStorage.setItem("resumeText", clean);
    } else {
      clearResumeData();
    }
  };

  const setResumeFileName = (name) => {
    const clean = isNonEmptyString(name) ? name.trim() : "";
    setResumeFileNameState(clean);
    if (clean) {
      localStorage.setItem("resumeFileName", clean);
    } else {
      localStorage.removeItem("resumeFileName");
    }
  };

  const setSkills = (newSkills) => {
    const cleanList = Array.isArray(newSkills) ? newSkills : [];
    setSkillsState(cleanList);
    if (cleanList.length > 0) {
      localStorage.setItem("skills", JSON.stringify(cleanList));
    } else {
      localStorage.removeItem("skills");
    }
  };

  const setResumeAnalysis = (analysis) => {
    if (!isNonEmptyString(resumeText)) {
      setResumeAnalysisState(null);
      localStorage.removeItem("resumeAnalysis");
      return;
    }
    if (analysis && analysis.ats_score !== undefined && analysis.ats_score !== null && !isNaN(Number(analysis.ats_score))) {
      const associated = {
        ...analysis,
        _associatedResumeId: activeResumeId || "",
        _associatedFileName: resumeFileName || "",
      };
      setResumeAnalysisState(associated);
      localStorage.setItem("resumeAnalysis", JSON.stringify(associated));
    } else {
      setResumeAnalysisState(null);
      localStorage.removeItem("resumeAnalysis");
    }
  };

  const updateResumeData = ({ resumeId, text, fileName, skills: newSkills, analysis }) => {
    const cleanId = isNonEmptyString(resumeId) ? resumeId.trim() : (activeResumeId || "");
    const cleanText = isNonEmptyString(text) ? text.trim() : "";
    const cleanFileName = isNonEmptyString(fileName) ? fileName.trim() : "";
    const cleanSkills = Array.isArray(newSkills) ? newSkills : [];

    let cleanAnalysis = null;
    if (
      cleanText &&
      analysis &&
      typeof analysis === "object" &&
      analysis.ats_score !== undefined &&
      analysis.ats_score !== null &&
      !isNaN(Number(analysis.ats_score))
    ) {
      cleanAnalysis = {
        ...analysis,
        _associatedResumeId: cleanId,
        _associatedFileName: cleanFileName,
      };
    }

    setActiveResumeIdState(cleanId);
    setResumeTextState(cleanText);
    setResumeFileNameState(cleanFileName);
    setSkillsState(cleanSkills);
    setResumeAnalysisState(cleanAnalysis);

    try {
      if (cleanId) localStorage.setItem("activeResumeId", cleanId);
      else localStorage.removeItem("activeResumeId");

      if (cleanText) localStorage.setItem("resumeText", cleanText);
      else localStorage.removeItem("resumeText");

      if (cleanFileName) localStorage.setItem("resumeFileName", cleanFileName);
      else localStorage.removeItem("resumeFileName");

      if (cleanSkills.length > 0) localStorage.setItem("skills", JSON.stringify(cleanSkills));
      else localStorage.removeItem("skills");

      if (cleanAnalysis) localStorage.setItem("resumeAnalysis", JSON.stringify(cleanAnalysis));
      else localStorage.removeItem("resumeAnalysis");

      // Notify other components & Dashboard immediately without page refresh
      window.dispatchEvent(
        new CustomEvent("resumeStateChanged", {
          detail: { type: "updated", resumeId: cleanId, fileName: cleanFileName },
        })
      );
    } catch (e) {
      console.warn("Storage write error", e);
    }
  };

  const clearResumeData = ({ clearActiveResults = false } = {}) => {
    setActiveResumeIdState("");
    setResumeTextState("");
    setResumeFileNameState("");
    setResumeAnalysisState(null);
    setSkillsState([]);
    setJdMatchResultState(null);

    try {
      localStorage.removeItem("activeResumeId");
      localStorage.removeItem("resumeText");
      localStorage.removeItem("resumeFileName");
      localStorage.removeItem("resumeAnalysis");
      localStorage.removeItem("skills");
      localStorage.removeItem("jdMatchResult");
      localStorage.removeItem("jobDescription");

      const resultsResume = localStorage.getItem("resultsResumeFileName");
      if (clearActiveResults || resultsResume) {
        setResultsState([]);
        localStorage.removeItem("results");
        localStorage.removeItem("summary");
        localStorage.removeItem("resultsResumeFileName");
      }

      // Notify other components & Dashboard immediately without page refresh
      window.dispatchEvent(
        new CustomEvent("resumeStateChanged", {
          detail: { type: "cleared" },
        })
      );

      // Call backend DELETE endpoint to deactivate active resume in SQLite
      const token = localStorage.getItem("token");
      if (token) {
        fetch(`${API_BASE_URL}/resume/active`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }).catch((err) => console.warn("Backend resume delete notice:", err));
      }
    } catch (e) {
      console.warn("Storage removal error", e);
    }
  };

  const syncActiveResumeWithBackend = useCallback(async (token) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/resume/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.has_active_resume && data.resume) {
          const r = data.resume;
          setActiveResumeIdState(r.resume_id || "");
          setResumeTextState(r.text || "");
          setResumeFileNameState(r.filename || "");
          setSkillsState(r.skills || []);
          setResumeAnalysisState(r.analysis || null);
          setJdMatchResultState(r.jd_match || null);

          localStorage.setItem("activeResumeId", r.resume_id || "");
          localStorage.setItem("resumeText", r.text || "");
          localStorage.setItem("resumeFileName", r.filename || "");
          localStorage.setItem("skills", JSON.stringify(r.skills || []));
          localStorage.setItem("resumeAnalysis", JSON.stringify(r.analysis || {}));
          if (r.jd_match) {
            localStorage.setItem("jdMatchResult", JSON.stringify(r.jd_match));
          } else {
            localStorage.removeItem("jdMatchResult");
          }
        } else {
          // Backend has NO active resume for this user -> clear any stale local resume data
          setActiveResumeIdState("");
          setResumeTextState("");
          setResumeFileNameState("");
          setResumeAnalysisState(null);
          setSkillsState([]);
          setJdMatchResultState(null);

          localStorage.removeItem("activeResumeId");
          localStorage.removeItem("resumeText");
          localStorage.removeItem("resumeFileName");
          localStorage.removeItem("resumeAnalysis");
          localStorage.removeItem("skills");
          localStorage.removeItem("jdMatchResult");
          localStorage.removeItem("jobDescription");
        }
      }
    } catch (err) {
      console.warn("Sync active resume error:", err);
    }
  }, []);

  // Sync active resume with backend on mount or when token is present
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      syncActiveResumeWithBackend(token);
    }
  }, [syncActiveResumeWithBackend]);

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [results, setResultsState] = useState(() => {
    try {
      const stored = localStorage.getItem("results");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const setResults = (newResults) => {
    setResultsState(newResults || []);
    try {
      if (newResults && newResults.length > 0) {
        localStorage.setItem("results", JSON.stringify(newResults));
      } else {
        localStorage.removeItem("results");
      }
    } catch (e) {
      console.warn("Storage write failed in setResults:", e);
    }
  };

  const [jobDescription, setJobDescriptionState] = useState(() => {
    const storedResume = localStorage.getItem("resumeText");
    const storedJd = localStorage.getItem("jobDescription");
    if (!isNonEmptyString(storedResume) || !isNonEmptyString(storedJd)) {
      if (storedJd) localStorage.removeItem("jobDescription");
      return "";
    }
    return storedJd.trim();
  });

  const setJobDescription = (desc) => {
    setJobDescriptionState(desc || "");
    if (desc) {
      localStorage.setItem("jobDescription", desc);
    } else {
      localStorage.removeItem("jobDescription");
    }
  };

  const [jdMatchResult, setJdMatchResultState] = useState(() => {
    try {
      const storedResume = localStorage.getItem("resumeText");
      const stored = localStorage.getItem("jdMatchResult");
      if (!isNonEmptyString(storedResume) || !stored) {
        if (stored) localStorage.removeItem("jdMatchResult");
        return null;
      }
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem("jdMatchResult");
      return null;
    }
  });

  const setJdMatchResult = (match) => {
    if (!isNonEmptyString(resumeText)) {
      setJdMatchResultState(null);
      localStorage.removeItem("jdMatchResult");
      return;
    }
    setJdMatchResultState(match);
    if (match) {
      localStorage.setItem("jdMatchResult", JSON.stringify(match));
    } else {
      localStorage.removeItem("jdMatchResult");
    }
  };

  const [interviewType, setInterviewType] = useState(() => {
    return localStorage.getItem("interviewType") || "standard";
  });

  const [adaptiveSession, setAdaptiveSession] = useState(() => {
    try {
      const stored = localStorage.getItem("adaptiveSession");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const hasActiveResume = Boolean(
    activeResumeId &&
    resumeFileName &&
    resumeText &&
    resumeAnalysis &&
    resumeAnalysis.ats_score !== undefined &&
    resumeAnalysis.ats_score !== null &&
    !isNaN(Number(resumeAnalysis.ats_score))
  );

  return (
    <InterviewContext.Provider
      value={{
        activeResumeId,
        setActiveResumeId: setActiveResumeIdState,

        hasActiveResume,

        skills,
        setSkills,

        resumeText,
        setResumeText,

        resumeFileName,
        setResumeFileName,

        resumeAnalysis,
        setResumeAnalysis,

        updateResumeData,
        clearResumeData,
        syncActiveResumeWithBackend,

        role,
        setRole,

        questions,
        setQuestions,

        answers,
        setAnswers,

        results,
        setResults,

        jobDescription,
        setJobDescription,

        jdMatchResult,
        setJdMatchResult,

        interviewType,
        setInterviewType,

        adaptiveSession,
        setAdaptiveSession,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
};
