import React from 'react';
import { Play, Edit2, Clock } from 'lucide-react';
import { Submission } from '../types'; // We assume types are exported here, or we define locally

// Define props locally if global types are not perfectly matched yet
interface SubmissionItemProps {
  submission: Submission;
  onEdit: (submission: Submission) => void;
}

const SubmissionItem: React.FC<SubmissionItemProps> = ({ submission, onEdit }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'played':
      case 'reviewed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'playing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Generate a deterministic color/gradient for placeholder art based on track title
  const getPlaceholderGradient = (title: string) => {
    const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const hue = Math.abs(hash % 360);
    return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 40) % 360}, 70%, 40%))`;
  };

  const title = submission.track_title || submission.track_url;

  return (
    <div className="group flex items-center p-3 bg-gray-800/40 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg transition-all mb-2">
      {/* Album Art Placeholder */}
      <div
        className="w-12 h-12 rounded-md shadow-lg flex-shrink-0 mr-4 flex items-center justify-center relative overflow-hidden"
        style={{ background: getPlaceholderGradient(title) }}
      >
         {/* Hover Play Overlay */}
         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Play className="w-5 h-5 text-white fill-current" />
         </div>
         <span className="text-white font-bold text-xs opacity-50 select-none">{title.substring(0, 2).toUpperCase()}</span>
      </div>

      {/* Track Info */}
      <div className="flex-grow min-w-0 mr-4">
        <div className="flex items-center mb-1">
            <h4 className="text-white font-medium truncate text-sm sm:text-base" title={title}>{title}</h4>
             {submission.score !== null && submission.score !== undefined && (
                <span className="ml-2 text-xs font-bold bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded">
                    {submission.score}/10
                </span>
             )}
        </div>
        <div className="flex items-center text-xs text-gray-400 space-x-3">
            <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider ${getStatusColor(submission.status)}`}>
                {submission.status}
            </span>
            {submission.start_time && (
                <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> Start: {submission.start_time}
                </span>
            )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center">
        <button
            onClick={() => onEdit(submission)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition-colors"
            title="Edit Submission"
        >
            <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SubmissionItem;
