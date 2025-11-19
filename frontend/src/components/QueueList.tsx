import React from 'react';
import { Submission } from '../hooks/useQueue';

interface QueueListProps {
    queue: Submission[];
    isReviewer: boolean;
}

const QueueList: React.FC<QueueListProps> = ({ queue, isReviewer }) => {
    if (queue.length === 0) {
        return <div className="text-gray-400 text-center py-4">Queue is empty</div>;
    }

    return (
        <div className="space-y-2">
            {queue.map((submission, index) => (
                <div
                    key={submission.id}
                    className={`p-3 rounded-lg flex items-center justify-between ${submission.is_priority ? 'bg-yellow-900/20 border border-yellow-700/50' : 'bg-gray-800/50'
                        }`}
                >
                    <div className="flex items-center space-x-3">
                        <span className="text-gray-500 font-mono w-6">{index + 1}</span>
                        <div>
                            <div className="font-medium text-white truncate max-w-[200px]">
                                {submission.track_title}
                            </div>
                            <div className="text-sm text-gray-400">
                                by {submission.user.username}
                            </div>
                        </div>
                    </div>
                    {submission.is_priority && (
                        <span className="px-2 py-1 text-xs font-bold text-yellow-500 bg-yellow-900/30 rounded">
                            PRIORITY
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

export default QueueList;
