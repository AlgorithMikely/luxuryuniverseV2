import React, { useState, useEffect } from 'react';
import { Trash2, ArrowUp, Search } from 'lucide-react';
import { useQueueStore, Submission } from '../../stores/queueStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { PriorityTier, ReviewerProfile } from '../../types';
import { useSubmissionSearch } from '../../hooks/useSubmissionSearch';

interface QueuePanelProps {
  reviewerId?: string | number;
}

const QueuePanel: React.FC<QueuePanelProps> = ({ reviewerId: propReviewerId }) => {
  const { queue, setCurrentTrack, socketStatus, currentTrack, updateSubmission } = useQueueStore();
  const { user } = useAuthStore();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tiers, setTiers] = useState<PriorityTier[]>([
    { value: 0, label: 'Free', color: 'gray' },
    { value: 5, label: '$5 Tier', color: 'green' },
    { value: 10, label: '$10 Tier', color: 'blue' },
    { value: 15, label: '$15 Tier', color: 'purple' },
    { value: 20, label: '$20 Tier', color: 'yellow' },
    { value: 25, label: '$25+ Tier', color: 'red' },
    { value: 50, label: '50+ Tier', color: 'pink' },
  ]);

  const filteredQueue = useSubmissionSearch(queue, searchQuery);

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
      // Call the play endpoint to set this track as active on the backend
      await api.post(`/reviewer/${track.reviewer_id}/queue/${track.id}/play`);
    } catch (error) {
      console.error("Failed to set active track:", error);
    }
    // We still set it locally for instant feedback, though the socket update will confirm it
    setCurrentTrack(track);
  };

  const handleMove = async (e: React.MouseEvent, track: Submission, priorityValue: number) => {
    e.stopPropagation(); // Prevent track selection

    // Optimistic update
    updateSubmission({
      ...track,
      priority_value: priorityValue,
      is_priority: priorityValue > 0
    });

    try {
      await api.post(`/reviewer/${track.reviewer_id}/queue/${track.id}/priority?priority_value=${priorityValue}`);
      setOpenMenuId(null);
    } catch (error) {
      console.error("Failed to update priority:", error);
      // Revert if we did optimistic update
      updateSubmission(track);
    }
  };

  const handleRemove = async (e: React.MouseEvent, track: Submission) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove "${track.track_title}" from the queue?`)) {
      try {
        await api.delete(`/reviewer/${track.reviewer_id}/queue/${track.id}`);
      } catch (error) {
        console.error("Failed to remove submission:", error);
      }
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
      <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2 flex justify-between items-center">
        <div className="flex items-center">
          Submission Queue
          <span
            className={`ml-2 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full ${socketStatus === 'connected' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}
          >
            {socketStatus}
          </span>
        </div>
      </h2>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="Search queue..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </div>

      <div className="overflow-y-auto flex-grow">
        {queue.length === 0 ? (
          <p className="text-gray-400">The queue is currently empty.</p>
        ) : filteredQueue.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No matches found.</p>
        ) : (
          <ul className="space-y-2">
            {filteredQueue.map((submission) => {
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
                      <span className="font-semibold truncate block text-white">
                        {submission.track_title || submission.track_url}
                      </span>
                      {submission.artist && (
                        <span className="block text-xs text-purple-400 font-medium mt-0.5">
                          {submission.artist}
                        </span>
                      )}
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

                    {/* Actions */}
                    <div className="relative flex items-center">
                      <button
                        onClick={(e) => handleRemove(e, submission)}
                        className="text-gray-400 hover:text-red-400 p-1 rounded hover:bg-gray-600 mr-1"
                        title="Remove Submission"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => toggleMenu(e, submission.id)}
                        className="text-gray-400 hover:text-purple-400 p-1 rounded hover:bg-gray-600"
                        title="Move to Skip Queue"
                      >
                        <ArrowUp className="w-4 h-4" />
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
