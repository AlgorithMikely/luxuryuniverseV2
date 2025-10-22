import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useSocket } from "../context/SocketContext";
import { useQueueStore } from "../stores/queueStore";

const DashboardPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const socket = useSocket();
  const { queue, setQueue } = useQueueStore();

  useEffect(() => {
    if (user && user.reviewer_profile) {
      const fetchQueue = async () => {
        setIsLoading(true);
        const response = await api.get(`/${user.reviewer_profile.id}/queue`);
        setQueue(response.data);
        setIsLoading(false);
      };
      fetchQueue();
    }
  }, [user, setQueue]);

  useEffect(() => {
    if (!socket) return;

    socket.on("queue_updated", (newQueueData: any[]) => {
      console.log("Queue was updated by server!");
      setQueue(newQueueData);
    });

    return () => {
      socket.off("queue_updated");
    };
  }, [socket, setQueue]);

  const handleNextTrack = async () => {
    if (user && user.reviewer_profile) {
      await api.post(`/${user.reviewer_profile.id}/queue/next`);
    }
  };

  if (!user) {
    return <div>Loading user...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Reviewer Dashboard</h1>
        <div className="mb-4">
          <button
            onClick={handleNextTrack}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto"
          >
            Next Track
          </button>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Queue</h2>
          {isLoading ? (
            <div className="text-center p-4">Loading queue...</div>
          ) : (
            <ul className="space-y-2">
              {queue.map((item, index) => (
                <li key={index} className="p-3 bg-gray-800 rounded-lg shadow">
                  {item.track_url}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
