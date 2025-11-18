import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useSpotifyStore } from '../../stores/spotifyStore';
import { useAuthStore } from '../../stores/authStore';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import api from '../../services/api';

// --- Helper functions ---
const isSpotifyUrl = (url?: string): url is string => !!url && url.includes('open.spotify.com');
const isYoutubeUrl = (url?: string): url is string => !!url && (url.includes('youtube.com') || url.includes('youtu.be'));
const isSoundCloudUrl = (url?: string): url is string => !!url && url.includes('soundcloud.com');


const getYoutubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    let videoId: string | null = null;
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
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// --- Main Component ---
const WebPlayer: React.FC = () => {
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
    const isDragging = useRef(false);

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
        wavesurfer.current?.setVolume(newVolume);
        setIsMuted(newVolume === 0);
    }, []);

    const toggleMute = useCallback(() => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        wavesurfer.current?.setVolume(newMuted ? 0 : volume);
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

        if ((window as any).Spotify || document.getElementById('spotify-sdk')) {
            return;
        }

        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);

        (window as any).onSpotifyWebPlaybackSDKReady = () => {
            const setupPlayer = async () => {
                try {
                    const response = await api.get('/spotify/token');
                    const token = response.data.access_token;
                    if (!token) throw new Error("Failed to get Spotify token.");

                    const player = new (window as any).Spotify.Player({
                        name: 'Universe Bot Web Player',
                        getOAuthToken: (cb: (token: string) => void) => { cb(token); },
                        volume: 0.5,
                    });

                    player.addListener('ready', ({ device_id }: { device_id: string }) => {
                        setDeviceId(device_id);
                        setIsPlayerReady(true);
                    });
                    player.addListener('not_ready', () => setIsPlayerReady(false));
                    player.addListener('player_state_changed', (state: any) => updatePlaybackState(state));
                    player.addListener('initialization_error', ({ message }: { message: string }) => console.error('Init Error:', message));
                    player.addListener('authentication_error', ({ message }: { message: string }) => console.error('Auth Error:', message));
                    player.addListener('account_error', ({ message }: { message: string }) => console.error('Account Error:', message));

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
            document.getElementById('spotify-sdk')?.remove();
            delete (window as any).onSpotifyWebPlaybackSDKReady;
        };
    }, [currentTrack?.track_url, user, spotifyPlayer, setSpotifyPlayer, setDeviceId, setIsPlayerReady, updatePlaybackState]);


    // --- WaveSurfer Initialization and Audio Loading ---
    useEffect(() => {
        const url = currentTrack?.track_url;
        if (!waveformRef.current || isSpotifyUrl(url) || isYoutubeUrl(url)) {
            return;
        }

        wavesurfer.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: 'rgb(200, 200, 200)',
            progressColor: '#A78BFA',
            height: 60,
            barWidth: 3,
            barGap: 2,
            barRadius: 2,
            cursorWidth: 2,
            cursorColor: 'white',
            dragToSeek: false, // We'll handle this manually for a better experience
        });

        if (url) {
            wavesurfer.current.load(`/api/proxy/audio?url=${encodeURIComponent(url)}`);
        }

        const ws = wavesurfer.current;

        const onReady = (newDuration: number) => setDuration(newDuration);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = (time: number) => {
            if (!isDragging.current) setCurrentTime(time);
        };
        const onFinish = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            ws.seekTo(0);
        };

        ws.on('ready', onReady);
        ws.on('play', onPlay);
        ws.on('pause', onPause);
        ws.on('timeupdate', onTimeUpdate);
        ws.on('finish', onFinish);

        return () => {
            ws.un('ready', onReady);
            ws.un('play', onPlay);
            ws.un('pause', onPause);
            ws.un('timeupdate', onTimeUpdate);
            ws.un('finish', onFinish);
            ws.destroy();
            wavesurfer.current = null;
        };
    }, [currentTrack]);


    // --- Manual Drag-to-Seek Handler ---
    useEffect(() => {
        const container = waveformRef.current;
        const ws = wavesurfer.current;
        if (!container || !ws) return;

        const handleSeek = (e: MouseEvent | TouchEvent) => {
            const rect = container.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const progress = (clientX - rect.left) / rect.width;
            setCurrentTime(duration * progress);
            ws.seekTo(progress);
        };

        const onMouseDown = (e: MouseEvent | TouchEvent) => {
            isDragging.current = true;
            handleSeek(e);
        };

        const onMouseMove = (e: MouseEvent | TouchEvent) => {
            if (isDragging.current) {
                handleSeek(e);
            }
        };

        const onMouseUp = () => {
            isDragging.current = false;
        };

        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('touchstart', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchend', onMouseUp);

        return () => {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('touchstart', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchend', onMouseUp);
        };

    }, [duration]); // Re-bind if duration changes

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

    const renderSoundCloudPlayer = () => {
        // SoundCloud embed URL format is slightly different
        const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(currentTrack!.track_url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
        return (
            <div className="aspect-w-16 aspect-h-9">
                <iframe
                    width="100%"
                    height="300"
                    scrolling="no"
                    frameBorder="no"
                    allow="autoplay"
                    src={embedUrl}>
                </iframe>
            </div>
        );
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
        if (isSoundCloudUrl(currentTrack.track_url)) return renderSoundCloudPlayer();
        return renderWaveSurferPlayer();
    };

    return <div className="bg-gray-800 rounded-lg shadow-lg w-full">{renderPlayer()}</div>;
};

export default WebPlayer;
