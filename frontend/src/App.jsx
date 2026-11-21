


import { useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import UploadResume from "./pages/UploadResume";
import SelectRole from "./pages/SelectRole";
import Interview from "./pages/Interview";
import InterviewSelection from "./pages/InterviewSelection";
import Results from "./pages/Results";
import History from "./pages/History";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./pages/Profile";
import Learning from "./pages/Learning";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ErrorBoundary from "./components/ErrorBoundary";
import AiChatbot from "./components/AiChatbot";

function App() {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="page-route-transition">
      <ErrorBoundary>
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/signin" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/signup" replace />} />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Resume Analysis */}
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <UploadResume />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume"
          element={
            <ProtectedRoute>
              <UploadResume />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-analysis"
          element={
            <ProtectedRoute>
              <UploadResume />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload-resume"
          element={
            <ProtectedRoute>
              <UploadResume />
            </ProtectedRoute>
          }
        />

        {/* Interview Setup */}
        <Route
          path="/role"
          element={
            <ProtectedRoute>
              <SelectRole />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <SelectRole />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview-setup"
          element={
            <ProtectedRoute>
              <SelectRole />
            </ProtectedRoute>
          }
        />
        <Route
          path="/select-role"
          element={
            <ProtectedRoute>
              <SelectRole />
            </ProtectedRoute>
          }
        />

        {/* Interview Mode Selection */}
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <InterviewSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview-selection"
          element={
            <ProtectedRoute>
              <InterviewSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/mode"
          element={
            <ProtectedRoute>
              <InterviewSelection />
            </ProtectedRoute>
          }
        />

        {/* Standard Interview Workflow */}
        <Route
          path="/standard-interview"
          element={
            <ProtectedRoute>
              <Interview forcedType="standard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/standard"
          element={
            <ProtectedRoute>
              <Interview forcedType="standard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/session"
          element={
            <ProtectedRoute>
              <Interview />
            </ProtectedRoute>
          }
        />

        {/* Adaptive Interview Workflow */}
        <Route
          path="/adaptive-interview"
          element={
            <ProtectedRoute>
              <Interview forcedType="adaptive" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/adaptive"
          element={
            <ProtectedRoute>
              <Interview forcedType="adaptive" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adaptive"
          element={
            <ProtectedRoute>
              <Interview forcedType="adaptive" />
            </ProtectedRoute>
          }
        />

        {/* Interview Results */}
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <Results />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview-results"
          element={
            <ProtectedRoute>
              <Results />
            </ProtectedRoute>
          }
        />

        {/* Interview History */}
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview-history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:id"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />

        {/* Learning Roadmap */}
        <Route
          path="/learning"
          element={
            <ProtectedRoute>
              <Learning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roadmap"
          element={
            <ProtectedRoute>
              <Learning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learning-roadmap"
          element={
            <ProtectedRoute>
              <Learning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/study-planner"
          element={
            <ProtectedRoute>
              <Learning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/study-plan"
          element={
            <ProtectedRoute>
              <Learning />
            </ProtectedRoute>
          }
        />

        {/* Profile (Unified Profile & Settings) */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Redirect /settings to unified /profile */}
        <Route
          path="/settings"
          element={<Navigate to="/profile" replace />}
        />

        {/* Fallback for invalid/unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Floating Context-Aware AI Career & Placement Assistant */}
      <AiChatbot />
      </ErrorBoundary>
    </div>
  );
}

export default App;

