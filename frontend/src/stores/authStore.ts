import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import jwtDecode from 'jwt-decode';
import api from '../services/api';

export interface User {
  id: number;
  discord_id: string;
  username: string;
  reviewer_profile: {
    id: number;
  } | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  roles: string[];
  setToken: (token: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      roles: [],
      setToken: async (token) => {
        const decoded = jwtDecode<{ sub: string; roles: string[] }>(token);
        set({ token, roles: decoded.roles });
        try {
          const response = await api.get('/user/me');
          set({ user: response.data });
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          set({ token: null, user: null, roles: [] });
        }
      },
      logout: () => set({ token: null, user: null, roles: [] }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
