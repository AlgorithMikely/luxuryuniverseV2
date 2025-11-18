// This declares the Spotify namespace globally.
declare namespace Spotify {
  interface PlayerOptions {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  type PlayerEvents = 'ready' | 'not_ready' | 'player_state_changed' | 'initialization_error' | 'authentication_error' | 'account_error';

  interface Player {
    connect: () => Promise<boolean>;
    disconnect: () => void;
    getCurrentState: () => Promise<PlaybackState | null>;
    nextTrack: () => Promise<void>;
    previousTrack: () => Promise<void>;
    togglePlay: () => Promise<void>;
    addListener: (event: PlayerEvents, callback: (data: any) => void) => void;
  }

  interface PlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
      current_track: Track;
    };
  }

  interface Track {
    name: string;
    uri: string;
    id: string | null;
    artists: { name: string }[];
    album: {
      name: string;
      images: { url: string }[];
    };
  }
}

// This augments the global Window object to include the Spotify SDK properties.
interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify: {
    Player: new (options: Spotify.PlayerOptions) => Spotify.Player;
  };
}
