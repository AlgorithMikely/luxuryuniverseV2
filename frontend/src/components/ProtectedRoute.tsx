import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    // If we have a token but no user object yet, it's likely being fetched.
    // Show a loading state.
    return <div className="text-white text-center p-8">Loading user profile...</div>;
  }

  return children;
};

export default ProtectedRoute;
