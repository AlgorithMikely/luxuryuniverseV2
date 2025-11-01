import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueueStore } from '../stores/queueStore';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

// Import the panel components
import QueuePanel from '../components/QueuePanel';
import ReviewHub from '../components/ReviewHub';
import HistoryPanel from '../components/HistoryPanel';
import WebPlayer from '../components/WebPlayer';
import Navbar from '../components/Navbar'; // Assuming a Navbar component exists

const ReviewerDashboard = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const {
    setQueue,
    setRecentlyPlayed,
    setSocketStatus,
    handleQueueUpdate,
  } = useQueueStore();
  const { user } = useAuthStore();
  const socket = useSocket();

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!reviewerId) return;
      try {
        const [queueRes, playedRes] = await Promise.all([
          api.get(`/api/${reviewerId}/queue`),
          api.get(`/api/${reviewerId}/queue/played`),
        ]);
        setQueue(queueRes.data);
        setRecentlyPlayed(playedRes.data);
      } catch (error) {
        console.error('Failed to fetch initial dashboard data:', error);
      }
    };

    fetchInitialData();
  }, [reviewerId, setQueue, setRecentlyPlayed]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => setSocketStatus('connected'));
    socket.on('disconnect', () => setSocketStatus('disconnected'));
    socket.on('queue_updated', (data) => handleQueueUpdate(data.queue));

    if (socket.connected) {
      setSocketStatus('connected');
    } else {
      setSocketStatus('connecting');
      socket.connect();
    }

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('queue_updated');
      }
    };
  }, [socket, setSocketStatus, handleQueueUpdate]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-grow p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
        {/* Left Panel: Queue */}
        <div className="lg:col-span-3 h-full">
          <QueuePanel />
        </div>

        {/* Center Panel: Review Hub */}
        <div className="lg:col-span-6 h-full flex flex-col">
          <div className="flex-grow">
            <ReviewHub />
          </div>
          <div className="mt-4">
            <WebPlayer />
          </div>
        </div>

        {/* Right Panel: History */}
        <div className="lg:col-span-3 h-full">
          <HistoryPanel />
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;
