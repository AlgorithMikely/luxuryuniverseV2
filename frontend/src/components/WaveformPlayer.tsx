import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

interface WaveformPlayerProps {
  src: string;
  header: string;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ src, header }) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#A8A8A8",
        progressColor: "#673AB7",
        cursorColor: "#673AB7",
        barWidth: 2,
        barRadius: 3,
        height: 100,
      });

      wavesurfer.current.load(src);

      wavesurfer.current.on("play", () => setIsPlaying(true));
      wavesurfer.current.on("pause", () => setIsPlaying(false));

      return () => {
        wavesurfer.current?.destroy();
      };
    }
  }, [src]);

  const handlePlayPause = () => {
    wavesurfer.current?.playPause();
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{header}</h2>
        <button
          onClick={handlePlayPause}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <div ref={waveformRef} className="mt-4" />
    </div>
  );
};

export default WaveformPlayer;
