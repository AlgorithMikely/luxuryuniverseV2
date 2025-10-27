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

const UserHubPage = () => {
  const [balance, setBalance] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { user } = useAuthStore();
  const socket = useSocket();

  useEffect(() => {
    if (user) {
      const fetchInitialData = async () => {
        setIsLoading(true);
        const [balanceRes, submissionsRes] = await Promise.all([
          api.get(`/user/me/balance`),
          api.get("/user/me/submissions"),
        ]);
        setBalance(balanceRes.data.balance);
        setSubmissions(submissionsRes.data);
        setIsLoading(false);
      };
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

  if (isLoading) {
    return <div className="text-white text-center p-8">Loading your hub...</div>
  }

  const { logout } = useAuthStore();

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
            />
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
              {submissions.map((item) => (
                <tr key={item.id} className="bg-gray-800">
                  <td className="p-2">
                    <a href={item.track_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                      {item.track_url}
                    </a>
                  </td>
                  <td className="p-2">{item.artist || "N/A"}</td>
                  <td className="p-2">{item.title || "N/A"}</td>
                  <td className="p-2 capitalize">{item.status}</td>
                  <td className="p-2">{item.submission_count}</td>
                  <td className="p-2">
                    {item.reviewers.map(r => r.reviewer.user.username).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserHubPage;
