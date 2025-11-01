import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useSocket } from "../context/SocketContext";
import { useQueueStore } from "../stores/queueStore";
import { DashboardProvider, useDashboard } from "../context/DashboardContext";
import Navbar from "../components/Navbar";
import QueuePanel from "../components/QueuePanel";
import ReviewHub from "../components/ReviewHub";
import HistoryPanel from "../components/HistoryPanel";
import SavedPanel from "../components/SavedPanel";
import PicksPanel from "../components/PicksPanel";
import UsersPanel from "../components/UsersPanel";
import WebPlayer from "../components/WebPlayer";
import api from "../services/api";

const DashboardContent = () => {
  const { user } = useAuthStore();
  const socket = useSocket();
  const { setQueue, setHistory, setSaved, setPicks } = useQueueStore();
  const { activePanel } = useDashboard();

  useEffect(() => {
    if (!socket) return;

    socket.on("queue_updated", (newQueueData: any[]) => {
      setQueue(newQueueData);
    });

    return () => {
      socket.off("queue_updated");
    };
  }, [socket, setQueue]);

  useEffect(() => {
    const fetchData = async () => {
      if (user && user.reviewer_profile) {
        const [queue, history, saved, picks] = await Promise.all([
          api.get(`/${user.reviewer_profile.id}/queue`),
          api.get(`/${user.reviewer_profile.id}/history`),
          api.get(`/${user.reviewer_profile.id}/saved`),
          api.get(`/${user.reviewer_profile.id}/picks`),
        ]);
        setQueue(queue.data);
        setHistory(history.data);
        setSaved(saved.data);
        setPicks(picks.data);
      }
    };
    fetchData();
  }, [user, setQueue, setHistory, setSaved, setPicks]);

  const renderPanel = () => {
    switch (activePanel) {
      case "queue":
        return <QueuePanel />;
      case "history":
        return <HistoryPanel />;
      case "saved":
        return <SavedPanel />;
      case "picks":
        return <PicksPanel />;
      case "users":
        return <UsersPanel />;
      default:
        return <QueuePanel />;
    }
  };

  if (!user) {
    return <div>Loading user...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-grow">
        <div className="w-1/4 p-4 border-r border-gray-700">
          {renderPanel()}
        </div>
        <div className="w-1/2 flex flex-col">
          <ReviewHub />
          <div className="p-4 border-t border-gray-700">
            <WebPlayer />
          </div>
        </div>
        <div className="w-1/4 p-4 border-l border-gray-700">
          {/* User details or other info */}
        </div>
      </div>
    </div>
  );
};

const DashboardPage = () => (
  <DashboardProvider>
    <DashboardContent />
  </DashboardProvider>
);

export default DashboardPage;
