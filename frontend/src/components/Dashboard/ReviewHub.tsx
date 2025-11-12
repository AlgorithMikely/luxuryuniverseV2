import { useState, useEffect } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useAuthStore } from '../../stores/authStore';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

const ReviewHub = () => {
  const { currentTrack, updateSubmission, setCurrentTrack, toggleBookmark, toggleSpotlight, bookmarks, spotlight } = useQueueStore();
  const { user } = useAuthStore();
  const { reviewerId } = useParams<{ reviewerId: string }>();

  // Local state for the review form
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState<number | ''>('');

  // When the currentTrack changes, update the form fields
  useEffect(() => {
    if (currentTrack) {
      setNotes(currentTrack.notes || '');
      setScore(currentTrack.score || '');
    } else {
      setNotes('');
      setScore('');
    }
  }, [currentTrack]);

  const syncReviewData = () => {
    if(!currentTrack) return;
    updateSubmission({
        ...currentTrack,
        notes,
        score: score === '' ? undefined : Number(score)
    });
  }

  const handleBookmarkClick = () => {
      if(!currentTrack) return;
      syncReviewData();
      toggleBookmark(currentTrack.id);
  }

  const handleSpotlightClick = () => {
      if(!currentTrack) return;
      syncReviewData();
      toggleSpotlight(currentTrack.id);
  }


  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack || !reviewerId) return;

    const isHistorical = currentTrack.status === 'played';

    try {
      const response = await api.post(
        `/${reviewerId}/queue/review/${currentTrack.id}`,
        {
          score: score === '' ? null : Number(score),
          notes,
        }
      );

      // Update the submission in the global store
      updateSubmission(response.data);

      // Only advance to the next track if it's not a historical review
      if (!isHistorical) {
        handleNextTrack();
      }

    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const handleNextTrack = async () => {
    if (!reviewerId) return;
    try {
        const response = await api.post(`/${reviewerId}/queue/next`);
        setCurrentTrack(response.data);
    } catch (error) {
        console.error('Failed to get next track:', error);
        // If the queue is empty, clear the current track
        setCurrentTrack(null);
    }
};

  if (!currentTrack) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-400">Select a track from the queue to start reviewing.</p>
      </div>
    );
  }

  const isPlayed = currentTrack.status === 'played';
  const isBookmarked = bookmarks.some(b => b.id === currentTrack.id);
  const isSpotlighted = spotlight.some(s => s.id === currentTrack.id);

  const getButtonText = () => {
      if(isPlayed) return 'Update Review';
      return 'Submit Review & Play Next';
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-2xl font-bold truncate">{currentTrack.track_title || currentTrack.track_url}</h3>
        <p className="text-md text-gray-400">
          Submitted by: <span className="font-semibold text-white">{currentTrack.user?.username || 'Unknown User'}</span>
        </p>
      </div>

       <div className="flex gap-2 mb-4">
            <button
                onClick={handleBookmarkClick}
                className={`py-2 px-4 rounded font-semibold transition-colors ${
                    isBookmarked ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
            >
                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
            <button
                onClick={handleSpotlightClick}
                className={`py-2 px-4 rounded font-semibold transition-colors ${
                    isSpotlighted ? 'bg-green-500 text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
            >
                {isSpotlighted ? 'Spotlighted' : 'Spotlight'}
            </button>
      </div>


      <form onSubmit={handleSubmitReview} className="space-y-4 flex-1 flex flex-col justify-between">
        <div className="flex-1 flex flex-col gap-4">
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300">
                Review Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="score" className="block text-sm font-medium text-gray-300">
                Rating (0-10)
              </label>
              <input
                id="score"
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                min="0"
                max="10"
                className="mt-1 block w-1/4 bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white"
              />
            </div>
        </div>
        <button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded transition-colors duration-200"
        >
          {getButtonText()}
        </button>
      </form>
    </div>
  );
};

export default ReviewHub;
