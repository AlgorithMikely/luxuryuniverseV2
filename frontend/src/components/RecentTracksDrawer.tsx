import React, { useEffect, useState, useRef } from "react";
import { X, Clock, Play, Pause, AlertCircle, Loader2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import toast from "react-hot-toast";

interface RecentTrack {
  id: number;
  track_title: string;
  artist_name?: string;
  file_url: string;
  hook_start_time?: number;
  created_at: string;
}

interface RecentTracksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (track: RecentTrack) => void;
}

const RecentTracksDrawer: React.FC<RecentTracksDrawerProps> = ({ isOpen, onClose, onSelect }) => {
  const [tracks, setTracks] = useState<RecentTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTrack, setActiveTrack] = useState<RecentTrack | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchTracks = async () => {
        setIsLoading(true);
        try {
          const { data } = await api.get<RecentTrack[]>("/user/recent-tracks");
          setTracks(data);
        } catch (error) {
          console.error("Failed to fetch recent tracks", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchTracks();
    }
  }, [isOpen]);

  const handlePlay = (e: React.MouseEvent, track: RecentTrack) => {
    e.stopPropagation();

    const isSC = track.file_url.includes('soundcloud.com');
    const isSpotify = track.file_url.includes('spotify.com');
    const isYouTube = track.file_url.includes('youtube.com') || track.file_url.includes('youtu.be');
    const isFile = !isSC && !isSpotify && !isYouTube;

    // Handle File Toggle
    if (isFile) {
      if (playingTrackId === track.id) {
        // Currently playing this file -> Pause/Stop
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setPlayingTrackId(null);
        return;
      }
    }

    // Handle Embed Toggle
    if (activeTrack?.id === track.id) {
      // Currently active embed -> Close (Stop)
      setActiveTrack(null);
      setPlayingTrackId(null);
      return;
    }

    // Start New Track

    // 1. Stop existing file audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // 2. Reset states
    setPlayingTrackId(null);

    if (isFile) {
      // Start File
      setLoadingTrackId(track.id);
      setActiveTrack(null);

      let urlToPlay = track.file_url;
      if (track.file_url.startsWith('r2://')) {
        urlToPlay = `/api/proxy/audio?url=${encodeURIComponent(track.file_url)}`;
      }

      const audio = new Audio(urlToPlay);
      audio.onended = () => setPlayingTrackId(null);
      audio.oncanplaythrough = () => {
        setLoadingTrackId(null);
        setPlayingTrackId(track.id);
        audio.play();
      };
      audio.onerror = (e) => {
        console.error("Audio playback error", e);
        toast.error("Failed to play audio");
        setLoadingTrackId(null);
        setPlayingTrackId(null);
      };
      audioRef.current = audio;
    } else {
      // Start Embed
      setActiveTrack(track);
      setPlayingTrackId(track.id);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const filteredTracks = tracks.filter(track => {
    const query = searchQuery.toLowerCase();
    return (
      track.track_title.toLowerCase().includes(query) ||
      (track.artist_name && track.artist_name.toLowerCase().includes(query)) ||
      track.file_url.toLowerCase().includes(query)
    );
  });

  // Helper to get Embed URL
  const getEmbedUrl = (track: RecentTrack) => {
    if (track.file_url.includes('soundcloud.com')) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.file_url)}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
    }
    if (track.file_url.includes('spotify.com')) {
      const match = track.file_url.match(/track\/([a-zA-Z0-9]+)/);
      const id = match ? match[1] : null;
      if (id) return `https://open.spotify.com/embed/track/${id}?utm_source=generator&autoplay=1`;
      return null;
    }
    if (track.file_url.includes('youtube.com') || track.file_url.includes('youtu.be')) {
      let videoId = null;
      if (track.file_url.includes('youtu.be')) {
        videoId = track.file_url.split('/').pop();
      } else {
        const urlParams = new URLSearchParams(new URL(track.file_url).search);
        videoId = urlParams.get('v');
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${window.location.origin}`;
      return null;
    }
    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-30"
          />

          {/* Right Side Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-16 right-0 bottom-0 w-80 md:w-96 bg-gray-900 border-l border-white/10 shadow-2xl z-40 flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex flex-col gap-4 bg-gray-900/95 backdrop-blur">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="text-blue-400" size={18} />
                  Recent Tracks
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="Search tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-20">
              {isLoading ? (
                <div className="text-center py-10 text-gray-500">Loading...</div>
              ) : filteredTracks.length === 0 ? (
                <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                  <AlertCircle className="mb-2 opacity-50" />
                  {searchQuery ? "No matches found." : "No recent tracks found."}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredTracks.map((track) => (
                    <div key={track.id} className="flex flex-col gap-2">
                      <div
                        onClick={() => onSelect(track)}
                        className={`group p-3 rounded-xl transition-all border flex items-center justify-between cursor-pointer
                            ${activeTrack?.id === track.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-blue-500/30'}
                        `}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <button
                            onClick={(e) => handlePlay(e, track)}
                            className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${playingTrackId === track.id ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 group-hover:text-blue-400 group-hover:bg-gray-700'}`}
                          >
                            {loadingTrackId === track.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : playingTrackId === track.id ? (
                              <div className="flex gap-0.5 items-end h-3">
                                <motion.div animate={{ height: [4, 12, 6, 12] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-white rounded-full" />
                                <motion.div animate={{ height: [8, 4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-white rounded-full" />
                                <motion.div animate={{ height: [6, 12, 4, 8] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-white rounded-full" />
                              </div>
                            ) : (
                              <Play size={14} fill="currentColor" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <h3 className={`font-bold text-sm transition-colors truncate ${activeTrack?.id === track.id ? 'text-blue-400' : 'text-white group-hover:text-blue-300'}`}>
                              {track.track_title || "Untitled"}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                              {new Date(track.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {track.hook_start_time !== undefined && track.hook_start_time !== null && (
                          <div className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20 whitespace-nowrap ml-2">
                            {track.hook_start_time}s
                          </div>
                        )}
                      </div>

                      {/* Embed Player Inside Card */}
                      <AnimatePresence>
                        {activeTrack?.id === track.id && (activeTrack.file_url.includes('soundcloud.com') || activeTrack.file_url.includes('spotify.com') || activeTrack.file_url.includes('youtube.com') || activeTrack.file_url.includes('youtu.be')) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden rounded-lg bg-black/20"
                          >
                            {activeTrack.file_url.includes('soundcloud.com') ? (
                              <iframe
                                width="100%"
                                height="166"
                                scrolling="no"
                                frameBorder="no"
                                allow="autoplay; encrypted-media"
                                src={getEmbedUrl(activeTrack) || ""}
                                className="rounded-lg"
                              ></iframe>
                            ) : activeTrack.file_url.includes('spotify.com') ? (
                              <iframe
                                style={{ borderRadius: '12px' }}
                                src={getEmbedUrl(activeTrack) || ""}
                                width="100%"
                                height="152"
                                frameBorder="0"
                                allowFullScreen
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                className="rounded-lg"
                              ></iframe>
                            ) : (
                              <iframe
                                ref={iframeRef}
                                width="100%"
                                height="200"
                                src={getEmbedUrl(activeTrack) || ""}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="rounded-lg"
                                onLoad={() => {
                                  if (iframeRef.current) {
                                    iframeRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                                  }
                                }}
                              ></iframe>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RecentTracksDrawer;
