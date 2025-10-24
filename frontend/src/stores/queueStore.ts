import { create } from 'zustand';

interface Submission {
  id: number;
  track_url: string;
  status: string;
  is_spotlighted: boolean;
  is_bookmarked: boolean;
}

interface QueueState {
  queue: Submission[];
  setQueue: (queue: Submission[]) => void;
}

export const useQueueStore = create<QueueState>()((set) => ({
  queue: [],
  setQueue: (queue) => set({ queue }),
}));
