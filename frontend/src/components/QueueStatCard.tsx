import React from 'react';
import { Clock, ListMusic, ToggleLeft, ToggleRight } from 'lucide-react';

interface QueueStatCardProps {
  queueLength: number;
  avgWaitTime: number;
  status: 'open' | 'closed';
  onToggleStatus?: () => void;
  isReviewer?: boolean;
}

const QueueStatCard: React.FC<QueueStatCardProps> = ({ queueLength, avgWaitTime, status, onToggleStatus, isReviewer }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-xl p-6 shadow-lg text-white relative">
      {status === 'open' && (
         <span className="absolute top-4 right-4 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
         </span>
      )}

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold flex items-center">
            <ListMusic className="w-5 h-5 mr-2 text-blue-400" />
            Queue Status
        </h3>
        {isReviewer && onToggleStatus && (
            <button onClick={onToggleStatus} className="focus:outline-none transition-transform active:scale-95">
                {status === 'open' ? (
                    <div className="flex items-center text-green-400">
                        <span className="mr-2 text-sm font-medium">Open</span>
                        <ToggleRight className="w-8 h-8" />
                    </div>
                ) : (
                    <div className="flex items-center text-red-400">
                        <span className="mr-2 text-sm font-medium">Closed</span>
                        <ToggleLeft className="w-8 h-8" />
                    </div>
                )}
            </button>
        )}
        {!isReviewer && (
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${status === 'open' ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-red-900/30 text-red-400 border border-red-900'}`}>
                {status}
            </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900/50 p-3 rounded-lg">
            <p className="text-gray-400 text-xs uppercase">Waiting</p>
            <p className="text-2xl font-bold text-white">{queueLength}</p>
            <p className="text-xs text-gray-500">tracks</p>
        </div>
        <div className="bg-gray-900/50 p-3 rounded-lg">
            <p className="text-gray-400 text-xs uppercase">Est. Wait</p>
            <div className="flex items-baseline">
                <p className="text-2xl font-bold text-white">{avgWaitTime}</p>
                <span className="text-xs text-gray-500 ml-1">mins</span>
            </div>
            <div className="flex items-center text-xs text-blue-400 mt-1">
                <Clock className="w-3 h-3 mr-1" />
                <span>approx.</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default QueueStatCard;
