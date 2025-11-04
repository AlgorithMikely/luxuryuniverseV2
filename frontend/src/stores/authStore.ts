import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export interface ReviewerProfile {
    id: number;
    discord_channel_id: string | null;
    tiktok_handle: string | null;
}
export interface UserProfile {
  id: number;
  discord_id: string;
  username: string;
  reviewer_profile: ReviewerProfile | null;
  roles: string[];
  moderated_reviewers?: ReviewerProfile[];
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  setToken: (token: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: true, // Start with loading true on initialization
      setToken: async (token) => {
        set({ token, isLoading: true });
        try {
          const response = await api.get('/user/me');
          set({ user: response.data, isLoading: false });
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          set({ token: null, user: null, isLoading: false });
        }
      },
      logout: () => {
        set({ token: null, user: null, isLoading: false });
      },
      checkAuth: async () => {
        const { token } = get();
        if (token) {
          set({ isLoading: true });
          try {
            const response = await api.get('/user/me');
            set({ user: response.data, isLoading: false });
          } catch (error) {
            console.error("Failed to verify token on load:", error);
            set({ token: null, user: null, isLoading: false });
          }
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
