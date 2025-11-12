import { useQueueStore } from '../stores/queueStore';
import { Submission } from '../types';

interface SubmissionQueueProps {
  reviewerId: string;
}

const SubmissionQueue = ({ reviewerId }: SubmissionQueueProps) => {
  const { queue, setActiveSubmission, advanceQueue } = useQueueStore();

  const handleSelectSubmission = (submission: Submission) => {
    setActiveSubmission(submission.id, reviewerId);
  };

  const handleNext = () => {
    advanceQueue(reviewerId);
  };

  return (
    <div className="space-y-2">
      <button onClick={handleNext} className="w-full bg-purple-600 p-2 rounded mb-4">
        Next Track
      </button>
      {queue.map((submission) => (
        <div
          key={submission.id}
          onClick={() => handleSelectSubmission(submission)}
          className="p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
        >
          <p className="font-semibold truncate">{submission.track_title || submission.track_url}</p>
          <p className="text-sm text-gray-400">by {submission.user?.username || 'Unknown'}</p>
        </div>
      ))}
    </div>
  );
};

export default SubmissionQueue;
