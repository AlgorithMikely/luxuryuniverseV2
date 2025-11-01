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
      console.log(`ReviewerDashboard: Fetching queue for reviewerId: ${reviewerId}`);
      try {
        const response = await api.get(`/${reviewerId}/queue`);
        console.log("ReviewerDashboard: Queue data received:", response.data);
        setQueue(response.data);
        console.log("ReviewerDashboard: Queue data set in store.");
      } catch (error) {
        console.error("ReviewerDashboard: Failed to fetch queue:", error);
      }
    };

    if (reviewerId) {
      console.log(`ReviewerDashboard: Reviewer ID is present: ${reviewerId}. Setting ID and fetching queue.`);
      setReviewerId(parseInt(reviewerId, 10));
      fetchQueue();
    } else {
        console.log("ReviewerDashboard: Reviewer ID is not present, skipping fetch.");
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
