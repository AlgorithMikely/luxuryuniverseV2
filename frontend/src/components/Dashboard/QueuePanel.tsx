import React, { useState, useEffect } from 'react';
import { useQueueStore, Submission } from '../../stores/queueStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { PriorityTier, ReviewerProfile } from '../../types';

const QueuePanel = () => {
  const { queue, setCurrentTrack, socketStatus, currentTrack } = useQueueStore();
  const { user } = useAuthStore();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [tiers, setTiers] = useState<PriorityTier[]>([
    { value: 0, label: 'Free', color: 'gray' },
    { value: 5, label: '$5 Tier', color: 'green' },
    { value: 10, label: '$10 Tier', color: 'blue' },
    { value: 15, label: '$15 Tier', color: 'purple' },
    { value: 20, label: '$20 Tier', color: 'yellow' },
    { value: 25, label: '$25+ Tier', color: 'red' },
    { value: 50, label: '50+ Tier', color: 'pink' },
  ]);

  useEffect(() => {
    const loadReviewerSettings = async () => {
        // Find the relevant reviewer ID from the queue/page context
        // Assuming the queueStore handles the current reviewer context implicitly by queue content,
        // but for fetching settings we need an ID.
        // We can get it from the first item in the queue OR use a param if this component was aware of it.
        // However, QueuePanel is used inside ReviewerDashboard which has the ID.
        // Ideally, QueuePanel should take reviewerId as a prop or use a store selector.

        // Fallback: try to get it from the URL using window.location or similar is hacky.
        // Better: use the first submission's reviewer_id if queue is not empty.
        let reviewerId: number | null = null;
        if (queue.length > 0) {
            reviewerId = queue[0].reviewer_id;
        } else if (window.location.pathname.includes('/reviewer/')) {
            const parts = window.location.pathname.split('/');
            const id = parseInt(parts[parts.indexOf('reviewer') + 1]);
            if (!isNaN(id)) reviewerId = id;
        }

        if (reviewerId) {
            try {
                const response = await api.get<ReviewerProfile>(`/${reviewerId}/settings`);
                if (response.data.configuration?.priority_tiers) {
                    setTiers(response.data.configuration.priority_tiers);
                }
            } catch (err) {
                console.error("Failed to load reviewer settings for queue panel", err);
            }
        }
    };
    loadReviewerSettings();
  }, [queue.length, window.location.pathname]); // Re-run if queue changes (might be first load) or route changes


  const handleTrackSelect = async (track: Submission) => {
    try {
      await api.post(`/${track.reviewer_id}/queue/return-active`);
    } catch (error) {
      console.error("Failed to return active track to queue:", error);
    }
    setCurrentTrack(track);
  };

  const handleMove = async (e: React.MouseEvent, track: Submission, priorityValue: number) => {
    e.stopPropagation(); // Prevent track selection
    try {
      await api.post(`/${track.reviewer_id}/queue/${track.id}/priority?priority_value=${priorityValue}`);
      setOpenMenuId(null);
    } catch (error) {
      console.error("Failed to update priority:", error);
    }
  };

  const toggleMenu = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const getPriorityStyles = (value: number) => {
    // Find the tier definition for this value
    // If exact match not found, find the highest tier <= value (logic from original code suggesting ranges)
    // Actually, user wants "add/remove" tiers, suggesting discrete values.
    // But let's stick to "highest defined tier <= value" to be safe for custom amounts.

    const sortedTiers = [...tiers].sort((a, b) => b.value - a.value);
    const tier = sortedTiers.find(t => value >= t.value) || tiers.find(t => t.value === 0);

    if (!tier) return 'border-gray-600 bg-gray-700';

    const colorMap: Record<string, string> = {
        red: 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
        yellow: 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]',
        purple: 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]',
        blue: 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]',
        green: 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
        gray: 'border-gray-600',
        pink: 'border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]',
        cyan: 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]',
    };

    const style = colorMap[tier.color] || 'border-gray-600';
    return `${style} bg-gray-800`;
  };

  // Map tiers to options format, filtering out 0 (Free) for the menu if desired,
  // but usually we want to allow moving back to free.
  const priorityOptions = tiers.map(t => ({
      value: t.value,
      label: t.label,
      color: `text-${t.color === 'gray' ? 'gray-400' : `${t.color}-400`}`
  })).sort((a, b) => a.value - b.value);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-full flex flex-col" onClick={() => setOpenMenuId(null)}>
      <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
        Submission Queue
        <span
          className={`ml-2 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full ${socketStatus === 'connected' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
            }`}
        >
          {socketStatus}
        </span>
      </h2>
      <div className="overflow-y-auto flex-grow">
        {queue.length === 0 ? (
          <p className="text-gray-400">The queue is currently empty.</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((submission) => {
              const isActive = currentTrack?.id === submission.id;
              const priorityValue = submission.priority_value || 0;

              return (
                <li
                  key={submission.id}
                  onClick={() => handleTrackSelect(submission)}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 relative ${isActive
                      ? 'bg-purple-900/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : getPriorityStyles(priorityValue)
                    } hover:bg-gray-600`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-grow min-w-0 mr-2">
                      <a href={submission.archived_url || submission.track_url} target="_blank" rel="noopener noreferrer" className="font-semibold truncate hover:underline block text-white">
                        {submission.track_title || submission.track_url}
                      </a>
                      <p className="text-sm text-gray-400 mt-1">
                        Submitted by: {submission.user?.username || 'Unknown User'}
                        {submission.user?.tiktok_username && (
                          <span className="ml-2 text-pink-400">(@{submission.user.tiktok_username})</span>
                        )}
                      </p>
                      {priorityValue > 0 && (
                        <span className="text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded bg-gray-900 text-white border border-gray-600">
                          Priority: {priorityValue}
                        </span>
                      )}
                    </div>

                    {/* Kebab Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => toggleMenu(e, submission.id)}
                        className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-600"
                      >
                        ⋮
                      </button>

                      {openMenuId === submission.id && (
                        <div className="absolute right-0 top-8 w-48 bg-gray-900 border border-gray-700 rounded shadow-xl z-10">
                          <div className="p-2 text-xs text-gray-500 border-b border-gray-800">
                            Current: {priorityValue > 0 ? `$${priorityValue}` : 'Free'}
                          </div>
                          {priorityOptions.map(option => (
                            <button
                              key={option.value}
                              onClick={(e) => handleMove(e, submission, option.value)}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center ${option.color}`}
                            >
                              <span className={`w-2 h-2 rounded-full mr-2 ${option.color.replace('text-', 'bg-')}`}></span>
                              Set to {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default QueuePanel;
