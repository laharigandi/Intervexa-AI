import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { InterviewContext } from "../context/InterviewContext";
import theme from "../styles/theme";
import { API_BASE_URL } from "../config/api";
import robotAvatar from "../assets/chatbot-robot-circle.png";
import {
  IconBot,
  IconSparkles,
  IconSend,
  IconX,
  IconMinimize,
  IconTrash,
  IconArrowRight,
  IconCheckCircle,
  IconAlertTriangle,
} from "./Icons";

// Context mappings & badges
const CONTEXT_CONFIG = {
  dashboard: {
    label: "Dashboard Coach",
    icon: "🎯",
    description: "Guidance on preparation status & readiness",
  },
  resume_analysis: {
    label: "Resume & ATS Coach",
    icon: "📄",
    description: "Actionable ATS optimization & skill advice",
  },
  standard_interview: {
    label: "Interview Hint Coach",
    icon: "💡",
    description: "STAR frameworks, hints & concept clarity",
  },
  adaptive_interview: {
    label: "Adaptive Interview Coach",
    icon: "⚡",
    description: "Adaptive difficulty hints & deep-dives",
  },
  results: {
    label: "Evaluation Review Coach",
    icon: "📊",
    description: "Score breakdowns & mistake analysis",
  },
  study_planner: {
    label: "Study Roadmap Coach",
    icon: "📚",
    description: "7-day planning & daily learning tasks",
  },
  role_selection: {
    label: "Role Selection Guide",
    icon: "🧭",
    description: "Role expectations & interview tips",
  },
  general: {
    label: "Career & Placement Coach",
    icon: "✨",
    description: "General interview coaching & prep",
  },
};

// Fallback suggested starter questions per context
const DEFAULT_SUGGESTED_QUESTIONS = {
  dashboard: [
    "What should I practice next to boost my readiness?",
    "How is my AI Readiness Score calculated?",
    "What are my biggest weak areas from past interviews?",
  ],
  resume_analysis: [
    "How can I improve my ATS score to 85+?",
    "What critical skills are missing from my resume?",
    "How do I describe my projects with quantifiable impact?",
  ],
  standard_interview: [
    "Can you give me a hint for this interview question?",
    "How should I structure my answer using the STAR method?",
    "Explain the core technical concept behind this question.",
  ],
  adaptive_interview: [
    "Why did the AI adjust the question difficulty?",
    "Can you clarify the technical concept in this follow-up?",
    "How can I make my technical explanation more rigorous?",
  ],
  results: [
    "Why did I get this technical score?",
    "How can I improve my communication and clarity score?",
    "What topics should I focus on before my next interview?",
  ],
  study_planner: [
    "Create a 7-day preparation schedule for my weak topics.",
    "Explain today's highest priority study task.",
    "How do I balance theory and coding practice?",
  ],
  role_selection: [
    "What technical skills are in highest demand for this role?",
    "What type of questions should I expect in this interview?",
    "Which interviewer personality should I practice with?",
  ],
  general: [
    "How can I prepare for technical placements effectively?",
    "What is the best way to answer behavioral interview questions?",
    "Give me tips for staying calm and articulate in interviews.",
  ],
};

/**
 * Lightweight in-app markdown and code renderer
 */
