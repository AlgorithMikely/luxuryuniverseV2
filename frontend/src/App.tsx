import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardRedirect from "./pages/DashboardPage";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import UserHubPage from "./pages/UserHubPage";
import WalletHistoryPage from "./pages/WalletHistoryPage";
import AdminPage from "./pages/AdminPage";
import ReviewerSettingsPage from "./pages/ReviewerSettingsPage";
import ArchivedSessionPage from './pages/ArchivedSessionPage';
import SubmissionPage from "./pages/SubmissionPage";
import ErrorPage from "./pages/ErrorPage";
import Navbar from './components/Navbar';
import Overlay from './components/Overlay';
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "react-error-boundary";

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        Loading application...
      </div>
    );
  }

  return (
    <>
      <Toaster />
      <BrowserRouter>
        <ErrorBoundary FallbackComponent={ErrorPage}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            {/* Overlay Route - Public & Transparent */}
            <Route path="/overlay/:reviewerId" element={<Overlay />} />

            {/* Public Routes */}
            <Route element={<MainLayout />}>
              <Route path="/submit/:reviewerId" element={<SubmissionPage />} />
            </Route>

            {/* Routes with Navbar (Protected) */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/reviewer/:reviewerId" element={<ReviewerDashboard />} />
              <Route path="/settings/reviewer" element={<ReviewerSettingsPage />} />
              <Route path="/hub" element={<UserHubPage />} />
              <Route path="/wallet/history" element={<WalletHistoryPage />} />
              <Route path="/session/:sessionId" element={<ArchivedSessionPage />} />
              <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminPage /></ProtectedRoute>} />
            </Route>

            <Route path="/" element={<LoginPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </>
  );
}

const MainLayout = () => (
  <div className="bg-gray-900 text-white min-h-screen">
    <Navbar />
    <main>
      <Outlet />
    </main>
  </div>
);

export default App;
