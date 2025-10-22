import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useSocket } from "../context/SocketContext";
import toast from "react-hot-toast";

interface Submission {
  track_url: string;
  status: string;
}

const UserHubPage = () => {
  const [balance, setBalance] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const socket = useSocket();

  useEffect(() => {
    if (user) {
      const reviewerId = user.reviewer_profile?.id || 1; // Default to 1 if not a reviewer
      const fetchInitialData = async () => {
        setIsLoading(true);
        const [balanceRes, submissionsRes] = await Promise.all([
          api.get(`/user/me/balance?reviewer_id=${reviewerId}`),
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

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Your Hub</h1>
        <div className="mb-4 p-4 bg-gray-800 rounded-lg shadow">
          <h2 className="text-2xl font-bold">Balance: {balance} Luxury Coins</h2>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Submissions</h2>
          <ul className="space-y-2">
          {submissions.map((item, index) => (
              <li key={index} className="p-3 bg-gray-800 rounded-lg shadow flex justify-between">
                <span>{item.track_url}</span>
                <span className="capitalize">{item.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UserHubPage;
