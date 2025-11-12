import { useQueueStore } from '../stores/queueStore';
import { Submission } from '../types';

interface SpotlightPanelProps {
  reviewerId: string;
}

const SpotlightPanel = ({ reviewerId }: SpotlightPanelProps) => {
  const { spotlight, setActiveSubmission } = useQueueStore();

  const handleSelectSubmission = (submission: Submission) => {
    const isFromHistory = submission.status !== 'pending';
    setActiveSubmission(submission.id, reviewerId, isFromHistory);
  };
  return (
    <div className="space-y-2">
      {spotlight.length > 0 ? (
        spotlight.map((submission) => (
          <div
            key={submission.id}
            onClick={() => handleSelectSubmission(submission)}
            className="p-2 bg-yellow-900/50 border border-yellow-500 rounded cursor-pointer hover:bg-yellow-800/50"
          >
            <p className="font-semibold truncate">{submission.track_title || submission.track_url}</p>
            <p className="text-sm text-gray-300">by {submission.user?.username || 'Unknown'}</p>
          </div>
        ))
      ) : (
        <p className="text-gray-400">No spotlighted tracks.</p>
      )}
    </div>
  );
};

export default SpotlightPanel;
