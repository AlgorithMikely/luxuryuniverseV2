import { useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import WebPlayer from "../components/WebPlayer";
import QueuePanel from "../components/QueuePanel";
import ReviewHub from "../components/ReviewHub";
import HistoryPanel from "../components/HistoryPanel";
import { useQueueStore } from "../stores/queueStore";
import { useSocketStore } from "../stores/socketStore";
import api from "../services/api";

const ReviewerDashboard = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const { setQueue, setReviewerId } = useQueueStore();
  const socket = useSocketStore((state) => state.socket);

  useEffect(() => {
    if (socket) {
      const handleQueueUpdate = (data: any) => {
        console.log("Queue update received!", data);
        setQueue(data);
      };

      socket.on("queue_updated", handleQueueUpdate);

      // Clean up the event listener when the component unmounts
      return () => {
        socket.off("queue_updated", handleQueueUpdate);
      };
    }
  }, [socket, setQueue]);

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
      <div className="flex-shrink-0">
        <WebPlayer />
      </div>
    </div>
  );
};

export default ReviewerDashboard;
