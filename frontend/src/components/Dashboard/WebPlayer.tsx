import { useEffect, useRef, useState } from 'react';
import { useQueueStore } from '../../stores/queueStore';
import WaveSurfer from 'wavesurfer.js';

const WebPlayer = () => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const { currentTrack } = useQueueStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to format time
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!waveformRef.current) return;

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgb(167 139 250)',
      progressColor: 'rgb(124 58 237)',
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      height: 60,
      cursorWidth: 1,
      cursorColor: 'white',
      interact: true, // Allow interaction
    });

    const ws = wavesurfer.current;

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    ws.on('audioprocess', (time) => {
      if (!isDragging) {
        setCurrentTime(time);
      }
    });

    ws.on('seeking', (time) => {
        setCurrentTime(time);
    });

    ws.on('drag', () => setIsDragging(true));
    ws.on('interaction', () => setIsDragging(false));


    ws.on('ready', (newDuration) => {
      setDuration(newDuration);
      setCurrentTime(0);
    });

    return () => {
      ws.destroy();
    };
  }, []);

  useEffect(() => {
    if (wavesurfer.current && currentTrack) {
      const audioUrl = `/api/proxy/audio?url=${encodeURIComponent(currentTrack.track_url)}`;
      wavesurfer.current.load(audioUrl);
    } else if (!currentTrack) {
        wavesurfer.current?.stop();
        setCurrentTime(0);
        setDuration(0);
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
      <div className="flex items-center gap-4 mb-2">
        <div className="flex-grow">
          <p className="font-bold text-lg truncate" title={currentTrack?.track_title || 'No track selected'}>
            {currentTrack?.track_title || 'No track selected'}
          </p>
          <p className="text-sm text-gray-400">
            {currentTrack?.user?.username ? `Submitted by ${currentTrack.user.username}` : ''}
          </p>
        </div>
      </div>
      <div ref={waveformRef} className="mb-2" />
      <div className="flex items-center justify-between text-sm text-gray-400 px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className="flex items-center space-x-4 mt-2">
        <button
          onClick={handlePlayPause}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!currentTrack}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
          )}
        </button>
        <div className="flex items-center space-x-2 flex-grow">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5.073 3.013A1 1 0 016 4v12a1 1 0 01-1.447.894L.83 12.447A1 1 0 010 11.553V8.447a1 1 0 01.83-1.447l3.723-1.987a1 1 0 01.52-.001zM12 4a1 1 0 011 1v10a1 1 0 01-1.555.832l-3.197-2.132A1 1 0 017 12.87V7.13a1 1 0 01.445-.832L10.25 4.136A1 1 0 0112 4z" /></svg>
            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-full"
            />
        </div>
      </div>
    </div>
  );
};

export default WebPlayer;
