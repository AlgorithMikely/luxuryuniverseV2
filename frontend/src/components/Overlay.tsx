import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Submission } from '../types';
import GiveawayProgressBar from './GiveawayProgressBar';
import GiveawayWinnerAnnouncement from './GiveawayWinnerAnnouncement';
import { GiveawayState, useQueueStore } from '../stores/queueStore';

export default function Overlay() {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const [currentTrack, setCurrentTrack] = useState<Submission | null>(null);
  const [giveawayState, setGiveawayState] = useState<GiveawayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Force body transparency for OBS
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    return () => {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, []);

  useEffect(() => {
    if (!reviewerId) return;

    let isMounted = true;
    let pollInterval: any;

    const init = async () => {
      let targetId = reviewerId;

      // Resolve handle if needed
      if (!/^\d+$/.test(reviewerId)) {
        try {
          const res = await fetch(`/api/reviewer/public/${reviewerId}`);
          if (res.ok) {
            const data = await res.json();
            targetId = data.id.toString();
          } else {
            console.error("Failed to resolve reviewer handle");
            if (isMounted) setLoading(false);
            return;
          }
        } catch (err) {
          console.error("Error resolving handle:", err);
          if (isMounted) setLoading(false);
          return;
        }
      }

      // Connect Socket for Real-time Updates (Winner Popup)
      const { connect } = useQueueStore.getState();
      connect("", targetId); // Empty token for public access

      const fetchData = async () => {
        try {
          // Fetch Current Track
          const trackRes = await fetch(`/api/reviewer/${targetId}/queue/current?t=${Date.now()}`);
          if (trackRes.ok) {
            const data = await trackRes.json();
            if (isMounted) setCurrentTrack(data);
            // Reset image error on new track
            setImageError(false);
          }

          // Fetch Giveaway State (Public Endpoint)
          const stateRes = await fetch(`/api/reviewer/${targetId}/giveaway/state?t=${Date.now()}`);
          if (stateRes.ok) {
            const stateData = await stateRes.json();
            if (isMounted) {
              setGiveawayState(stateData);
            }
          }

        } catch (error) {
          console.error("Error fetching overlay data:", error);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      // Initial fetch
      fetchData();

      // Poll every 1 second for fast updates
      pollInterval = setInterval(fetchData, 1000);
    };

    init();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [reviewerId]);

  if (loading && !currentTrack) {
    return null;
  }

  if (!currentTrack) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-transparent space-y-4">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-2xl max-w-md w-full text-center animate-pulse">
          <p className="text-white/60 font-medium">Waiting for next track...</p>
        </div>
        {giveawayState && (
          <div className="w-full max-w-md transform scale-90">
            <GiveawayProgressBar overrideState={giveawayState} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent p-8 space-y-6">
      <div className="bg-black/70 backdrop-blur-2xl border border-white/20 rounded-2xl p-5 shadow-2xl max-w-2xl w-full transform transition-all duration-500 hover:scale-105 relative overflow-hidden">

        <div className="flex flex-col space-y-2">

          {/* Header Row: Now Playing (Left) vs Submitted By (Right) */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">

            {/* Left: Now Playing + Animation */}
            <div className="flex items-center space-x-3">
              <div className="flex items-end space-x-1 h-5">
                {[0.4, 0.7, 1.0, 0.6, 0.8].map((delay, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-purple-400 rounded-full animate-music-bar"
                    style={{
                      height: '100%',
                      animation: `music-bar 0.8s ease-in-out infinite alternate`,
                      animationDelay: `${delay}s`
                    }}
                  />
                ))}
                <style>{`
                  @keyframes music-bar {
                    0% { height: 20%; opacity: 0.5; }
                    100% { height: 100%; opacity: 1; }
                  }
                `}</style>
              </div>
              <span className="text-sm font-bold text-purple-400 uppercase tracking-widest drop-shadow-md">Now Playing</span>
            </div>

            {/* Right: Submitted By (Enhanced) */}
            <div className="flex items-center space-x-3 bg-white/10 px-4 py-1.5 rounded-full border border-white/20 shadow-inner backdrop-blur-md">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">Submitted by</span>
              <div className="flex items-center space-x-2">
                {currentTrack.user?.avatar && !imageError ? (
                  <img
                    src={currentTrack.user.avatar}
                    alt={currentTrack.user.username}
                    className="w-6 h-6 rounded-full object-cover border-2 border-purple-500 shadow-sm"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center border-2 border-purple-400 shadow-sm">
                    <span className="text-xs font-bold text-white">
                      {currentTrack.user?.username?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <span className="text-sm font-bold text-white truncate max-w-[120px] drop-shadow-md">
                  {currentTrack.user?.username || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Track Info */}
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight drop-shadow-xl line-clamp-1 tracking-tight">
              {currentTrack.track_title || 'Untitled Track'}
            </h1>
            {currentTrack.artist && (
              <h2 className="text-xl md:text-2xl font-bold text-white/80 drop-shadow-lg line-clamp-1">
                {currentTrack.artist}
              </h2>
            )}
          </div>

        </div>
      </div>

      {/* Giveaway Bar */}
      {giveawayState && (
        <div className="w-full max-w-md transform scale-90 opacity-90 hover:opacity-100 transition-opacity">
          <GiveawayProgressBar overrideState={giveawayState} />
        </div>
      )}

      <GiveawayWinnerAnnouncement />
    </div>
  );
}
