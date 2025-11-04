import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueueStore } from '../stores/queueStore';
import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore'; // Import the new store
import api from '../services/api';

// Import the panel components
import QueuePanel from '../components/QueuePanel';
import ReviewHub from '../components/ReviewHub';
import HistoryPanel from '../components/HistoryPanel';
import WebPlayer from '../components/WebPlayer';
import Navbar from '../components/Navbar';

const ReviewerDashboard = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const {
    setQueue,
    setRecentlyPlayed,
    setSocketStatus,
    handleQueueUpdate,
  } = useQueueStore();
  const { user } = useAuthStore();
  const { socket } = useSocketStore(); // Use the Zustand store

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!reviewerId) return;
      try {
        const [queueRes, playedRes] = await Promise.all([
          api.get(`/${reviewerId}/queue`),
          api.get(`/${reviewerId}/queue/played`),
        ]);
        setQueue(queueRes.data);
        setRecentlyPlayed(playedRes.data);
      } catch (error) {
        console.error('Failed to fetch initial dashboard data:', error);
      }
    };

    fetchInitialData();
  }, [reviewerId, setQueue, setRecentlyPlayed]);

  // The socket connection and event listeners are now managed globally in App.tsx
  // We just need to react to socket events here.
  useEffect(() => {
    if (!socket) {
      setSocketStatus('disconnected');
      return;
    }

    // Set initial status based on the global socket state
    setSocketStatus(socket.connected ? 'connected' : 'connecting');

    // The 'connect' and 'disconnect' events are handled here to update the UI
    const handleConnect = () => setSocketStatus('connected');
    const handleDisconnect = () => setSocketStatus('disconnected');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('queue_updated', handleQueueUpdate); // handleQueueUpdate now expects the data directly

    // Cleanup listeners on component unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('queue_updated', handleQueueUpdate);
    };
  }, [socket, setSocketStatus, handleQueueUpdate]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
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
