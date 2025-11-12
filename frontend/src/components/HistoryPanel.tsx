import { useQueueStore } from '../stores/queueStore';
import { Submission } from '../types';

interface HistoryPanelProps {
  reviewerId: string;
}

const HistoryPanel = ({ reviewerId }: HistoryPanelProps) => {
  const { history, setActiveSubmission } = useQueueStore();

  const handleSelectSubmission = (submission: Submission) => {
    setActiveSubmission(submission.id, reviewerId, true); // `true` to indicate it's from history
  };

  return (
    <div className="space-y-2">
      {history.map((submission) => (
        <div
          key={submission.id}
          onClick={() => handleSelectSubmission(submission)}
          className="p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
        >
          <p className="font-semibold truncate">{submission.track_title || submission.track_url}</p>
          <p className="text-sm text-gray-400">by {submission.user?.username || 'Unknown'}</p>
          <p className="text-xs text-gray-500">Score: {submission.score ?? 'Not Rated'}</p>
        </div>
      ))}
    </div>
  );
};

export default HistoryPanel;
