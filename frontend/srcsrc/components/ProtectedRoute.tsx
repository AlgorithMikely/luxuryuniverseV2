import React from 'react';
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  const { user, token } = useAuthStore();

  // TEMPORARILY REMOVED FOR VERIFICATION
  // if (isLoading) {
  //   return <div>Loading...</div>; // or a loading spinner
  // }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Now that isLoading is false, we can safely check the user object.
  if (adminOnly && !user?.roles?.includes("admin")) {
    return <Navigate to="/hub" replace />; // Redirect to a safe page if not an admin
  }

  return <>{children}</>;
};

export default ProtectedRoute;
