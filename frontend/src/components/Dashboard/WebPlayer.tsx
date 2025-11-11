import { useEffect, useRef, useState } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useAuthStore } from '../../stores/authStore';
import { useSpotifyStore } from '../../stores/spotifyStore';
import WaveSurfer from 'wavesurfer.js';
import api from '../../services/api';

// Internal component for the Spotify Player UI
const SpotifyPlayerUI = () => {
    const { player, isPlaying: isSpotifyPlaying, volume } = useSpotifyStore.getState();

    const handlePlayPause = () => {
        player?.togglePlay();
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        useSpotifyStore.getState().setVolume(newVolume);
        player?.setVolume(newVolume);
    };

    return (
        <div className="flex items-center space-x-4 mt-2">
            <button
                onClick={handlePlayPause}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-full w-10 h-10 flex items-center justify-center"
            >
                {isSpotifyPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                )}
            </button>
            <div className="flex items-center space-x-2 flex-grow">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5.073 3.013A1 1 0 016 4v12a1 1 0 01-1.447.894L.83 12.447A1 1 0 010 11.553V8.447a1 1 0 01.83-1.447l3.723-1.987a1 1 0 01.52-.001zM12 4a1 1 0 011 1v10a1 1 0 01-1.555.832l-3.197-2.132A1 1 0 017 12.87V7.13a1 1 0 01.445-.832L10.25 4.136A1 1 0 0112 4z" /></svg>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full"
                />
            </div>
        </div>
    );
};


const WebPlayer = () => {
    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const { currentTrack } = useQueueStore();
    const { spotify_connected } = useAuthStore();
    const { fetchToken, accessToken, setPlayer, setDeviceId, setIsPlaying } = useSpotifyStore();

    const [isPlaying, setIsPlayingState] = useState(false);
    const [volume, setVolumeState] = useState(0.5);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const isYoutubeUrl = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');
    const isSpotifyUrl = (url: string) => currentTrack?.track_url?.includes('spotify.com') ?? false;

    // SDK Initialization
    useEffect(() => {
        if (!spotify_connected) return;

        // Fetch the token initially
        fetchToken();

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new Spotify.Player({
                name: 'Universe Bot Player',
                getOAuthToken: cb => {
                    // This function is called by the SDK to get a fresh token
                    // We can't use the zustand hook here, so we call our fetcher and return the new token
                    api.get('/spotify/token').then(response => {
                        cb(response.data.access_token);
                    });
                },
                volume: 0.5
            });

            setPlayer(player);

            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                setDeviceId(device_id);
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
            });

            player.addListener('player_state_changed', (state => {
                if (!state) return;
                setIsPlaying(!state.paused);
            }));

            player.connect();
        };
    }, [spotify_connected, fetchToken, setPlayer, setDeviceId, setIsPlaying]);

    // This effect handles playing a spotify track when the currentTrack changes
    useEffect(() => {
        if (isSpotifyUrl(currentTrack?.track_url ?? '') && spotify_connected && useSpotifyStore.getState().deviceId) {
            const trackUri = `spotify:track:${currentTrack?.track_url.split('/').pop()?.split('?')[0]}`;
            const play = async () => {
                await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${useSpotifyStore.getState().deviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ uris: [trackUri] }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${useSpotifyStore.getState().accessToken}`
                    },
                });
            }
            play();
        }
    }, [currentTrack, spotify_connected]);

    // WaveSurfer logic remains mostly the same
    useEffect(() => {
        if (isSpotifyUrl(currentTrack?.track_url ?? '') || isYoutubeUrl(currentTrack?.track_url ?? '')) {
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
                wavesurfer.current = null;
            }
            return;
        }

        if (waveformRef.current && !wavesurfer.current) {
            wavesurfer.current = WaveSurfer.create({
                container: waveformRef.current,
                waveColor: 'rgb(167 139 250)',
                progressColor: 'rgb(124 58 237)',
                barWidth: 3, barGap: 2, barRadius: 2, height: 60,
                cursorWidth: 1, cursorColor: 'white', interact: true,
            });

            wavesurfer.current.on('play', () => setIsPlayingState(true));
            wavesurfer.current.on('pause', () => setIsPlayingState(false));
            wavesurfer.current.on('audioprocess', (time) => !isDragging && setCurrentTime(time));
            wavesurfer.current.on('ready', (newDuration) => setDuration(newDuration));
        }

        return () => {
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
                wavesurfer.current = null;
            }
        };
    }, [currentTrack]);

    useEffect(() => {
        if (wavesurfer.current && currentTrack?.track_url && !isSpotifyUrl(currentTrack.track_url) && !isYoutubeUrl(currentTrack.track_url)) {
            const audioUrl = `/api/proxy/audio?url=${encodeURIComponent(currentTrack.track_url)}`;
            wavesurfer.current.load(audioUrl);
        }
    }, [currentTrack]);

    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const renderPlayer = () => {
        if (!currentTrack) return null;

        if (isSpotifyUrl(currentTrack.track_url)) {
            return spotify_connected ? <SpotifyPlayerUI /> : <p className="text-center text-gray-400">Please connect your Spotify account.</p>;
        }

        if (isYoutubeUrl(currentTrack.track_url)) {
            const videoId = new URLSearchParams(new URL(currentTrack.track_url).search).get('v');
            return <iframe width="100%" height="315" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>;
        }

        // Default to WaveSurfer
        return (
            <>
                <div ref={waveformRef} />
                <div className="flex items-center justify-between text-sm text-gray-400 px-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                {/* Add WaveSurfer controls here */}
            </>
        );
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-4">
            <div className="flex items-center gap-4 mb-2">
                <div className="flex-grow">
                    <p className="font-bold text-lg truncate">{currentTrack?.track_title || 'No track selected'}</p>
                    <p className="text-sm text-gray-400">{currentTrack?.user?.username ? `Submitted by ${currentTrack.user.username}` : ''}</p>
                </div>
            </div>
            {renderPlayer()}
        </div>
    );
};

export default WebPlayer;
