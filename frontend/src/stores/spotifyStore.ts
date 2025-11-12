/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';

interface SpotifyState {
  sdk: any | null; // Spotify Player SDK instance
  deviceId: string | null;
  playerState: any | null;
  setSdk: (sdk: any) => void;
  setDeviceId: (deviceId: string) => void;
  setPlayerState: (state: any) => void;
}

export const useSpotifyStore = create<SpotifyState>((set) => ({
  sdk: null,
  deviceId: null,
  playerState: null,
  setSdk: (sdk) => set({ sdk }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setPlayerState: (playerState) => set({ playerState }),
}));
