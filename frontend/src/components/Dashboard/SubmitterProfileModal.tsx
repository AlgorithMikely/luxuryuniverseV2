import React, { useEffect, useState } from 'react';
import { X, Star, BarChart2, Music, Calendar } from 'lucide-react';
import api from '../../services/api';
import { SubmitterStats } from '../../types';
import toast from 'react-hot-toast';

interface SubmitterProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number | null;
}

const SubmitterProfileModal: React.FC<SubmitterProfileModalProps> = ({ isOpen, onClose, userId }) => {
    const [stats, setStats] = useState<SubmitterStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            fetchStats(userId);
        } else {
            setStats(null);
        }
    }, [isOpen, userId]);

    const fetchStats = async (id: number) => {
        setIsLoading(true);
        try {
            const { data } = await api.get<SubmitterStats>(`/user/${id}/stats`);
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch submitter stats:", error);
            toast.error("Failed to load profile.");
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                    <h2 className="text-xl font-bold text-white">Submitter Profile</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-grow flex items-center justify-center p-12">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : stats ? (
                    <div className="overflow-y-auto custom-scrollbar p-6 space-y-6">

                        {/* User Info */}
                        <div className="flex items-center gap-4">
                            <img
                                src={stats.user.avatar && stats.user.discord_id ? `https://cdn.discordapp.com/avatars/${stats.user.discord_id}/${stats.user.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png"}
                                alt={stats.user.username}
                                className="w-20 h-20 rounded-full border-2 border-purple-500 shadow-lg"
                            />
                            <div>
                                <h3 className="text-2xl font-bold text-white">{stats.user.username}</h3>
                                <div className="flex gap-2 mt-2">
                                    {stats.genres.slice(0, 5).map(genre => (
                                        <span key={genre} className="text-xs bg-purple-900/40 text-purple-300 px-2 py-1 rounded-full border border-purple-500/20">
                                            {genre}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center">
                                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                                    <Star className="w-5 h-5 fill-current" />
                                    <span className="font-bold text-lg">{stats.average_review_score.toFixed(1)}</span>
                                </div>
                                <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Avg Score</span>
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center">
                                <div className="flex items-center gap-2 text-green-400 mb-1">
                                    <BarChart2 className="w-5 h-5" />
                                    <span className="font-bold text-lg">{stats.average_poll_result.toFixed(1)}%</span>
                                </div>
                                <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Avg Poll W</span>
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center">
                                <div className="flex items-center gap-2 text-blue-400 mb-1">
                                    <Music className="w-5 h-5" />
                                    <span className="font-bold text-lg">{stats.user.total_submissions_graded || 0}</span>
                                </div>
                                <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Submissions</span>
                            </div>
                        </div>

                        {/* Recent Submissions */}
                        <div>
                            <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-purple-400" />
                                Recent Submissions
                            </h4>
                            <div className="space-y-2">
                                {stats.submissions.length === 0 ? (
                                    <p className="text-gray-500 italic">No submissions found.</p>
                                ) : (
                                    stats.submissions.map(sub => (
                                        <div key={sub.id} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center hover:bg-gray-750 transition-colors">
                                            <div className="min-w-0">
                                                <div className="font-medium text-white truncate">{sub.track_title || "Untitled"}</div>
                                                <div className="text-xs text-gray-400 flex gap-2">
                                                    <span>{new Date(sub.submitted_at).toLocaleDateString()}</span>
                                                    {sub.genre && <span>• {sub.genre}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {sub.score !== null && (
                                                    <div className="text-sm font-bold text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-500/20">
                                                        {sub.score}
                                                    </div>
                                                )}
                                                {sub.poll_result_w_percent !== null && (
                                                    <div className={`text-xs font-bold px-2 py-0.5 rounded border ${sub.poll_result_w_percent && sub.poll_result_w_percent >= 50 ? 'text-blue-400 bg-blue-900/20 border-blue-500/20' : 'text-gray-400 bg-gray-800 border-gray-600'}`}>
                                                        {sub.poll_result_w_percent}% W
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        User not found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubmitterProfileModal;
