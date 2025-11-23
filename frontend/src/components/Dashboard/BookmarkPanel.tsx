import React from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { Submission } from '../../types';
import api from '../../services/api';
import UnifiedListItem from './UnifiedListItem';

interface BookmarkPanelProps {
  submissions?: Submission[];
}

const BookmarkPanel: React.FC<BookmarkPanelProps> = ({ submissions: propSubmissions }) => {
  const { bookmarks, spotlight, setCurrentTrack, currentTrack } = useQueueStore();

  // Use propSubmissions if available, otherwise use bookmarks from store
  const displayList = propSubmissions || bookmarks;

  const handleTrackSelect = async (track: Submission) => {
    try {
      await api.post(`/reviewer/${track.reviewer_id}/queue/${track.id}/play`);
    } catch (error) {
      console.error("Failed to play track:", error);
    }
    setCurrentTrack(track);
  };

  const renderList = (list: Submission[]) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-2 p-8">
          <p>No bookmarked tracks yet.</p>
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
              onClick={handleTrackSelect}
            />
          );
        })}
      </ul>
    );
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl h-full flex flex-col overflow-hidden">
      <div className="overflow-y-auto flex-grow custom-scrollbar">
        {renderList(displayList)}
      </div>
    </div>
  );
};

export default BookmarkPanel;
