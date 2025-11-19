import React from 'react';
import { useParams } from 'react-router-dom';
import { useQueue } from '../hooks/useQueue';
import QueueList from './QueueList';
import NowPlayingCard from './NowPlayingCard';

const Overlay: React.FC = () => {
    const { reviewerId } = useParams<{ reviewerId: string }>();
    const id = parseInt(reviewerId || '0', 10);
    const { queue, history } = useQueue(id);

    // Find the currently playing track (first in history if status is played, or handled by backend logic)
    // Based on queue service, 'played' items are in history. The most recent one is likely the "now playing" one if we consider the top of history as current.
    // However, usually "now playing" is a distinct state or the last item moved to history.
    // Let's assume the first item in history is the "Now Playing" one for the overlay.
    const nowPlaying = history.length > 0 ? history[0] : null;

    if (!id) return <div>Invalid Reviewer ID</div>;

    return (
        <div className="min-h-screen bg-transparent p-8 flex flex-col space-y-6 w-full max-w-md">
            {/* Now Playing Section */}
            <div className="animate-fade-in">
                <NowPlayingCard submission={nowPlaying} />
            </div>

            {/* Queue Section */}
            <div className="bg-gray-900/80 backdrop-blur-md rounded-xl p-4 border border-gray-700/50 shadow-2xl">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-700 pb-2">
                    Up Next
                </h2>
                <QueueList queue={queue.slice(0, 5)} isReviewer={false} />
            </div>
        </div>
    );
};

export default Overlay;
