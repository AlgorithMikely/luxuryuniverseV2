import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import api from "../services/api";

interface Reviewer {
  id: number;
  user: {
    username: string;
    avatar: string | null;
  };
}

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { reviewerId } = useParams();

  useEffect(() => {
    const fetchReviewers = async () => {
      if (user?.roles.includes("admin")) {
        try {
          const response = await api.get("/admin/reviewers");
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

  const handleReviewerSelect = (selectedReviewerId: string) => {
    navigate(`/dashboard/${selectedReviewerId}`);
    setDropdownOpen(false);
  };

  if (!user) return null;

  const currentReviewer = reviewers.find(
    (r) => r.id === parseInt(reviewerId || "")
  );

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <div className="text-xl font-bold">
        <Link to="/dashboard">
          {currentReviewer
            ? `${currentReviewer.user.username}'s Dashboard`
            : "Dashboard"}
        </Link>
      </div>
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 focus:outline-none"
        >
          <img
            src={user.avatar || ""}
            alt="User Avatar"
            className="w-10 h-10 rounded-full"
          />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg py-1 z-50">
            <div className="px-4 py-2">
              <p className="text-sm">Signed in as</p>
              <p className="font-medium">{user.username}</p>
            </div>
            <div className="border-t border-gray-600"></div>
            <Link
              to="/settings"
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
              onClick={() => setDropdownOpen(false)}
            >
              Settings
            </Link>
            {user.roles.includes("admin") && (
              <>
                <div className="border-t border-gray-600"></div>
                <div className="px-4 py-2 text-sm font-semibold">
                  View Queues
                </div>
                {reviewers.map((reviewer) => (
                  <button
                    key={reviewer.id}
                    onClick={() => handleReviewerSelect(reviewer.id.toString())}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                  >
                    {reviewer.user.username}
                  </button>
                ))}
              </>
            )}
            <div className="border-t border-gray-600"></div>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
