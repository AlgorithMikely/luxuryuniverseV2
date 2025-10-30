
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const DashboardRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      if (user.reviewer_profile) {
        navigate(`/dashboard/${user.reviewer_profile.id}`);
      } else {
        navigate("/hub");
      }
    }
  }, [user, navigate]);

  return <div>Loading...</div>;
};

export default DashboardRedirect;
