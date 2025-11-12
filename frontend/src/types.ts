// --- User and Auth ---
export interface User {
  id: number;
  discord_id: string;
  username: string;
  tiktok_username?: string;
  reviewer_profile?: ReviewerProfile;
  spotify_connected?: boolean;
}

export interface UserProfile extends User {
    roles: string[];
    moderated_reviewers?: ReviewerProfile[];
}

export interface ReviewerProfile {
    id: number;
    user_id: number;
    tiktok_handle: string;
    discord_channel_id?: string;
    queue_status: 'open' | 'closed';
}

// --- Submissions & Queue ---
export interface Submission {
  id: number;
  reviewer_id: number;
  user_id: number;
  track_url: string;
  track_title?: string;
  archived_url?: string;
  status: 'pending' | 'played' | 'next';
  submitted_at: string;
  score?: number;
  notes?: string;
  user: User;
  bookmarked?: boolean;
  spotlighted?: boolean;
}

// --- Spotify ---
export interface SpotifyTrack {
  name: string;
  uri: string;
  id: string;
  artists: { name: string; uri: string }[];
  album: {
    name: string;
    uri: string;
    images: { url: string }[];
  };
}

export interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyTrack;
  };
}

export interface SpotifyPlayer {
  _options: {
    getOAuthToken: (cb: (token: string) => void) => void;
    name: string;
    id: string;
  };
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
  getVolume: () => Promise<number>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (position_ms: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  on: (event: string, callback: (data: any) => void) => void;
}
