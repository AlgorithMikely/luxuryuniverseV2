import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { PriorityTier, ReviewerProfile } from '../types';
import { Save, Trash2, Plus, RotateCcw } from 'lucide-react';

const ReviewerSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, fetchUser } = useAuthStore();
    const [reviewerProfile, setReviewerProfile] = useState<ReviewerProfile | null>(null);

    // Form States
    const [tiktokHandle, setTiktokHandle] = useState('');
    const [discordChannelId, setDiscordChannelId] = useState('');
    const [tiers, setTiers] = useState<PriorityTier[]>([]);

    // Loading/Error States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // New Tier State
    const [newTierValue, setNewTierValue] = useState<number>(0);
    const [newTierLabel, setNewTierLabel] = useState('');
    const [newTierColor, setNewTierColor] = useState('gray');

    const colorOptions = [
        { name: 'Gray', value: 'gray' },
        { name: 'Green', value: 'green' },
        { name: 'Blue', value: 'blue' },
        { name: 'Purple', value: 'purple' },
        { name: 'Yellow', value: 'yellow' },
        { name: 'Red', value: 'red' },
        { name: 'Pink', value: 'pink' },
        { name: 'Cyan', value: 'cyan' },
    ];

    const defaultTiers: PriorityTier[] = [
        { value: 0, label: "Free", color: "gray" },
        { value: 5, label: "$5 Tier", color: "green" },
        { value: 10, label: "$10 Tier", color: "blue" },
        { value: 15, label: "$15 Tier", color: "purple" },
        { value: 20, label: "$20 Tier", color: "yellow" },
        { value: 25, label: "$25 Tier", color: "red" },
        { value: 50, label: "50+ Tier", color: "pink" },
    ];

    useEffect(() => {
        const loadData = async () => {
            if (!user?.reviewer_profile) return;

            try {
                // Fetch full settings to ensure we get the config with defaults
                const response = await api.get<ReviewerProfile>(`/${user.reviewer_profile.id}/settings`);
                const profile = response.data;

                setReviewerProfile(profile);
                setTiktokHandle(profile.tiktok_handle || '');
                setDiscordChannelId(profile.discord_channel_id || '');

                if (profile.configuration?.priority_tiers) {
                    setTiers(profile.configuration.priority_tiers);
                } else {
                    setTiers(defaultTiers);
                }
            } catch (err) {
                console.error("Failed to load reviewer settings", err);
                setMessage({ text: "Failed to load settings.", type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            loadData();
        }
    }, [user]);

    const handleSave = async () => {
        if (!reviewerProfile) return;
        setIsSaving(true);
        setMessage(null);

        try {
            const updateData = {
                tiktok_handle: tiktokHandle,
                discord_channel_id: discordChannelId,
                configuration: {
                    priority_tiers: tiers
                }
            };

            await api.patch(`/${reviewerProfile.id}/settings`, updateData);
            setMessage({ text: "Settings saved successfully!", type: 'success' });
            await fetchUser(); // Refresh global user state
        } catch (err) {
            console.error("Failed to save settings", err);
            setMessage({ text: "Failed to save settings.", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddTier = () => {
        if (tiers.some(t => t.value === newTierValue)) {
            setMessage({ text: `A tier with value ${newTierValue} already exists.`, type: 'error' });
            return;
        }
        const newTier: PriorityTier = {
            value: newTierValue,
            label: newTierLabel || `${newTierValue} Tier`,
            color: newTierColor
        };

        // Sort tiers by value
        const updatedTiers = [...tiers, newTier].sort((a, b) => a.value - b.value);
        setTiers(updatedTiers);

        // Reset form
        setNewTierValue(0);
        setNewTierLabel('');
        setNewTierColor('gray');
    };

    const handleDeleteTier = (value: number) => {
        setTiers(tiers.filter(t => t.value !== value));
    };

    const handleResetTiers = () => {
        if (window.confirm("Are you sure you want to reset priority tiers to defaults?")) {
            setTiers(defaultTiers);
        }
    };

    if (isLoading) return <div className="p-10 text-center text-white">Loading settings...</div>;
    if (!user?.reviewer_profile) return <div className="p-10 text-center text-white">You must be a reviewer to access this page.</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-4">Reviewer Settings</h1>

                {message && (
                    <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-900/50 text-green-200 border border-green-800' : 'bg-red-900/50 text-red-200 border border-red-800'}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-8">
                    {/* General Information */}
                    <section className="bg-gray-800 rounded-xl p-6 shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 text-purple-400">General Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">TikTok Handle</label>
                                <input
                                    type="text"
                                    value={tiktokHandle}
                                    onChange={(e) => setTiktokHandle(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                                    placeholder="e.g. my_tiktok_user"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Discord Channel ID</label>
                                <input
                                    type="text"
                                    value={discordChannelId}
                                    onChange={(e) => setDiscordChannelId(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                                    placeholder="e.g. 123456789012345678"
                                />
                                <p className="text-xs text-gray-500 mt-1">The ID of the channel the bot listens to.</p>
                            </div>
                        </div>
                    </section>

                    {/* Priority Tiers Configuration */}
                    <section className="bg-gray-800 rounded-xl p-6 shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-purple-400">Skip Line Configuration</h2>
                            <button
                                onClick={handleResetTiers}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                            >
                                <RotateCcw size={14} /> Reset Defaults
                            </button>
                        </div>

                        {/* Tier List */}
                        <div className="bg-gray-700/50 rounded-lg overflow-hidden mb-6">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-700 text-gray-300 text-sm">
                                        <th className="p-3 font-medium">Value</th>
                                        <th className="p-3 font-medium">Label</th>
                                        <th className="p-3 font-medium">Theme</th>
                                        <th className="p-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tiers.map((tier) => (
                                        <tr key={tier.value} className="border-t border-gray-700 hover:bg-gray-700/30 transition-colors">
                                            <td className="p-3">{tier.value}</td>
                                            <td className="p-3">{tier.label}</td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-3 h-3 rounded-full`} style={{ backgroundColor: tier.color === 'gray' ? 'var(--gray-400, #9ca3af)' : `var(--${tier.color}-500)` }}></span>
                                                    <span className="capitalize text-sm text-gray-300">{tier.color}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteTier(tier.value)}
                                                    className="text-red-400 hover:text-red-300 p-1"
                                                    title="Remove Tier"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Add New Tier */}
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-300 mb-3">Add New Tier</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 mb-1">Priority Value</label>
                                    <input
                                        type="number"
                                        value={newTierValue}
                                        onChange={(e) => setNewTierValue(parseInt(e.target.value) || 0)}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                                    <input
                                        type="text"
                                        value={newTierLabel}
                                        onChange={(e) => setNewTierLabel(e.target.value)}
                                        placeholder="e.g. Super Skip"
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 mb-1">Theme</label>
                                    <select
                                        value={newTierColor}
                                        onChange={(e) => setNewTierColor(e.target.value)}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    >
                                        {colorOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={handleAddTier}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded flex items-center gap-2 text-sm h-10"
                                >
                                    <Plus size={16} /> Add
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Action Buttons */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="mr-4 px-6 py-2 rounded text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`px-8 py-2 rounded bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold shadow-lg hover:from-purple-500 hover:to-blue-500 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewerSettingsPage;
