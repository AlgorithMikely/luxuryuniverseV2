/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useSpotifyStore } from '../stores/spotifyStore';
import { useQueueStore } from '../stores/queueStore';
import WaveSurfer from 'wavesurfer.js';
import api from '../services/api';

const WebPlayer = () => {
  const { setSdk, setDeviceId } = useSpotifyStore();
  const { activeSubmission } = useQueueStore();
  const spotifyPlayerRef = useRef<any>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const wavesurferContainerRef = useRef<HTMLDivElement | null>(null);
  const [playerType, setPlayerType] = useState<'spotify' | 'youtube' | 'wavesurfer' | null>(null);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);


  // Initialize Spotify SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Universe Music Review Bot',
        getOAuthToken: cb => {
          const token = localStorage.getItem('spotify_access_token');
          if (!token) {
            console.error("Spotify token not found!");
            // Potentially trigger a re-auth flow
          }
          cb(token || '');
        },
        volume: 0.5,
      });

      spotifyPlayerRef.current = player;
      setSdk(player);

      player.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player Ready with Device ID', device_id);
        setDeviceId(device_id);
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      player.connect().then(success => {
        if (success) {
          console.log('The Spotify Player has connected successfully!');
        }
      });
    };

    return () => {
      if (spotifyPlayerRef.current) {
        spotifyPlayerRef.current.disconnect();
      }
    };
  }, [setSdk, setDeviceId]);

  // Initialize WaveSurfer
  useEffect(() => {
    if (wavesurferContainerRef.current && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: wavesurferContainerRef.current,
        waveColor: 'rgb(200, 0, 200)',
        progressColor: 'rgb(100, 0, 100)',
        barWidth: 2,
        barGap: 1,
        height: 64,
        url: '', // Initially empty
      });

      wavesurferRef.current.on('play', () => setIsPlaying(true));
      wavesurferRef.current.on('pause', () => setIsPlaying(false));
    }

    return () => {
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, []);


  // Determine player type and load track
  useEffect(() => {
    // Cleanup previous state
    setIsPlaying(false);
    if (wavesurferRef.current) {
      wavesurferRef.current.stop();
      wavesurferRef.current.empty();
    }
     if (spotifyPlayerRef.current) {
        spotifyPlayerRef.current.pause();
    }
    setYoutubeVideoId(null);
    setPlayerType(null);


    if (!activeSubmission) return;

    const { track_url } = activeSubmission;

    if (track_url.includes('spotify.com')) {
      setPlayerType('spotify');
      const spotify_uri = `spotify:track:${track_url.split('/').pop()?.split('?')[0]}`;
      const deviceId = useSpotifyStore.getState().deviceId;
      if (deviceId) {
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          body: JSON.stringify({ uris: [spotify_uri] }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`,
          },
        }).then(() => setIsPlaying(true)).catch(err => console.error("Failed to play on spotify", err));
      }
    } else if (track_url.includes('youtube.com') || track_url.includes('youtu.be')) {
      setPlayerType('youtube');
      const videoId = new URL(track_url).searchParams.get('v') || track_url.split('/').pop();
      setYoutubeVideoId(videoId || null);
    } else {
      // Assume direct link or discord attachment for WaveSurfer
      setPlayerType('wavesurfer');
      const proxyUrl = `/api/proxy/audio?url=${encodeURIComponent(track_url)}`;
      if (wavesurferRef.current) {
        wavesurferRef.current.load(proxyUrl);
      }
    }
  }, [activeSubmission]);

  const handlePlayPause = () => {
    if (playerType === 'wavesurfer' && wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
    if (playerType === 'spotify' && spotifyPlayerRef.current) {
      spotifyPlayerRef.current.togglePlay();
      setIsPlaying(!isPlaying);
    }
    // YouTube is controlled by the iframe API, which is not implemented here for simplicity
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Player</h3>
        <button onClick={handlePlayPause} className="bg-purple-600 p-2 rounded">
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <div className="mt-4 h-24 flex items-center justify-center">
        {playerType === 'spotify' && (
          <p>Spotify playback initiated. Control via your Spotify app.</p>
        )}
        {playerType === 'youtube' && youtubeVideoId && (
           <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
        )}
        {playerType === 'wavesurfer' && (
          <div ref={wavesurferContainerRef} className="w-full h-16" />
        )}
        {!playerType && <p>Select a track to play.</p>}
      </div>
    </div>
  );
};

export default WebPlayer;
