import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import api from "../services/api";

interface Reviewer {
  id: number;
  user: {
    username: string;
  };
}

const Header = () => {
  const { user, logout } = useAuthStore();
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const navigate = useNavigate();
  const { reviewerId } = useParams<{ reviewerId: string }>();

  useEffect(() => {
    const fetchReviewers = async () => {
      if (user && user.roles.includes("admin")) {
        try {
          const response = await api.get<Reviewer[]>("/admin/reviewers");
          setReviewers(response.data);
        } catch (error) {
          console.error("Failed to fetch reviewers:", error);
        }
      }
    };
    fetchReviewers();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Prevent React error by ensuring the select's value exists as an option.
  // If the reviewerId from the URL isn't in the fetched list yet, default to "".
  const currentSelection = reviewers.some((r) => r.id.toString() === reviewerId)
    ? reviewerId
    : "";

  return (
    <header className="bg-gray-800 p-4 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Universe Bot</h1>
        <div className="flex items-center space-x-4">
          {user && user.roles.includes("admin") && (
            <div className="relative">
              <select
                value={currentSelection}
                onChange={(e) => navigate(`/dashboard/${e.target.value}`)}
                className="bg-gray-700 text-white p-2 rounded"
              >
                {/* The placeholder option is only shown when no valid reviewer is selected */}
                {!currentSelection && (
                  <option value="" disabled>
                    Select a Reviewer
                  </option>
                )}
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.user.username}
                  </option>
                ))}
              </select>
            </div>
          )}
          {user && (
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
