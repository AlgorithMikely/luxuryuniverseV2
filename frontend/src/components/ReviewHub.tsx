import {
  StarIcon,
  TagIcon,
  ChatBubbleBottomCenterTextIcon,
  LockClosedIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/solid";
import { useState } from "react";
import { useQueueStore } from "../stores/queueStore";

const ReviewHub = () => {
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState("Pending");
  const currentTrack = useQueueStore((state) => state.currentTrack);

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
                onChange={(e) => setStatus(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-sm"
              >
                <option>Pending</option>
                <option>In Progress</option>
                <option>Reviewed</option>
                <option>Rejected</option>
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
                placeholder="This will be visible to the submitter and community..."
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
              ></textarea>
            </div>

            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
              Submit Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewHub;
