
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { User } from "../types"; // Import the User type

const DashboardRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    const typedUser = user as User | null;

    if (typedUser) {
      // If user is a reviewer, go to their specific dashboard
      if (typedUser.reviewer_profile) {
        navigate(`/dashboard/${typedUser.reviewer_profile.id}`);
      }
      // If user is an admin, redirect to the first moderated reviewer's dashboard
      else if (
        typedUser.roles.includes("admin") &&
        typedUser.moderated_reviewers &&
        typedUser.moderated_reviewers.length > 0
      ) {
        navigate(`/dashboard/${typedUser.moderated_reviewers[0].id}`);
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
