import { create } from 'zustand';
import api from '../services/api';

// Based on schemas.py User model
export interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
}

// Based on schemas.py Submission model
export interface Submission {
  id: number;
  track_url: string;
  status: "pending" | "playing" | "played" | "rejected";
  is_spotlighted: boolean;
  is_bookmarked: boolean;
  track_title?: string;
  track_artist?: string;
  submitted_by: User;
}

interface QueueState {
  queue: Submission[];
  currentTrack: Submission | null;
  recentlyPlayed: Submission[];
  reviewerId: number | null;
  setReviewerId: (id: number) => void;
  setQueue: (queue: Submission[]) => void;
  setCurrentTrack: (track: Submission) => void;
  playNext: () => void;
  toggleBookmark: (submissionId: number, bookmark: boolean) => Promise<void>;
  toggleSpotlight: (submissionId: number, spotlight: boolean) => Promise<void>;
}

export const useQueueStore = create<QueueState>()((set, get) => ({
  queue: [],
  currentTrack: null,
  recentlyPlayed: [],
  reviewerId: null,
  setReviewerId: (id) => set({ reviewerId: id }),
  setQueue: (queue) => set({ queue }),
  setCurrentTrack: (track) => {
    const { currentTrack } = get();
    // If there was a track playing, move it to recently played
    if (currentTrack) {
      set((state) => ({
        recentlyPlayed: [
          { ...currentTrack, status: "played" },
          ...state.recentlyPlayed,
        ],
      }));
    }
    // Set the new track as current and update its status in the queue
    set((state) => ({
      currentTrack: { ...track, status: "playing" },
      queue: state.queue.map((s) =>
        s.id === track.id ? { ...s, status: "playing" } : s
      ),
    }));
  },
  playNext: () => {
    const { queue, currentTrack } = get();
    // Move the current track to recently played
    if (currentTrack) {
      set((state) => ({
        recentlyPlayed: [
          { ...currentTrack, status: "played" },
          ...state.recentlyPlayed,
        ],
      }));
    }

    // Find the next pending track in the queue
    const nextTrack = queue.find((s) => s.status === 'pending');

    if (nextTrack) {
      // Set the next track as the current track
      set((state) => ({
        currentTrack: { ...nextTrack, status: 'playing' },
        // Update the status of the new track in the main queue
        queue: state.queue.map((s) =>
          s.id === nextTrack.id ? { ...s, status: 'playing' } : s
        ),
      }));
    } else {
      // If no pending tracks, clear the current track
      set({ currentTrack: null });
    }
  },
  toggleBookmark: async (submissionId, bookmark) => {
    const { reviewerId, currentTrack } = get();
    if (!reviewerId) return;

    // Optimistic update
    if (currentTrack?.id === submissionId) {
        set({ currentTrack: { ...currentTrack, is_bookmarked: bookmark }});
    }

    try {
      await api.post(`/${reviewerId}/queue/submission/${submissionId}/bookmark`, null, {
        params: { bookmark },
      });
    } catch (error) {
      console.error("Failed to update bookmark:", error);
      // Revert on failure
      if (currentTrack?.id === submissionId) {
          set({ currentTrack: { ...currentTrack, is_bookmarked: !bookmark }});
      }
    }
  },
  toggleSpotlight: async (submissionId, spotlight) => {
    const { reviewerId, currentTrack } = get();
    if (!reviewerId) return;

    // Optimistic update
    if (currentTrack?.id === submissionId) {
        set({ currentTrack: { ...currentTrack, is_spotlighted: spotlight }});
    }

    try {
      await api.post(`/${reviewerId}/queue/submission/${submissionId}/spotlight`, null, {
        params: { spotlight },
      });
    } catch (error) {
      console.error("Failed to update spotlight:", error);
      // Revert on failure
       if (currentTrack?.id === submissionId) {
          set({ currentTrack: { ...currentTrack, is_spotlighted: !spotlight }});
      }
    }
  },
}));
