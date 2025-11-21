import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { useSessionStore } from './sessionStore';

import { UserProfile, ReviewerProfile } from '../types';



// Remove local ReviewerProfile if it duplicates types.ts, but for now just UserProfile


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
        useSessionStore.getState().clearActiveSession();
      },
      checkAuth: async () => {
        const { token } = get();
        if (token) {
          set({ isLoading: true });
          try {
            const response = await api.get('/user/me');
            set({ user: response.data, isLoading: false });
            // After fetching user, fetch their active session
            await useSessionStore.getState().fetchActiveSession();
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
