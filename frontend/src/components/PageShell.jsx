import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Layout from "./Layout";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import PageContainer from "./PageContainer";
import PageHeader from "./PageHeader";
import StepProgress from "./StepProgress";
import theme from "../styles/theme";

function PageShell({
  step,
  hideStepper = false,
  title,
  subtitle,
  children,
  actions,
  stickyActions = false,
  containerStyle = {},
  headerStyle = {},
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainContentRef = useRef(null);

  // Scroll main content to top on route change
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location.pathname]);

  return (
    <Layout>
      {/* Fixed Stationary Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Layout with margin-left equal to sidebar width on desktop */}
      <div
        className="app-main-layout"
        style={{
          marginLeft: "var(--sidebar-width, 260px)",
          width: "calc(100% - var(--sidebar-width, 260px))",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
          boxSizing: "border-box",
          background: theme.background,
          transition: "margin-left 0.25s ease, width 0.25s ease",
        }}
      >
        {/* Top Navbar */}
        <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} sidebarOpen={sidebarOpen} />

        {step && !hideStepper && <StepProgress currentStep={step} />}

        {/* Scrollable Main Content Container: ONLY THIS SCROLLS */}
        <div
          ref={mainContentRef}
          className="app-main-content custom-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <PageContainer style={containerStyle}>
              {title && <PageHeader title={title} subtitle={subtitle} style={headerStyle} />}
              <div className="animate-fade-in" style={{ width: "100%", minWidth: 0 }}>
                {children}
              </div>
              {actions && (
                <div
                  style={
                    stickyActions
                      ? {
                          position: "sticky",
                          bottom: 0,
                          background: "var(--bg-nav)",
                          backdropFilter: "blur(12px)",
                          padding: "16px 24px",
                          borderTop: `1px solid ${theme.border}`,
                          boxShadow: "0 -4px 14px rgba(0,0,0,0.08)",
                          marginTop: 24,
                          zIndex: 50,
                        }
                      : { marginTop: 24 }
                  }
                >
                  {actions}
                </div>
              )}
            </PageContainer>
          </div>
        </div>
      </div>

      <style>{`
        :root {
          --sidebar-width: 260px;
        }
        @media (max-width: 1023px) {
          .app-main-layout {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100vw !important;
          }
        }
        @media (min-width: 1024px) and (max-width: 1200px) {
          :root {
            --sidebar-width: 240px;
          }
        }
      `}</style>
    </Layout>
  );
}

export default PageShell;
