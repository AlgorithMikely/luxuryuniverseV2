import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Header from "../components/Header";
import { useAuthStore } from "../stores/authStore";

interface Reviewer {
  id: number;
  user: {
    username: string;
    avatar: string;
  };
  tiktok_handle: string;
  discord_channel_id: string;
}

const AdminDashboardPage = () => {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Safely determine if the current user is an admin
  const isAdmin = user && Array.isArray(user.roles) && user.roles.includes("admin");

  useEffect(() => {
    const fetchReviewers = async () => {
      // Ensure user is loaded and is an admin before fetching
      if (!isAdmin) {
        // Optional: Redirect non-admins or show an error
        setIsLoading(false);
        setError("You do not have permission to view this page.");
        return;
      }

      try {
        setIsLoading(true);
        const response = await api.get<Reviewer[]>("/admin/reviewers");
        setReviewers(response.data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch reviewers:", err);
        setError("Could not load the list of reviewers. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviewers();
  }, [user, isAdmin]);

  const handleSelectReviewer = (reviewerId: number) => {
    navigate(`/dashboard/${reviewerId}`);
  };

  if (!user) {
    return <div>Loading user information...</div>
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <Header />
      <div className="p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
          {isLoading && <p>Loading reviewers...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviewers.map((reviewer) => (
                <div
                  key={reviewer.id}
                  className="bg-gray-800 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => handleSelectReviewer(reviewer.id)}
                >
                  <img
                    src={reviewer.user.avatar}
                    alt={`${reviewer.user.username}'s avatar`}
                    className="w-20 h-20 rounded-full mb-4"
                  />
                  <h2 className="text-xl font-semibold">{reviewer.user.username}</h2>
                  <p className="text-sm text-gray-400">@{reviewer.tiktok_handle}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
