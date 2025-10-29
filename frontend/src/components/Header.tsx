import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import api from "../services/api";

interface Reviewer {
  id: number;
  user?: { // Marking user as optional to handle potential malformed data
    username: string;
  };
}

const Header = () => {
  const { user, logout } = useAuthStore();
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>("");
  const navigate = useNavigate();
  const { reviewerId } = useParams<{ reviewerId: string }>();

  const isAdmin = user && Array.isArray(user.roles) && user.roles.includes("admin");

  useEffect(() => {
    const fetchReviewers = async () => {
      if (isAdmin) {
        try {
          const response = await api.get<Reviewer[]>("/admin/reviewers");
          // Filter out any reviewers that are missing the 'user' object
          const validReviewers = response.data.filter(r => r.user);
          setReviewers(validReviewers);
        } catch (error) {
          console.error("Failed to fetch reviewers:", error);
        }
      }
    };
    fetchReviewers();
  }, [isAdmin]);

  useEffect(() => {
    if (reviewers.length > 0) {
      const isValidReviewer = reviewers.some(
        (r) => r.id.toString() === reviewerId
      );
      if (isValidReviewer) {
        setSelectedReviewer(reviewerId!);
      } else {
        setSelectedReviewer("");
      }
    }
  }, [reviewerId, reviewers]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-gray-800 p-4 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/hub" className="text-xl font-bold text-white">
          Universe Bot
        </Link>
        <div className="flex items-center space-x-4">
          {isAdmin && (
            <>
              <Link
                to="/admin"
                className="text-white hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Admin
              </Link>
              <div className="relative">
                <select
                  value={selectedReviewer}
                  onChange={(e) => navigate(`/dashboard/${e.target.value}`)}
                  className="bg-gray-700 text-white p-2 rounded"
                >
                  <option value="" disabled>
                    Select a Reviewer
                  </option>
                  {reviewers.map((reviewer) => (
                    // The 'user' object is now guaranteed to exist due to the filter
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.user!.username}
                    </option>
                  ))}
                </select>
              </div>
            </>
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
