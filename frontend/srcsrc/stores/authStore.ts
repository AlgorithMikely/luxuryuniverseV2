import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
  reviewer_profile: {
    id: number;
  } | null;
  roles?: string[]; // Roles are now part of the user object
}

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
        set({ token });
        try {
          // The /user/me endpoint now returns the complete user profile, including roles
          const response = await api.get<User>('/user/me');
          set({ user: response.data });
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          // Clear auth state on error
          set({ token: null, user: null });
        }
      },
      logout: () => {
        set({ token: null, user: null });
        // Optionally, clear other related storage here
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
