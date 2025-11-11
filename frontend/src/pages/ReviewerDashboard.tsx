import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useQueueStore } from '../stores/queueStore';
import { useSessionStore } from '../stores/sessionStore';

// Import Panel Components
import QueuePanel from '../components/Dashboard/QueuePanel';
import ReviewHub from '../components/Dashboard/ReviewHub';
import HistoryPanel from '../components/Dashboard/HistoryPanel';
import WebPlayer from '../components/Dashboard/WebPlayer';
import SessionManager from '../components/Dashboard/SessionManager';
import SessionControls from '../components/Dashboard/SessionControls';

const ReviewerDashboard: React.FC = () => {
  const { token, user } = useAuthStore();
  const { activeSession } = useSessionStore();
  const { connect, disconnect, socketStatus } = useQueueStore();

  useEffect(() => {
    // Connect the socket when a token is available and there's an active session
    if (token && activeSession && socketStatus !== 'connected') {
      connect(token);
    }

    // Disconnect when the component unmounts or the session ends
    return () => {
      if (socketStatus === 'connected') {
        disconnect();
      }
    };
  }, [token, activeSession, connect, disconnect, socketStatus]);


  if (!user) {
    return <div className="text-white text-center p-8">Loading user profile...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4">
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-2rem)]">
        {/* --- Left Column: Session Management --- */}
        <div className="col-span-3 flex flex-col gap-4">
            <SessionControls />
            <SessionManager />
        </div>

        {/* --- Center Column: Queue and Review --- */}
        <div className="col-span-6 flex flex-col gap-4 h-full">
            <div className="flex-1 min-h-0">
                <QueuePanel />
            </div>
            <div className="flex-1 min-h-0">
                <ReviewHub />
            </div>
        </div>

        {/* --- Right Column: History and Player --- */}
        <div className="col-span-3 flex flex-col gap-4 h-full">
           <div className="flex-1 min-h-0">
                <HistoryPanel />
           </div>
           <div>
                <WebPlayer />
           </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;
