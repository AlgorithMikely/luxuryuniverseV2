import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useQueueStore } from '../stores/queueStore';
import { useSessionStore } from '../stores/sessionStore';

// Import Panel Components
import SubmissionQueue from '../components/Dashboard/QueuePanel';
import ReviewHub from '../components/Dashboard/ReviewHub';
import WebPlayer from '../components/Dashboard/WebPlayer';
import RightPanelTabs from '../components/Dashboard/RightPanelTabs';


const ReviewerDashboard: React.FC = () => {
  const { token, user } = useAuthStore();
  const { activeSession } = useSessionStore();
  const { connect, disconnect, socketStatus } = useQueueStore();

  useEffect(() => {
    // Connect the socket when a token is available
    if (token && socketStatus !== 'connected') {
      connect(token);
    }

    // Disconnect when the component unmounts
    return () => {
      disconnect();
    };
  }, [token, socketStatus]);


  if (!user) {
    return <div className="text-white text-center p-8">Loading user profile...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4">
       <div className="grid grid-cols-12 gap-4 h-[calc(100vh-2rem)]">
        {/* --- Left Column: Submission Queue --- */}
        <div className="col-span-3 flex flex-col gap-4">
          <SubmissionQueue />
        </div>

        {/* --- Middle Column: Player and Review Hub --- */}
        <div className="col-span-6 flex flex-col gap-4 h-full">
          <WebPlayer />
          <div className="flex-1 min-h-0">
             <ReviewHub />
          </div>
        </div>

        {/* --- Right Column: Tabs (History, Bookmarks, etc.) --- */}
        <div className="col-span-3 flex flex-col gap-4 h-full">
            <RightPanelTabs />
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;
