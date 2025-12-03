import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Save, User, Music, Share2 } from 'lucide-react';

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

                </form>
            </div>
        </div>
    );
};

export default UserSettingsPage;
