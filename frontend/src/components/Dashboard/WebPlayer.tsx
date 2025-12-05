import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useSpotifyStore } from '../../stores/spotifyStore';
import { useAuthStore } from '../../stores/authStore';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, VolumeX, Music, AlertCircle, LogIn, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import EQVisualizer from './EQVisualizer';
import { Activity } from 'lucide-react';

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

// --- Simulated Waveform Component ---
const SimulatedWaveform = ({ isPlaying, progress, duration, onSeek }: { isPlaying: boolean, progress: number, duration: number, onSeek: (time: number) => void }) => {
    const [bars, setBars] = useState<number[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Calculate bar count based on duration (1 bar per second)
        // Default to 100 if duration is 0/invalid, clamp between 50 and 600 (10 mins) to prevent rendering issues
        const seconds = duration > 0 ? Math.floor(duration / 1000) : 100;
        const barCount = Math.max(50, Math.min(seconds, 600));

        const newBars = Array.from({ length: barCount }, () => Math.random() * 0.6 + 0.2); // Base height
        setBars(newBars);
    }, [duration]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || duration <= 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const seekTime = Math.floor(percentage * duration);
        onSeek(seekTime);
    };

    return (
        <div
            ref={containerRef}
            onClick={handleClick}
            className="w-full h-12 flex items-center justify-between gap-[1px] mt-4 hover:opacity-100 transition-opacity cursor-pointer group"
        >
            <style>
                {`
                @keyframes waveform-bounce {
                    0% { transform: scaleY(1.0); }
                    50% { transform: scaleY(0.4); }
                    100% { transform: scaleY(1.0); }
                }
                .animate-waveform {
                    animation: waveform-bounce 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    will-change: transform;
                }
                `}
            </style>
            {bars.map((height, index) => {
                // Calculate if this bar is "past" (played) based on progress
                const barPercent = index / bars.length;
                const currentPercent = duration > 0 ? progress / duration : 0;
                const isPlayed = barPercent <= currentPercent;

                return (
                    <div
                        key={index}
                        className={`w-0.5 rounded-full transition-colors duration-300 ${isPlayed ? 'bg-[#a855f7]' : 'bg-white/10 group-hover:bg-white/20'} ${isPlaying ? 'animate-waveform' : ''}`}
                        style={{
                            height: `${height * 100}%`,
                            animationDelay: `${-(index * 0.1) % 2}s`, // Negative delay for immediate start, pseudo-random offset
                            animationDuration: `${0.8 + (index % 3) * 0.2 + Math.random() * 0.3}s` // More varied durations
                        }}
                    />
                );
            })}
        </div>
    );
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
        updatePlaybackState,
        deviceId,
        progress: spotifyProgress,
        duration: spotifyDuration
    } = useSpotifyStore();

    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const filtersRef = useRef<BiquadFilterNode[]>([]);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null); // State to trigger re-render for EQVisualizer

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [spotifyError, setSpotifyError] = useState<string | null>(null);
    const [localSpotifyProgress, setLocalSpotifyProgress] = useState(0);
    const [prefetchedTrack, setPrefetchedTrack] = useState<any>(null);
    const [isWaveSurferReady, setIsWaveSurferReady] = useState(false);
    const [showEQ, setShowEQ] = useState(false);

    // Refs for cleaning up captured audio
    const captureStreamRef = useRef<MediaStream | null>(null);
    const captureContextRef = useRef<AudioContext | null>(null);
    // Ref for file-based playback context (to resume on user interaction)
    const fileAudioContextRef = useRef<AudioContext | null>(null);


    // Cleanup captured audio when track changes
    useEffect(() => {
        if (captureStreamRef.current) {
            captureStreamRef.current.getTracks().forEach(t => t.stop());
            captureStreamRef.current = null;
        }
        if (captureContextRef.current) {
            captureContextRef.current.close();
            captureContextRef.current = null;
        }
        // Also ensure EQ visualizer is reset if it was using the capture
        if (analyser && captureContextRef.current) {
            setAnalyser(null);
            filtersRef.current = [];
        }
    }, [currentTrack?.id, currentTrack?.track_url]);

    // --- Audio Engine (EQ) Logic ---
    const initFilters = (ws: WaveSurfer) => {
        // Try to get AudioContext from options (where we passed it) or backend
        // @ts-ignore
        const ac = ws.options?.audioContext || ws.backend?.ac || (ws as any).audioContext;

        if (!ac) {
            console.error("EQ: Could not find AudioContext in WaveSurfer instance", ws);
            return;
        }

        // Create 5 bands matching EQVisualizer defaults
        const frequencies = [60, 250, 1000, 4000, 12000];
        const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

        const newFilters = frequencies.map((freq, i) => {
            const filter = ac.createBiquadFilter();
            filter.type = types[i];
            filter.frequency.value = freq;
            filter.gain.value = 0;
            filter.Q.value = 1.0;
            return filter;
        });

        // Create Analyser
        const analyserNode = ac.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.8;
        analyserRef.current = analyserNode;
        setAnalyser(analyserNode);

        filtersRef.current = newFilters;

        // Apply filters to WaveSurfer
        // WaveSurfer v7 supports setFilters, but types might be missing it
        const wsAny = ws as any;
        if (wsAny.setFilters) {
            // We pass the filters AND the analyser at the end so it visualizes the post-EQ signal
            wsAny.setFilters([...newFilters, analyserNode]);
        } else {
            console.warn("WaveSurfer setFilters not available");
        }
    };

    const handleEQChange = useCallback((bands: any[]) => {
        const filters = filtersRef.current;
        if (filters.length === 0) return;

        bands.forEach((band, i) => {
            if (filters[i]) {
                const filter = filters[i];
                // Smooth transitions
                const now = filter.context.currentTime;

                // Check and update type if needed (immediate change, no automation)
                if (filter.type !== band.type) {
                    filter.type = band.type;
                }

                filter.frequency.setTargetAtTime(band.freq, now, 0.02);

                // Gain is ignored for bandpass/lowpass/highpass but safe to set
                if (band.type !== 'bandpass' && band.type !== 'lowpass' && band.type !== 'highpass') {
                    filter.gain.setTargetAtTime(band.gain, now, 0.02);
                }

                filter.Q.setTargetAtTime(band.q, now, 0.02);
            }
        });
    }, []);


    // --- Spotify SDK Initialization ---
    useEffect(() => {
        if (!user) return;

        let playerInstance: any;

        const initializePlayer = () => {
            if (playerInstance) return; // Prevent double init

            const player = new window.Spotify.Player({
                name: 'Luxury Universe Web Player',
                getOAuthToken: async (cb) => {
                    try {
                        const response = await api.get('/spotify/token');
                        cb(response.data.access_token);
                    } catch (error) {
                        console.error("Failed to get Spotify token", error);
                        setSpotifyError("Failed to authenticate with Spotify");
                    }
                },
                volume: 0.5
            });

            playerInstance = player;
            setSpotifyPlayer(player);

            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                setDeviceId(device_id);
                setIsPlayerReady(true);
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setIsPlayerReady(false);
                setDeviceId(''); // Clear device ID to show loading state if needed
            });

            player.addListener('player_state_changed', (state) => {
                if (!state) return;
                updatePlaybackState(state);

                // Update local state to match
                setIsPlaying(!state.paused);
                setDuration(state.duration);
                setCurrentTime(state.position);
            });

            player.addListener('initialization_error', ({ message }) => {
                console.error('Failed to initialize', message);
                setSpotifyError(`Initialization failed: ${message}`);
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error('Failed to authenticate', message);
                setSpotifyError("Authentication failed. Please reconnect.");
            });

            player.addListener('account_error', ({ message }) => {
                console.error('Failed to validate Spotify account', message);
                setSpotifyError("Premium account required.");
            });

            player.connect();
        };

        if (window.Spotify) {
            initializePlayer();
        } else {
            window.onSpotifyWebPlaybackSDKReady = initializePlayer;
            if (!document.getElementById('spotify-player-script')) {
                const script = document.createElement("script");
                script.id = 'spotify-player-script';
                script.src = "https://sdk.scdn.co/spotify-player.js";
                script.async = true;
                document.body.appendChild(script);
            }
        }

        return () => {
            if (playerInstance) {
                console.log("Disconnecting Spotify player...");
                playerInstance.disconnect();
            }
        };
    }, [user]); // Removed other dependencies to avoid unnecessary re-initialization

    // Pause Spotify if switching to a non-Spotify track
    useEffect(() => {
        if (spotifyPlayer && (!currentTrack || !isSpotifyUrl(currentTrack.track_url))) {
            spotifyPlayer.pause();
        }
    }, [currentTrack, spotifyPlayer]);

    // Sync local progress with store progress when it updates (on events)
    useEffect(() => {
        setLocalSpotifyProgress(spotifyProgress);
    }, [spotifyProgress]);

    // Increment local progress while playing
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isSpotifyPlaying) {
            interval = setInterval(() => {
                setLocalSpotifyProgress((prev) => {
                    const next = prev + 1000;
                    return next > spotifyDuration ? spotifyDuration : next;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isSpotifyPlaying, spotifyDuration]);

    // --- WaveSurfer Logic ---
    const onPlayPause = useCallback(() => {
        // Ensure AudioContext is running (crucial for behavior after page refresh)
        if (fileAudioContextRef.current?.state === 'suspended') {
            fileAudioContextRef.current.resume();
        }
        wavesurfer.current?.playPause();
    }, []);


    const onVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        wavesurfer.current?.setVolume(newVolume);
        setIsMuted(newVolume === 0);
    }, []);

    const onSpotifyVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        spotifyPlayer?.setVolume(newVolume);
        setIsMuted(newVolume === 0);
    }, [spotifyPlayer]);

    const toggleMute = useCallback(() => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        const newVol = newMuted ? 0 : volume;
        wavesurfer.current?.setVolume(newVol);
        spotifyPlayer?.setVolume(newVol);
    }, [isMuted, volume, spotifyPlayer]);

    // --- WaveSurfer Initialization ---
    useEffect(() => {
        // Clean up previous instance if track changes or component unmounts
        if (wavesurfer.current) {
            wavesurfer.current.destroy();
            wavesurfer.current = null;
        }

        setIsWaveSurferReady(false); // Reset ready state
        setIsPlaying(false); // Reset playing state
        filtersRef.current = []; // Reset filters

        const trackUrl = currentTrack?.track_url;
        // Only initialize WaveSurfer for non-Spotify/YT/SC urls (i.e., direct files)
        if (!trackUrl || isSpotifyUrl(trackUrl) || isYoutubeUrl(trackUrl) || isSoundCloudUrl(trackUrl)) {
            return;
        }

        if (!waveformRef.current) return;

        // Use the proxy endpoint to bypass CORS for Discord URLs
        const proxyUrl = `/api/proxy/audio?url=${encodeURIComponent(trackUrl)}`;

        // --- Manual Audio Graph Setup ---
        // 1. Create AudioContext
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ac = new AudioContext();
        fileAudioContextRef.current = ac;


        // 2. Create Audio Element with CORS
        const audio = document.createElement('audio');
        audio.crossOrigin = "anonymous";
        audio.src = proxyUrl;

        // 3. Create MediaElementSource
        const source = ac.createMediaElementSource(audio);

        // 4. Create Filters
        const frequencies = [60, 250, 1000, 4000, 12000];
        const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
        const newFilters = frequencies.map((freq, i) => {
            const filter = ac.createBiquadFilter();
            filter.type = types[i];
            filter.frequency.value = freq;
            filter.gain.value = 0;
            filter.Q.value = 1.0;
            return filter;
        });
        filtersRef.current = newFilters;

        // 5. Create Analyser
        const analyserNode = ac.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.8;
        analyserRef.current = analyserNode;
        setAnalyser(analyserNode);

        // 6. Connect Graph: Source -> Filters -> Analyser -> Destination
        let currentNode: AudioNode = source;
        newFilters.forEach(filter => {
            currentNode.connect(filter);
            currentNode = filter;
        });
        currentNode.connect(analyserNode);
        analyserNode.connect(ac.destination);

        // 7. Initialize WaveSurfer with the media element
        wavesurfer.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: 'rgba(255, 255, 255, 0.1)',
            progressColor: '#a855f7',
            cursorColor: '#ffffff',
            barWidth: 4,
            barGap: 1,
            barRadius: 4,
            height: 60,
            media: audio, // Use our connected element
            // We don't pass audioContext here to avoid WaveSurfer messing with our graph
        });

        wavesurfer.current.on('play', () => setIsPlaying(true));
        wavesurfer.current.on('pause', () => setIsPlaying(false));
        wavesurfer.current.on('timeupdate', (time) => setCurrentTime(time));
        wavesurfer.current.on('ready', (duration) => {
            setDuration(duration);
            setIsWaveSurferReady(true); // Mark as ready
        });
        wavesurfer.current.on('finish', () => setIsPlaying(false));
        wavesurfer.current.on('error', (err) => console.error("WaveSurfer Error:", err));

        // Set initial volume
        wavesurfer.current.setVolume(isMuted ? 0 : volume);

        return () => {
            // Cleanup manual audio graph
            // Use local variables 'ac' and 'audio' from the effect scope
            try {
                if (ac && ac.state !== 'closed') {
                    ac.close();
                }
                fileAudioContextRef.current = null;

            } catch (e) {
                console.error("Error closing AudioContext:", e);
            }

            if (audio) {
                audio.pause();
                audio.src = ''; // Detach source
                audio.remove(); // Remove element
            }

            if (wavesurfer.current) {
                wavesurfer.current.destroy();
                wavesurfer.current = null;
            }
        };
    }, [currentTrack?.track_url, currentTrack?.id]); // Re-run when track URL or ID changes

    const handleLogin = async () => {
        try {
            const forceLogin = !!spotifyError;
            const response = await api.get(`/spotify/login?force_login=${forceLogin}`);
            if (response.data.url) {
                window.location.href = response.data.url;
            }
        } catch (error) {
            console.error("Failed to get login URL", error);
            setSpotifyError("Could not connect to Spotify. Please try again.");
        }
    };

    const handleSpotifyPlayPause = async () => {
        if (!spotifyPlayer || !deviceId || !currentTrack?.track_url) return;

        if (isSpotifyPlaying) {
            await spotifyPlayer.pause();
        } else {
            const trackIdMatch = currentTrack.track_url.match(/track\/([a-zA-Z0-9]+)/);
            const trackId = trackIdMatch ? trackIdMatch[1] : null;
            if (!trackId) return;

            const state = await spotifyPlayer.getCurrentState();
            const currentTrackId = state?.track_window?.current_track?.id;
            const isSameTrack = currentTrackId && (currentTrackId === trackId || currentTrackId.includes(trackId));

            if (state && isSameTrack) {
                await spotifyPlayer.resume();
            } else {
                try {
                    await api.put('/spotify/play', {
                        device_id: deviceId,
                        uris: [`spotify:track:${trackId}`]
                    });
                } catch (error: any) {
                    console.error("Failed to start playback:", error);
                    const errorDetail = error.response?.data?.detail || "";

                    if (errorDetail.includes("user may not be registered")) {
                        setSpotifyError("Dev Mode: Add your email to Spotify Dashboard 'Users and Access'.");
                    } else if (error.response && (error.response.status === 403 || error.response.status === 401)) {
                        setSpotifyError("Missing permissions. Please reconnect to Spotify.");
                    } else {
                        console.error("Playback error:", error);
                    }
                }
            }
        }
    };

    const handleSpotifySeek = useCallback((time: number) => {
        if (spotifyPlayer) {
            spotifyPlayer.seek(time);
            setLocalSpotifyProgress(time); // Immediate local update for snappiness
        }
    }, [spotifyPlayer]);

    // Prefetch Spotify metadata when track changes
    useEffect(() => {
        const fetchSpotifyMetadata = async () => {
            if (!currentTrack?.track_url || !isSpotifyUrl(currentTrack.track_url)) {
                setPrefetchedTrack(null);
                return;
            }

            const trackIdMatch = currentTrack.track_url.match(/track\/([a-zA-Z0-9]+)/);
            const trackId = trackIdMatch ? trackIdMatch[1] : null;

            if (trackId) {
                try {
                    const response = await api.get(`/spotify/track/${trackId}`);
                    setPrefetchedTrack(response.data);
                } catch (error) {
                    console.error("Failed to prefetch Spotify metadata", error);
                }
            }
        };

        fetchSpotifyMetadata();
    }, [currentTrack?.track_url]);

    // --- System Audio Capture Logic ---
    const handleCaptureAudio = async () => {
        try {
            // Cleanup previous if exists
            if (captureStreamRef.current) {
                captureStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (captureContextRef.current) {
                captureContextRef.current.close();
            }

            // Request display media (screen/tab capture) with audio
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true, // Video is required to get the stream usually
                audio: {
                    // @ts-ignore - Experimental but powerful constraint
                    suppressLocalAudioPlayback: true,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            captureStreamRef.current = stream;

            // We only care about the audio track
            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) {
                alert("No audio track found! Did you check 'Share tab audio'?");
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            // Create Audio Context if not exists
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ac = new AudioContext();
            captureContextRef.current = ac;

            // Create Source from Stream
            const source = ac.createMediaStreamSource(stream);

            // Create EQ Filters & Analyser
            const frequencies = [60, 250, 1000, 4000, 12000];
            const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

            const newFilters = frequencies.map((freq, i) => {
                const filter = ac.createBiquadFilter();
                filter.type = types[i];
                filter.frequency.value = freq;
                filter.gain.value = 0;
                filter.Q.value = 1.0;
                return filter;
            });

            const analyserNode = ac.createAnalyser();
            analyserNode.fftSize = 2048;
            analyserNode.smoothingTimeConstant = 0.6;

            // Connect Graph: Source -> Filters -> Analyser -> Destination
            let currentNode: AudioNode = source;
            newFilters.forEach(filter => {
                currentNode.connect(filter);
                currentNode = filter;
            });
            currentNode.connect(analyserNode);
            analyserNode.connect(ac.destination);

            // Update State
            filtersRef.current = newFilters;
            analyserRef.current = analyserNode;
            setAnalyser(analyserNode); // Trigger visualizer
            setShowEQ(true); // Open EQ

            // Handle Stream End (User stops sharing)
            audioTrack.onended = () => {
                ac.close();
                setAnalyser(null);
                filtersRef.current = [];
                captureContextRef.current = null;
                captureStreamRef.current = null;
            };

            // Alert user
            alert("Audio Captured! \n\nWe attempted to auto-mute the original tab. If you still hear an echo, please manually Mute the original tab (Right Click Tab -> Mute Site).");

        } catch (err) {
            console.error("Error capturing audio:", err);
        }
    };


    // --- Pop-Out Logic ---
    const handlePopOut = () => {
        if (!currentTrack?.track_url) return;

        let url = currentTrack.track_url;
        // Optimization: Use embed URL for YouTube
        const ytEmbed = getYoutubeEmbedUrl(url);
        if (ytEmbed) url = ytEmbed + '?autoplay=1';

        window.open(url, 'MusicPlayer', 'width=500,height=600,menubar=no,toolbar=no,location=no,status=no');
    };

    const renderSpotifyPlayer = () => {
        if (spotifyError) {
            return (
                <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center h-full">
                    <AlertCircle className="w-10 h-10 text-red-400" />
                    <p className="text-red-200 text-sm font-medium px-4">{spotifyError}</p>
                    <button
                        onClick={handleLogin}
                        className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black rounded-full transition-all font-bold shadow-lg hover:shadow-green-500/20"
                    >
                        <LogIn className="w-4 h-4" />
                        Connect to Spotify
                    </button>
                </div>
            );
        }

        // Use Spotify SDK state if available, otherwise fallback to prefetched metadata, then queue metadata
        // @ts-ignore - Spotify types might be incomplete
        const albumArt = currentSpotifyTrack?.album?.images?.[0]?.url || prefetchedTrack?.album?.images?.[0]?.url;
        const trackName = currentSpotifyTrack?.name || prefetchedTrack?.name || currentTrack?.track_title || 'Ready to Play';
        const artistName = currentSpotifyTrack?.artists?.map((a) => a.name).join(', ') || prefetchedTrack?.artists?.map((a: any) => a.name).join(', ') || currentTrack?.user?.username || 'Select a track';

        return (
            <div className="flex flex-col w-full h-full p-4 justify-center">
                {/* Main Row: Art, Info */}
                <div className="flex items-center gap-4 w-full">
                    {/* Album Art */}
                    <div className="relative group shrink-0">
                        <div className={`w-16 h-16 rounded-lg overflow-hidden shadow-lg ${isSpotifyPlaying ? 'animate-pulse-slow' : ''} bg-black/40`}>
                            {albumArt ? (
                                <img src={albumArt} alt="Album Art" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                                    <Music className="w-6 h-6 text-white/20" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-white truncate tracking-tight leading-tight">
                            {trackName}
                        </h3>
                        <p className="text-white/60 text-sm truncate">
                            {artistName}
                        </p>
                    </div>
                </div>

                {/* Waveform & Time - Compact Bottom Bar */}
                <div className="mt-3 w-full">
                    <SimulatedWaveform
                        isPlaying={isSpotifyPlaying}
                        progress={localSpotifyProgress}
                        duration={spotifyDuration}
                        onSeek={handleSpotifySeek}
                    />
                    <div className="flex justify-between text-[10px] text-white/30 font-medium px-1 mt-1">
                        <span>{formatTime(localSpotifyProgress / 1000)}</span>
                        <span>{formatTime(spotifyDuration / 1000)}</span>
                    </div>
                </div>

                {/* Controls & Volume - Bottom Left */}
                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSpotifyPlayPause}
                            disabled={!deviceId}
                            className={`w-10 h-10 flex items-center justify-center rounded-full transition-transform shadow-lg shadow-white/10 ${!deviceId ? 'bg-white/20 cursor-not-allowed text-white/50' : 'bg-white text-black hover:scale-105'
                                }`}
                        >
                            {!deviceId ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                isSpotifyPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                        </button>

                        <div className="flex items-center gap-2 group">
                            <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={onSpotifyVolumeChange}
                                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white opacity-50 group-hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>

                    {/* Controls Right */}
                    <div className="flex items-center gap-2">
                        <button
                            className="p-2 text-white/60 hover:text-white transition-colors"
                            onClick={handlePopOut}
                            title="Pop Out Player (Easier Capture)"
                        >
                            <ExternalLink size={18} />
                        </button>
                        <button
                            className="p-2 text-white/60 hover:text-white transition-colors"
                            onClick={handleCaptureAudio}
                            title="Capture System Audio (Spotify/YouTube)"
                        >
                            <LogIn size={18} />
                        </button>

                        {/* EQ Toggle */}
                        <button
                            onClick={() => setShowEQ(!showEQ)}
                            className={`p-2 rounded-lg transition-all ${showEQ ? 'bg-purple-900/50 text-purple-300' : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'}`}
                            title="Toggle EQ Visualizer"
                        >
                            <Activity size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderYoutubePlayer = () => {
        const embedUrl = getYoutubeEmbedUrl(currentTrack!.track_url);
        return embedUrl ? (
            <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black relative group">
                <iframe src={embedUrl} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                {/* Overlay Toggle for Video Players */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                        onClick={handlePopOut}
                        className="p-2 rounded-lg backdrop-blur-md bg-black/40 text-white/60 hover:text-white"
                        title="Pop Out Player"
                    >
                        <ExternalLink size={18} />
                    </button>
                    <button
                        onClick={handleCaptureAudio}
                        className="p-2 rounded-lg backdrop-blur-md bg-black/40 text-white/60 hover:text-white"
                        title="Capture Audio"
                    >
                        <LogIn size={18} />
                    </button>
                    <button
                        onClick={() => setShowEQ(!showEQ)}
                        className={`p-2 rounded-lg backdrop-blur-md transition-all ${showEQ ? 'bg-purple-900/80 text-purple-300' : 'bg-black/40 text-white/60 hover:text-white'}`}
                        title="Toggle EQ Visualizer"
                    >
                        <Activity size={18} />
                    </button>
                </div>
            </div>
        ) : <div className="flex items-center justify-center h-full text-white/50">Invalid YouTube URL</div>;
    };

    const renderSoundCloudPlayer = () => {
        const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(currentTrack!.track_url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
        return (
            <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black relative group">
                <iframe width="100%" height="100%" scrolling="no" frameBorder="no" allow="autoplay" src={embedUrl}></iframe>
                {/* Overlay Toggle for Soundcloud */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                        onClick={handlePopOut}
                        className="p-2 rounded-lg backdrop-blur-md bg-black/40 text-white/60 hover:text-white"
                        title="Pop Out Player"
                    >
                        <ExternalLink size={18} />
                    </button>
                    <button
                        onClick={handleCaptureAudio}
                        className="p-2 rounded-lg backdrop-blur-md bg-black/40 text-white/60 hover:text-white"
                        title="Capture Audio"
                    >
                        <LogIn size={18} />
                    </button>
                    <button
                        onClick={() => setShowEQ(!showEQ)}
                        className={`p-2 rounded-lg backdrop-blur-md transition-all ${showEQ ? 'bg-purple-900/80 text-purple-300' : 'bg-black/40 text-white/60 hover:text-white'}`}
                        title="Toggle EQ Visualizer"
                    >
                        <Activity size={18} />
                    </button>
                </div>
            </div>
        );
    };

    const renderWaveSurferPlayer = () => (
        <div className="flex flex-col h-full justify-between p-6">
            <div>
                <h3 className="text-2xl font-bold text-white tracking-tight">{currentTrack?.track_title || 'Untitled Track'}</h3>
                <p className="text-white/60 text-lg mt-1">by {currentTrack?.user?.username || 'Unknown'}</p>
            </div>

            <div
                ref={waveformRef}
                className="w-full my-4 hover:opacity-100 transition-opacity"
                style={{ filter: 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.6))' }} // Neon glow effect
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 flex-1">
                    <button
                        onClick={onPlayPause}
                        disabled={!isWaveSurferReady}
                        className={`w-12 h-12 flex items-center justify-center rounded-full transition-transform shadow-lg ${!isWaveSurferReady
                            ? 'bg-white/20 cursor-not-allowed text-white/50'
                            : 'bg-white text-black hover:scale-105'
                            }`}
                    >
                        {!isWaveSurferReady ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />
                        )}
                    </button>

                    <div className="flex-1 flex items-center gap-3">
                        <span className="text-xs text-white/60 font-mono w-10 text-right">{formatTime(currentTime)}</span>
                        <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 w-full origin-left transform scale-x-0 transition-transform" style={{ transform: `scaleX(${duration ? currentTime / duration : 0})` }} />
                        </div>
                        <span className="text-xs text-white/60 font-mono w-10">{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center gap-3 group">
                        <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={onVolumeChange}
                            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                    </div>
                </div>

                {/* EQ Toggle */}
                <button
                    onClick={() => setShowEQ(!showEQ)}
                    className={`ml-4 p-2 rounded-lg transition-all ${showEQ ? 'bg-purple-900/50 text-purple-300' : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'}`}
                    title="Toggle EQ Visualizer"
                >
                    <Activity size={20} />
                </button>
            </div>
        </div>
    );

    const renderContent = () => {
        if (!currentTrack) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-3">
                    <Music className="w-12 h-12" />
                    <p className="text-sm font-medium uppercase tracking-widest">No Track Selected</p>
                </div>
            );
        }
        if (isSpotifyUrl(currentTrack.track_url)) return renderSpotifyPlayer();
        if (isYoutubeUrl(currentTrack.track_url)) return renderYoutubePlayer();
        if (isSoundCloudUrl(currentTrack.track_url)) return renderSoundCloudPlayer();
        return renderWaveSurferPlayer();
    };

    // Determine container class based on content type
    const isVideo = currentTrack && (isYoutubeUrl(currentTrack.track_url) || isSoundCloudUrl(currentTrack.track_url));
    const containerClass = isVideo
        ? "aspect-video w-full max-h-[400px] min-h-[300px] relative" // Video mode
        : "w-full relative p-2"; // Compact Audio mode

    return (
        <div className="flex flex-col gap-2 transition-all duration-300">
            <div className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 hover:border-white/20">
                {/* Main Player Container */}
                <div className={containerClass}>
                    {/* Background Gradient Mesh - Only for Audio or if needed */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 z-0 pointer-events-none" />

                    {/* Content */}
                    <div className="relative z-10 w-full h-full">
                        {renderContent()}
                    </div>
                </div>
            </div>

            {/* EQ Visualizer Section (Expands Down) */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showEQ ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <EQVisualizer
                    className="w-full h-[250px]"
                    onClose={() => setShowEQ(false)}
                    onBandsChange={handleEQChange}
                    analyser={analyser}
                    onExport={(text) => {
                        window.dispatchEvent(new CustomEvent('ADD_REVIEW_NOTE', { detail: text }));
                    }}
                />

            </div>
        </div>
    );
};

export default WebPlayer;
