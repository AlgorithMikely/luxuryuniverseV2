import { create } from 'zustand';

interface Submission {
  id: number;
  track_url: string;
  status: "pending" | "playing" | "played";
  is_spotlighted: boolean;
  is_bookmarked: boolean;
  track_title?: string;
  track_artist?: string;
  submitted_by: {
    username: string;
  };
}

interface QueueState {
  queue: Submission[];
  setQueue: (queue: Submission[]) => void;
}

export const useQueueStore = create<QueueState>()((set) => ({
  queue: [],
  setQueue: (queue) => set({ queue }),
}));
