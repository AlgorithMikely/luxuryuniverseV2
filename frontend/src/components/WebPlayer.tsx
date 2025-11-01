import { useRef, useEffect, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  HeartIcon,
  StarIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/solid";
import { SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";
import { useQueueStore } from "../stores/queueStore";

const WebPlayer = () => {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");

  const currentTrack = useQueueStore((state) => state.currentTrack);
  const playNext = useQueueStore((state) => state.playNext);
  const toggleBookmark = useQueueStore((state) => state.toggleBookmark);
  const toggleSpotlight = useQueueStore((state) => state.toggleSpotlight);


  useEffect(() => {
    if (!waveformRef.current) return;

    // Destroy previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    if (currentTrack) {
        const proxiedUrl = `/api/proxy/audio?url=${encodeURIComponent(currentTrack.track_url)}`;

        wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: "rgb(107 114 128)",
            progressColor: "rgb(168 85 247)",
            height: 64,
            barWidth: 2,
            barGap: 1,
            cursorWidth: 2,
            cursorColor: "white",
            url: proxiedUrl,
        });

        const ws = wavesurferRef.current;

        ws.on("play", () => setIsPlaying(true));
        ws.on("pause", () => setIsPlaying(false));
        ws.on("ready", () => {
            const totalDuration = ws.getDuration();
            setDuration(formatTime(totalDuration));
            // ws.play(); // Autoplay when ready - DISABLED per new requirements
        });
        ws.on("audioprocess", () => {
            const time = ws.getCurrentTime();
            setCurrentTime(formatTime(time));
        });
        ws.on('finish', () => {
          // playNext(); // Autoplay is now handled by the review submission process
        });
    }

    return () => {
      // This cleanup runs when the component unmounts OR before the effect runs again.
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [currentTrack?.id]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handlePlayPause = () => {
    wavesurferRef.current?.playPause();
  };

  const handleNext = () => {
    playNext();
  };

  const handleBookmark = () => {
    if (currentTrack) {
        toggleBookmark(currentTrack.id, !currentTrack.is_bookmarked);
    }
  };

  const handleSpotlight = () => {
      if (currentTrack) {
          toggleSpotlight(currentTrack.id, !currentTrack.is_spotlighted);
      }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    wavesurferRef.current?.setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  if (!currentTrack) {
    return (
        <footer className="bg-gray-800 border-t border-gray-700 p-4 flex items-center justify-center h-28">
            <p className="text-gray-500">Select a track from the queue to start playing.</p>
        </footer>
    )
  }

  return (
    <footer className="bg-gray-800 border-t border-gray-700 p-4 grid grid-cols-3 items-center h-28">
      {/* Left side: Track Info */}
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 rounded-md bg-gray-700 flex items-center justify-center">
            <MusicalNoteIcon className="h-8 w-8 text-gray-400"/>
        </div>
        <div>
          <p className="font-bold">{currentTrack.track_title || 'Untitled'}</p>
          <p className="text-sm text-gray-400">{currentTrack.track_artist || 'Unknown Artist'}</p>
        </div>
      </div>

      {/* Center: Player Controls & Waveform */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handlePlayPause}
          className="bg-purple-600 p-2 rounded-full text-white hover:bg-purple-700"
        >
          {isPlaying ? (
            <PauseIcon className="h-6 w-6" />
          ) : (
            <PlayIcon className="h-6 w-6" />
          )}
        </button>
        <div className="w-full flex items-center space-x-2">
            <span className="text-xs text-gray-400 w-12 text-right">{currentTime}</span>
            <div ref={waveformRef} className="flex-grow h-16"></div>
            <span className="text-xs text-gray-400 w-12">{duration}</span>
        </div>
      </div>

      {/* Right side: Volume & Actions */}
      <div className="flex items-center justify-end space-x-4">
         <button onClick={handleBookmark} aria-label="Bookmark" className={`${currentTrack.is_bookmarked ? 'text-pink-500' : 'text-gray-400'} hover:text-white`}>
            <HeartIcon className="h-6 w-6" />
          </button>
          <button onClick={handleSpotlight} aria-label="Spotlight" className={`${currentTrack.is_spotlighted ? 'text-yellow-400' : 'text-gray-400'} hover:text-white`}>
            <StarIcon className="h-6 w-6" />
          </button>
        <div className="flex items-center space-x-2 w-32">
            <button onClick={toggleMute} className="text-gray-400 hover:text-white">
                {isMuted || volume === 0 ? <SpeakerXMarkIcon className="h-5 w-5"/> : <SpeakerWaveIcon className="h-5 w-5"/>}
            </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </footer>
  );
};

export default WebPlayer;
