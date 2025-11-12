import { useQueueStore } from '../stores/queueStore';
import { Submission } from '../types';

interface BookmarkPanelProps {
  reviewerId: string;
}

const BookmarkPanel = ({ reviewerId }: BookmarkPanelProps) => {
  const { bookmarks, setActiveSubmission } = useQueueStore();

  const handleSelectSubmission = (submission: Submission) => {
    // A bookmarked submission might be from the queue or history,
    // so we check its status to decide how to set it as active.
    const isFromHistory = submission.status !== 'pending';
    setActiveSubmission(submission.id, reviewerId, isFromHistory);
  };

  return (
    <div className="space-y-2">
      {bookmarks.length > 0 ? (
        bookmarks.map((submission) => (
          <div
            key={submission.id}
            onClick={() => handleSelectSubmission(submission)}
            className="p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
          >
            <p className="font-semibold truncate">{submission.track_title || submission.track_url}</p>
            <p className="text-sm text-gray-400">by {submission.user?.username || 'Unknown'}</p>
          </div>
        ))
      ) : (
        <p className="text-gray-400">No bookmarked tracks.</p>
      )}
    </div>
  );
};

export default BookmarkPanel;
