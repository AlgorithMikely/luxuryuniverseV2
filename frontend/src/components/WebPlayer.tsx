import { useRef, useEffect, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  HeartIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";

// Mock submission for now
const mockSubmission = {
  track_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  track_title: "A Great Song",
  track_artist: "An Amazing Artist",
  album_art_url: "https://i.scdn.co/image/ab67616d0000b273f412df037803304530f40f2d",
};

const WebPlayer = () => {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");

  useEffect(() => {
    if (!waveformRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "rgb(107 114 128)",
      progressColor: "rgb(168 85 247)",
      height: 64,
      barWidth: 2,
      barGap: 1,
      cursorWidth: 2,
      cursorColor: "white",
      url: mockSubmission.track_url,
    });

    const ws = wavesurferRef.current;

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("ready", () => {
      const totalDuration = ws.getDuration();
      setDuration(formatTime(totalDuration));
    });
    ws.on("audioprocess", () => {
      const time = ws.getCurrentTime();
      setCurrentTime(formatTime(time));
    });

    return () => {
      ws.destroy();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handlePlayPause = () => {
    wavesurferRef.current?.playPause();
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

  return (
    <footer className="bg-gray-800 border-t border-gray-700 p-4 grid grid-cols-3 items-center">
      {/* Left side: Track Info */}
      <div className="flex items-center space-x-4">
        <img
          src={mockSubmission.album_art_url}
          alt="Album Art"
          className="w-16 h-16 rounded-md"
        />
        <div>
          <p className="font-bold">{mockSubmission.track_title}</p>
          <p className="text-sm text-gray-400">{mockSubmission.track_artist}</p>
        </div>
      </div>

      {/* Center: Player Controls & Waveform */}
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-center space-x-6">
          <button className="text-gray-400 hover:text-white">
            <BackwardIcon className="h-6 w-6" />
          </button>
          <button
            onClick={handlePlayPause}
            className="bg-purple-600 p-3 rounded-full text-white hover:bg-purple-700"
          >
            {isPlaying ? (
              <PauseIcon className="h-8 w-8" />
            ) : (
              <PlayIcon className="h-8 w-8" />
            )}
          </button>
          <button className="text-gray-400 hover:text-white">
            <ForwardIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="w-full flex items-center space-x-2 mt-2">
            <span className="text-xs text-gray-400 w-12 text-right">{currentTime}</span>
            <div ref={waveformRef} className="flex-grow h-16"></div>
            <span className="text-xs text-gray-400 w-12">{duration}</span>
        </div>
      </div>

      {/* Right side: Volume & Actions */}
      <div className="flex items-center justify-end space-x-4">
         <button className="text-gray-400 hover:text-white">
            <HeartIcon className="h-6 w-6" />
          </button>
          <button className="text-gray-400 hover:text-white">
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
