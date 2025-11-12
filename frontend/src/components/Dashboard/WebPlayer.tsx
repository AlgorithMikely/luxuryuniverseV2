import { useEffect, useRef, useState } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import { useSpotifyStore } from '../../stores/spotifyStore';
import WaveSurfer from 'wavesurfer.js';
import { FaPlay, FaPause, FaForward, FaBackward, FaVolumeUp } from 'react-icons/fa';

// --- Helper Functions for URL detection ---
const isSpotifyUrl = (url: string) => url.includes('open.spotify.com');
const isYoutubeUrl = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');

const getYoutubeEmbedUrl = (url: string): string | null => {
    let videoId = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (e) {
        console.error("Invalid URL for YouTube parsing", e);
        return null;
    }

    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return null;
};


const WebPlayer = () => {
  // --- State and Store Hooks ---
  const { currentTrack } = useQueueStore();
  const { spotifyPlayer, isPlaying: isSpotifyPlaying, progress, duration, currentSpotifyTrack } = useSpotifyStore();

  // --- Refs for WaveSurfer ---
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isWaveSurferPlaying, setWaveSurferPlaying] = useState(false);
  const [waveSurferVolume, setWaveSurferVolume] = useState(0.5);
  const [waveSurferTime, setWaveSurferTime] = useState(0);
  const [waveSurferDuration, setWaveSurferDuration] = useState(0);


  // --- Initialize WaveSurfer ---
  useEffect(() => {
    if (!waveformRef.current) return;

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#A78BFA', // purple-400
      progressColor: '#7C3AED', // purple-600
      barWidth: 3,
      barGap: 2,
      height: 80,
      cursorWidth: 2,
      cursorColor: 'white',
    });

    // --- WaveSurfer Event Listeners ---
    wavesurfer.current.on('play', () => setWaveSurferPlaying(true));
    wavesurfer.current.on('pause', () => setWaveSurferPlaying(false));
    wavesurfer.current.on('finish', () => setWaveSurferPlaying(false));
    wavesurfer.current.on('ready', (duration) => setWaveSurferDuration(duration));
    wavesurfer.current.on('audioprocess', (time) => setWaveSurferTime(time));

    return () => wavesurfer.current?.destroy();
  }, []);

  // --- Load Track into WaveSurfer when URL is not Spotify/YouTube ---
  useEffect(() => {
    if (wavesurfer.current && currentTrack && !isSpotifyUrl(currentTrack.track_url) && !isYoutubeUrl(currentTrack.track_url)) {
      const audioUrl = `/api/proxy/audio?url=${encodeURIComponent(currentTrack.track_url)}`;
      wavesurfer.current.load(audioUrl);
    }
  }, [currentTrack]);

  // --- Control WaveSurfer Volume ---
  useEffect(() => {
    if (wavesurfer.current) {
      wavesurfer.current.setVolume(waveSurferVolume);
    }
  }, [waveSurferVolume]);


  // --- Player Control Handlers ---
  const handleWaveSurferPlayPause = () => wavesurfer.current?.playPause();
  const handleSpotifyPlayPause = () => spotifyPlayer?.togglePlay();
  const handleNextTrack = () => spotifyPlayer?.nextTrack();
  const handlePrevTrack = () => spotifyPlayer?.previousTrack();
  const handleSpotifyVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    spotifyPlayer?.setVolume(volume);
  };


  // --- Render Functions ---
  const renderSpotifyPlayer = () => (
    <div className="flex flex-col items-center justify-center p-4">
        <h3 className="text-xl font-bold">{currentSpotifyTrack?.name || 'No song selected'}</h3>
        <p className="text-md text-gray-400">{currentSpotifyTrack?.artists.map(a => a.name).join(', ') || '...'}</p>
        <div className="flex items-center gap-4 my-4">
            <FaBackward className="cursor-pointer hover:text-purple-400" onClick={handlePrevTrack} />
            <div onClick={handleSpotifyPlayPause} className="cursor-pointer text-3xl hover:text-purple-400">
                {isSpotifyPlaying ? <FaPause /> : <FaPlay />}
            </div>
            <FaForward className="cursor-pointer hover:text-purple-400" onClick={handleNextTrack} />
        </div>
         <div className="flex items-center gap-2 w-full">
            <FaVolumeUp />
            <input type="range" min="0" max="1" step="0.01" defaultValue="1" onChange={handleSpotifyVolume} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
        </div>
        {/* Progress bar could be added here using `progress` and `duration` from the store */}
    </div>
  );

  const renderYoutubePlayer = () => {
      const embedUrl = getYoutubeEmbedUrl(currentTrack!.track_url);
      if(!embedUrl) return <p className="text-center text-red-500">Invalid YouTube URL</p>;
      return (
        <div className="aspect-w-16 aspect-h-9">
            <iframe
                src={embedUrl}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
            ></iframe>
        </div>
      );
  };

  const renderWaveSurferPlayer = () => (
    <div className="p-4">
      <div className="mb-2">
          <h3 className="text-lg font-bold">{currentTrack?.track_title || 'Untitled Track'}</h3>
          <p className="text-sm text-gray-400">by {currentTrack?.user?.username || 'Unknown'}</p>
      </div>
      <div ref={waveformRef} className="mb-4" />
       <div className="flex items-center justify-between">
            <div onClick={handleWaveSurferPlayPause} className="cursor-pointer text-2xl hover:text-purple-400">
                {isWaveSurferPlaying ? <FaPause /> : <FaPlay />}
            </div>
             <div className="flex items-center gap-2">
                <span>{waveSurferTime.toFixed(2)}s</span>
                <span>/</span>
                <span>{waveSurferDuration.toFixed(2)}s</span>
            </div>
             <div className="flex items-center gap-2 w-1/3">
                <FaVolumeUp />
                <input type="range" min="0" max="1" step="0.05" value={waveSurferVolume} onChange={(e) => setWaveSurferVolume(parseFloat(e.target.value))} className="w-full" />
            </div>
        </div>
    </div>
  );

  const renderPlayer = () => {
    if (!currentTrack) {
      return <div className="text-center p-8">No track selected.</div>;
    }
    if (isSpotifyUrl(currentTrack.track_url)) {
      return renderSpotifyPlayer();
    }
    if (isYoutubeUrl(currentTrack.track_url)) {
      return renderYoutubePlayer();
    }
    return renderWaveSurferPlayer();
  };

  return <div className="bg-gray-800 rounded-lg shadow-lg">{renderPlayer()}</div>;
};

export default WebPlayer;
