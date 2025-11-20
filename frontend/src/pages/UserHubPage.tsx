import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import toast from "react-hot-toast";

interface Submission {
  track_url: string;
  status: string;
}

interface UserSubmissionsResponse {
  submissions: Submission[];
}

const UserHubPage = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      const fetchSubmissions = async () => {
        setIsLoading(true);
        try {
          const response = await api.get<Submission[]>("/user/me/submissions");
          if (Array.isArray(response.data)) {
            setSubmissions(response.data);
          } else if (response.data && Array.isArray((response.data as any).submissions)) {
            // Fallback for previous structure if needed
            setSubmissions((response.data as any).submissions);
          } else {
            console.error("Submissions data is not in the expected format:", response.data);
            setSubmissions([]);
          }
        } catch (error) {
          console.error("Failed to fetch submissions:", error);
          toast.error("Could not load your submissions. Please try again later.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchSubmissions();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return <div className="text-white text-center p-8">Loading your hub...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Your Hub</h1>

          {/* Managed Queues Section */}
          {user?.moderated_reviewers && user.moderated_reviewers.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Managed Queues</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.moderated_reviewers.map((reviewer) => (
                  <div key={reviewer.id} className="bg-gray-800 p-4 rounded-lg shadow hover:bg-gray-700 transition-colors">
                    <h3 className="text-xl font-semibold mb-2">{reviewer.tiktok_handle || reviewer.username || `Reviewer #${reviewer.id}`}</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Status: <span className={reviewer.queue_status === 'open' ? 'text-green-400' : 'text-red-400'}>{reviewer.queue_status}</span>
                    </p>
                    <Link
                      to={`/reviewer/${reviewer.id}`}
                      className="block w-full text-center bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-medium"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold mb-2">Your Submissions</h2>
            {submissions.length > 0 ? (
              <ul className="space-y-2">
                {submissions.map((item, index) => (
                  <li key={index} className="p-3 bg-gray-800 rounded-lg shadow flex justify-between">
                    <span>{item.track_url}</span>
                    <span className="capitalize">{item.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>You have not made any submissions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserHubPage;
