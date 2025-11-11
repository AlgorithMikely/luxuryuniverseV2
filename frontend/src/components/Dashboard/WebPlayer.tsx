import { useEffect, useRef, useState } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useAuthStore } from '../../stores/authStore';
import { useSpotifyStore } from '../../stores/spotifyStore';
import WaveSurfer from 'wavesurfer.js';
import api from '../../services/api';

// Internal component for the Spotify Player UI
const SpotifyPlayerUI = () => {
    const { player, isPlaying: isSpotifyPlaying, volume, setVolume } = useSpotifyStore();

    const handlePlayPause = () => {
        player?.togglePlay();
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
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
    const { fetchToken, setPlayer, setDeviceId, setIsPlaying: setSpotifyIsPlaying, accessToken, deviceId } = useSpotifyStore();

    const [isWaveformPlaying, setIsWaveformPlaying] = useState(false);
    const [waveformVolume, setWaveformVolume] = useState(0.5);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);

    const isYoutubeUrl = (url: string | null | undefined): url is string => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));
    const isSpotifyUrl = (url: string | null | undefined): url is string => !!url && url.includes('spotify.com');

    // Update current track URL state when track changes
    useEffect(() => {
        if (currentTrack?.track_url !== currentTrackUrl) {
            setCurrentTrackUrl(currentTrack?.track_url || null);
        }
    }, [currentTrack]);

    // Spotify SDK Initialization
    useEffect(() => {
        if (!spotify_connected) return;

        const initializePlayer = () => {
            const player = new Spotify.Player({
                name: 'Universe Bot Player',
                getOAuthToken: cb => {
                    api.get('/spotify/token').then(response => {
                        cb(response.data.access_token);
                    }).catch(() => cb(''));
                },
                volume: 0.5
            });

            setPlayer(player);
            player.addListener('ready', ({ device_id }) => setDeviceId(device_id));
            player.addListener('not_ready', () => setDeviceId(null));
            player.addListener('player_state_changed', state => {
                if (!state) return;
                setSpotifyIsPlaying(!state.paused);
            });
            player.connect();
        };

        if (!window.Spotify) {
            window.onSpotifyWebPlaybackSDKReady = initializePlayer;
        } else {
            initializePlayer();
        }

        return () => {
            useSpotifyStore.getState().player?.disconnect();
        }
    }, [spotify_connected, fetchToken, setPlayer, setDeviceId, setSpotifyIsPlaying]);

    // Effect for playing a Spotify track
    useEffect(() => {
        if (currentTrackUrl && isSpotifyUrl(currentTrackUrl) && spotify_connected && deviceId && accessToken) {
            const trackUri = `spotify:track:${currentTrackUrl.split('/').pop()?.split('?')[0]}`;
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                body: JSON.stringify({ uris: [trackUri] }),
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            });
        }
    }, [currentTrackUrl, spotify_connected, deviceId, accessToken]);

    // WaveSurfer Initialization and Handling
    useEffect(() => {
        if (!currentTrackUrl) {
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
                wavesurfer.current = null;
            }
            return;
        }

        if (isYoutubeUrl(currentTrackUrl) || isSpotifyUrl(currentTrackUrl)) {
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
                wavesurfer.current = null;
            }
            return;
        }

        if (waveformRef.current && !wavesurfer.current) {
            wavesurfer.current = WaveSurfer.create({
                container: waveformRef.current,
                waveColor: 'rgb(167 139 250)', progressColor: 'rgb(124 58 237)',
                barWidth: 3, barGap: 2, barRadius: 2, height: 60,
                cursorWidth: 1, cursorColor: 'white', interact: true,
            });

            const ws = wavesurfer.current;
            ws.on('play', () => setIsWaveformPlaying(true));
            ws.on('pause', () => setIsWaveformPlaying(false));
            ws.on('audioprocess', time => !isDragging && setCurrentTime(time));
            ws.on('seeking', time => setCurrentTime(time));
            ws.on('ready', newDuration => setDuration(newDuration));

            return () => { ws.destroy(); wavesurfer.current = null; };
        }
    }, [currentTrackUrl]);

    // Load audio into WaveSurfer
    useEffect(() => {
        if (wavesurfer.current && currentTrackUrl && typeof currentTrackUrl === 'string' && !isYoutubeUrl(currentTrackUrl) && !isSpotifyUrl(currentTrackUrl)) {
            const audioUrl = `/api/proxy/audio?url=${encodeURIComponent(currentTrackUrl)}`;
            wavesurfer.current.load(audioUrl);
        }
    }, [currentTrackUrl]);

    // WaveSurfer volume control
    useEffect(() => {
        if (wavesurfer.current) {
            wavesurfer.current.setVolume(waveformVolume);
        }
    }, [waveformVolume]);

    const handleWaveformPlayPause = () => wavesurfer.current?.playPause();
    const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().substr(14, 5);

    const renderPlayer = () => {
        if (!currentTrackUrl) return null;

        if (isSpotifyUrl(currentTrackUrl)) {
            return spotify_connected ? <SpotifyPlayerUI /> : <p className="text-center text-gray-400">Please connect Spotify to play.</p>;
        }

        if (isYoutubeUrl(currentTrackUrl)) {
            const videoId = new URL(currentTrackUrl).searchParams.get('v') || currentTrackUrl.split('/').pop();
            return <iframe width="100%" height="315" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>;
        }

        return (
            <>
                <div ref={waveformRef} className="mb-2" />
                <div className="flex items-center justify-between text-sm text-gray-400 px-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                <div className="flex items-center space-x-4 mt-2">
                    <button onClick={handleWaveformPlayPause} className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-full w-10 h-10 flex items-center justify-center">
                        {isWaveformPlaying ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>}
                    </button>
                    <div className="flex items-center space-x-2 flex-grow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5.073 3.013A1 1 0 016 4v12a1 1 0 01-1.447.894L.83 12.447A1 1 0 010 11.553V8.447a1 1 0 01.83-1.447l3.723-1.987a1 1 0 01.52-.001zM12 4a1 1 0 011 1v10a1 1 0 01-1.555.832l-3.197-2.132A1 1 0 017 12.87V7.13a1 1 0 01.445-.832L10.25 4.136A1 1 0 0112 4z" /></svg>
                        <input type="range" min="0" max="1" step="0.05" value={waveformVolume} onChange={e => setWaveformVolume(parseFloat(e.target.value))} className="w-full" />
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-4">
            <div className="flex items-center gap-4 mb-2">
                <div className="flex-grow">
                    <p className="font-bold text-lg truncate" title={currentTrack?.track_title || 'No track selected'}>
                        {currentTrack?.track_title || 'No track selected'}
                    </p>
                    <p className="text-sm text-gray-400">
                        {currentTrack?.user?.username ? `Submitted by ${currentTrack.user.username}` : ''}
                    </p>
                </div>
            </div>
            {renderPlayer()}
        </div>
    );
};

export default WebPlayer;
