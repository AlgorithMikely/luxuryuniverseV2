import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { useAuthStore } from './stores/authStore';
import { injectStore } from './services/api'; // Import injection function
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardRedirect from "./pages/DashboardPage";
import ReviewerDashboard from "./pages/ReviewerDashboard";
import UserHubPage from "./pages/UserHubPage";
import WalletHistoryPage from "./pages/WalletHistoryPage";
import AdminPage from "./pages/AdminPage";
import ReviewerSettingsPage from "./pages/ReviewerSettingsPage";
import AdminMetricsPage from "./pages/AdminMetricsPage";
import UserSettingsPage from "./pages/UserSettingsPage";
import TransactionLedgerPage from "./pages/TransactionLedgerPage";
import ArchivedSessionPage from './pages/ArchivedSessionPage';
import SubmissionPage from "./pages/SubmissionPage";
import SpotlightPage from "./pages/SpotlightPage";
import BookmarksPage from "./pages/BookmarksPage";
import ErrorPage from "./pages/ErrorPage";
import Navbar from './components/Navbar';
import Overlay from './components/Overlay';
import ChatPage from './pages/ChatPage';
import LinePage from './pages/LinePage';
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "react-error-boundary";
import LegalPages from "./pages/LegalPages";

// Inject the store to avoid circular dependency
injectStore(useAuthStore);

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
            {/* Chat Popout Route - Public */}            <Route path="/chat/:reviewerId" element={<ChatPage />} />


            {/* Public Routes */}
            <Route element={<MainLayout />}>
              <Route path="/terms" element={<LegalPages />} />
              <Route path="/privacy" element={<LegalPages />} />
              <Route path="/spotlight" element={<SpotlightPage />} />
              <Route path="/submit/:identifier" element={<SubmissionPage />} />
            </Route>

            {/* Standalone Route for Line Page (Immersive) */}
            <Route path="/line/:reviewerHandle" element={<LinePage />} />

            {/* Routes with Navbar (Protected) */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/reviewer/:reviewerId" element={<ReviewerDashboard />} />
              <Route path="/reviewer/bookmarks" element={<BookmarksPage />} />
              <Route path="/settings/reviewer" element={<ReviewerSettingsPage />} />
              <Route path="/settings" element={<UserSettingsPage />} />
              <Route path="/hub" element={<UserHubPage />} />
              <Route path="/wallet/history" element={<WalletHistoryPage />} />
              <Route path="/session/:sessionId" element={<ArchivedSessionPage />} />
              <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminPage /></ProtectedRoute>} />
              <Route path="/admin/economy" element={<ProtectedRoute adminOnly={true}><TransactionLedgerPage /></ProtectedRoute>} />
              <Route path="/admin/reviewer/:reviewerId/settings" element={<ProtectedRoute adminOnly={true}><ReviewerSettingsPage /></ProtectedRoute>} />
              <Route path="/admin/metrics" element={<ProtectedRoute adminOnly={true}><AdminMetricsPage /></ProtectedRoute>} />
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
