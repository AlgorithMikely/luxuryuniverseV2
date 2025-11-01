import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import jwtDecode from 'jwt-decode';
import api from '../services/api';

interface ReviewerProfile {
    id: number;
}
interface User {
  id: number;
  discord_id: string;
  username: string;
  reviewer_profile: ReviewerProfile | null;
  roles: string[];
  moderated_reviewers?: ReviewerProfile[];
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
