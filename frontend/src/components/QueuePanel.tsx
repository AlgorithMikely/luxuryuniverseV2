import { useQueueStore } from '../stores/queueStore';
import { Submission } from '../stores/queueStore'; // Import the Submission type

const QueuePanel = () => {
  const { queue, setCurrentTrack, socketStatus } = useQueueStore();

  const handleTrackSelect = (track: Submission) => {
    setCurrentTrack(track);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">
        Submission Queue
        <span
          className={`ml-2 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full ${
            socketStatus === 'connected' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
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
            {queue.map((submission) => (
              <li
                key={submission.id}
                onClick={() => handleTrackSelect(submission)}
                className="p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-purple-600 transition-colors duration-200"
              >
                <a href={submission.archived_url || submission.track_url} target="_blank" rel="noopener noreferrer" className="font-semibold truncate hover:underline">
                  {submission.track_title || submission.track_url}
                </a>
                <p className="text-sm text-gray-400">
                  Submitted by: {submission.user?.username || 'Unknown User'}
                  {submission.user?.tiktok_username && (
                    <span className="ml-2 text-pink-400">(@{submission.user.tiktok_username})</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default QueuePanel;
