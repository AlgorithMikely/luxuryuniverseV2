import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

interface ProtectedRouteProps {
  children: JSX.Element;
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  const { user, token, isLoading } = useAuthStore();

  if (isLoading) {
    return null; // or a loading spinner
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !user?.roles?.includes("admin")) {
    return <Navigate to="/hub" replace />; // Redirect to a safe page if not an admin
  }

  return children;
};

export default ProtectedRoute;
