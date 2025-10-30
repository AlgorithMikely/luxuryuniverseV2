import { useEffect, useState, useRef } from "react";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useSocket } from "../context/SocketContext";
import { useQueueStore, Submission } from "../stores/queueStore";
import { useParams, useNavigate } from "react-router-dom";
import WaveSurfer from "wavesurfer.js";

interface Reviewer {
  id: number;
  user: {
    username: string;
  };
}

const DashboardPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<Submission[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [currentReviewerName, setCurrentReviewerName] = useState<string>("");
  const { user } = useAuthStore();
  const socket = useSocket();
  const { queue, setQueue } = useQueueStore();
  const { reviewerId } = useParams();
  const navigate = useNavigate();

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const nowPlaying = queue.find((s) => s.status === "playing");
  const upcomingQueue = queue.filter((s) => s.status === "pending");

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!reviewerId) return;
      setIsLoading(true);
      try {
        const [queueRes, historyRes] = await Promise.all([
          api.get(`/${reviewerId}/queue`),
          api.get(`/${reviewerId}/queue/history`),
        ]);
        setQueue(queueRes.data);
        setHistory(historyRes.data);
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
      setIsLoading(false);
    };

    fetchInitialData();
  }, [reviewerId, setQueue]);

  useEffect(() => {
    if (!nowPlaying || !waveformRef.current) return;

    // Destroy previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "rgb(209 213 219)",
      progressColor: "rgb(168 85 247)",
      height: 100,
      barWidth: 3,
      responsive: true,
    });
    wavesurferRef.current = wavesurfer;

    // Use the proxy for audio loading
    const proxiedUrl = `${api.defaults.baseURL}/proxy/audio?url=${encodeURIComponent(
      nowPlaying.track_url
    )}`;
    wavesurfer.load(proxiedUrl);

    wavesurfer.on("ready", () => {
      console.log("WaveSurfer is ready");
      wavesurfer.play();
    });
    wavesurfer.on("play", () => setIsPlaying(true));
    wavesurfer.on("pause", () => setIsPlaying(false));
    wavesurfer.on("finish", handleNextTrack);

    return () => {
      wavesurfer.destroy();
    };
  }, [nowPlaying, reviewerId]);

  useEffect(() => {
    const fetchReviewers = async () => {
      if (user?.roles.includes("admin")) {
        try {
          const response = await api.get("/admin/reviewers");
          setReviewers(response.data);
          const currentReviewer = response.data.find(
            (r: Reviewer) => r.id === parseInt(reviewerId || "")
          );
          if (currentReviewer) {
            setCurrentReviewerName(currentReviewer.user.username);
          }
        } catch (error) {
          console.error("Failed to fetch reviewers:", error);
        }
      }
    };
    fetchReviewers();
  }, [user, reviewerId]);

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
    if (reviewerId) {
      await api.post(`/${reviewerId}/queue/next`);
    }
  };

  const handleTogglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleSpotlight = async (submissionId: number, spotlight: boolean) => {
    if (reviewerId) {
      await api.post(
        `/${reviewerId}/queue/submission/${submissionId}/spotlight`,
        null,
        { params: { spotlight } }
      );
    }
  };

  const handleBookmark = async (submissionId: number, bookmark: boolean) => {
    if (reviewerId) {
      await api.post(
        `/${reviewerId}/queue/submission/${submissionId}/bookmark`,
        null,
        { params: { bookmark } }
      );
    }
  };

  if (!user) {
    return <div className="text-center p-8">Loading user...</div>;
  }

  if (isLoading) {
    return <div className="text-center p-8">Loading dashboard...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">
          {currentReviewerName || user.username}'s Dashboard
        </h1>
        {user.roles.includes("admin") && reviewers.length > 0 && (
          <div className="mb-4">
            <select
              value={reviewerId}
              onChange={(e) => navigate(`/dashboard/${e.target.value}`)}
              className="bg-gray-800 text-white p-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {reviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.user.username}'s Queue
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Now Playing Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Now Playing</h2>
          {nowPlaying ? (
            <div>
              <p className="text-xl font-semibold">{nowPlaying.track_title || "Untitled"}</p>
              <p className="text-md text-gray-400 mb-4">
                {nowPlaying.track_artist || "Unknown Artist"} - Submitted by {nowPlaying.submitted_by.username}
              </p>
              <div ref={waveformRef} className="w-full h-24 mb-4"></div>
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={handleTogglePlay}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-3 rounded-full flex items-center justify-center w-16 h-16 transition-transform transform hover:scale-105"
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                  )}
                </button>
                <button
                  onClick={handleNextTrack}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Next Track
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">The queue is empty. Ready for the first track!</p>
          )}
        </div>

        {/* Upcoming Queue */}
        <div>
          <h2 className="text-2xl font-bold mb-2">Queue</h2>
          {upcomingQueue.length > 0 ? (
            <ul className="space-y-2">
              {upcomingQueue.map((item: Submission) => (
                <li key={item.id} className="p-3 bg-gray-800 rounded-lg shadow flex justify-between items-center">
                  <div>
                    <span className="font-semibold">{item.track_title || "Untitled"}</span>
                    <span className="text-gray-400 text-sm ml-2">- {item.track_artist || "Unknown"}</span>
                  </div>
                  <div>
                    <button
                      onClick={() => handleSpotlight(item.id, !item.is_spotlighted)}
                      className={`font-bold py-1 px-3 rounded-full text-xs ${
                        item.is_spotlighted ? "bg-yellow-500 text-black" : "bg-gray-700 hover:bg-yellow-600"
                      }`}
                    >
                      Spotlight
                    </button>
                    <button
                      onClick={() => handleBookmark(item.id, !item.is_bookmarked)}
                      className={`font-bold py-1 px-3 rounded-full text-xs ml-2 ${
                        item.is_bookmarked ? "bg-blue-500 text-white" : "bg-gray-700 hover:bg-blue-600"
                      }`}
                    >
                      Bookmark
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
             !nowPlaying && <p className="text-gray-400">No more tracks in the queue.</p>
          )}
        </div>

        {/* Recently Played */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-2">Recently Played</h2>
          {history.length > 0 ? (
            <ul className="space-y-2">
              {history.map((item: Submission) => (
                <li key={item.id} className="p-3 bg-gray-800 rounded-lg shadow opacity-70">
                  <span className="font-semibold">{item.track_title || "Untitled"}</span>
                  <span className="text-gray-400 text-sm ml-2">- {item.track_artist || "Unknown"}</span>
                </li>
              ))}
            </ul>
          ) : (
             <p className="text-gray-400">No tracks have been played yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
