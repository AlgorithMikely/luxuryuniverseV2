import { useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import WebPlayer from "../components/WebPlayer";
import QueuePanel from "../components/QueuePanel";
import ReviewHub from "../components/ReviewHub";
import HistoryPanel from "../components/HistoryPanel";
import { useQueueStore } from "../stores/queueStore";
import api from "../services/api";

const ReviewerDashboard = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const setQueue = useQueueStore((state) => state.setQueue);
  const setReviewerId = useQueueStore((state) => state.setReviewerId);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await api.get(`/${reviewerId}/queue`);
        setQueue(response.data);
      } catch (error) {
        console.error("Failed to fetch queue:", error);
      }
    };

    if (reviewerId) {
      setReviewerId(parseInt(reviewerId, 10));
      fetchQueue();
    }
  }, [reviewerId, setQueue, setReviewerId]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Navbar />
      <main className="flex flex-grow overflow-hidden">
        <QueuePanel />
        <ReviewHub />
        <HistoryPanel />
      </main>
      <WebPlayer />
    </div>
  );
};

export default ReviewerDashboard;
