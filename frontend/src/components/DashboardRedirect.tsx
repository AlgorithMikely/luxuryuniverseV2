
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const DashboardRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      // Safely check if the user is an admin before redirecting
      const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");

      if (isAdmin) {
        navigate("/admin");
      } else if (user.reviewer_profile) {
        navigate(`/dashboard/${user.reviewer_profile.id}`);
      } else {
        // Default redirect for regular users
        navigate("/hub");
      }
    }
  }, [user, navigate]);

  // Render a loading state while the redirect is processed
  return <div>Loading...</div>;
};

export default DashboardRedirect;
