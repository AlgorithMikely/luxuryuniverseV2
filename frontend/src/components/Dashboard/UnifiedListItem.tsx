import React from 'react';
import { Submission } from '../../types';
import { Star, Bookmark, Zap } from 'lucide-react';

interface UnifiedListItemProps {
  submission: Submission;
  isActive: boolean;
  isBookmarked?: boolean;
  isSpotlighted?: boolean;
  onClick: (submission: Submission) => void;
}

const UnifiedListItem: React.FC<UnifiedListItemProps> = ({
  submission,
  isActive,
  isBookmarked,
  isSpotlighted,
  onClick,
}) => {
  return (
    <li
      onClick={() => onClick(submission)}
      className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${isActive
        ? 'bg-purple-900/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
        : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10'
        }`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
            {submission.track_title || 'Untitled Track'}
          </h4>
          <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
            <span>{submission.user?.username || 'Unknown'}</span>
            {submission.rating && (
              <span className="flex items-center gap-1 text-yellow-400/80">
                <Star className="w-3 h-3 fill-current" /> {submission.rating}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Icons for status */}
          {isBookmarked && <Bookmark className="w-3 h-3 text-blue-400" />}
          {isSpotlighted && <Zap className="w-3 h-3 text-yellow-400" />}
        </div>
      </div>
      {submission.note && (
        <p className="text-xs text-white/40 mt-2 line-clamp-1 italic">
          "{submission.note}"
        </p>
      )}
    </li>
  );
};

export default UnifiedListItem;
