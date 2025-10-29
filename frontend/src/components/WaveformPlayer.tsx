import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

interface WaveformPlayerProps {
  src: string;
  header: string;
}

const formatTime = (seconds: number) => {
  const date = new Date(seconds * 1000);
  const minutes = date.getUTCMinutes();
  const secs = date.getUTCSeconds().toString().padStart(2, "0");
  return `${minutes}:${secs}`;
};

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ src, header }) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isLoading, setIsLoading] = useState(true); // To track loading state

  useEffect(() => {
    if (waveformRef.current) {
      setIsLoading(true); // Start loading
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#A8A8A8",
        progressColor: "#673AB7",
        cursorColor: "#673AB7",
        barWidth: 3,
        barRadius: 3,
        height: 100,
        responsive: true,
      });

      const proxyUrl = `/api/proxy/audio?url=${encodeURIComponent(src)}`;
      wavesurfer.current.load(proxyUrl);

      // Event listeners
      wavesurfer.current.on("play", () => setIsPlaying(true));
      wavesurfer.current.on("pause", () => setIsPlaying(false));
      wavesurfer.current.on("ready", (newDuration) => {
        setDuration(newDuration);
        setIsLoading(false); // Finished loading
      });
      wavesurfer.current.on("audioprocess", (time) => {
        setCurrentTime(time);
      });
      wavesurfer.current.on("error", (error) => {
        console.error("WaveSurfer error:", error);
        setIsLoading(false);
      });
      wavesurfer.current.setVolume(volume);

      return () => {
        wavesurfer.current?.destroy();
      };
    }
  }, [src]); // Re-create WaveSurfer instance when src changes

  const handlePlayPause = () => {
    wavesurfer.current?.playPause();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    wavesurfer.current?.setVolume(newVolume);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white truncate">{header}</h2>
      </div>

      {isLoading && <div className="text-center text-gray-400">Loading audio...</div>}

      <div style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
        <div ref={waveformRef} className="waveform-container" />

        <div className="flex items-center justify-between mt-3 text-white">
          <button
            onClick={handlePlayPause}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full w-14 h-14 flex items-center justify-center"
            disabled={isLoading}
          >
            {isPlaying ? "❚❚" : "►"}
          </button>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="flex items-center space-x-2">
              <span>🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaveformPlayer;
