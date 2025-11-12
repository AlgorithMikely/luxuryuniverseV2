import { useState, useEffect } from 'react';
import { useQueueStore } from '../stores/queueStore';
import api from '../services/api';

interface ActiveSubmissionProps {
  reviewerId: string;
}

const ActiveSubmission = ({ reviewerId }: ActiveSubmissionProps) => {
  const { activeSubmission, updateSubmission } = useQueueStore();
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (activeSubmission) {
      setScore(activeSubmission.score ?? null);
      setNotes(activeSubmission.notes ?? '');
    } else {
      // Reset when there's no active submission
      setScore(null);
      setNotes('');
    }
  }, [activeSubmission]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmission) return;

    try {
      const response = await api.post(
        `/reviewers/${reviewerId}/queue/review/${activeSubmission.id}`,
        {
          score: score,
          notes: notes,
        }
      );
      // Update the submission in the store with the response from the API
      updateSubmission(response.data);
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const handleBookmark = () => {
    if (!activeSubmission) return;
    updateSubmission({ ...activeSubmission, bookmarked: !activeSubmission.bookmarked });
    api.post(`/submissions/${activeSubmission.id}/bookmark`);
  }

  const handleSpotlight = () => {
    if (!activeSubmission) return;
    updateSubmission({ ...activeSubmission, spotlighted: !activeSubmission.spotlighted });
    api.post(`/submissions/${activeSubmission.id}/spotlight`);
  }

  if (!activeSubmission) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg h-full flex items-center justify-center">
        <p className="text-gray-400">No submission selected.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg h-full overflow-y-auto">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold truncate">
            {activeSubmission.track_title || 'Unknown Title'}
          </h3>
          <p className="text-md text-gray-300">
            by {activeSubmission.user?.username || 'Unknown User'}
          </p>
          <a
            href={activeSubmission.track_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-400 hover:underline"
          >
            Listen on Platform
          </a>
        </div>
        <div className="flex gap-2">
            <button onClick={handleBookmark} className={`p-2 rounded ${activeSubmission.bookmarked ? 'bg-yellow-500' : 'bg-gray-700'}`}>
                Bookmark
            </button>
            <button onClick={handleSpotlight} className={`p-2 rounded ${activeSubmission.spotlighted ? 'bg-blue-500' : 'bg-gray-700'}`}>
                Spotlight
            </button>
        </div>
      </div>


      <form onSubmit={handleReviewSubmit} className="mt-4">
        <div className="mb-4">
          <label htmlFor="score" className="block text-sm font-medium text-gray-300 mb-1">
            Score (0-10)
          </label>
          <input
            id="score"
            type="number"
            min="0"
            max="10"
            value={score ?? ''}
            onChange={(e) => setScore(e.target.value === '' ? null : Number(e.target.value))}
            className="w-full bg-gray-700 p-2 rounded"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-gray-700 p-2 rounded"
          ></textarea>
        </div>
        <button type="submit" className="w-full bg-green-600 p-2 rounded">
          Submit Review
        </button>
      </form>
    </div>
  );
};

export default ActiveSubmission;
