import React, { useState, useEffect } from 'react';
import { useQueueStore, Submission } from '../../stores/queueStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { PriorityTier, ReviewerProfile } from '../../types';

interface QueuePanelProps {
  reviewerId?: string | number;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ reviewerId: propReviewerId }) => {
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
      // Use prop if available, otherwise try to infer
      let id = propReviewerId;

      if (!id) {
        if (queue.length > 0) {
          id = queue[0].reviewer_id;
        } else if (window.location.pathname.includes('/reviewer/')) {
          const parts = window.location.pathname.split('/');
          const parsedId = parseInt(parts[parts.indexOf('reviewer') + 1]);
          if (!isNaN(parsedId)) id = parsedId;
        }
      }

      if (id) {
        try {
          const response = await api.get<ReviewerProfile>(`/reviewer/${id}/settings`);
          if (response.data.configuration?.priority_tiers) {
            setTiers(response.data.configuration.priority_tiers);
          }
        } catch (err) {
          console.error("Failed to load reviewer settings for queue panel", err);
        }
      }
    };
    loadReviewerSettings();
  }, [queue.length, window.location.pathname, propReviewerId]);


  const handleTrackSelect = async (track: Submission) => {
    try {
      await api.post(`/reviewer/${track.reviewer_id}/queue/return-active`);
    } catch (error) {
      console.error("Failed to return active track to queue:", error);
    }
    setCurrentTrack(track);
  };

  const handleMove = async (e: React.MouseEvent, track: Submission, priorityValue: number) => {
    e.stopPropagation(); // Prevent track selection
    try {
      await api.post(`/reviewer/${track.reviewer_id}/queue/${track.id}/priority?priority_value=${priorityValue}`);
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
    const sortedTiers = [...tiers].sort((a, b) => b.value - a.value);
    const tier = sortedTiers.find(t => value >= t.value) || tiers.find(t => t.value === 0);

    if (!tier) return 'border-gray-600 bg-gray-700';

    const colorMap: Record<string, string> = {
      red: 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
      orange: 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]',
      amber: 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]',
      yellow: 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]',
      lime: 'border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.5)]',
      green: 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
      emerald: 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]',
      teal: 'border-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]',
      cyan: 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]',
      sky: 'border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]',
      blue: 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]',
      indigo: 'border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]',
      violet: 'border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]',
      purple: 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]',
      fuchsia: 'border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]',
      pink: 'border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]',
      rose: 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
      gray: 'border-gray-600',
    };

    const style = colorMap[tier.color] || 'border-gray-600';
    return style;
  };

  // ... (textColorMap and bgColorMap remain unchanged)

  // Map for text colors to avoid dynamic class issues
  const textColorMap: Record<string, string> = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    yellow: 'text-yellow-400',
    lime: 'text-lime-400',
    green: 'text-green-400',
    emerald: 'text-emerald-400',
    teal: 'text-teal-400',
    cyan: 'text-cyan-400',
    sky: 'text-sky-400',
    blue: 'text-blue-400',
    indigo: 'text-indigo-400',
    violet: 'text-violet-400',
    purple: 'text-purple-400',
    fuchsia: 'text-fuchsia-400',
    pink: 'text-pink-400',
    rose: 'text-rose-400',
    gray: 'text-gray-400',
  };

  const bgColorMap: Record<string, string> = {
    red: 'bg-red-400',
    orange: 'bg-orange-400',
    amber: 'bg-amber-400',
    yellow: 'bg-yellow-400',
    lime: 'bg-lime-400',
    green: 'bg-green-400',
    emerald: 'bg-emerald-400',
    teal: 'bg-teal-400',
    cyan: 'bg-cyan-400',
    sky: 'bg-sky-400',
    blue: 'bg-blue-400',
    indigo: 'bg-indigo-400',
    violet: 'bg-violet-400',
    purple: 'bg-purple-400',
    fuchsia: 'bg-fuchsia-400',
    pink: 'bg-pink-400',
    rose: 'bg-rose-400',
    gray: 'bg-gray-400',
  };

  const priorityOptions = tiers.map(t => ({
    value: t.value,
    label: t.label,
    textColor: textColorMap[t.color] || 'text-gray-400',
    bgColor: bgColorMap[t.color] || 'bg-gray-400'
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

              const priorityStyle = getPriorityStyles(priorityValue);

              return (
                <li
                  key={submission.id}
                  onClick={() => handleTrackSelect(submission)}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 relative 
                    ${isActive
                      ? `bg-purple-900/40 ${priorityStyle} shadow-[0_0_15px_rgba(168,85,247,0.3)]`
                      : `${priorityStyle} bg-gray-800`
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
                      {priorityValue > 0 && (() => {
                        const tier = tiers.slice().sort((a, b) => b.value - a.value).find(t => priorityValue >= t.value);
                        const color = tier ? tier.color : 'gray';
                        const textColor = textColorMap[color] || 'text-gray-400';
                        const borderColor = color === 'gray' ? 'border-gray-600' : `border-${color}-500`;

                        return (
                          <span className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded bg-gray-900 ${textColor} ${borderColor} border`}>
                            Priority: {priorityValue}
                          </span>
                        );
                      })()}
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
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 flex items-center ${option.textColor}`}
                            >
                              <span className={`w-2 h-2 rounded-full mr-2 ${option.bgColor}`}></span>
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
