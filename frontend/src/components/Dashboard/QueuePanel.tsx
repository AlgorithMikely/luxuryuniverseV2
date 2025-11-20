import React, { useState } from 'react';
import { useQueueStore, Submission } from '../../stores/queueStore';
import api from '../../services/api';

const QueuePanel = () => {
  const { queue, setCurrentTrack, socketStatus, currentTrack } = useQueueStore();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

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
    if (value >= 25) return 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] bg-gray-800'; // Mythic
    if (value >= 20) return 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] bg-gray-800'; // Legendary
    if (value >= 15) return 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] bg-gray-800'; // Epic
    if (value >= 10) return 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] bg-gray-800'; // Rare
    if (value >= 5) return 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] bg-gray-800'; // Common
    return 'border-gray-600 bg-gray-700'; // Free
  };

  const priorityOptions = [
    { value: 0, label: 'Free', color: 'text-gray-400' },
    { value: 5, label: '$5 Tier', color: 'text-green-400' },
    { value: 10, label: '$10 Tier', color: 'text-blue-400' },
    { value: 15, label: '$15 Tier', color: 'text-purple-400' },
    { value: 20, label: '$20 Tier', color: 'text-yellow-400' },
    { value: 25, label: '$25+ Tier', color: 'text-red-400' },
  ];

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
