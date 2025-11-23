import React from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { Submission } from '../../types';
import api from '../../services/api';

const SpotlightPanel: React.FC = () => {
  const { spotlight, setCurrentTrack } = useQueueStore();

  const handleTrackSelect = async (track: Submission) => {
    try {
        await api.post(`/reviewer/${track.reviewer_id}/queue/${track.id}/play`);
    } catch (error) {
        console.error("Failed to play track:", error);
    }
    setCurrentTrack(track);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-inner h-full overflow-y-auto">
      <h2 className="text-xl font-bold text-white p-4 sticky top-0 bg-gray-800">Spotlight Tracks</h2>
      {spotlight.length > 0 ? (
        <ul>
          {spotlight.map((track) => (
            <li
              key={track.id}
              onClick={() => handleTrackSelect(track)}
              className="p-4 border-b border-gray-700 hover:bg-gray-700 cursor-pointer"
            >
              <p className="font-semibold text-white">{track.track_title || 'Untitled'}</p>
              <p className="text-sm text-gray-400">by {track.user.username}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-gray-400 p-4">No spotlighted tracks yet.</p>
      )}
    </div>
  );
};

export default SpotlightPanel;
