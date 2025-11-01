import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { useQueueStore } from "../stores/queueStore";

const WebPlayer: React.FC = () => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const { nowPlaying } = useQueueStore();

  useEffect(() => {
    if (waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "violet",
        progressColor: "purple",
      });

      return () => {
        wavesurfer.current?.destroy();
      };
    }
  }, []);

  useEffect(() => {
    if (nowPlaying && wavesurfer.current) {
      wavesurfer.current.load(
        `/api/proxy/audio?url=${encodeURIComponent(nowPlaying.track_url)}`
      );
    }
  }, [nowPlaying]);

  return <div ref={waveformRef} />;
};

export default WebPlayer;
