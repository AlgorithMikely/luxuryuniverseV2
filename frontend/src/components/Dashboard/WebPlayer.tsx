// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useSpotifyStore } from '../../stores/spotifyStore';
import { useAuthStore } from '../../stores/authStore';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import api from '../../services/api';

// --- Helper functions ---
const isSpotifyUrl = (url: string | undefined): url is string => !!url && url.includes('open.spotify.com');
const isYoutubeUrl = (url: string | undefined): url is string => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));

const getYoutubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    let videoId = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (e) {
        console.error("Invalid YouTube URL", e);
        return null;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};


// --- Main Component ---
const WebPlayer = () => {
    const { currentTrack } = useQueueStore();
    const { user } = useAuthStore();
    const {
        spotifyPlayer,
        isPlaying: isSpotifyPlaying,
        currentSpotifyTrack,
        setSpotifyPlayer,
        setDeviceId,
        setIsPlayerReady,
        updatePlaybackState
    } = useSpotifyStore();

    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const onPlayPause = useCallback(() => {
        wavesurfer.current?.playPause();
    }, []);

    const onVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (wavesurfer.current) {
            wavesurfer.current.setVolume(newVolume);
        }
        setIsMuted(newVolume === 0);
    }, []);

    const toggleMute = useCallback(() => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (wavesurfer.current) {
            wavesurfer.current.setVolume(newMuted ? 0 : volume);
        }
    }, [isMuted, volume]);

    // --- Dynamic Spotify SDK Loader & Player Setup ---
    useEffect(() => {
        const trackUrl = currentTrack?.track_url;

        if (!isSpotifyUrl(trackUrl) || !user) {
             if (spotifyPlayer) {
                spotifyPlayer.disconnect();
                setSpotifyPlayer(null);
            }
            return;
        }

        if (window.Spotify || document.getElementById('spotify-sdk')) {
            return;
        }

        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const setupPlayer = async () => {
                try {
                    const response = await api.get('/spotify/token');
                    const token = response.data.access_token;
                    if (!token) {
                        console.error("Failed to get Spotify token from backend.");
                        return;
                    }

                    const player = new Spotify.Player({
                        name: 'Universe Bot Web Player',
                        getOAuthToken: (cb) => { cb(token); },
                        volume: 0.5,
                    });

                    player.addListener('ready', ({ device_id }) => {
                        console.log('Spotify Player Ready with Device ID', device_id);
                        setDeviceId(device_id);
                        setIsPlayerReady(true);
                    });
                    player.addListener('not_ready', ({ device_id }) => {
                        console.log('Device ID has gone offline', device_id);
                        setIsPlayerReady(false);
                    });
                    player.addListener('player_state_changed', (state) => {
                        updatePlaybackState(state);
                    });
                    player.addListener('initialization_error', ({ message }) => { console.error('Init Error:', message); });
                    player.addListener('authentication_error', ({ message }) => { console.error('Auth Error:', message); });
                    player.addListener('account_error', ({ message }) => { console.error('Account Error:', message); });

                    await player.connect();
                    setSpotifyPlayer(player);

                } catch (error) {
                    console.error("Could not initialize Spotify player:", error);
                }
            };
            setupPlayer();
        };

        return () => {
            spotifyPlayer?.disconnect();
            const sdkScript = document.getElementById('spotify-sdk');
            if (sdkScript) {
                sdkScript.remove();
            }
            delete window.onSpotifyWebPlaybackSDKReady;
        };
    }, [currentTrack?.track_url, user, setSpotifyPlayer, setDeviceId, setIsPlayerReady, updatePlaybackState]);

    // --- Initialize WaveSurfer ---
    useEffect(() => {
        if (!waveformRef.current) return;
        if (isSpotifyUrl(currentTrack?.track_url)) return;

        const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: 'rgb(200, 200, 200)',
            progressColor: '#A78BFA',
            height: 60,
            barWidth: 3,
            barGap: 2,
            barRadius: 2,
            cursorWidth: 2,
            cursorColor: 'white',
            dragToSeek: true,
        });
        wavesurfer.current = ws;

        const handlers = {
            'play': () => setIsPlaying(true),
            'pause': () => setIsPlaying(false),
            'audioprocess': (time: number) => setCurrentTime(time),
            'ready': (dur: number) => setDuration(dur),
            'seeking': (time: number) => setCurrentTime(time),
        };

        Object.entries(handlers).forEach(([event, handler]) => {
            ws.on(event as any, handler);
        });

        return () => {
            Object.entries(handlers).forEach(([event, handler]) => {
                ws.un(event as any, handler);
            });
            ws.destroy();
        };
    }, [currentTrack?.track_url]);

    // --- Load Audio into WaveSurfer ---
    useEffect(() => {
        const url = currentTrack?.track_url;
        if (wavesurfer.current && url && !isSpotifyUrl(url) && !isYoutubeUrl(url)) {
             wavesurfer.current.load(`/api/proxy/audio?url=${encodeURIComponent(url)}`);
        }
    }, [currentTrack?.track_url]);

    // --- Player Render Logic ---
    const renderSpotifyPlayer = () => (
        <div className="flex flex-col items-center justify-center p-4">
             <h3 className="text-xl font-bold">{currentSpotifyTrack?.name || 'Loading Spotify...'}</h3>
             <p className="text-md text-gray-400">{currentSpotifyTrack?.artists?.map((a) => a.name).join(', ') || '...'}</p>
             <div className="flex items-center gap-4 my-4">
                 <button onClick={() => spotifyPlayer?.previousTrack()} className="text-2xl hover:text-purple-400">Prev</button>
                 <button onClick={() => spotifyPlayer?.togglePlay()} className="text-3xl hover:text-purple-400">{isSpotifyPlaying ? 'Pause' : 'Play'}</button>
                 <button onClick={() => spotifyPlayer?.nextTrack()} className="text-2xl hover:text-purple-400">Next</button>
             </div>
        </div>
    );

    const renderYoutubePlayer = () => {
        const embedUrl = getYoutubeEmbedUrl(currentTrack!.track_url);
        return embedUrl ? (
            <div className="aspect-w-16 aspect-h-9"><iframe src={embedUrl} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe></div>
        ) : <p className="text-center p-8">Invalid YouTube URL</p>;
    };

    const renderWaveSurferPlayer = () => (
        <div className="p-4 space-y-3">
            <div>
                <h3 className="text-lg font-bold text-white">{currentTrack?.track_title || 'Untitled Track'}</h3>
                <p className="text-sm text-gray-400">by {currentTrack?.user?.username || 'Unknown'}</p>
            </div>

            <div ref={waveformRef} className="w-full" />

            <div className="flex items-center gap-4">
                <button onClick={onPlayPause} className="text-white text-2xl hover:text-purple-400">
                    {isPlaying ? <Pause /> : <Play />}
                </button>
                <span className="text-gray-400 text-sm w-20">{formatTime(currentTime)} / {formatTime(duration)}</span>
                <button onClick={toggleMute} className="text-white text-lg hover:text-purple-400">
                    {isMuted ? <VolumeX /> : <Volume2 />}
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={onVolumeChange}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
            </div>
        </div>
    );

    const renderPlayer = () => {
        if (!currentTrack) return <div className="flex items-center justify-center h-full min-h-[120px]"><p className="text-gray-400">No track selected.</p></div>;
        if (isSpotifyUrl(currentTrack.track_url)) return renderSpotifyPlayer();
        if (isYoutubeUrl(currentTrack.track_url)) return renderYoutubePlayer();
        return renderWaveSurferPlayer();
    };

    return <div className="bg-gray-800 rounded-lg shadow-lg w-full">{renderPlayer()}</div>;
};

export default WebPlayer;
