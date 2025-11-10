import { useQueueStore, Submission } from '../../stores/queueStore';

const HistoryPanel = () => {
  const { history, setCurrentTrack } = useQueueStore();

  const handleTrackSelect = (track: Submission) => {
    setCurrentTrack(track);
  };

  const renderList = (list: Submission[]) => {
    if (list.length === 0) {
      return <p className="text-gray-400 p-4">This list is empty.</p>;
    }
    return (
      <ul className="space-y-2 p-1">
        {list.map((submission) => (
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
            </p>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
      <div className="overflow-y-auto flex-grow">
        {renderList(history)}
      </div>
    </div>
  );
};

export default HistoryPanel;
