import { useState, useEffect } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useAuthStore } from '../../stores/authStore';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Star, Bookmark, Zap, Save, SkipForward } from 'lucide-react';

const ReviewHub = () => {
  const { currentTrack, updateSubmission, setCurrentTrack, toggleBookmark, toggleSpotlight, bookmarks, spotlight } = useQueueStore();
  const { user } = useAuthStore();
  const { reviewerId } = useParams<{ reviewerId: string }>();

  // Local state for the review form
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState<number>(0);

  // When the currentTrack changes, update the form fields
  useEffect(() => {
    if (currentTrack) {
      setNotes(currentTrack.notes || '');
      setScore(currentTrack.score || 0);
    } else {
      setNotes('');
      setScore(0);
    }
  }, [currentTrack]);

  const syncReviewData = () => {
    if (!currentTrack) return;
    updateSubmission({
      ...currentTrack,
      notes,
      score: score === 0 ? undefined : score
    });
  }

  const handleBookmarkClick = () => {
    if (!currentTrack) return;
    syncReviewData();
    toggleBookmark(currentTrack.id);
  }

  const handleSpotlightClick = () => {
    if (!currentTrack) return;
    syncReviewData();
    toggleSpotlight(currentTrack.id);
  }


  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack || !reviewerId) return;

    const isHistorical = currentTrack.status === 'played';

    try {
      const response = await api.post(
        `/reviewer/${reviewerId}/queue/review/${currentTrack.id}`,
        {
          score: score === 0 ? null : score,
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
      const response = await api.post(`/reviewer/${reviewerId}/queue/next`);
      setCurrentTrack(response.data);
    } catch (error) {
      console.error('Failed to get next track:', error);
      // If the queue is empty, clear the current track
      setCurrentTrack(null);
    }
  };

  if (!currentTrack) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-8 h-full flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
          <Star className="w-8 h-8 text-white/20" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Ready to Review</h3>
          <p className="text-white/40 mt-1">Select a track from the queue to start listening.</p>
        </div>
      </div>
    );
  }

  const isPlayed = currentTrack.status === 'played';
  const isBookmarked = bookmarks.some(b => b.id === currentTrack.id);
  const isSpotlighted = spotlight.some(s => s.id === currentTrack.id);

  const getButtonText = () => {
    if (isPlayed) return 'Update Review';
    return 'Submit & Next';
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/5">
        <h3 className="text-2xl font-bold text-white truncate tracking-tight">{currentTrack.track_title || currentTrack.track_url}</h3>
        <div className="flex items-center justify-between mt-2">
          <p className="text-white/50 text-sm">
            Submitted by <span className="text-white font-medium">{currentTrack.user?.username || 'Unknown User'}</span>
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleBookmarkClick}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isBookmarked
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>
            <button
              onClick={handleSpotlightClick}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isSpotlighted
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
            >
              <Zap className={`w-4 h-4 ${isSpotlighted ? 'fill-current' : ''}`} />
              <span>{isSpotlighted ? 'Spotlighted' : 'Spotlight'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmitReview} className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">

        {/* Rating Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Rating</label>
            <span className="text-2xl font-bold text-purple-400">{score > 0 ? score : '-'}</span>
          </div>

          {/* Whole Numbers */}
          <div className="flex items-center gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => {
              const isSelected = Math.floor(score) === star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setScore(star)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${isSelected
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-105 ring-2 ring-purple-400/50'
                    : 'bg-white/5 text-white/20 hover:bg-white/10 hover:scale-105'
                    }`}
                >
                  <span className="font-bold text-lg">{star}</span>
                </button>
              );
            })}
          </div>

          {/* Quarter Points (only show if a whole number is selected) */}
          {score > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="text-xs font-medium text-white/30 mr-2">Fine tune:</span>
              {[0, 0.25, 0.5, 0.75].map((fraction) => {
                const baseScore = Math.floor(score);
                const targetScore = baseScore + fraction;
                const isSelected = score === targetScore;

                return (
                  <button
                    key={fraction}
                    type="button"
                    onClick={() => setScore(targetScore)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                      }`}
                  >
                    +{fraction === 0 ? '0' : fraction}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-between text-xs text-white/20 px-1 font-medium mt-1">
            <span>1 (Poor)</span>
            <span>10 (Masterpiece)</span>
          </div>
        </div>

        {/* Notes Section */}
        <div className="space-y-3 flex-1 flex flex-col">
          <label htmlFor="notes" className="text-xs font-bold text-white/40 uppercase tracking-wider">
            Review Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your thoughts on this track..."
            className="flex-1 w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none text-sm leading-relaxed"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 group"
        >
          {isPlayed ? <Save className="w-5 h-5" /> : <SkipForward className="w-5 h-5" />}
          {getButtonText()}
        </button>
      </form>
    </div>
  );
};

export default ReviewHub;
