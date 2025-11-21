import React, { useState } from 'react';
import { Play, Edit2, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Submission } from '../types';

interface SubmissionItemProps {
  submissions: Submission[];
  onEdit: (submission: Submission) => void;
  onSkip: (submission: Submission) => void;
}

const SubmissionItem: React.FC<SubmissionItemProps> = ({ submissions, onEdit, onSkip }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use the most recent submission for main display info
  const mainSubmission = submissions.reduce((latest, current) =>
    new Date(current.submitted_at) > new Date(latest.submitted_at) ? current : latest
    , submissions[0]);

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

  const getPriorityBorder = (value: number) => {
    if (value >= 25) return 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
    if (value >= 20) return 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]';
    if (value >= 15) return 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]';
    if (value >= 10) return 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
    if (value >= 5) return 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
    return 'border-gray-700/50';
  };

  // Generate a deterministic color/gradient for placeholder art based on track title
  const getPlaceholderGradient = (title: string) => {
    const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const hue = Math.abs(hash % 360);
    return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 40) % 360}, 70%, 40%))`;
  };

  // Calculate average score
  const reviewedSubmissions = submissions.filter(s => s.score !== null && s.score !== undefined);
  const averageScore = reviewedSubmissions.length > 0
    ? (reviewedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / reviewedSubmissions.length).toFixed(1)
    : null;

  // Check if any submission in the group is pending and skipped (priority)
  const pendingPrioritySubmission = submissions.find(s => s.status === 'pending' && s.is_priority);

  const title = mainSubmission.track_title || mainSubmission.track_url;

  // Determine border style based on priority of pending item, or default
  const priorityStyle = pendingPrioritySubmission
    ? getPriorityBorder(pendingPrioritySubmission.priority_value)
    : 'border-gray-700/50';

  return (
    <div className={`group flex flex-col bg-gray-800/40 hover:bg-gray-700/50 border rounded-lg transition-all mb-2 overflow-hidden ${priorityStyle}`}>
      <div className="flex items-center p-3">
        {/* Album Art Placeholder */}
        <div
          className="w-12 h-12 rounded-md shadow-lg flex-shrink-0 mr-4 flex items-center justify-center relative overflow-hidden"
          style={{ background: getPlaceholderGradient(title) }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <Play className="w-5 h-5 text-white/90 relative z-10" />
        </div>

        <div className="flex-grow min-w-0 mr-4">
          <div className="flex items-center mb-1">
            <h4 className="text-white font-medium truncate text-sm sm:text-base" title={title}>{title}</h4>
            {averageScore && (
              <span className="ml-2 text-xs font-bold bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700">
                Score: {averageScore}/10
              </span>
            )}
          </div>
          <div className="flex items-center text-xs text-gray-400 space-x-3">
            <span className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {new Date(mainSubmission.submitted_at).toLocaleDateString()}
            </span>
            <span className={`px-1.5 py-0.5 rounded ${getStatusColor(mainSubmission.status)} capitalize`}>
              {mainSubmission.status}
            </span>
            {/* Show count if multiple */}
            {submissions.length > 1 && (
              <span className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                {submissions.length} Reviews
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Show Skip button if there is a pending submission that isn't already high priority */}
          {submissions.some(s => s.status === 'pending') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const pending = submissions.find(s => s.status === 'pending');
                if (pending) onSkip(pending);
              }}
              className="flex items-center px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 text-xs font-bold rounded transition-colors border border-yellow-600/30"
            >
              <Zap className="w-3 h-3 mr-1.5" />
              Buy Skip
            </button>
          )}

          <button
            onClick={() => onEdit(mainSubmission)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition-colors"
            title="Edit Submission"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition-colors"
            title={isExpanded ? "Hide Details" : "Show Details"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            {submissions.map(sub => (
              (sub.notes || sub.note || sub.score) && (
                <div key={sub.id} className="bg-gray-900/50 rounded p-3 text-sm text-gray-300 border border-gray-700/50">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2">
                      {sub.reviewer?.user?.avatar && sub.reviewer?.user?.discord_id ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${sub.reviewer.user.discord_id}/${sub.reviewer.user.avatar}.png`}
                          alt={sub.reviewer.user.username}
                          className="w-6 h-6 rounded-full object-cover border border-purple-500/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png";
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-purple-900/50 border border-purple-500/30 flex items-center justify-center text-xs text-purple-300 font-bold">
                          {(sub.reviewer?.user?.username || sub.reviewer?.tiktok_handle || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="font-bold text-purple-300 text-sm">
                        {sub.reviewer?.user?.username || sub.reviewer?.tiktok_handle || `Reviewer #${sub.reviewer_id}`}
                      </span>
                    </div>
                    {sub.score !== null && sub.score !== undefined && (
                      <span className="text-xs font-bold bg-gray-800 px-1.5 py-0.5 rounded text-white">
                        {sub.score}/10
                      </span>
                    )}
                  </div>
                  {sub.notes || sub.note ? (
                    <p className="whitespace-pre-wrap text-gray-400">{sub.notes || sub.note}</p>
                  ) : (
                    <p className="italic text-gray-600">No feedback provided.</p>
                  )}
                </div>
              )
            ))}
            {submissions.every(s => !s.notes && !s.note && s.score === null) && (
              <p className="text-center text-gray-500 text-sm py-2">No reviews available yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionItem;
