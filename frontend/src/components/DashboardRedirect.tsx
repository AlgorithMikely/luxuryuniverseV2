
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const DashboardRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && user.reviewer_profile) {
      navigate(`/dashboard/${user.reviewer_profile.id}`);
    }
  }, [user]);

  return <div>Loading...</div>;
};

export default DashboardRedirect;
