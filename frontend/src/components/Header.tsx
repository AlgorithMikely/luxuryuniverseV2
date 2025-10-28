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
  const [selectedReviewer, setSelectedReviewer] = useState<string>("");
  const navigate = useNavigate();
  const { reviewerId } = useParams<{ reviewerId: string }>();

  // A memoized value to safely check if the user is an admin
  const isAdmin = user && Array.isArray(user.roles) && user.roles.includes("admin");

  useEffect(() => {
    const fetchReviewers = async () => {
      // Only fetch reviewers if the user is an admin
      if (isAdmin) {
        try {
          const response = await api.get<Reviewer[]>("/admin/reviewers");
          setReviewers(response.data);
        } catch (error) {
          console.error("Failed to fetch reviewers:", error);
        }
      }
    };
    fetchReviewers();
  }, [isAdmin]); // Dependency array ensures this runs only when admin status changes

  useEffect(() => {
    // Only perform this logic if there are reviewers to check against
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
        <h1 className="text-xl font-bold text-white">Universe Bot</h1>
        <div className="flex items-center space-x-4">
          {/* Use the safe isAdmin check for conditional rendering */}
          {isAdmin && (
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
