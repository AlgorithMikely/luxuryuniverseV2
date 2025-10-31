
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const DashboardRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      // If user is a reviewer, go to their specific dashboard
      if (user.reviewer_profile) {
        navigate(`/dashboard/${user.reviewer_profile.id}`);
      }
      // If user is an admin, go to a default dashboard (or a specific admin view)
      else if (user.roles.includes("admin")) {
        // We'll redirect to a default/first reviewer's dashboard for now.
        // This could be changed to a dedicated admin dashboard page in the future.
        navigate("/dashboard/1");
      }
      // Otherwise, they are a regular user, send to the user hub
      else {
        navigate("/hub");
      }
    }
  }, [user, navigate]);

  return <div>Loading...</div>;
};

export default DashboardRedirect;
