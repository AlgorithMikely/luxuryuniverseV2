import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useQueueStore } from '../stores/queueStore';
import api from '../services/api';

// Import Panel Components
import SubmissionQueue from '../components/Dashboard/QueuePanel';
import ReviewHub from '../components/Dashboard/ReviewHub';
import WebPlayer from '../components/Dashboard/WebPlayer';
import RightPanelTabs from '../components/Dashboard/RightPanelTabs';
import SessionManager from '../components/Dashboard/SessionManager';

import { AnimatePresence } from 'framer-motion';

const ReviewerDashboard: React.FC = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const { token, user } = useAuthStore();
  // We get the functions once and can trust them to be stable
  const connect = useQueueStore((state) => state.connect);
  const disconnect = useQueueStore((state) => state.disconnect);
  const socketStatus = useQueueStore((state) => state.socketStatus);

  const [resolvedReviewerId, setResolvedReviewerId] = React.useState<string | null>(null);

  useEffect(() => {
    const resolveId = async () => {
      if (!reviewerId) return;

      // If it's already a numeric ID, use it directly
      if (/^\d+$/.test(reviewerId)) {
        setResolvedReviewerId(reviewerId);
        return;
      }

      // Otherwise, try to resolve via public API
      try {
        const { data } = await api.get(`/reviewer/public/${reviewerId}`);
        if (data && data.id) {
          setResolvedReviewerId(data.id.toString());
        }
      } catch (error) {
        console.error("Failed to resolve reviewer handle:", error);
      }
    };
    resolveId();
  }, [reviewerId]);

  useEffect(() => {
    // This effect should only run when we have a valid token AND a user object AND a resolved reviewer ID.
    if (token && user && resolvedReviewerId) {
      connect(token, resolvedReviewerId);
      useQueueStore.getState().fetchInitialStateHttp(resolvedReviewerId);
    }

    // The cleanup function will be called when the component unmounts or dependencies change.
    return () => {
      disconnect();
    };
  }, [token, user, resolvedReviewerId, connect, disconnect]);


  if (!user || !resolvedReviewerId) {
    return <div className="text-white text-center p-8">Loading...</div>;
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 relative">
      <div className="mb-4">
        <SessionManager
          reviewerId={resolvedReviewerId}
        />
      </div>
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-2rem)]">
        {/* --- Left Column: Submission Queue --- */}
        <div className="col-span-3 flex flex-col gap-4">
          <SubmissionQueue reviewerId={resolvedReviewerId} />
        </div>

        {/* --- Middle Column: Player and Review Hub --- */}
        <div className="col-span-6 flex flex-col gap-4 h-full">
          <WebPlayer />
          <div className="flex-1 min-h-0">
            <ReviewHub reviewerId={resolvedReviewerId} />
          </div>
        </div>

        {/* --- Right Column: Tabs (History, Bookmarks, etc.) --- */}
        <div className="col-span-3 flex flex-col gap-4 h-full">
          <RightPanelTabs reviewerId={resolvedReviewerId} />
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboard;
