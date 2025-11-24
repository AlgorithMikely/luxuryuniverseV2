import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);

  useEffect(() => {
    const handleAuth = async () => {
      const token = searchParams.get("token");
      if (token) {
        await setToken(token);
        navigate("/hub");
      } else {
        navigate("/login");
      }
    };
    handleAuth();
  }, [searchParams, navigate, setToken]);

  return <div>Loading...</div>;
};

export default AuthCallbackPage;
