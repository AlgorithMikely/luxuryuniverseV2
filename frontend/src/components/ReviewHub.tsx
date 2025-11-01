import {
  StarIcon,
  TagIcon,
  ChatBubbleBottomCenterTextIcon,
  LockClosedIcon,
  MusicalNoteIcon,
  HeartIcon,
} from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";
import { useQueueStore, Submission } from "../stores/queueStore";

import api from "../services/api"; // Import the api service

const ReviewHub = () => {
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<Submission['status']>("pending");
  const [tags, setTags] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [publicReview, setPublicReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentTrack, reviewerId, playNext, updateReview } = useQueueStore((state) => ({
    currentTrack: state.currentTrack,
    reviewerId: state.reviewerId,
    playNext: state.playNext,
    updateReview: state.updateReview,
  }));
  const toggleBookmark = useQueueStore((state) => state.toggleBookmark);
  const toggleSpotlight = useQueueStore((state) => state.toggleSpotlight);

  useEffect(() => {
    // When a new track is loaded, populate the form with its review data
    if (currentTrack) {
      setRating(currentTrack.rating || 0);
      setStatus(currentTrack.status || "pending");
      setTags(currentTrack.tags || "");
      setPrivateNotes(currentTrack.private_notes || "");
      setPublicReview(currentTrack.public_review || "");
    }
  }, [currentTrack?.id]);

  const handleSubmitReview = async () => {
    if (!currentTrack || !reviewerId) return;

    setIsSubmitting(true);
    try {
      const reviewData = {
        rating,
        status,
        tags,
        private_notes: privateNotes,
        public_review: publicReview,
      };

      await api.post(`/${reviewerId}/queue/submission/${currentTrack.id}/review`, reviewData);

      // Manually update the review in the global store before playing next
      updateReview(currentTrack.id, reviewData);

      // Reset form state after successful submission
      setRating(0);
      setStatus("pending");
      setTags("");
      setPrivateNotes("");
      setPublicReview("");

      // The endpoint triggers a queue update via websocket.
      // Now, we tell the player to load and play the next track from the updated queue.
      playNext();

    } catch (error) {
      console.error("Failed to submit review:", error);
      // Optionally, show an error message to the user
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentTrack) {
    return (
        <div className="w-1/2 bg-gray-900 p-6 h-full flex flex-col items-center justify-center text-center">
            <MusicalNoteIcon className="h-24 w-24 text-gray-700 mb-4" />
            <h3 className="text-2xl font-bold text-gray-400">Nothing Playing</h3>
            <p className="text-gray-500">Select a track from the queue to start your review.</p>
        </div>
    );
  }

  return (
    <div className="w-1/2 bg-gray-900 p-6 overflow-y-auto h-full">
      <h2 className="text-2xl font-bold mb-6">Review Hub</h2>

      <div className="flex flex-col lg:flex-row space-y-6 lg:space-y-0 lg:space-x-6">
        {/* Left Side: Art & Metadata */}
        <div className="lg:w-1/2">
            <div className="w-full aspect-square bg-gray-800 rounded-lg shadow-lg mb-4 flex items-center justify-center">
                <MusicalNoteIcon className="h-32 w-32 text-gray-600"/>
            </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-bold">{currentTrack.track_title || 'Untitled'}</h3>
            <p className="text-xl text-gray-400">{currentTrack.track_artist || 'Unknown Artist'}</p>
            <p className="text-sm text-gray-400">
              Submitted by{" "}
              <span className="font-semibold text-purple-400">
                {currentTrack.submitted_by.username}
              </span>
            </p>
          </div>
        </div>

        {/* Right Side: Review Form */}
        <div className="lg:w-1/2 flex-grow">
          <div className="bg-gray-800 p-4 rounded-lg space-y-4">
            {/* Rating */}
            <div className="flex items-center justify-between">
              <label className="font-semibold">Rating</label>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon
                    key={star}
                    className={`h-6 w-6 cursor-pointer ${
                      rating >= star ? "text-yellow-400" : "text-gray-600"
                    }`}
                    onClick={() => setRating(star)}
                  />
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <label htmlFor="status" className="font-semibold">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Submission['status'])}
                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="playing">In Progress</option>
                <option value="played">Reviewed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className="font-semibold block mb-2">
                <TagIcon className="h-5 w-5 inline mr-1" /> Tags
              </label>
              <input
                type="text"
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., indie, high-energy, vocal-heavy"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
              />
            </div>

            {/* Private Notes */}
            <div>
              <label htmlFor="private_notes" className="font-semibold block mb-2">
                <LockClosedIcon className="h-5 w-5 inline mr-1" /> Private Notes
              </label>
              <textarea
                id="private_notes"
                rows={4}
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                placeholder="Your eyes only..."
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
              ></textarea>
            </div>

            {/* Public Review */}
            <div>
              <label htmlFor="public_review" className="font-semibold block mb-2">
                <ChatBubbleBottomCenterTextIcon className="h-5 w-5 inline mr-1" /> Public Review
              </label>
              <textarea
                id="public_review"
                rows={6}
                value={publicReview}
                onChange={(e) => setPublicReview(e.target.value)}
                placeholder="This will be visible to the submitter and community..."
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
              ></textarea>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={() => currentTrack && toggleBookmark(currentTrack.id, !currentTrack.is_bookmarked)}
                    className={`w-1/2 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                        currentTrack.is_bookmarked
                            ? 'bg-pink-500 hover:bg-pink-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                >
                    <HeartIcon className="h-5 w-5"/>
                    <span>{currentTrack.is_bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>
                <button
                    onClick={() => currentTrack && toggleSpotlight(currentTrack.id, !currentTrack.is_spotlighted)}
                    className={`w-1/2 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                        currentTrack.is_spotlighted
                            ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                >
                    <StarIcon className="h-5 w-5"/>
                    <span>{currentTrack.is_spotlighted ? 'Spotlighted' : 'Spotlight'}</span>
                </button>
            </div>
            <button
                onClick={handleSubmitReview}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Submitting...'
                : ['played', 'Reviewed', 'Rejected'].includes(currentTrack.status)
                ? 'Update Review & Load Next Track'
                : 'Submit Review & Play Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewHub;
