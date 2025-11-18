import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useQueueStore } from '../stores/queueStore';

// Import Panel Components
import SubmissionQueue from '../components/Dashboard/QueuePanel';
import ReviewHub from '../components/Dashboard/ReviewHub';
import WebPlayer from '../components/Dashboard/WebPlayer';
import RightPanelTabs from '../components/Dashboard/RightPanelTabs';

const ReviewerDashboard: React.FC = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const { token, user } = useAuthStore();
  // We get the functions once and can trust them to be stable
  const connect = useQueueStore((state) => state.connect);
  const disconnect = useQueueStore((state) => state.disconnect);
  const socketStatus = useQueueStore((state) => state.socketStatus);

  useEffect(() => {
    // This effect should only run when we have a valid token AND a user object.
    // The user object's presence confirms the token has been validated by the backend.
    if (token && user && reviewerId) {
      connect(token, reviewerId);
    }

    // The cleanup function will be called when the component unmounts or dependencies change.
    return () => {
      disconnect();
    };
  }, [token, user, reviewerId, connect, disconnect]);


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
