import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: async (token) => {
        try {
          // Set the token first to be available for the API call
          set({ token });
          const response = await api.get('/user/me');
          set({ user: response.data });
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          set({ token: null, user: null });
        }
      },
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
