import React, { useState } from 'react';
import { X, Music, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SubmissionSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    submissions: any[];
    onSelect: (submissions: any[]) => void;
    onCreateNew: () => void;
}

const SubmissionSelectionModal: React.FC<SubmissionSelectionModalProps> = ({ isOpen, onClose, submissions, onSelect, onCreateNew }) => {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const toggleSelection = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            if (selectedIds.length < 3) {
                setSelectedIds([...selectedIds, id]);
            }
        }
    };

    const handleContinue = () => {
        const selectedSubmissions = submissions.filter(s => selectedIds.includes(s.submission_id));
        onSelect(selectedSubmissions);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-white">Select Submissions</h3>
                                <p className="text-sm text-gray-400">Choose up to 3 tracks to upgrade</p>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-3 flex-grow">
                            <button
                                onClick={onCreateNew}
                                className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-all group text-left mb-4"
                            >
                                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                    <Plus size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-100">Create New Submission</h4>
                                    <p className="text-sm text-blue-300/70">Submit a new track to the queue</p>
                                </div>
                            </button>

                            <div className="space-y-3">
                                {submissions.map((sub) => {
                                    const isSelected = selectedIds.includes(sub.submission_id);
                                    return (
                                        <div
                                            key={sub.submission_id}
                                            onClick={() => toggleSelection(sub.submission_id)}
                                            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden
                                                ${isSelected
                                                    ? 'bg-purple-500/10 border-purple-500/50'
                                                    : 'bg-gray-800/50 border-white/5 hover:bg-gray-800 hover:border-white/10'
                                                }
                                            `}
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                                ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-600'}
                                            `}>
                                                {isSelected && <Check size={14} className="text-white" />}
                                            </div>

                                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                                                {sub.cover_art_url ? (
                                                    <img src={sub.cover_art_url} alt={sub.track_title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                        <Music size={20} />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-white truncate">
                                                    {sub.track_title || "Untitled Track"}
                                                </h4>
                                                <p className="text-sm text-gray-400 truncate">
                                                    {sub.artist || "Unknown Artist"}
                                                </p>
                                            </div>

                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${sub.is_priority
                                                        ? 'bg-purple-500/20 text-purple-300'
                                                        : 'bg-gray-700 text-gray-400'
                                                    }`}>
                                                    {sub.is_priority ? `Priority ${sub.priority_value}` : 'Standard'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 bg-gray-900/50 shrink-0">
                            <button
                                onClick={handleContinue}
                                disabled={selectedIds.length === 0}
                                className={`w-full py-3 rounded-xl font-bold text-lg shadow-lg transition-all
                                    ${selectedIds.length === 0
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-[1.02]'
                                    }
                                `}
                            >
                                Continue with {selectedIds.length} Track{selectedIds.length !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SubmissionSelectionModal;
