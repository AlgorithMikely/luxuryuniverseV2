import { create } from 'zustand';
import api from '../services/api';

export interface Session {
  id: number;
  reviewer_id: number;
  name: string;
  status: 'active' | 'archived';
  createdAt: string;
  open_queue_tiers: number[];
}

interface SessionState {
  activeSession: Session | null;
  isLoading: boolean;
  fetchActiveSession: () => Promise<void>;
  clearActiveSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  isLoading: false,
  fetchActiveSession: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<Session>('/sessions/active');
      set({ activeSession: response.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch active session:', error);
      // A 404 is an expected error if the user has no active session.
      set({ activeSession: null, isLoading: false });
    }
  },
  clearActiveSession: () => {
    set({ activeSession: null });
  },
}));
