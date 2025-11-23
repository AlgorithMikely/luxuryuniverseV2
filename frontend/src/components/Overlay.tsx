import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Submission } from '../types';

export default function Overlay() {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const [currentTrack, setCurrentTrack] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

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

    const fetchCurrentTrack = async () => {
      try {
        // We use fetch directly to avoid the interceptors in api.ts that might handle auth errors unexpectedly for a public endpoint,
        // although usually 401s are handled. But for an overlay, simplicity is key.
        // Add timestamp to prevent caching
        const response = await fetch(`/api/reviewer/${reviewerId}/queue/current?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentTrack(data); // data can be null if no track is playing
        } else {
          console.error("Failed to fetch current track");
        }
      } catch (error) {
        console.error("Error fetching current track:", error);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchCurrentTrack();

    // Poll every 5 seconds
    const interval = setInterval(fetchCurrentTrack, 5000);

    return () => clearInterval(interval);
  }, [reviewerId]);

  if (loading && !currentTrack) {
      // Optional: Show nothing or a loader while initially loading
      return null;
  }

  if (!currentTrack) {
    // Show a placeholder or nothing if no track is playing
    return (
        <div className="min-h-screen flex items-center justify-center bg-transparent">
             <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-2xl max-w-md w-full text-center animate-pulse">
                <p className="text-white/60 font-medium">Waiting for next track...</p>
             </div>
        </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-8">
      <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl max-w-2xl w-full transform transition-all duration-500 hover:scale-105">
        <div className="flex flex-col space-y-4">

            {/* Header / Label */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Now Playing</span>
                <span className="text-xs font-medium text-white/40">Submitted by {currentTrack.user?.username || 'Unknown'}</span>
            </div>

            {/* Track Info */}
            <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight drop-shadow-lg line-clamp-2">
                    {currentTrack.track_title || 'Untitled Track'}
                </h1>
                {currentTrack.artist && (
                    <h2 className="text-xl md:text-2xl font-medium text-white/80 drop-shadow-md line-clamp-1">
                        {currentTrack.artist}
                    </h2>
                )}
            </div>

             {/* Progress / Extra Info (Optional, if we had duration) */}
             {/* <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-4">
                 <div className="bg-purple-500 h-full w-1/2"></div>
             </div> */}

        </div>
      </div>
    </div>
  );
}
