import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import jwtDecode from 'jwt-decode';
import api from '../services/api';

interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
  reviewer_profile: {
    id: number;
  } | null;
  roles: string[];
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
        console.log("setToken called with token:", token);
        try {
          const decoded = jwtDecode<{ sub: string; roles: string[] }>(token);
          console.log("Decoded token:", decoded);
          console.log("Making API call to /user/me");
          const response = await api.get('/user/me');
          console.log("API call successful, user data:", response.data);
          set({ token, user: response.data, roles: decoded.roles });
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          set({ token: null, user: null, roles: [] });
        }
      },
      logout: () => {
        console.log("Logout called");
        set({ token: null, user: null, roles: [] });
      }
    }),
    {
      name: 'auth-storage',
    }
  )
);
