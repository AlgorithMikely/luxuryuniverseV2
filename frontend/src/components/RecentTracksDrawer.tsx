import React, { useEffect, useState } from "react";
import { X, Clock, Play, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-white/10 shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="text-blue-400" />
                Recent Tracks
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoading ? (
                <div className="text-center py-10 text-gray-500">Loading...</div>
              ) : tracks.length === 0 ? (
                <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                    <AlertCircle className="mb-2 opacity-50" />
                    No recent tracks found.
                </div>
              ) : (
                tracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => onSelect(track)}
                    className="group p-4 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all border border-transparent hover:border-blue-500/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-blue-400 transition-colors">
                            <Play size={16} fill="currentColor" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                                {track.track_title || "Untitled"}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {new Date(track.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    {track.hook_start_time !== undefined && track.hook_start_time !== null && (
                         <div className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20">
                             Hook: {track.hook_start_time}s
                         </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RecentTracksDrawer;
