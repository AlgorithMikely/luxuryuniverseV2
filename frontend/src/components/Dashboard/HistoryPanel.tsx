import React, { useMemo } from 'react';
import api from '../../services/api';
import { useQueueStore } from '../../stores/queueStore';
import { Submission } from '../../types';
import UnifiedListItem from './UnifiedListItem';

interface HistoryPanelProps {
  submissions?: Submission[];
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ submissions: propSubmissions }) => {
  const { history, bookmarks, spotlight, setCurrentTrack, currentTrack } = useQueueStore();

  // Combine all lists and remove duplicates based on ID if propSubmissions is not provided
  const allHistoryItems = useMemo(() => {
    if (propSubmissions) return propSubmissions;

    const combined = [...history, ...bookmarks, ...spotlight];
    const unique = new Map();
    combined.forEach(item => {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    });
    // Sort by most recent (assuming higher ID is more recent)
    return Array.from(unique.values()).sort((a, b) => b.id - a.id);
  }, [history, bookmarks, spotlight, propSubmissions]);

  const handlePlay = async (submission: Submission) => {
    try {
      // Tell backend to set this track as active
      await api.post(`/reviewer/${submission.reviewer_id}/queue/${submission.id}/play`);
    } catch (error) {
      console.error("Failed to play track:", error);
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
            <UnifiedListItem
              key={submission.id}
              submission={submission}
              isActive={isActive}
              isBookmarked={bookmarks.some(b => b.id === submission.id)}
              isSpotlighted={spotlight.some(s => s.id === submission.id)}
              onClick={handlePlay}
            />
          );
        })}
      </ul>
    );
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl h-full flex flex-col overflow-hidden">
      <div className="overflow-y-auto flex-grow custom-scrollbar">
        {renderList(allHistoryItems)}
      </div>
    </div>
  );
};

export default HistoryPanel;
