import React from 'react';
import { Submission } from '../types';

interface NowPlayingCardProps {
    submission: Submission | null;
    onNext?: () => void;
    isReviewer?: boolean;
}

const NowPlayingCard: React.FC<NowPlayingCardProps> = ({ submission, onNext, isReviewer }) => {
    if (!submission) {
        return (
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 flex items-center justify-center h-48">
                <div className="text-gray-400">No track playing</div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-xl p-6 shadow-lg border border-indigo-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-32 h-32 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">
                            Now Playing
                        </h2>
                        <h1 className="text-2xl font-bold text-white truncate max-w-md">
                            {submission.track_title}
                        </h1>
                        <p className="text-indigo-200">
                            Submitted by <span className="font-semibold text-white">{submission.user.username}</span>
                        </p>
                    </div>
                    {submission.is_priority && (
                        <span className="px-3 py-1 text-xs font-bold text-yellow-400 bg-yellow-900/40 rounded-full border border-yellow-700/50">
                            PRIORITY
                        </span>
                    )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                    <a
                        href={submission.track_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        Open Link
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>

                    {isReviewer && onNext && (
                        <button
                            onClick={onNext}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-green-900/20"
                        >
                            Next Track
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NowPlayingCard;
