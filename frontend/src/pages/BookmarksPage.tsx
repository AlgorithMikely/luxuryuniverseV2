import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useQueueStore } from '../stores/queueStore';
import api from '../services/api';
import { Submission } from '../types';
import WebPlayer from '../components/Dashboard/WebPlayer';
import PlaylistModal from '../components/Dashboard/PlaylistModal';
import { Play, Search, Tag, Filter, Music, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

import SubmitterProfileModal from '../components/Dashboard/SubmitterProfileModal';

const BookmarksPage: React.FC = () => {
    const { user } = useAuthStore();
    const { setCurrentTrack, currentTrack } = useQueueStore();
    const [bookmarks, setBookmarks] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Modal State
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);

    // Submitter Profile Modal State
    const [isSubmitterModalOpen, setIsSubmitterModalOpen] = useState(false);
    const [selectedSubmitterId, setSelectedSubmitterId] = useState<number | null>(null);

    useEffect(() => {
        const fetchBookmarks = async () => {
            if (!user?.reviewer_profile?.id) return;
            try {
                const { data } = await api.get<Submission[]>(`/reviewer/${user.reviewer_profile.id}/bookmarks`);
                setBookmarks(data);
            } catch (error) {
                console.error("Failed to fetch bookmarks:", error);
                toast.error("Failed to load bookmarks.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchBookmarks();
    }, [user?.reviewer_profile?.id]);

    // Extract unique tags for playlists
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        bookmarks.forEach(sub => {
            if (sub.tags) {
                sub.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }, [bookmarks]);

    // Filter bookmarks
    const filteredBookmarks = useMemo(() => {
        return bookmarks.filter(sub => {
            const matchesSearch = (
                (sub.track_title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (sub.artist?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (sub.user.username.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            const matchesTag = selectedTag ? sub.tags?.includes(selectedTag) : true;
            return matchesSearch && matchesTag;
        });
    }, [bookmarks, searchQuery, selectedTag]);

    const handlePlay = (submission: Submission) => {
        setCurrentTrack(submission);
    };

    const openPlaylistModal = (submissionId: number) => {
        setSelectedSubmissionId(submissionId);
        setIsPlaylistModalOpen(true);
    };

    const openSubmitterProfile = (userId: number) => {
        setSelectedSubmitterId(userId);
        setIsSubmitterModalOpen(true);
    };

    const handleAddTag = async (newTag: string) => {
        if (!user?.reviewer_profile?.id || !selectedSubmissionId) return;

        const submissionId = selectedSubmissionId; // Capture for closure

        try {
            // Optimistic update
            const updatedBookmarks = bookmarks.map(b => {
                if (b.id === submissionId) {
                    const currentTags = b.tags || [];
                    if (!currentTags.includes(newTag)) {
                        return { ...b, tags: [...currentTags, newTag] };
                    }
                }
                return b;
            });
            setBookmarks(updatedBookmarks);

            // API Call
            const submission = bookmarks.find(b => b.id === submissionId);
            if (submission) {
                const currentTags = submission.tags || [];
                // Prevent duplicates
                if (currentTags.includes(newTag)) {
                    toast.success(`Already in playlist: ${newTag}`);
                    return;
                }
                const updatedTags = [...currentTags, newTag];
                await api.patch(`/reviewer/${user.reviewer_profile.id}/queue/${submissionId}`, {
                    tags: updatedTags
                });
                toast.success(`Added to playlist: ${newTag}`);
            }
        } catch (error) {
            console.error("Failed to add tag:", error);
            toast.error("Failed to update playlist.");
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen text-white">Loading bookmarks...</div>;
    }

    if (!user?.reviewer_profile) {
        return <div className="flex items-center justify-center h-screen text-white">You must be a reviewer to view this page.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header & Player */}
                <div className="flex flex-col gap-6">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Music className="w-8 h-8 text-purple-500" />
                        My Bookmarks
                    </h1>

                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                        <WebPlayer />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar - Playlists/Tags */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-purple-400" />
                                Playlists
                            </h2>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setSelectedTag(null)}
                                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedTag === null ? 'bg-purple-600 text-white' : 'hover:bg-gray-700 text-gray-300'
                                        }`}
                                >
                                    All Tracks
                                </button>
                                {allTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setSelectedTag(tag)}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${selectedTag === tag ? 'bg-purple-600 text-white' : 'hover:bg-gray-700 text-gray-300'
                                            }`}
                                    >
                                        <Tag className="w-4 h-4" />
                                        {tag}
                                    </button>
                                ))}
                                {allTags.length === 0 && (
                                    <p className="text-gray-500 text-sm italic">No playlists created yet.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content - List */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search bookmarks by title, artist, or user..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            />
                        </div>

                        {/* Bookmarks List */}
                        <div className="space-y-3">
                            {filteredBookmarks.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <p>No bookmarks found matching your criteria.</p>
                                </div>
                            ) : (
                                filteredBookmarks.map(sub => (
                                    <div key={sub.id} className={`bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-purple-500/50 transition-all group ${currentTrack?.id === sub.id ? 'border-purple-500 ring-1 ring-purple-500/50' : ''}`}>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="flex flex-col gap-2 items-center">
                                                    {/* Play Button / Art */}
                                                    <button
                                                        onClick={() => handlePlay(sub)}
                                                        className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-900 to-gray-900 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform relative overflow-hidden shadow-lg"
                                                    >
                                                        {currentTrack?.id === sub.id ? (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-purple-600/50">
                                                                <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                                                            </div>
                                                        ) : (
                                                            <Play className="w-8 h-8 text-white/50 group-hover:text-white transition-colors" />
                                                        )}
                                                    </button>

                                                    {/* Submitter Avatar & Name (Moved here) */}
                                                    <button
                                                        onClick={() => openSubmitterProfile(sub.user.id)}
                                                        className="flex flex-col items-center gap-1 group/submitter"
                                                    >
                                                        <img
                                                            src={sub.user.avatar ? `https://cdn.discordapp.com/avatars/${sub.user.discord_id}/${sub.user.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png"}
                                                            alt={sub.user.username}
                                                            className="w-8 h-8 rounded-full border border-gray-700 group-hover/submitter:border-purple-500 transition-colors"
                                                        />
                                                        <span className="text-[10px] text-gray-400 font-medium group-hover/submitter:text-white transition-colors max-w-[80px] truncate text-center">
                                                            {sub.user.username}
                                                        </span>
                                                    </button>
                                                </div>

                                                {/* Main Info */}
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-bold text-lg truncate text-white">{sub.track_title || "Untitled Track"}</h3>
                                                            {/* Artist Name under Title */}
                                                            {sub.artist && (
                                                                <div className="text-sm text-gray-400 font-medium mt-0.5">
                                                                    {sub.artist}
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-2 mt-2">
                                                                {sub.genre && (
                                                                    <span className="text-xs text-purple-300 bg-purple-900/30 px-2 py-1 rounded-full border border-purple-500/20">
                                                                        {sub.genre}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(sub.submitted_at).toLocaleDateString()}
                                                            </div>
                                                            {sub.score !== null && sub.score !== undefined && (
                                                                <div className="flex items-center gap-1 bg-green-900/30 text-green-400 px-2 py-0.5 rounded text-xs font-bold border border-green-500/20">
                                                                    <span className="text-[10px] uppercase text-green-500/70">Score</span>
                                                                    {sub.score}/10
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Stats Grid */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                                                        {/* User Stats */}
                                                        <div className="bg-gray-900/30 rounded p-2 border border-gray-700/30 flex flex-col">
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Avg Score</span>
                                                            <span className="text-sm font-medium text-white">
                                                                {sub.user.average_review_score ? Number(sub.user.average_review_score).toFixed(1) : '-'}
                                                            </span>
                                                        </div>
                                                        <div className="bg-gray-900/30 rounded p-2 border border-gray-700/30 flex flex-col">
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Submissions</span>
                                                            <span className="text-sm font-medium text-white">
                                                                {sub.user.total_submissions_graded || 0}
                                                            </span>
                                                        </div>

                                                        {/* Submission Stats */}
                                                        <div className="bg-gray-900/30 rounded p-2 border border-gray-700/30 flex flex-col">
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Poll Result</span>
                                                            <span className={`text-sm font-medium ${sub.poll_result_w_percent && sub.poll_result_w_percent >= 50 ? 'text-green-400' : 'text-gray-400'}`}>
                                                                {sub.poll_result_w_percent ? `${sub.poll_result_w_percent}% W` : '-'}
                                                            </span>
                                                        </div>
                                                        <div className="bg-gray-900/30 rounded p-2 border border-gray-700/30 flex flex-col">
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Viewers</span>
                                                            <span className="text-sm font-medium text-white">
                                                                {sub.average_concurrent_viewers || '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tags / Actions Footer */}
                                            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-700/50">
                                                {sub.tags?.map(tag => (
                                                    <span key={tag} className="px-2 py-0.5 bg-purple-900/30 text-purple-300 text-xs rounded-full border border-purple-500/20 flex items-center gap-1">
                                                        <Tag className="w-3 h-3" />
                                                        {tag}
                                                    </span>
                                                ))}

                                                <button
                                                    onClick={() => openPlaylistModal(sub.id)}
                                                    className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-full transition-colors flex items-center gap-1"
                                                >
                                                    + Add to Playlist
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Playlist Modal */}
            <PlaylistModal
                isOpen={isPlaylistModalOpen}
                onClose={() => setIsPlaylistModalOpen(false)}
                onSelect={handleAddTag}
                existingTags={allTags}
            />

            {/* Submitter Profile Modal */}
            <SubmitterProfileModal
                isOpen={isSubmitterModalOpen}
                onClose={() => setIsSubmitterModalOpen(false)}
                userId={selectedSubmitterId}
            />
        </div>
    );
};

export default BookmarksPage;
