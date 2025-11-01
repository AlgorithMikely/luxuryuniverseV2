import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardRedirect from "./pages/DashboardPage"; // Renamed to DashboardRedirect
import ReviewerDashboard from "./pages/ReviewerDashboard"; // Import the new dashboard
import UserHubPage from "./pages/UserHubPage";
import ErrorPage from "./pages/ErrorPage";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "react-error-boundary";

function App() {
  return (
    <SocketProvider>
      <Toaster />
      <ErrorBoundary FallbackComponent={ErrorPage}>
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
              path="/dashboard/:reviewerId" // Add the new parameterized route
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
            <Route path="/" element={<LoginPage />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </SocketProvider>
  );
}

export default App;
