import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
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
                  <DashboardPage />
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
