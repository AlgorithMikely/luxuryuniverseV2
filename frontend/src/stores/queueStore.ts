import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

// Based on schemas.py User model
export interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
}

// Based on schemas.py Submission model
// Based on the full data structure seen in logs
export interface Submission {
  id: number;
  track_url: string;
  status: "pending" | "playing" | "played" | "rejected";
  is_spotlighted: boolean;
  is_bookmarked: boolean;
  track_title?: string;
  track_artist?: string;
  submitted_by: User;

  // Review fields
  rating?: number;
  tags?: string;
  private_notes?: string;
  public_review?: string;

  reviewers: Array<{
    reviewer: {
      id: number;
      user: User;
    };
  }>;
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

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentTrack: null,
  recentlyPlayed: [],
  reviewerId: null,
  setReviewerId: (id) => set({ reviewerId: id }),
  setQueue: (queue) => set({ queue }),
  setCurrentTrack: (track) => {
    const { currentTrack, recentlyPlayed } = get();
    // If there was a track playing, move it to recently played
    if (currentTrack) {
      const finalStatus = currentTrack.status === 'playing' ? 'played' : currentTrack.status;
      set((state) => ({
        recentlyPlayed: [
          { ...currentTrack, status: finalStatus },
          ...state.recentlyPlayed.filter(t => t.id !== currentTrack.id) // Remove duplicates
        ],
      }));
    }

    // Set the new track as current, and remove it from recently played if it was there
    set((state) => ({
      currentTrack: { ...track, status: "playing" },
      recentlyPlayed: state.recentlyPlayed.filter(t => t.id !== track.id),
      queue: state.queue.map((s) =>
        s.id === track.id ? { ...s, status: "playing" } : s
      ),
    }));
  },
  playNext: () => {
    const { queue, currentTrack, recentlyPlayed } = get();
    // Move the current track to recently played, updating if it's already there
    if (currentTrack) {
      const finalStatus = currentTrack.status === 'playing' ? 'played' : currentTrack.status;
      const updatedTrack = { ...currentTrack, status: finalStatus };

      const existingIndex = recentlyPlayed.findIndex(t => t.id === currentTrack.id);

      let updatedRecentlyPlayed = [...recentlyPlayed];
      if (existingIndex > -1) {
        updatedRecentlyPlayed[existingIndex] = updatedTrack;
      } else {
        updatedRecentlyPlayed = [updatedTrack, ...recentlyPlayed];
      }

      set({ recentlyPlayed: updatedRecentlyPlayed });
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
    }),
    {
      name: 'queue-storage', // unique name
      partialize: (state) => ({ recentlyPlayed: state.recentlyPlayed }), // only persist the 'recentlyPlayed' field
    }
  )
);
