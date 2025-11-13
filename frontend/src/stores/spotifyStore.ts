import { create } from 'zustand';

interface SpotifyState {
  spotifyPlayer: Spotify.Player | null;
  deviceId: string | null;
  isPlayerReady: boolean;
  isPlaying: boolean;
  currentSpotifyTrack: Spotify.Track | null;
  progress: number;
  duration: number;
  setSpotifyPlayer: (player: Spotify.Player | null) => void;
  setDeviceId: (id: string) => void;
  setIsPlayerReady: (ready: boolean) => void;
  updatePlaybackState: (state: Spotify.PlaybackState | null) => void;
}

export const useSpotifyStore = create<SpotifyState>()((set) => ({
  spotifyPlayer: null,
  deviceId: null,
  isPlayerReady: false,
  isPlaying: false,
  currentSpotifyTrack: null,
  progress: 0,
  duration: 0,
  setSpotifyPlayer: (player) => set({ spotifyPlayer: player }),
  setDeviceId: (id) => set({ deviceId: id }),
  setIsPlayerReady: (ready) => set({ isPlayerReady: ready }),
  updatePlaybackState: (state) => {
    if (!state) {
      return set({ isPlaying: false, progress: 0, duration: 0, currentSpotifyTrack: null });
    }
    set({
      isPlaying: !state.paused,
      progress: state.position,
      duration: state.duration,
      currentSpotifyTrack: state.track_window.current_track,
    });
  },
}));
