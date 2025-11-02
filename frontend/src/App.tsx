import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuthStore } from './stores/authStore';
import { useSocketStore } from './stores/socketStore';
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardRedirect from "./pages/DashboardPage";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import UserHubPage from "./pages/UserHubPage";
import AdminPage from "./pages/AdminPage";
import ErrorPage from "./pages/ErrorPage";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "react-error-boundary";

function AppContent() {
  const { token, checkAuth, isLoading, user } = useAuthStore();
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (token && user) {
      // Logic to connect to the correct reviewer room
      const reviewerId = user.reviewer_profile?.id;
      if (reviewerId) {
        connect(token, reviewerId);
      } else if (user.roles?.includes('admin') && user.moderated_reviewers && user.moderated_reviewers.length > 0) {
        // Default to the first moderated reviewer for admins
        connect(token, user.moderated_reviewers[0].id);
      }
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  }, [token, user, connect, disconnect]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/:reviewerId"
          element={
            <ProtectedRoute>
              <ReviewerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hub"
          element={
            <ProtectedRoute>
              <UserHubPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly={true}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <>
      <Toaster />
      <ErrorBoundary FallbackComponent={ErrorPage}>
        <AppContent />
      </ErrorBoundary>
    </>
  );
}

export default App;
