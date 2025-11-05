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
    <Routes>
      {/* Public routes that don't have the main layout */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<LoginPage />} />

      {/* Protected routes wrapped in the main layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardRedirect />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/:reviewerId"
        element={
          <ProtectedRoute>
            <Layout>
              <ReviewerDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hub"
        element={
          <ProtectedRoute>
            <Layout>
              <UserHubPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly={true}>
            <Layout>
              <AdminPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

import Navbar from './components/Navbar';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <>
      <Toaster />
      <BrowserRouter>
        <ErrorBoundary FallbackComponent={ErrorPage}>
          <AppContent />
        </ErrorBoundary>
      </BrowserRouter>
    </>
  );
}

export default App;
