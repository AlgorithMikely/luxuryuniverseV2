import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useSocket } from "../context/SocketContext";
import toast from "react-hot-toast";

interface Submission {
  id: number;
  track_url: string;
  status: string;
  artist: string | null;
  title: string | null;
  submission_count: number;
  reviewers: {
    reviewer: {
      user: {
        username: string;
      };
    };
  }[];
}

interface UserSubmissionsResponse {
  user: {
    username: string;
    avatar: string;
  };
  submissions: Submission[];
}

const UserHubPage = () => {
  console.log("UserHubPage rendering...");
  
  const [balance, setBalance] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fix: Select individual values instead of creating new object
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const socket = useSocket();

  console.log("User:", user);
  console.log("Socket:", socket);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Starting to fetch data...");
        const [balanceRes, submissionsRes] = await Promise.all([
          api.get(`/user/me/balance`),
          api.get<UserSubmissionsResponse>("/user/me/submissions"),
        ]);

        console.log("Balance response:", balanceRes.data);
        console.log("Submissions response:", submissionsRes.data);

        setBalance(balanceRes.data.balance);
        if (Array.isArray(submissionsRes.data.submissions)) {
          setSubmissions(submissionsRes.data.submissions);
        } else {
          console.warn("Submissions is not an array:", submissionsRes.data);
          setSubmissions([]);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        setError("Failed to load your data. Please refresh the page.");
        setSubmissions([]);
      }
      setIsLoading(false);
    };

    if (user) {
      fetchInitialData();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    socket.on("balance_updated", (data: { new_balance: number }) => {
      console.log("Balance was updated by server!");
      setBalance(data.new_balance);
      toast.success("You received new coins!");
    });

    return () => {
      socket.off("balance_updated");
    };
  }, [socket]);

  if (isLoading || !user) {
    return <div className="text-white text-center p-8">Loading your hub...</div>
  }

  if (error) {
    return (
      <div className="text-white text-center p-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  // Safe render function for reviewers
  const renderReviewers = (reviewers: any) => {
    try {
      if (!reviewers || !Array.isArray(reviewers)) {
        return "N/A";
      }
      
      const usernames = reviewers
        .map(r => {
          try {
            return r?.reviewer?.user?.username;
          } catch (e) {
            console.warn("Error accessing reviewer username:", e);
            return null;
          }
        })
        .filter(username => username && typeof username === 'string');
      
      return usernames.length > 0 ? usernames.join(", ") : "N/A";
    } catch (e) {
      console.error("Error rendering reviewers:", e);
      return "N/A";
    }
  };

  console.log("About to render with submissions:", submissions);

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Your Hub</h1>
          <div className="relative">
            <img
              src={user?.avatar || ""}
              alt="User Avatar"
              className="w-10 h-10 rounded-full cursor-pointer"
              onClick={() => setShowDropdown(!showDropdown)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden w-10 h-10 bg-gray-600 rounded-full cursor-pointer flex items-center justify-center">
              {user?.username?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-10">
                <button
                  onClick={logout}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mb-4 p-4 bg-gray-800 rounded-lg shadow">
          <h2 className="text-2xl font-bold">Balance: {balance} Luxury Coins</h2>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Submissions</h2>
          {submissions.length === 0 ? (
            <p className="text-gray-400">No submissions found.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="p-2">Track</th>
                  <th className="p-2">Artist</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Times Submitted</th>
                  <th className="p-2">Submitted To</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((item, index) => {
                  try {
                    return (
                      <tr key={item.id || index} className="bg-gray-800">
                        <td className="p-2">
                          <a
                            href={item.track_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:underline"
                          >
                            {item.title || item.track_url}
                          </a>
                        </td>
                        <td className="p-2">{item.artist || "N/A"}</td>
                        <td className="p-2">{item.title || "N/A"}</td>
                        <td className="p-2 capitalize">{item.status || "N/A"}</td>
                        <td className="p-2">{item.submission_count || 0}</td>
                        <td className="p-2">
                          {renderReviewers(item.reviewers)}
                        </td>
                      </tr>
                    );
                  } catch (e) {
                    console.error(`Error rendering submission ${index}:`, e, item);
                    return (
                      <tr key={`error-${index}`} className="bg-red-800">
                        <td colSpan={6} className="p-2 text-center">
                          Error rendering submission data
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserHubPage;