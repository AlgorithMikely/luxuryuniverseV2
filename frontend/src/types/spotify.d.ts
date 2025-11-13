// Type definitions for Spotify Web Playback SDK 0.1
// Project: https://beta.developer.spotify.com/documentation/web-playback-sdk/
// Definitions by: Fesbeat <https://github.com/Fesbeat>
//                 GoodForOneFare <https://github.com/GoodForOneFare>
//                 Beinsez <https://github.com/beinsez>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.1

declare namespace Spotify {
  interface Album {
      uri: string;
      name: string;
      images: Image[];
  }

  interface Artist {
      uri: string;
      name: string;
  }

  interface Error {
      message: string;
  }

  type ErrorTypes =
      | 'account_error'
      | 'authentication_error'
      | 'initialization_error'
      | 'playback_error';

  interface Image {
      height?: number | null;
      url: string;
      width?: number | null;
  }

  interface PlaybackContext {
      metadata: any;
      uri: string | null;
  }

  interface PlaybackDisallows {
      pausing: boolean;
      peeking_next: boolean;
      peeking_prev: boolean;
      resuming: boolean;
      seeking: boolean;
      skipping_next: boolean;
      skipping_prev: boolean;
  }

  interface PlaybackRestrictions {
      disallow_pausing_reasons: string[];
      disallow_peeking_next_reasons: string[];
      disallow_peeking_prev_reasons: string[];
      disallow_resuming_reasons: string[];
      disallow_seeking_reasons: string[];
      disallow_skipping_next_reasons: string[];
      disallow_skipping_prev_reasons: string[];
  }

  interface PlayerInit {
      name: string;
      getOAuthToken(cb: (token: string) => void): void;
      volume?: number;
  }

  interface PlayerState {
      context: PlaybackContext;
      disallows: PlaybackDisallows;
      duration: number;
      paused: boolean;
      position: number;
      /**
       * 0: NO_REPEAT
       * 1: ONCE_REPEAT
       * 2: FULL_REPEAT
       */
      repeat_mode: 0 | 1 | 2;
      shuffle: boolean;
      track_window: TrackWindow;
      restrictions: PlaybackRestrictions;
  }

  interface Track {
      uri: string;
      id: string | null;
      type: 'track' | 'episode' | 'ad';
      media_type: 'audio' | 'video';
      name: string;
      is_playable: boolean;
      album: Album;
      artists: Artist[];
  }

  interface TrackWindow {
      current_track: Track;
      previous_tracks: Track[];
      next_tracks: Track[];
  }

  interface WebPlaybackInstance {
      device_id: string;
  }

  class Player {
      constructor(options: PlayerInit);

      connect(): Promise<boolean>;
      disconnect(): void;
      getCurrentState(): Promise<PlayerState | null>;
      getVolume(): Promise<number>;
      nextTrack(): Promise<void>;

      addListener(event: 'ready' | 'not_ready', cb: (instance: WebPlaybackInstance) => void): void;
      addListener(event: 'player_state_changed', cb: (state: PlayerState) => void): void;
      addListener(event: 'account_error' | 'authentication_error' | 'initialization_error' | 'playback_error', cb: (error: Error) => void): void;
      on(event: 'ready' | 'not_ready', cb: (instance: WebPlaybackInstance) => void): void;
      on(event: 'player_state_changed', cb: (state: PlayerState) => void): void;
      on(event: 'account_error' | 'authentication_error' | 'initialization_error' | 'playback_error', cb: (error: Error) => void): void;


      removeListener(event: 'ready' | 'not_ready' | 'player_state_changed' | 'account_error' | 'authentication_error' | 'initialization_error' | 'playback_error', cb?: (error: Error) => void): void;

      pause(): Promise<void>;
      previousTrack(): Promise<void>;
      resume(): Promise<void>;
      seek(pos_ms: number): Promise<void>;
      setVolume(volume: number): Promise<void>;
      togglePlay(): Promise<void>;
  }
}

interface Window {
  onSpotifyWebPlaybackSDKReady(): void;
  Spotify: typeof Spotify;
}
