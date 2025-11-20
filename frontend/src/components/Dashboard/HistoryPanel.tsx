import React, { useState, useMemo } from 'react';
import api from '../../services/api';
import { useQueueStore } from '../../stores/queueStore';
import { Submission } from '../../types';
import { Play, Edit2, Star, Bookmark, Zap } from 'lucide-react';


const HistoryPanel = () => {
  const { history, bookmarks, spotlight, setCurrentTrack, currentTrack } = useQueueStore();

  // Combine all lists and remove duplicates based on ID
  const allHistoryItems = useMemo(() => {
    const combined = [...history, ...bookmarks, ...spotlight];
    const unique = new Map();
    combined.forEach(item => {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    });
    // Sort by most recent (assuming higher ID is more recent, or we could use a timestamp if available)
    return Array.from(unique.values()).sort((a, b) => b.id - a.id);
  }, [history, bookmarks, spotlight]);

  const handlePlay = async (submission: Submission) => {
    // If we are switching tracks, ensure any currently playing track returns to queue
    // We do this optimistically or in parallel
    try {
      // Assuming we have reviewerId available in context or store, but here we might need to get it from the submission or store
      // submission.reviewer_id is available
      await api.post(`/${submission.reviewer_id}/queue/return-active`);
    } catch (error) {
      console.error("Failed to return active track to queue:", error);
    }

    setCurrentTrack(submission);
  };

  const renderList = (list: Submission[]) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-2 p-8">
          <p>No history yet.</p>
        </div>
      );
    }
    return (
      <ul className="space-y-2 p-2">
        {list.map((submission) => {
          const isActive = currentTrack?.id === submission.id;
          return (
            <li
              key={submission.id}
              onClick={() => handlePlay(submission)}
              className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${isActive
                ? 'bg-purple-900/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10'
                }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                    {submission.track_title || 'Untitled Track'}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                    <span>{submission.user?.username || 'Unknown'}</span>
                    {submission.rating && (
                      <span className="flex items-center gap-1 text-yellow-400/80">
                        <Star className="w-3 h-3 fill-current" /> {submission.rating}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Icons for status */}
                  {bookmarks.some(b => b.id === submission.id) && <Bookmark className="w-3 h-3 text-blue-400" />}
                  {spotlight.some(s => s.id === submission.id) && <Zap className="w-3 h-3 text-yellow-400" />}
                </div>
              </div>
              {submission.note && (
                <p className="text-xs text-white/40 mt-2 line-clamp-1 italic">
                  "{submission.note}"
                </p>
              )}
            </li>
          );
        })}
      </ul >
    );
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-white/5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          History & Reviews
          <span className="text-xs font-normal text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
            {allHistoryItems.length}
          </span>
        </h2>
      </div>
      <div className="overflow-y-auto flex-grow custom-scrollbar">
        {renderList(allHistoryItems)}
      </div>
    </div>
  );
};

export default HistoryPanel;
