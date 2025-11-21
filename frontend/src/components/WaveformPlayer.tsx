import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface WaveformPlayerProps {
  url: string;
  hookStartTime?: number;
  onHookChange: (startTime: number, endTime: number) => void;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ url, hookStartTime, onHookChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !url) return;

    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255, 255, 255, 0.2)',
      progressColor: '#3b82f6', // Blue-500
      cursorColor: '#60a5fa',
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 60,
      normalize: true,
    });

    // Initialize Regions Plugin
    const wsRegions = RegionsPlugin.create();
    ws.registerPlugin(wsRegions);
    regions.current = wsRegions;

    ws.load(url);

    ws.on('ready', () => {
      setIsReady(true);

      // Create Hook Region
      // Default to start at hookStartTime or 30s in, duration 30s
      const start = hookStartTime || 30;
      const duration = 30;

      wsRegions.clearRegions();
      wsRegions.addRegion({
        start: start,
        end: start + duration,
        color: 'rgba(234, 179, 8, 0.2)', // Yellow-500 with opacity
        drag: true,
        resize: true,
        content: 'Hook',
        minLength: 15, // Min hook length
        maxLength: 60, // Max hook length
      });

      // Initial notification
      onHookChange(start, start + duration);
    });

    wsRegions.on('region-updated', (region) => {
        onHookChange(Math.round(region.start), Math.round(region.end));
    });

    // Play hook on region click
    wsRegions.on('region-clicked', (region, e) => {
        e.stopPropagation();
        region.play();
        setIsPlaying(true);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    wavesurfer.current = ws;

    return () => {
      ws.destroy();
    };
  }, [url]); // Re-init if URL changes

  const togglePlay = () => {
      if (wavesurfer.current) {
          wavesurfer.current.playPause();
      }
  };

  return (
    <div className="flex items-center gap-4">
        <button
            onClick={togglePlay}
            disabled={!isReady}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
            {isPlaying ? (
                 <div className="w-3 h-3 bg-white rounded-sm" />
            ) : (
                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />
            )}
        </button>

        <div className="flex-1 relative group" ref={containerRef}>
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                    Loading waveform...
                </div>
            )}
        </div>
    </div>
  );
};

export default WaveformPlayer;
