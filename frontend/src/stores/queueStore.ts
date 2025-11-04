import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Define the shape of a User, matching the backend schema.
interface User {
  id: number;
  username: string;
  tiktok_username?: string | null;
}

// Expand the Submission interface to include all relevant data.
export interface Submission {
  id: number;
  track_url: string;
  track_title?: string | null;
  archived_url?: string | null;
  status: 'pending' | 'played' | 'saved_for_later' | 'reviewer_pick';
  submitted_at: string;
  user: User; // Embed the user object.
  // Optional fields for review data
  notes?: string;
  rating?: number;
  is_favorite?: boolean;
}

// Define the state structure for the queue store.
interface QueueState {
  // Core data arrays
  queue: Submission[];
  recentlyPlayed: Submission[];
  savedForLater: Submission[];
  reviewerPicks: Submission[];

  // The currently active track for the web player and review hub
  currentTrack: Submission | null;

  // Connection status for real-time updates
  socketStatus: 'connected' | 'disconnected' | 'connecting';

  // --- ACTIONS ---

  // Setters for initializing and updating the main lists
  setQueue: (queue: Submission[]) => void;
  setRecentlyPlayed: (played: Submission[]) => void;
  setSavedForLater: (saved: Submission[]) => void;
  setReviewerPicks: (picks: Submission[]) => void;

  // Action to set the currently active track
  setCurrentTrack: (track: Submission | null) => void;

  // Action to update a single submission's details (e.g., after a review)
  updateSubmission: (updatedSubmission: Submission) => void;

  // Action to handle real-time queue updates from the socket
  handleQueueUpdate: (newQueue: Submission[]) => void;

  // Action to update socket connection status
  setSocketStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
}

export const useQueueStore = create<QueueState>()(
  devtools(
    (set, get) => ({
      // Initial state
      queue: [],
      recentlyPlayed: [],
      savedForLater: [],
      reviewerPicks: [],
      currentTrack: null,
      socketStatus: 'disconnected',

      // --- ACTION IMPLEMENTATIONS ---

      setQueue: (queue) => set({ queue }),
      setRecentlyPlayed: (played) => set({ recentlyPlayed: played }),
      setSavedForLater: (saved) => set({ savedForLater: saved }),
      setReviewerPicks: (picks) => set({ reviewerPicks: picks }),

      setCurrentTrack: (track) => set({ currentTrack: track }),

      updateSubmission: (updatedSubmission) => {
        const allLists = ['queue', 'recentlyPlayed', 'savedForLater', 'reviewerPicks'] as const;
        allLists.forEach((listName) => {
          const list = get()[listName];
          const updatedList = list.map((item) =>
            item.id === updatedSubmission.id ? { ...item, ...updatedSubmission } : item
          );
          set({ [listName]: updatedList });
        });

        // If the updated track is the current track, update it as well
        if (get().currentTrack?.id === updatedSubmission.id) {
          set({ currentTrack: { ...get().currentTrack, ...updatedSubmission } });
        }
      },

      handleQueueUpdate: (newQueue) => {
        set({ queue: newQueue });
      },

      setSocketStatus: (status) => set({ socketStatus: status }),
    }),
    { name: 'QueueStore' }
  )
);
