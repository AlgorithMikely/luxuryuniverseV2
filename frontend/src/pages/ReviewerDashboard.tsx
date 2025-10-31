import Navbar from "../components/Navbar";
import WebPlayer from "../components/WebPlayer";
import QueuePanel from "../components/QueuePanel";
import ReviewHub from "../components/ReviewHub";
import HistoryPanel from "../components/HistoryPanel";

const ReviewerDashboard = () => {
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
