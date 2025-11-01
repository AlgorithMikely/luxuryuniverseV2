import { create } from "zustand";
import { User } from "./authStore";

export interface Submission {
  id: number;
  track_url: string;
  status: "pending" | "played";
  user: User;
  [key: string]: any; // Allow for other properties
}

interface QueueState {
  queue: Submission[];
  nowPlaying: Submission | null;
  history: Submission[];
  saved: Submission[];
  picks: Submission[];
  setQueue: (queue: Submission[]) => void;
  setNowPlaying: (submission: Submission | null) => void;
  setHistory: (history: Submission[]) => void;
  setSaved: (saved: Submission[]) => void;
  setPicks: (picks: Submission[]) => void;
}

export const useQueueStore = create<QueueState>()((set) => ({
  queue: [],
  nowPlaying: null,
  history: [],
  saved: [],
  picks: [],
  setQueue: (queue) => set({ queue }),
  setNowPlaying: (submission) => set({ nowPlaying: submission }),
  setHistory: (history) => set({ history }),
  setSaved: (saved) => set({ saved }),
  setPicks: (picks) => set({ picks }),
}));
