import { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { InterviewContext } from "../context/InterviewContext";
import PageShell from "../components/PageShell";
import Button from "../components/Button";
import PageActions from "../components/PageActions";
import AtsAnalysisDashboard from "../components/AtsAnalysisDashboard";
import { classifyAtsScore } from "../utils/atsScoreClassification";
import { textareaStyle, preStyle } from "../styles/shared";
import { API_BASE_URL } from "../config/api";
import {
  IconUpload,
  IconFileText,
  IconCheckCircle,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconSparkles,
  IconArrowRight,
  IconBriefcase,
  IconTrash,
  IconRefresh,
} from "../components/Icons";

const MAX_JD_CHARS = 10000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function UploadResume() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [showText, setShowText] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadRequestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);

  // Context State & Actions
  const {
    activeResumeId,
    skills,
    resumeText,
    resumeFileName,
    resumeAnalysis,
    updateResumeData,
    clearResumeData,
    jobDescription,
    setJobDescription,
    jdMatchResult,
    setJdMatchResult,
  } = useContext(InterviewContext);

  // Job Description Local State
  const [jdInput, setJdInput] = useState(() => jobDescription || localStorage.getItem("jobDescription") || "");
  const [analyzingJd, setAnalyzingJd] = useState(false);
  const [jdError, setJdError] = useState(null);
  const [isEditingJd, setIsEditingJd] = useState(false);
  const [retryingAi, setRetryingAi] = useState(false);

  // Clean up timers & abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const hasValidResume = Boolean(
    resumeText && typeof resumeText === "string" && resumeText.trim().length > 0
  );
  const effectiveResumePresent = hasValidResume;

  const hasValidAnalysis = Boolean(
    hasValidResume &&
    !uploading &&
    !file &&
    resumeAnalysis &&
    typeof resumeAnalysis === "object" &&
    resumeAnalysis.ats_score !== undefined &&
    resumeAnalysis.ats_score !== null &&
    !isNaN(Number(resumeAnalysis.ats_score))
  );

  const jdMatchScore = jdMatchResult?.match_score ?? 0;
  const jdScoreColor =
    jdMatchScore >= 75
      ? "var(--success)"
      : jdMatchScore >= 50
        ? "var(--warning)"
        : "var(--danger)";

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const validateAndSelectFile = (selectedFile) => {
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Invalid file format. Please upload a valid PDF document (.pdf).");
      return;
    }

    if (selectedFile.size === 0) {
      setUploadError("The selected PDF file is empty (0 bytes). Please upload a valid resume.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`File exceeds the maximum limit of 10MB (${formatFileSize(selectedFile.size)}). Please choose a smaller PDF.`);
      return;
    }

    // Cancel in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    uploadRequestIdRef.current++;

    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setFile(selectedFile);
  };

  const handleRemoveResume = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    uploadRequestIdRef.current++;

    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    setJdInput("");
    setJdError(null);
    clearResumeData();
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setShowText(false);
  };

  const handleCancelSelection = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (uploading) return;

    if (!file) {
      setUploadError("Please select a PDF resume file to upload.");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentReqId = ++uploadRequestIdRef.current;

    try {
      setUploading(true);
      setUploadProgress(15);
      setUploadError(null);

      progressTimerRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 88) {
            clearInterval(progressTimerRef.current);
            return 88;
          }
          return prev + Math.floor(Math.random() * 8 + 4);
        });
      }, 350);

      const formData = new FormData();
      formData.append("resume", file);

      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_BASE_URL}/upload_resume`, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (uploadRequestIdRef.current !== currentReqId) return;

      let data = null;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (uploadRequestIdRef.current !== currentReqId) return;

      if (!response.ok || !data || !data.success) {
        let errMsg = data?.message || data?.error;
        if (!errMsg) {
          if (response.status === 401 || response.status === 403) {
            errMsg = "Authentication session expired or invalid. Please sign in again.";
          } else if (response.status === 413) {
            errMsg = "File is too large. The maximum allowed PDF size is 10 MB.";
          } else if (response.status === 404) {
            errMsg = "Upload service endpoint not found (404). Please ensure the backend server is running.";
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            errMsg = `Backend server is currently unreachable (HTTP ${response.status} Bad Gateway). The frontend proxy cannot connect to the Flask server. Please verify that the Flask backend service is running on http://127.0.0.1:5000.`;
          } else if (response.status >= 500) {
            errMsg = `Backend server encountered an error (HTTP ${response.status}). Please check backend logs or try again.`;
          } else {
            errMsg = `Upload request failed with status ${response.status}. Please try again.`;
          }
        }
        setUploadError(errMsg);
        return;
      }

      if (!data.analysis || data.analysis.ats_score === undefined) {
        setUploadError("ATS evaluation could not be generated. Please upload a standard text PDF resume.");
        return;
      }

      setUploadProgress(100);

      updateResumeData({
        resumeId: data.resume_id || "",
        text: data.text || "",
        fileName: data.filename || file.name,
        skills: data.skills || [],
        analysis: data.analysis,
      });

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    } catch (error) {
      if (error.name === "AbortError" || uploadRequestIdRef.current !== currentReqId) {
        return;
      }
      console.error("Upload error:", error);
      if (typeof window !== "undefined" && !window.navigator?.onLine) {
        setUploadError("No internet connection detected. Please verify your network connection and try again.");
      } else if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("fetch failed")
      ) {
        setUploadError(
          "Unable to reach the backend server. Please verify that the Flask backend is active at http://127.0.0.1:5000."
        );
      } else {
        setUploadError(error.message || "An unexpected network error occurred while uploading resume.");
      }
    } finally {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      if (uploadRequestIdRef.current === currentReqId) {
        setUploading(false);
      }
    }
  };

  const handleRetryAiFeedback = async () => {
    if (retryingAi || !resumeText) return;
    setRetryingAi(true);
    setUploadError(null);

    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await fetch(`${API_BASE_URL}/resume/retry_ai_feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          resume_id: activeResumeId || "",
          resume_text: resumeText,
          job_description: jobDescription || "",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.analysis) {
        throw new Error(data.message || data.error || "Failed to generate AI feedback. Please try again.");
      }

      updateResumeData({
        resumeId: activeResumeId || "",
        text: resumeText,
        fileName: resumeFileName || "Resume.pdf",
        skills: skills || [],
        analysis: data.analysis,
      });
    } catch (err) {
      console.error("Retry AI feedback error:", err);
      setUploadError(err.message || "Failed to generate AI feedback. Please check your connection and try again.");
    } finally {
      setRetryingAi(false);
    }
  };

  const handleAnalyzeJd = async () => {
    if (analyzingJd) return;

    if (!hasValidResume) {
      setJdError("Please upload and analyze your resume first before matching against a Job Description.");
      return;
    }

    const trimmedJd = jdInput.trim();
    if (!trimmedJd) {
      setJdError("Please enter or paste a Job Description to analyze.");
      return;
    }

    if (trimmedJd.length > MAX_JD_CHARS) {
      setJdError(`Job Description exceeds maximum limit of ${MAX_JD_CHARS.toLocaleString()} characters. Please shorten it.`);
      return;
    }

    try {
      setAnalyzingJd(true);
      setJdError(null);

      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await fetch(`${API_BASE_URL}/analyze_jd_match`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          resume_id: activeResumeId || "",
          resume_text: resumeText,
          job_description: trimmedJd,
        }),
      });

      let data = null;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!response.ok || !data || !data.success) {
        let errMsg = data?.message || data?.error;
        if (!errMsg) {
          if (response.status === 401 || response.status === 403) {
            errMsg = "Authentication session expired or invalid. Please sign in again.";
          } else if (response.status === 404) {
            errMsg = "Job Description analysis endpoint not found (404).";
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            errMsg = `Backend server is currently unreachable (HTTP ${response.status} Bad Gateway). The frontend proxy cannot connect to the Flask server. Please verify that the Flask backend service is running on http://127.0.0.1:5000.`;
          } else if (response.status >= 500) {
            errMsg = `Backend server encountered an error (HTTP ${response.status}). Please check backend logs or try again.`;
          } else {
            errMsg = `Analysis request failed with status ${response.status}. Please try again.`;
          }
        }
        setJdError(errMsg);
        return;
      }

      setJobDescription(trimmedJd);
      setJdMatchResult(data);
      setIsEditingJd(false);
    } catch (error) {
      console.error("JD Match error:", error);
      if (typeof window !== "undefined" && !window.navigator?.onLine) {
        setJdError("No internet connection detected. Please verify your network connection and try again.");
      } else if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("fetch failed")
      ) {
        setJdError(
          "Unable to reach the backend server. Please verify that the Flask backend is active at http://127.0.0.1:5000."
        );
      } else {
        setJdError(error.message || "An unexpected error occurred while analyzing Job Description.");
      }
    } finally {
      setAnalyzingJd(false);
    }
  };

  const handleClearJd = () => {
    setJobDescription("");
    setJdMatchResult(null);
    setJdInput("");
    setIsEditingJd(false);
    setJdError(null);
  };

  const handleCopyParsedText = () => {
    if (!resumeText) return;
    navigator.clipboard.writeText(resumeText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <PageShell
      title="Resume Analysis & ATS Evaluation"
      subtitle="Analyze your resume, identify important skills, and evaluate your job readiness."
      hideStepper={true}
      actions={
        hasValidResume ? (
          <PageActions>
            <Button
              size="lg"
              onClick={() => navigate("/role")}
              icon={IconArrowRight}
              style={{
                height: 44,
                padding: "0 28px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 9999,
                background: "var(--primary)",
                color: "#FFFFFF",
                boxShadow: "0 4px 14px var(--primary-glow)",
              }}
            >
              Continue to Role Selection
            </Button>
          </PageActions>
        ) : null
      }
    >
      <div className="resume-analysis-container" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        {/* Error Alert */}
        {uploadError && (
          <div
            role="alert"
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              background: "var(--danger-light, rgba(239, 68, 68, 0.08))",
              border: "1px solid var(--danger-border, rgba(239, 68, 68, 0.3))",
              color: "var(--danger, #EF4444)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
              marginBottom: 20,
              animation: "fadeInUp 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <IconAlertTriangle size={18} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: 13.5, display: "block", marginBottom: 2 }}>
                  Resume Processing Issue
                </strong>
                <span style={{ fontSize: 13, lineHeight: 1.45 }}>{uploadError}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {file && (
                <Button size="sm" onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Analyzing..." : "Try Again"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setUploadError(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 1: RESUME UPLOAD (Open Layout, No Large Card Wrapper)
            ========================================================================= */}
        <section className="resume-section" aria-label="Resume Upload" style={{ marginBottom: 20 }}>
          {/* Section Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "var(--primary-light)",
                border: "1px solid var(--primary-border)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconUpload size={15} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
                Upload Your Resume
              </h2>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>
                Upload your resume in PDF format to analyze your skills and job readiness.
              </p>
            </div>
          </div>

          {/* Active File Bar or Drag-and-Drop Area */}
          {hasValidResume && !file ? (
            /* ACTIVE RESUME STRIP (Sleek, Clean, Open) */
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                {/* File Information */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 min(100%, 240px)", minWidth: 0 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: "var(--primary-light)",
                      border: "1px solid var(--primary-border)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconFileText size={20} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--text-main)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {resumeFileName || "Uploaded Resume.pdf"}
                      </h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--primary)",
                          background: "var(--primary-light)",
                          border: "1px solid var(--primary-border)",
                          padding: "2px 8px",
                          borderRadius: 9999,
                        }}
                      >
                        Active
                      </span>
                      {resumeAnalysis && resumeAnalysis.ats_score !== undefined && (
                        (() => {
                          const cls = classifyAtsScore(resumeAnalysis.ats_score);
                          if (!cls.isValid) return null;
                          return (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: cls.color,
                                background: cls.bg,
                                border: `1px solid ${cls.border}`,
                                padding: "2px 8px",
                                borderRadius: 9999,
                              }}
                            >
                              ATS: {cls.percentageDisplay} • {cls.category}
                            </span>
                          );
                        })()
                      )}
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
                      {skills.length} technical skills parsed &bull; {resumeText.length.toLocaleString()} characters extracted
                    </p>
                  </div>
                </div>

                {/* File Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <label
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        replaceFileInputRef.current?.click();
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      padding: "7px 14px",
                      borderRadius: 8,
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-main)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.18s ease",
                      userSelect: "none",
                    }}
                    className="resume-action-btn"
                  >
                    <IconRefresh size={14} color="var(--primary)" />
                    <span>Replace Resume</span>
                    <input
                      ref={replaceFileInputRef}
                      type="file"
                      accept=".pdf"
                      disabled={uploading}
                      aria-label="Replace PDF resume"
                      onChange={(e) => validateAndSelectFile(e.target.files?.[0])}
                      style={{ display: "none" }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowText(!showText)}
                    style={{
                      cursor: "pointer",
                      padding: "7px 14px",
                      borderRadius: 8,
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-main)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.18s ease",
                    }}
                    className="resume-action-btn"
                  >
                    {showText ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    <span>{showText ? "Hide Text" : "View Parsed Text"}</span>
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveResume}
                    icon={IconTrash}
                    style={{
                      color: "var(--danger, #EF4444)",
                      border: "1px solid var(--danger-border, rgba(239, 68, 68, 0.25))",
                      background: "var(--danger-light, rgba(239, 68, 68, 0.05))",
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {/* Collapsible Parsed Text */}
              {showText && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--border-color)",
                    animation: "fadeInUp 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Extracted Resume Text
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyParsedText}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {copiedText ? "✓ Copied to clipboard!" : "Copy Text"}
                    </button>
                  </div>
                  <pre
                    style={{
                      ...preStyle,
                      margin: 0,
                      maxHeight: 220,
                      overflowY: "auto",
                      fontSize: 12,
                      lineHeight: 1.5,
                      borderRadius: 8,
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      padding: "12px 14px",
                    }}
                  >
                    {resumeText}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* DRAG AND DROP AREA (Centered, Clean, Not Wrapped Inside an Outer Card) */
            <div>
              {uploading ? (
                <div
                  style={{
                    padding: "24px 20px",
                    textAlign: "center",
                    background: "var(--bg-secondary)",
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                      border: "1px solid var(--primary-border)",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        border: "2px solid var(--primary-border)",
                        borderTopColor: "var(--primary)",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                  </div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text-main)", margin: "0 0 4px 0" }}>
                    Analyzing Resume... {uploadProgress}%
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 auto 12px", maxWidth: 440, lineHeight: 1.5 }}>
                    Parsing document structure, extracting technical competencies, and computing ATS benchmark alignment.
                  </p>

                  <div
                    style={{
                      width: "100%",
                      maxWidth: 360,
                      height: 6,
                      borderRadius: 9999,
                      background: "var(--border-color)",
                      margin: "0 auto 14px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${uploadProgress}%`,
                        background: "var(--primary)",
                        borderRadius: 9999,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  <Button variant="ghost" size="sm" onClick={handleRemoveResume} style={{ color: "var(--text-muted)" }}>
                    Cancel Analysis
                  </Button>
                </div>
              ) : (
                /* Drag & Drop Upload Box */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      validateAndSelectFile(e.dataTransfer.files[0]);
                    }
                  }}
                  style={{
                    border: `2px dashed ${isDragOver || file ? "var(--primary)" : "var(--border-color)"}`,
                    borderRadius: 12,
                    padding: "24px 20px",
                    textAlign: "center",
                    background: isDragOver || file ? "var(--primary-light)" : "var(--bg-secondary)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--bg-surface)",
                      border: `1px solid ${file ? "var(--primary)" : "var(--border-color)"}`,
                      color: file ? "var(--primary)" : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconFileText size={20} />
                  </div>

                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", margin: "0 0 3px 0" }}>
                      {file ? file.name : "Drag and drop your PDF resume here"}
                    </p>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
                      {file
                        ? `File ready to evaluate (${formatFileSize(file.size)})`
                        : "or browse from your device"}
                    </p>
                  </div>

                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Supported format: PDF only &bull; Maximum file size: 10MB
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    <label
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          fileInputRef.current?.click();
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "var(--text-main)",
                        display: "inline-block",
                        transition: "all 0.18s ease",
                        userSelect: "none",
                      }}
                      className="resume-action-btn"
                    >
                      <span>{file ? "Change File" : "Browse Files"}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        disabled={uploading}
                        aria-label="Upload PDF resume"
                        onChange={(e) => validateAndSelectFile(e.target.files?.[0])}
                        style={{ display: "none" }}
                      />
                    </label>

                    {file && (
                      <Button variant="ghost" onClick={handleCancelSelection} size="sm">
                        Cancel
                      </Button>
                    )}

                    <Button
                      onClick={handleUpload}
                      disabled={uploading || !file}
                      loading={uploading}
                      icon={IconSparkles}
                      size="sm"
                      style={{
                        padding: "8px 18px",
                        borderRadius: 8,
                        background: "var(--primary)",
                        color: "#FFFFFF",
                      }}
                    >
                      {uploading ? "Analyzing..." : "Analyze Resume"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section Divider */}
        {hasValidAnalysis && (
          <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "24px 0" }} />
        )}

        {/* =========================================================================
            SECTION 2: RESUME ANALYSIS RESULTS (ATS Score, Skills, Strengths, Suggestions)
            ========================================================================= */}
        {hasValidAnalysis && (
          <>
            {resumeAnalysis?.ai_feedback_status === "unavailable" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  color: "var(--warning)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
                  <IconAlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>AI Feedback Unavailable:</strong> Live AI advisory timed out, but your deterministic ATS compatibility score, factor breakdown, and skill extractions are 100% verified and preserved below.
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleRetryAiFeedback}
                  disabled={retryingAi}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    background: "var(--warning)",
                    color: "#000",
                    fontWeight: 600,
                  }}
                >
                  <IconRefresh size={14} className={retryingAi ? "spin" : ""} />
                  {retryingAi ? "Generating AI Advisory..." : "Retry AI Feedback"}
                </Button>
              </div>
            )}
            <AtsAnalysisDashboard analysis={resumeAnalysis} skills={skills} jdMatchResult={jdMatchResult} />
          </>
        )}

        {/* Section Divider */}
        <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "18px 0" }} />

        {/* =========================================================================
            SECTION 3: TARGET JOB DESCRIPTION MATCHING (Open Section, Wide Textarea)
            ========================================================================= */}
        <section className="resume-section" aria-label="Job Description Matching" style={{ marginBottom: 20 }}>
          {/* Section Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: "var(--primary-light)",
                  border: "1px solid var(--primary-border)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconBriefcase size={15} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
                  Target Job Description Matching (Optional)
                </h2>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>
                  Compare your resume against specific job requirements to evaluate keyword match and skill gaps.
                </p>
              </div>
            </div>

            {jdMatchResult && !isEditingJd && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 9999,
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  border: "1px solid var(--primary-border)",
                }}
              >
                {jdMatchResult.match_score}% Match Confidence
              </span>
            )}
          </div>

          {/* Form Input Mode */}
          {!jdMatchResult || isEditingJd ? (
            <div>
              {!jdMatchResult && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "var(--bg-secondary)",
                    border: "1px dashed var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  <IconBriefcase size={15} style={{ color: "var(--text-muted)" }} />
                  <span>
                    <strong>Job Description Match: Not Available</strong> – Add a Job Description to evaluate alignment.
                  </span>
                </div>
              )}
              <textarea
                rows={5}
                placeholder="Paste a target job posting here (e.g. required skills, frameworks, responsibilities from LinkedIn, Indeed, or company careers page)..."
                value={jdInput}
                onChange={(e) => {
                  setJdInput(e.target.value);
                  if (jdError) setJdError(null);
                }}
                style={{
                  ...textareaStyle,
                  minHeight: 120,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  borderRadius: 10,
                  border: `1px solid ${jdInput.length > MAX_JD_CHARS ? "var(--danger)" : "var(--border-color)"}`,
                  background: "var(--bg-surface)",
                  boxSizing: "border-box",
                  width: "100%",
                }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 12 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: jdInput.length > MAX_JD_CHARS ? "var(--danger)" : "var(--text-muted)",
                    fontWeight: jdInput.length > MAX_JD_CHARS ? 700 : 500,
                  }}
                >
                  {jdInput.length.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()} characters
                </span>

                <div style={{ display: "flex", gap: 10 }}>
                  {isEditingJd && (
                    <Button variant="secondary" onClick={() => setIsEditingJd(false)} size="sm">
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleAnalyzeJd}
                    disabled={analyzingJd || !jdInput.trim() || !effectiveResumePresent}
                    loading={analyzingJd}
                    icon={IconSparkles}
                    size="sm"
                    style={{
                      background: "var(--primary)",
                      color: "#FFFFFF",
                    }}
                  >
                    {analyzingJd ? "Matching..." : "Analyze Match"}
                  </Button>
                </div>
              </div>

              {!effectiveResumePresent && (
                <p style={{ margin: "10px 0 0 0", fontSize: 13, color: "var(--warning)", fontWeight: 600 }}>
                  Upload your resume above first to enable Job Description matching.
                </p>
              )}

              {jdError && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "var(--danger-light)", border: "1px solid var(--danger-border)", color: "var(--danger)", fontSize: 13 }}>
                  {jdError}
                </div>
              )}
            </div>
          ) : (
            /* Match Results View */
            <div>
              {/* Match Score Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 14,
                  padding: "16px 20px",
                  borderRadius: 10,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  marginBottom: 16,
                }}
              >
                <div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Job Description Match Confidence
                  </span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: jdScoreColor }}>
                      {jdMatchResult.match_score}%
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                      {jdMatchResult.match_score >= 75
                        ? "High Candidate Alignment"
                        : jdMatchResult.match_score >= 50
                          ? "Moderate Fit — Address Missing Keywords"
                          : "Low Alignment — Critical Gaps Detected"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button variant="secondary" size="sm" onClick={() => setIsEditingJd(true)}>
                    Edit Job Description
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClearJd}>
                    Clear
                  </Button>
                </div>
              </div>

              {/* Matching Skills vs Missing Gaps (2-Column Grid) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14, marginBottom: 14 }}>
                {/* Matching Skills */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <IconCheckCircle size={16} color="var(--primary)" />
                    <strong style={{ fontSize: 13.5, color: "var(--text-main)" }}>
                      Matching Skills ({jdMatchResult.matching_skills?.length || 0})
                    </strong>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {jdMatchResult.matching_skills && jdMatchResult.matching_skills.length > 0 ? (
                      jdMatchResult.matching_skills.map((skill, i) => (
                        <span
                          key={i}
                          style={{
                            background: "var(--primary-light)",
                            color: "var(--primary)",
                            border: "1px solid var(--primary-border)",
                            padding: "4px 10px",
                            borderRadius: 9999,
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          ✓ {skill}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No direct skill matches detected.</span>
                    )}
                  </div>
                </div>

                {/* Missing Skills / Gaps */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <IconAlertTriangle size={16} color="var(--warning, #F59E0B)" />
                    <strong style={{ fontSize: 13.5, color: "var(--text-main)" }}>
                      Missing Skill Gaps ({jdMatchResult.missing_skills?.length || 0})
                    </strong>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {jdMatchResult.missing_skills && jdMatchResult.missing_skills.length > 0 ? (
                      jdMatchResult.missing_skills.map((skill, i) => (
                        <span
                          key={i}
                          style={{
                            background: "var(--bg-surface)",
                            color: "var(--text-secondary)",
                            border: "1.5px dashed var(--border-color)",
                            padding: "4px 10px",
                            borderRadius: 9999,
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          ✕ {skill}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>All core JD skills are evidenced in your resume!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Relevant Experience & Strengths */}
              {(jdMatchResult.relevant_experience || jdMatchResult.strengths) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14, marginBottom: 14 }}>
                  {jdMatchResult.relevant_experience && (
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 4 }}>
                        Relevant Experience Alignment
                      </span>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-main)", lineHeight: 1.5 }}>
                        {jdMatchResult.relevant_experience}
                      </p>
                    </div>
                  )}

                  {jdMatchResult.strengths && (
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 4 }}>
                        Key Strengths for this Posting
                      </span>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-main)", lineHeight: 1.5 }}>
                        {jdMatchResult.strengths}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Improvement Suggestions to Bridge Gap */}
              {jdMatchResult.improvement_suggestions && jdMatchResult.improvement_suggestions.length > 0 && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 10,
                    background: "var(--primary-light)",
                    border: "1px solid var(--primary-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <IconSparkles size={16} color="var(--primary)" />
                    <strong style={{ fontSize: 13.5, color: "var(--primary)" }}>
                      Actionable Steps to Bridge Job Requirements
                    </strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-main)", fontSize: 13, lineHeight: 1.6 }}>
                    {jdMatchResult.improvement_suggestions.map((sug, i) => (
                      <li key={i}>{sug}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .resume-action-btn:hover {
          border-color: var(--primary) !important;
          background: var(--primary-light) !important;
          color: var(--primary) !important;
        }
      `}</style>
    </PageShell>
  );
}

export default UploadResume;
