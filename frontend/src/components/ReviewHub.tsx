import React, { useState } from "react";
import { useQueueStore } from "../stores/queueStore";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useDashboard } from "../context/DashboardContext";

const ReviewHub: React.FC = () => {
  const { nowPlaying } = useQueueStore();
  const { user } = useAuthStore();
  const [notes, setNotes] = useState("");
  const { setActivePanel, setSelectedUser } = useDashboard();

  const handleSubmitReview = async () => {
    if (!nowPlaying || !user?.reviewer_profile) return;

    await api.post(`/submissions/${nowPlaying.id}/review`, {
      notes,
      rating: 5, // Placeholder for actual rating
    });

    // Move to next in queue automatically
    await api.post(`/${user.reviewer_profile.id}/queue/next`);
  };

  if (!nowPlaying) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <p>Select a track to start reviewing</p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col p-4">
      <h2 className="text-xl font-bold mb-4">Review Hub</h2>
      <p>
        <strong>Track:</strong> {nowPlaying.track_url}
      </p>
      <div className="flex items-center">
        <p className="mr-2">
          <strong>Submitted by:</strong> {nowPlaying.user.username}
        </p>
        {nowPlaying.user.tiktok_username && (
          <p className="text-sm text-gray-400">
            (@{nowPlaying.user.tiktok_username})
          </p>
        )}
        <button
          onClick={() => {
            setSelectedUser(nowPlaying.user);
            setActivePanel("users");
          }}
          className="ml-4 text-sm text-purple-400 hover:underline"
        >
          View Profile
        </button>
      </div>
      <textarea
        className="w-full h-40 bg-gray-800 p-2 mt-4"
        placeholder="Your review notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        onClick={handleSubmitReview}
        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mt-4"
      >
        {nowPlaying.status === "played"
          ? "Update Review & Play Next"
          : "Submit Review & Play Next"}
      </button>
    </div>
  );
};

export default ReviewHub;
