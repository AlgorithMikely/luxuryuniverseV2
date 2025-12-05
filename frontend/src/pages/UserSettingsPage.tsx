import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Save, User, Music, Share2, AlertTriangle, Download, Trash2 } from 'lucide-react';

const UserSettingsPage = () => {
    const { user, checkAuth } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        artist_name: '',
        tiktok_username: '',
        instagram_handle: '',
        twitter_handle: '',
        youtube_channel: '',
        soundcloud_url: '',
        apple_music_url: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                artist_name: user.artist_name || '',
                tiktok_username: user.tiktok_username || '',
                instagram_handle: user.instagram_handle || '',
                twitter_handle: user.twitter_handle || '',
                youtube_channel: user.youtube_channel || '',
                soundcloud_url: user.soundcloud_url || '',
                apple_music_url: user.apple_music_url || ''
            });
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        console.log("DEBUG: Submitting User Settings:", formData);
        try {
            await api.patch('/user/me/settings', formData);
            toast.success("Settings updated successfully!");
            await checkAuth(true); // Refresh user data
        } catch (error) {
            console.error("Failed to update settings", error);
            toast.error("Failed to update settings.");
        } finally {
            setIsLoading(false);
        }
    };


    const handleExportData = async () => {
        try {
            const { data } = await api.get('/user/me/export');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `user_data_${user?.id}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success("Data export started");
        } catch (error) {
            console.error("Export failed", error);
            toast.error("Failed to export data");
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm("ARE YOU SURE? This action cannot be undone. Your account will be anonymized and you will lose access.")) {
            try {
                await api.delete('/user/me');
                toast.success("Account deleted.");
                // We need to access store directly or use the hook's logout but we can't call hook conditionally easily if we were outside component
                // internal function is fine
                // But wait, logout from useAuthStore is available? No, I need to destruct it.
                // I only destructured { user, checkAuth } in line 8.
                // I need to add logout there or use store directly.
                // I'll use store directly for safety if not destructured.
                useAuthStore.getState().logout();
                window.location.href = '/login';
            } catch (error) {
                console.error("Delete failed", error);
                toast.error("Failed to delete account");
            }
        }
    };

    if (!user) return <div className="p-8 text-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    User Settings
                </h1>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Profile Section */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <User className="w-6 h-6 text-blue-400" />
                            <h2 className="text-xl font-semibold">Profile</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={user.username}
                                    disabled
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                                <input
                                    type="text"
                                    value={user.email || ''}
                                    disabled
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Artist Identity */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <Music className="w-6 h-6 text-purple-400" />
                            <h2 className="text-xl font-semibold">Artist Identity</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Artist Name</label>
                                <input
                                    type="text"
                                    name="artist_name"
                                    value={formData.artist_name}
                                    onChange={handleChange}
                                    placeholder="e.g. Lil Nas X"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">This will be auto-filled when you submit tracks.</p>
                            </div>
                        </div>
                    </div>

                    {/* Socials */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <Share2 className="w-6 h-6 text-pink-400" />
                            <h2 className="text-xl font-semibold">Socials & Links</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">TikTok Handle</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-2 text-gray-500">@</span>
                                    <input
                                        type="text"
                                        name="tiktok_username"
                                        value={formData.tiktok_username}
                                        onChange={handleChange}
                                        placeholder="username"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-pink-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Instagram Handle</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-2 text-gray-500">@</span>
                                    <input
                                        type="text"
                                        name="instagram_handle"
                                        value={formData.instagram_handle}
                                        onChange={handleChange}
                                        placeholder="username"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-pink-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Twitter Handle</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-2 text-gray-500">@</span>
                                    <input
                                        type="text"
                                        name="twitter_handle"
                                        value={formData.twitter_handle}
                                        onChange={handleChange}
                                        placeholder="username"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-blue-400"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-700 mt-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">YouTube Channel URL</label>
                                <input
                                    type="text"
                                    name="youtube_channel"
                                    value={formData.youtube_channel}
                                    onChange={handleChange}
                                    placeholder="https://youtube.com/c/..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">SoundCloud URL</label>
                                <input
                                    type="text"
                                    name="soundcloud_url"
                                    value={formData.soundcloud_url}
                                    onChange={handleChange}
                                    placeholder="https://soundcloud.com/..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/30">
                        <div className="flex items-center gap-3 mb-6">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            <h2 className="text-xl font-semibold text-red-500">Danger Zone</h2>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            <button
                                type="button"
                                onClick={handleExportData}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg border border-gray-600 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Export My Data
                            </button>

                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-900 text-white font-medium rounded-lg transition-colors border border-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Account
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-4 text-center">
                            Deleting your account is permanent. Your data will be anonymized.
                        </p>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default UserSettingsPage;
