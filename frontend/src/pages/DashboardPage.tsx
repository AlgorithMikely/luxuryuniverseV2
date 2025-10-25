import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useSocket } from "../context/SocketContext";
import { useQueueStore } from "../stores/queueStore";

interface Submission {
  id: number;
  track_url: string;
  is_spotlighted: boolean;
  is_bookmarked: boolean;
}

const DashboardPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<Submission[]>([]);
  const { user } = useAuthStore();
  const socket = useSocket();
  const { queue, setQueue } = useQueueStore();

  useEffect(() => {
    const fetchQueue = async () => {
      if (user && user.reviewer_profile) {
        setIsLoading(true);
        const response = await api.get(`/${user.reviewer_profile.id}/queue`);
        setQueue(response.data);
        setIsLoading(false);
      }
    };
    const fetchHistory = async () => {
      if (user && user.reviewer_profile) {
        const response = await api.get(`/${user.reviewer_profile.id}/queue/history`);
        setHistory(response.data);
      }
    };
    fetchQueue();
    fetchHistory();
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

  const handleSpotlight = async (submissionId: number, spotlight: boolean) => {
    if (user && user.reviewer_profile) {
      await api.post(
        `/${user.reviewer_profile.id}/queue/submission/${submissionId}/spotlight`,
        null,
        { params: { spotlight } }
      );
    }
  };

  const handleBookmark = async (submissionId: number, bookmark: boolean) => {
    if (user && user.reviewer_profile) {
      await api.post(
        `/${user.reviewer_profile.id}/queue/submission/${submissionId}/bookmark`,
        null,
        { params: { bookmark } }
      );
    }
  };

  if (!user) {
    return <div>Loading user...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">
          {user.username}'s Reviewer Dashboard
        </h1>
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
              {queue.map((item: Submission) => (
                <li key={item.id} className="p-3 bg-gray-800 rounded-lg shadow flex justify-between items-center">
                  <span>{item.track_url}</span>
                  <div>
                    <button
                      onClick={() => handleSpotlight(item.id, !item.is_spotlighted)}
                      className={`font-bold py-1 px-2 rounded ${
                        item.is_spotlighted ? "bg-yellow-500" : "bg-gray-700"
                      }`}
                    >
                      Spotlight
                    </button>
                    <button
                      onClick={() => handleBookmark(item.id, !item.is_bookmarked)}
                      className={`font-bold py-1 px-2 rounded ml-2 ${
                        item.is_bookmarked ? "bg-blue-500" : "bg-gray-700"
                      }`}
                    >
                      Bookmark
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-2">Recently Played</h2>
          <ul className="space-y-2">
            {history.map((item: Submission) => (
              <li key={item.id} className="p-3 bg-gray-800 rounded-lg shadow">
                {item.track_url}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
