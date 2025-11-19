import React, { useState, useEffect } from 'react';
import { X, Save, Star } from 'lucide-react';
import { Submission } from '../../types';
import { useQueueStore } from '../../stores/queueStore';

interface SubmissionEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    submission: Submission | null;
}

const SubmissionEditModal: React.FC<SubmissionEditModalProps> = ({ isOpen, onClose, submission }) => {
    const { updateSubmission } = useQueueStore();
    const [note, setNote] = useState('');
    const [rating, setRating] = useState<number>(0);

    useEffect(() => {
        if (submission) {
            setNote(submission.note || '');
            setRating(submission.rating || 0);
        }
    }, [submission]);

    if (!isOpen || !submission) return null;

    const handleSave = () => {
        updateSubmission({
            ...submission,
            note,
            rating: rating === 0 ? undefined : rating
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <h3 className="text-lg font-bold text-white truncate pr-4">
                        Edit Submission
                    </h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Track Info */}
                    <div>
                        <h4 className="text-white font-semibold text-lg truncate">{submission.track_title || submission.track_url}</h4>
                        <p className="text-white/50 text-sm">Submitted by {submission.user?.username || 'Unknown'}</p>
                    </div>

                    {/* Rating */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Rating</label>
                            <span className="text-2xl font-bold text-purple-400">{rating > 0 ? rating : '-'}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => {
                                const isSelected = Math.floor(rating) === star;
                                return (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isSelected ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-105 ring-2 ring-purple-400/50' : 'bg-white/5 text-white/20 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="font-bold text-sm">{star}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quarter Points (only show if a whole number is selected) */}
                        {rating > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <span className="text-xs font-medium text-white/30 mr-2">Fine tune:</span>
                                {[0, 0.25, 0.5, 0.75].map((fraction) => {
                                    const baseScore = Math.floor(rating);
                                    const targetScore = baseScore + fraction;
                                    const isSelected = rating === targetScore;

                                    return (
                                        <button
                                            key={fraction}
                                            type="button"
                                            onClick={() => setRating(targetScore)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected
                                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                                                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            +{fraction === 0 ? '0' : fraction}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex justify-between text-xs text-white/30 px-1">
                            <span>1 (Poor)</span>
                            <span>10 (Masterpiece)</span>
                        </div>
                    </div>

                    {/* Note */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Note</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add a personal note about this track..."
                            className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-600/20 transition-all active:scale-95"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubmissionEditModal;
