import { useEffect, useRef, useState } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import WaveSurfer from 'wavesurfer.js';

const WebPlayer = () => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const { currentTrack } = useQueueStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);

  useEffect(() => {
    if (!waveformRef.current) return;

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgb(167 139 250)', // purple-400
      progressColor: 'rgb(124 58 237)', // purple-600
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      height: 100,
      cursorWidth: 2,
      cursorColor: 'white',
    });

    wavesurfer.current.on('play', () => setIsPlaying(true));
    wavesurfer.current.on('pause', () => setIsPlaying(false));
    wavesurfer.current.on('finish', () => setIsPlaying(false));


    return () => {
      wavesurfer.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (wavesurfer.current && currentTrack) {
      const audioUrl = `/api/proxy/audio?url=${encodeURIComponent(currentTrack.track_url)}`;

      // Define the ready handler
      const handleReady = () => {
        wavesurfer.current?.play();
      };

      // Add the listener
      wavesurfer.current.on('ready', handleReady);

      // Load the new track
      wavesurfer.current.load(audioUrl);

      // Cleanup function to remove the listener
      return () => {
        wavesurfer.current?.un('ready', handleReady);
      };
    }
  }, [currentTrack]);

  useEffect(() => {
    if(wavesurfer.current) {
        wavesurfer.current.setVolume(volume);
    }
  }, [volume]);

  const handlePlayPause = () => {
    wavesurfer.current?.playPause();
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4">
      <div ref={waveformRef} className="mb-4" />
      <div className="flex items-center space-x-4">
        <button
          onClick={handlePlayPause}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="flex items-center space-x-2">
            <span>Volume</span>
            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-32"
            />
        </div>
      </div>
    </div>
  );
};

export default WebPlayer;
