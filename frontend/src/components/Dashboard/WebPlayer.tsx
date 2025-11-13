import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useSpotifyStore } from '../../stores/spotifyStore';
import WaveSurfer from 'wavesurfer.js';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

// --- Helper functions ---
const isSpotifyUrl = (url: string) => url?.includes('open.spotify.com');
const isYoutubeUrl = (url: string) => url?.includes('youtube.com') || url?.includes('youtu.be');

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
        return null;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};


// --- Main Component ---
const WebPlayer = () => {
    const { currentTrack } = useQueueStore();
    const { spotifyPlayer, isPlaying: isSpotifyPlaying, currentSpotifyTrack } = useSpotifyStore();

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

    // --- Initialize WaveSurfer ---
    useEffect(() => {
        if (!waveformRef.current) return;

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

        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));
        ws.on('audioprocess', (time) => setCurrentTime(time));
        ws.on('ready', (dur) => setDuration(dur));
        ws.on('seeking', (time) => setCurrentTime(time));

        return () => ws.destroy();
    }, []);

    // --- Load Audio ---
    useEffect(() => {
        const url = currentTrack?.track_url;
        if (wavesurfer.current && url && !isSpotifyUrl(url) && !isYoutubeUrl(url)) {
             wavesurfer.current.load(`/api/proxy/audio?url=${encodeURIComponent(url)}`);
        }
    }, [currentTrack?.track_url]);


    // --- Player Render Logic ---
    const renderSpotifyPlayer = () => (
        <div className="flex flex-col items-center justify-center p-4">
             <h3 className="text-xl font-bold">{currentSpotifyTrack?.name || 'No song selected'}</h3>
             <p className="text-md text-gray-400">{currentSpotifyTrack?.artists.map((a: { name: string }) => a.name).join(', ') || '...'}</p>
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
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                <span className="text-gray-400 text-sm w-20">{formatTime(currentTime)} / {formatTime(duration)}</span>
                <button onClick={toggleMute} className="text-white text-lg hover:text-purple-400">
                    {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
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
        if (!currentTrack) return <div className="text-center p-8">No track selected.</div>;
        if (isSpotifyUrl(currentTrack.track_url)) return renderSpotifyPlayer();
        if (isYoutubeUrl(currentTrack.track_url)) return renderYoutubePlayer();
        return renderWaveSurferPlayer();
    };

    return <div className="bg-gray-800 rounded-lg shadow-lg">{renderPlayer()}</div>;
};

export default WebPlayer;
