import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useSocket } from "../context/SocketContext";
import { useQueueStore } from "../stores/queueStore";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import WaveformPlayer from "../components/WaveformPlayer";

interface Reviewer {
  id: number;
  user: {
    username: string;
  };
}

interface Submission {
  id: number;
  track_url: string;
  title: string | null;
  artist: string | null;
  is_spotlighted: boolean;
  is_bookmarked: boolean;
}

const DashboardPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<Submission[]>([]);
  const [currentReviewerName, setCurrentReviewerName] = useState<string>("");
  const [currentTrack, setCurrentTrack] = useState<Submission | null>(null);
  const { user } = useAuthStore();
  const socket = useSocket();
  const { queue, setQueue } = useQueueStore();
  const { reviewerId } = useParams();

  // Safely determine if the current user is an admin
  const isAdmin = user && Array.isArray(user.roles) && user.roles.includes("admin");

  useEffect(() => {
    const fetchQueue = async () => {
      if (reviewerId) {
        setIsLoading(true);
        const response = await api.get(`/${reviewerId}/queue`);
        setQueue(response.data);
        if (response.data.length > 0) {
          setCurrentTrack(response.data[0]);
        } else {
          setCurrentTrack(null);
        }
        setIsLoading(false);
      }
    };
    const fetchHistory = async () => {
      if (reviewerId) {
        const response = await api.get(`/${reviewerId}/queue/history`);
        setHistory(response.data);
      }
    };
    fetchQueue();
    fetchHistory();
  }, [reviewerId, setQueue]);

  useEffect(() => {
    const fetchCurrentReviewerName = async () => {
      if (!user) return;
      // Use the safe isAdmin check here
      if (isAdmin) {
        try {
          const response = await api.get("/admin/reviewers");
          const currentReviewer = response.data.find(
            (r: Reviewer) => r.id === parseInt(reviewerId || "")
          );
          if (currentReviewer) {
            setCurrentReviewerName(currentReviewer.user.username);
          } else {
            setCurrentReviewerName(user.username);
          }
        } catch (error) {
          console.error("Failed to fetch reviewers for name lookup", error);
          setCurrentReviewerName(user.username);
        }
      } else {
        // Non-admin users will just see their own name
        setCurrentReviewerName(user.username);
      }
    };
    fetchCurrentReviewerName();
  }, [user, reviewerId, isAdmin]); // Add isAdmin to the dependency array


  useEffect(() => {
    if (!socket) return;

    socket.on("queue_updated", (newQueueData: any[]) => {
      console.log("Queue was updated by server!");
      setQueue(newQueueData);
      if (newQueueData.length > 0) {
        setCurrentTrack(newQueueData[0]);
      } else {
        setCurrentTrack(null);
      }
    });

    return () => {
      socket.off("queue_updated");
    };
  }, [socket, setQueue]);

  const handleNextTrack = async () => {
    if (reviewerId) {
      await api.post(`/${reviewerId}/queue/next`);
    }
  };

  const handleSpotlight = async (submissionId: number, spotlight: boolean) => {
    if (reviewerId) {
      const response = await api.post(
        `/${reviewerId}/queue/submission/${submissionId}/spotlight`,
        null,
        { params: { spotlight } }
      );
      // Update the local state with the returned submission
      const updatedSubmission = response.data;
      setQueue(
        queue.map((s) => (s.id === updatedSubmission.id ? updatedSubmission : s))
      );
    }
  };

  const handleBookmark = async (submissionId: number, bookmark: boolean) => {
    if (reviewerId) {
      const response = await api.post(
        `/${reviewerId}/queue/submission/${submissionId}/bookmark`,
        null,
        { params: { bookmark } }
      );
      // Update the local state with the returned submission
      const updatedSubmission = response.data;
      setQueue(
        queue.map((s) => (s.id === updatedSubmission.id ? updatedSubmission : s))
      );
    }
  };

  const getTrackDisplayName = (submission: Submission) => {
    if (submission.title && submission.artist) {
      return `${submission.title} - ${submission.artist}`;
    }
    // Fallback to filename if title and artist are not available
    try {
      const url = new URL(submission.track_url);
      const pathnameParts = url.pathname.split('/');
      return pathnameParts[pathnameParts.length - 1] || submission.track_url;
    } catch (error) {
      // If the URL is malformed, just return the original URL
      return submission.track_url;
    }
  };

  if (!user) {
    return <div>Loading user...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <Header />
      <div className="p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">
          {currentReviewerName}'s Reviewer Dashboard
        </h1>
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Now Playing</h2>
            {currentTrack ? (
              <>
                <WaveformPlayer
                  key={currentTrack.id}
                  src={currentTrack.track_url}
                  header={getTrackDisplayName(currentTrack)}
                />
                <button
                  onClick={handleNextTrack}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto mt-4"
                >
                  Next Track
                </button>
              </>
            ) : (
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                The queue is empty.
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Queue</h2>
            {isLoading ? (
              <div className="text-center p-4">Loading queue...</div>
            ) : (
              <ul className="space-y-2">
                {queue.filter(item => item.id !== currentTrack?.id).map((item: Submission) => (
                  <li key={item.id} className="p-3 bg-gray-800 rounded-lg shadow flex justify-between items-center">
                    <a
                      href={item.track_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:underline"
                    >
                      {getTrackDisplayName(item)}
                    </a>
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
                  <a
                    href={item.track_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:underline"
                  >
                    {getTrackDisplayName(item)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