function MarkdownRenderer({ content, isUser }) {
  if (!content) return null;

  // Split into lines
  const lines = content.split("\n");
  const renderedElements = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  const parseInline = (text) => {
    // Bold **text**
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} style={{ fontWeight: 700, color: isUser ? "#FFFFFF" : "inherit" }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              background: isUser ? "rgba(255,255,255,0.2)" : "var(--bg-main)",
              border: isUser ? "none" : "1px solid var(--border-color)",
              fontSize: "12px",
              fontFamily: "ui-monospace, monospace",
              color: isUser ? "#FFFFFF" : "var(--primary)",
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        renderedElements.push(
          <pre
            key={`code-${index}`}
            style={{
              background: isUser ? "rgba(0,0,0,0.3)" : "var(--bg-main)",
              border: `1px solid ${isUser ? "rgba(255,255,255,0.15)" : "var(--border-color)"}`,
              borderRadius: "8px",
              padding: "10px 12px",
              margin: "6px 0",
              overflowX: "auto",
              fontSize: "12px",
              lineHeight: 1.45,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Headings ###
    if (line.startsWith("### ")) {
      renderedElements.push(
        <div
          key={`h3-${index}`}
          style={{
            fontSize: "13.5px",
            fontWeight: 800,
            marginTop: index === 0 ? "0" : "8px",
            marginBottom: "4px",
            color: isUser ? "#FFFFFF" : "var(--primary)",
          }}
        >
          {line.replace("### ", "")}
        </div>
      );
      return;
    }

    // Blockquote >
    if (line.startsWith("> ")) {
      renderedElements.push(
        <blockquote
          key={`quote-${index}`}
          style={{
            borderLeft: `3px solid ${isUser ? "#FFFFFF" : "var(--primary)"}`,
            paddingLeft: "10px",
            margin: "6px 0",
            fontStyle: "italic",
            color: isUser ? "#E2E8F0" : "var(--text-secondary)",
            fontSize: "12.5px",
          }}
        >
          {parseInline(line.replace("> ", ""))}
        </blockquote>
      );
      return;
    }

    // Bullet points - or *
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      renderedElements.push(
        <div
          key={`bullet-${index}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            margin: "2px 0",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: isUser ? "#FFFFFF" : "var(--primary)", fontWeight: 700 }}>•</span>
          <span>{parseInline(line.trim().substring(2))}</span>
        </div>
      );
      return;
    }

    // Numbered lists 1. 2.
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      renderedElements.push(
        <div
          key={`num-${index}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            margin: "3px 0",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 700, minWidth: "16px", color: isUser ? "#FFFFFF" : "var(--primary)" }}>
            {numMatch[1]}.
          </span>
          <span>{parseInline(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Normal paragraph
    if (line.trim().length > 0) {
      renderedElements.push(
        <p key={`p-${index}`} style={{ margin: "4px 0", fontSize: "13px", lineHeight: 1.55 }}>
          {parseInline(line)}
        </p>
      );
    } else {
      renderedElements.push(<div key={`sp-${index}`} style={{ height: "4px" }} />);
    }
  });

  return <div>{renderedElements}</div>;
}

export default function AiChatbot() {
  const location = useLocation();
  const { user, token, isAuthenticated } = useContext(AuthContext);
  const {
    role,
    skills,
    resumeAnalysis,
    questions,
    currentQuestionIndex,
    results,
    interviewType,
  } = useContext(InterviewContext);

  // Chat window state
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Stored conversation identifier
  const [conversationId, setConversationId] = useState(() => {
    try {
      return sessionStorage.getItem("intervexa_ai_chat_id") || `conv_${Date.now()}`;
    } catch {
      return `conv_${Date.now()}`;
    }
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Listen for global custom event to open chatbot from footer/nav triggers
  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener("intervexa-open-chatbot", handleOpenChat);
    return () => window.removeEventListener("intervexa-open-chatbot", handleOpenChat);
  }, []);

  // 1. Detect active page context from location pathname
  const getPageContext = useCallback(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/dashboard")) return "dashboard";
    if (path.includes("/resume") || path.includes("/upload")) return "resume_analysis";
    if (path.includes("/interview")) {
      return interviewType === "adaptive" ? "adaptive_interview" : "standard_interview";
    }
    if (path.includes("/result")) return "results";
    if (path.includes("/learning") || path.includes("/roadmap") || path.includes("/study")) return "study_planner";
    if (path.includes("/role") || path.includes("/setup") || path.includes("/interview-selection")) return "role_selection";
    return "general";
  }, [location.pathname, interviewType]);

  const currentContext = getPageContext();
  const contextMeta = CONTEXT_CONFIG[currentContext] || CONTEXT_CONFIG.general;

  // 2. Extract active page data for contextual intelligence
  const getActivePageData = useCallback(() => {
    switch (currentContext) {
      case "resume_analysis":
        return {
          ats_score: resumeAnalysis?.ats_score,
          missing_skills: resumeAnalysis?.missing_skills,
          strengths: resumeAnalysis?.strengths,
          weaknesses: resumeAnalysis?.weaknesses,
          role: role || "Software Engineer",
        };
      case "standard_interview":
      case "adaptive_interview": {
        const activeQ = questions && questions.length > 0 ? questions[currentQuestionIndex || 0] : null;
        return {
          question: typeof activeQ === "string" ? activeQ : activeQ?.question,
          role: role || "Software Developer",
          skills: skills || [],
          questionIndex: (currentQuestionIndex || 0) + 1,
          totalQuestions: questions?.length || 0,
        };
      }
      case "results":
        return {
          role: role || "Software Engineer",
          results_count: results?.length || 0,
        };
      case "study_planner":
        return {
          role: role || "Full Stack Developer",
        };
      default:
        return {
          role: role || "Software Engineer",
        };
    }
  }, [currentContext, resumeAnalysis, role, skills, questions, currentQuestionIndex, results]);

  // 3. Auto-scroll to bottom of messages
  const scrollToBottom = useCallback((behavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "nearest" });
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen, isMinimized, scrollToBottom]);

  // 4. Update suggested questions on context change
  useEffect(() => {
    const list = DEFAULT_SUGGESTED_QUESTIONS[currentContext] || DEFAULT_SUGGESTED_QUESTIONS.general;
    setSuggestedQuestions(list);
  }, [currentContext]);

  // 5. Fetch previous conversation history on mount
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/history?conversation_id=${conversationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (isMounted && data.success && Array.isArray(data.history)) {
            const formatted = data.history.map((m) => ({
              id: m.id,
              sender: m.sender,
              text: m.message,
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              evidence_sources: m.evidence_sources || [],
              suggested_followups: m.suggested_followups || [],
            }));
            setMessages(formatted);
          }
        }
      } catch (err) {
        console.warn("[AiChatbot] Failed to fetch chat history:", err);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [token, conversationId]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setHasUnread(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 150);
    }
  }, [isOpen, isMinimized]);

  // 6. Send message handler
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    setErrorMessage("");
    setInputMessage("");

    const userMsgObj = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      evidence_sources: [],
      suggested_followups: [],
    };

    // Optimistically append user message
    setMessages((prev) => [...prev, userMsgObj]);
    setIsLoading(true);

    try {
      const pageData = getActivePageData();
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: query,
          page_context: currentContext,
          page_data: pageData,
          conversation_id: conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to receive AI response.");
      }

      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
        sessionStorage.setItem("intervexa_ai_chat_id", data.conversation_id);
      }

      const assistantMsgObj = {
        id: `ai_${Date.now()}`,
        sender: "assistant",
        text: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        evidence_sources: data.evidence_sources || [],
        suggested_followups: data.suggested_followups || [],
      };

      setMessages((prev) => [...prev, assistantMsgObj]);

      // Update follow-up suggestion chips if returned
      if (Array.isArray(data.suggested_followups) && data.suggested_followups.length > 0) {
        setSuggestedQuestions(data.suggested_followups);
      }

      // If minimized, signal unread
      if (!isOpen || isMinimized) {
        setHasUnread(true);
      }
    } catch (err) {
      console.error("[AiChatbot Error]:", err);
      setErrorMessage(err.message || "Unable to reach AI assistant. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Clear chat conversation
  const handleClearChat = async () => {
    setShowClearConfirm(false);
    try {
      await fetch(`${API_BASE_URL}/api/chat/history?conversation_id=${conversationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessages([]);
      const newId = `conv_${Date.now()}`;
      setConversationId(newId);
      sessionStorage.setItem("intervexa_ai_chat_id", newId);
      setSuggestedQuestions(DEFAULT_SUGGESTED_QUESTIONS[currentContext] || DEFAULT_SUGGESTED_QUESTIONS.general);
    } catch (err) {
      console.warn("[AiChatbot] Clear conversation error:", err);
    }
  };

  // Keydown helper: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Do not render on public landing or authentication pages
  if (!isAuthenticated || ["/", "/login", "/signup"].includes(location.pathname)) {
    return null;
  }

  return (
    <div className="intervexa-ai-chatbot-root">
      {/* 1. FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="ai-chatbot-launcher"
          aria-label="Ask Intervexa AI"
          title="Ask Intervexa AI — Your Personal Career Coach"
        >
          <div className="launcher-pulse-ring" />
          <div className="launcher-icon-wrap">
            <img
              src={robotAvatar}
              alt="Ask Intervexa AI"
              className="launcher-robot-img"
              onError={(e) => {
                e.currentTarget.src = "/chatbot-robot-circle.png";
              }}
            />
          </div>

          {/* Unread indicator */}
          {hasUnread && <span className="launcher-unread-dot" />}

          {/* Floating Tooltip */}
          <span className="launcher-tooltip">Ask Intervexa AI</span>
        </button>
      )}

      {/* 2. CHATBOT WINDOW PANEL */}
      {isOpen && (
        <div className={`ai-chatbot-window ${isMinimized ? "minimized" : ""}`} role="dialog" aria-modal="true" aria-label="Intervexa AI Assistant">
          {/* A. Header */}
          <div className="ai-chat-header">
            <div className="header-brand-info">
              <div className="header-avatar-badge">
                <img
                  src={robotAvatar}
                  alt="Intervexa AI"
                  className="header-avatar-img"
                  onError={(e) => {
                    e.currentTarget.src = "/chatbot-robot-circle.png";
                  }}
                />
                <span className="status-online-dot" />
              </div>
              <div className="header-text-block">
                <div className="header-title-row">
                  <span className="header-title">Intervexa AI</span>
                  <span className="context-chip-tag" title={contextMeta.description}>
                    {contextMeta.icon} {contextMeta.label}
                  </span>
                </div>
                <span className="header-subtitle">Your personal interview preparation assistant</span>
              </div>
            </div>

            {/* Header Controls */}
            <div className="header-controls-row">
              {/* Clear button */}
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="header-ctrl-btn"
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                <IconTrash size={16} />
              </button>

              {/* Minimize button */}
              <button
                type="button"
                onClick={() => setIsMinimized((prev) => !prev)}
                className="header-ctrl-btn"
                title={isMinimized ? "Expand chat" : "Minimize chat"}
                aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
              >
                <IconMinimize size={16} />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="header-ctrl-btn close-btn"
                title="Close chat"
                aria-label="Close chat"
              >
                <IconX size={16} />
              </button>
            </div>
          </div>

          {/* Clear Confirmation Modal Popover */}
          {showClearConfirm && (
            <div className="clear-confirm-banner">
              <span>Clear active conversation?</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={handleClearChat} className="confirm-btn danger">
                  Clear
                </button>
                <button type="button" onClick={() => setShowClearConfirm(false)} className="confirm-btn">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* B. Message Stream Area (Hidden when minimized) */}
          {!isMinimized && (
            <>
              <div className="ai-chat-messages-scroll">
                {/* Welcome / Empty State */}
                {messages.length === 0 && (
                  <div className="chat-empty-state">
                    <div className="empty-state-icon">
                      <IconSparkles size={28} color="var(--primary)" />
                    </div>
                    <h4 className="empty-state-title">How can I help you today?</h4>
                    <p className="empty-state-desc">
                      I'm tailored to your current screen (<strong>{contextMeta.label}</strong>). Ask me for hints, concept
                      breakdowns, or ATS resume suggestions.
                    </p>
                  </div>
                )}

                {/* Messages Stream */}
                {messages.map((m) => {
                  const isUser = m.sender === "user";
                  return (
                    <div key={m.id} className={`chat-message-row ${isUser ? "user-row" : "ai-row"}`}>
                      {!isUser && (
                        <div className="msg-avatar ai-avatar">
                          <img
                            src={robotAvatar}
                            alt="Intervexa AI"
                            className="msg-avatar-img"
                            onError={(e) => {
                              e.currentTarget.src = "/chatbot-robot-circle.png";
                            }}
                          />
                        </div>
                      )}

                      <div className={`chat-bubble ${isUser ? "user-bubble" : "ai-bubble"}`}>
                        <MarkdownRenderer content={m.text} isUser={isUser} />

                        {/* RAG Official Evidence Citation Pills */}
                        {!isUser && m.evidence_sources && m.evidence_sources.length > 0 && (
                          <div className="evidence-sources-footer">
                            <span className="evidence-badge-title">📖 Verified Documentation:</span>
                            {m.evidence_sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="evidence-source-link"
                              >
                                {src.title || "Official Standards"} ({src.authority || "Authoritative"})
                              </a>
                            ))}
                          </div>
                        )}

                        <span className="msg-timestamp">{m.timestamp}</span>
                      </div>

                      {isUser && (
                        <div className="msg-avatar user-avatar">
                          {(user?.name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isLoading && (
                  <div className="chat-message-row ai-row">
                    <div className="msg-avatar ai-avatar">
                      <img
                        src={robotAvatar}
                        alt="Intervexa AI"
                        className="msg-avatar-img"
                        onError={(e) => {
                          e.currentTarget.src = "/chatbot-robot-circle.png";
                        }}
                      />
                    </div>
                    <div className="chat-bubble ai-bubble typing-bubble">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="chat-error-card">
                    <IconAlertTriangle size={16} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* C. Suggested Questions Chips */}
              {suggestedQuestions && suggestedQuestions.length > 0 && (
                <div className="suggested-chips-bar">
                  <div className="chips-scroll-wrap">
                    {suggestedQuestions.slice(0, 3).map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => handleSendMessage(chip)}
                        className="suggested-chip-btn"
                        disabled={isLoading}
                      >
                        <span className="chip-icon">💬</span>
                        <span className="chip-text">{chip}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* D. Input Bar */}
              <div className="ai-chat-input-bar">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask anything about ${contextMeta.label.toLowerCase()}...`}
                  rows={1}
                  maxLength={1000}
                  className="chat-textarea-input"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="chat-send-action-btn"
                  aria-label="Send message"
                  title="Send message (Enter)"
                >
                  <IconSend size={16} color="#FFFFFF" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. COMPONENT STYLES */}
      <style>{`
        /* Floating Launcher */
        .ai-chatbot-launcher {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 2px solid rgba(139, 92, 246, 0.3);
          box-shadow: 0 8px 24px rgba(124, 58, 237, 0.28), 0 2px 8px rgba(0, 0, 0, 0.06);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          z-index: 995;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease;
        }

        .ai-chatbot-launcher:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 12px 30px rgba(124, 58, 237, 0.42), 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: rgba(139, 92, 246, 0.55);
        }

        .ai-chatbot-launcher:active {
          transform: scale(0.96);
        }

        .launcher-pulse-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(139, 92, 246, 0.35);
          animation: launcherPulse 2.8s infinite;
          pointer-events: none;
        }

        @keyframes launcherPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }

        .launcher-icon-wrap {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .launcher-robot-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }

        .ai-chatbot-launcher:hover .launcher-icon-wrap {
          transform: scale(1.05);
        }

        .launcher-unread-dot {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #10B981;
          border: 2px solid #FFFFFF;
          z-index: 2;
        }

        .launcher-tooltip {
          position: absolute;
          right: 72px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--bg-surface, #1E1B2E);
          color: var(--text-primary, #F8FAFC);
          padding: 7px 13px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.22);
          border: 1px solid var(--border-color, rgba(139, 92, 246, 0.25));
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 3;
        }

        .ai-chatbot-launcher:hover .launcher-tooltip {
          opacity: 1;
          transform: translateY(-50%) translateX(-4px);
        }

        /* Chat Window */
        .ai-chatbot-window {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 400px;
          max-width: calc(100vw - 32px);
          height: 580px;
          max-height: calc(100vh - 48px);
          background: var(--bg-surface, #FFFFFF);
          border: 1px solid var(--border-color, #E2E8F0);
          border-radius: 20px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.22);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 10000;
          animation: chatSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }

        .ai-chatbot-window.minimized {
          height: auto;
          max-height: 72px;
        }

        @keyframes chatSlideUp {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Header */
        .ai-chat-header {
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(113, 56, 245, 0.12) 0%, rgba(144, 85, 255, 0.05) 100%);
          border-bottom: 1px solid var(--border-color, #E2E8F0);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .header-brand-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .header-avatar-badge {
          position: relative;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 1.5px solid rgba(139, 92, 246, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(113, 56, 245, 0.25);
          overflow: visible;
        }

        .header-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
          display: block;
        }

        .status-online-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #10B981;
          border: 1.5px solid #FFFFFF;
        }

        .header-text-block {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .header-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-title {
          font-size: 14.5px;
          font-weight: 800;
          color: var(--text-primary, #0F172A);
          letter-spacing: -0.015em;
        }

        .context-chip-tag {
          font-size: 11px;
          font-weight: 700;
          color: var(--primary, #8054E8);
          background: var(--bg-selected, rgba(128, 84, 232, 0.1));
          border: 1px solid var(--primary-border, rgba(128, 84, 232, 0.25));
          padding: 2px 7px;
          border-radius: 999px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        .header-subtitle {
          font-size: 11.5px;
          color: var(--text-secondary, #64748B);
          margin-top: 1px;
        }

        .header-controls-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .header-ctrl-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-secondary, #64748B);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .header-ctrl-btn:hover {
          background: var(--bg-main, #F1F5F9);
          color: var(--text-primary, #0F172A);
        }

        .header-ctrl-btn.close-btn:hover {
          background: rgba(239, 68, 68, 0.12);
          color: #EF4444;
        }

        /* Clear Confirm Banner */
        .clear-confirm-banner {
          background: var(--bg-card, #F8FAFC);
          padding: 8px 14px;
          border-bottom: 1px solid var(--border-color, #E2E8F0);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-primary, #0F172A);
          animation: fadeIn 0.2s ease;
        }

        .confirm-btn {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--border-color, #E2E8F0);
          background: var(--bg-surface, #FFFFFF);
          color: var(--text-primary, #0F172A);
        }

        .confirm-btn.danger {
          background: #EF4444;
          color: #FFFFFF;
          border-color: #EF4444;
        }

        /* Messages Scroll Container */
        .ai-chat-messages-scroll {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: var(--bg-main, #FAF5FF);
        }

        /* Empty State */
        .chat-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin: auto 0;
          padding: 24px 16px;
        }

        .empty-state-icon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: var(--bg-surface, #FFFFFF);
          border: 1px solid var(--border-color, #E2E8F0);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(113, 56, 245, 0.12);
        }

        .empty-state-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 6px 0;
          color: var(--text-primary, #0F172A);
        }

        .empty-state-desc {
          font-size: 12.5px;
          color: var(--text-secondary, #64748B);
          margin: 0;
          line-height: 1.5;
          max-width: 290px;
        }

        /* Message Rows */
        .chat-message-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          width: 100%;
        }

        .chat-message-row.user-row {
          justify-content: flex-end;
        }

        .chat-message-row.ai-row {
          justify-content: flex-start;
        }

        .msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 700;
        }

        .msg-avatar.ai-avatar {
          background: #FFFFFF;
          border: 1.5px solid rgba(139, 92, 246, 0.3);
          box-shadow: 0 2px 6px rgba(113, 56, 245, 0.2);
          overflow: hidden;
          padding: 1px;
          border-radius: 50%;
        }

        .msg-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
          display: block;
        }

        .msg-avatar.user-avatar {
          background: var(--primary, #8054E8);
          color: #FFFFFF;
        }

        .chat-bubble {
          max-width: 82%;
          padding: 10px 14px;
          border-radius: 14px;
          position: relative;
          word-break: break-word;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .user-bubble {
          background: linear-gradient(135deg, #8054E8 0%, #7043D5 100%);
          color: #FFFFFF;
          border-bottom-right-radius: 3px;
        }

        .ai-bubble {
          background: var(--bg-surface, #FFFFFF);
          color: var(--text-primary, #0F172A);
          border: 1px solid var(--border-color, #E2E8F0);
          border-bottom-left-radius: 3px;
        }

        .msg-timestamp {
          display: block;
          font-size: 10.5px;
          opacity: 0.65;
          margin-top: 4px;
          text-align: right;
        }

        /* Evidence Source Citations */
        .evidence-sources-footer {
          margin-top: 8px;
          padding-top: 6px;
          border-top: 1px dashed var(--border-color, rgba(0,0,0,0.1));
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .evidence-badge-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--primary, #8054E8);
        }

        .evidence-source-link {
          font-size: 11.5px;
          color: var(--primary, #8054E8);
          text-decoration: none;
          font-weight: 600;
          transition: text-decoration 0.15s ease;
        }

        .evidence-source-link:hover {
          text-decoration: underline;
        }

        /* Typing Dots */
        .typing-bubble {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 12px 16px;
        }

        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary, #8054E8);
          animation: typingBlink 1.4s infinite;
        }

        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingBlink {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }

        .chat-error-card {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #EF4444;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Suggested Chips Bar */
        .suggested-chips-bar {
          background: var(--bg-surface, #FFFFFF);
          border-top: 1px solid var(--border-color, #E2E8F0);
          padding: 8px 12px;
          flex-shrink: 0;
        }

        .chips-scroll-wrap {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .chips-scroll-wrap::-webkit-scrollbar {
          display: none;
        }

        .suggested-chip-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 11px;
          border-radius: 999px;
          background: var(--bg-main, #F1F5F9);
          border: 1px solid var(--border-color, #CBD5E1);
          color: var(--text-primary, #0F172A);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .suggested-chip-btn:hover:not(:disabled) {
          background: var(--bg-selected, rgba(128, 84, 232, 0.12));
          border-color: var(--primary-border, #8054E8);
          color: var(--primary, #8054E8);
          transform: translateY(-1px);
        }

        .chip-icon {
          font-size: 11px;
        }

        /* Input Bar */
        .ai-chat-input-bar {
          padding: 10px 14px;
          background: var(--bg-surface, #FFFFFF);
          border-top: 1px solid var(--border-color, #E2E8F0);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .chat-textarea-input {
          flex: 1;
          background: var(--bg-main, #F8FAFC);
          border: 1px solid var(--border-color, #E2E8F0);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          color: var(--text-primary, #0F172A);
          resize: none;
          outline: none;
          line-height: 1.4;
          max-height: 80px;
          transition: border-color 0.15s ease;
        }

        .chat-textarea-input:focus {
          border-color: var(--primary, #8054E8);
          box-shadow: 0 0 0 2px rgba(128, 84, 232, 0.15);
        }

        .chat-send-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--primary, #8054E8);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .chat-send-action-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(113, 56, 245, 0.35);
        }

        .chat-send-action-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* Mobile Responsive Viewports */
        @media (max-width: 480px) {
          .ai-chatbot-launcher {
            bottom: 16px;
            right: 16px;
            width: 52px;
            height: 52px;
          }

          .launcher-icon-wrap {
            width: 44px;
            height: 44px;
          }

          .ai-chatbot-window {
            right: 12px;
            left: 12px;
            bottom: 12px;
            width: auto;
            max-width: none;
            height: calc(100vh - 80px);
            max-height: 560px;
            border-radius: 16px;
          }
        }
      `}</style>
    </div>
  );
}

