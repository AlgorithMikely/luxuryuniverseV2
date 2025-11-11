import { create } from 'zustand';
import api from '../services/api';

interface SpotifyState {
  accessToken: string | null;
  deviceId: string | null;
  player: Spotify.Player | null;
  isPlaying: boolean;
  volume: number;
  setPlayer: (player: Spotify.Player) => void;
  setDeviceId: (deviceId: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  fetchToken: () => Promise<void>;
}

export const useSpotifyStore = create<SpotifyState>((set) => ({
  accessToken: null,
  deviceId: null,
  player: null,
  isPlaying: false,
  volume: 0.5,
  setPlayer: (player) => set({ player }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  fetchToken: async () => {
    try {
      const response = await api.get('/spotify/token');
      set({ accessToken: response.data.access_token });
    } catch (error) {
      console.error('Failed to fetch Spotify token:', error);
      // Handle error, e.g., prompt for re-login
    }
  },
}));
