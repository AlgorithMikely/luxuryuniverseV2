import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import DashboardRedirect from "./components/DashboardRedirect";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import UserHubPage from "./pages/UserHubPage";
import ErrorPage from "./pages/ErrorPage";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "./components/ErrorBoundary"; // Import the new ErrorBoundary

function App() {
  return (
    <SocketProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/dashboard/:reviewerId"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <DashboardPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<LoginPage />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <UserHubPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;
