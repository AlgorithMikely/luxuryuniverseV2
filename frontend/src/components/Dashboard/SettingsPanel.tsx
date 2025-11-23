import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import api from '../../services/api';
import { PriorityTier, ReviewerProfile } from '../../types';

interface SettingsPanelProps {
    reviewerId?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ reviewerId }) => {
    const { activeSession, fetchActiveSession } = useSessionStore();
    const [tiers, setTiers] = useState<PriorityTier[]>([
        { value: 5, label: '$5 Tier', color: 'green' },
        { value: 10, label: '$10 Tier', color: 'blue' },
        { value: 15, label: '$15 Tier', color: 'purple' },
        { value: 20, label: '$20 Tier', color: 'yellow' },
        { value: 25, label: '$25+ Tier', color: 'red' },
        { value: 50, label: '50+ Tier', color: 'pink' },
    ]);
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);

    useEffect(() => {
        const loadReviewerSettings = async () => {
            if (!reviewerId) return;
            try {
                const response = await api.get<ReviewerProfile>(`/reviewer/${reviewerId}/settings`);
                if (response.data.configuration?.priority_tiers) {
                    // Filter out 0 (Free) as it is handled separately
                    setTiers(response.data.configuration.priority_tiers.filter(t => t.value > 0).sort((a, b) => a.value - b.value));
                }
                setBio(response.data.bio || '');
                setAvatarUrl(response.data.avatar_url || '');
            } catch (err) {
                console.error("Failed to load reviewer settings for session panel", err);
            }
        };
        loadReviewerSettings();
    }, [reviewerId]);

    const handleSaveBio = async () => {
        if (!reviewerId) return;
        try {
            await api.patch(`/reviewer/${reviewerId}/settings`, { bio });
            // Optionally show success toast
        } catch (err) {
            console.error("Failed to save bio", err);
        }
    };

    const handleSyncAvatar = async () => {
        if (!reviewerId) return;
        setIsLoadingAvatar(true);
        try {
            const response = await api.post<ReviewerProfile>(`/reviewer/${reviewerId}/sync-avatar`);
            setAvatarUrl(response.data.avatar_url || '');
        } catch (err) {
            console.error("Failed to sync avatar", err);
            alert("Failed to sync avatar from Discord server. Ensure the bot is in the server.");
        } finally {
            setIsLoadingAvatar(false);
        }
    };

    const toggleGate = async (tier: number) => {
        if (!activeSession) return;
        const currentTiers = activeSession.open_queue_tiers || [];
        let newTiers;
        if (currentTiers.includes(tier)) {
            newTiers = currentTiers.filter(t => t !== tier);
        } else {
            newTiers = [...currentTiers, tier];
        }

        try {
            const url = reviewerId ? `/sessions/${activeSession.id}?reviewer_id=${reviewerId}` : `/sessions/${activeSession.id}`;
            await api.patch(url, { open_queue_tiers: newTiers });
            await fetchActiveSession(reviewerId);
        } catch (err) {
            console.error("Failed to update session tiers", err);
        }
    };

    if (!activeSession) {
        return (
            <div className="text-center text-gray-400 mt-10">
                <p>No active session.</p>
                <p className="text-sm">Start a session to configure settings.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 text-white">Reviewer Profile</h3>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Avatar</label>
                    <div className="flex items-center space-x-4">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Reviewer Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-purple-500" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-gray-400">No Img</div>
                        )}
                        <button
                            onClick={handleSyncAvatar}
                            disabled={isLoadingAvatar}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
                        >
                            {isLoadingAvatar ? 'Syncing...' : 'Sync from Discord Server'}
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                    <textarea
                        className="w-full bg-gray-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Write a bio..."
                    />
                </div>
                <button
                    onClick={handleSaveBio}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                >
                    Save Bio
                </button>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 text-white">Queue Configuration</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Manage which submission tiers are currently open for this session.
                </p>

                <div className="space-y-3">
                    {/* Free Tier */}
                    <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                        <span className="text-white font-medium">Free Submissions</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={activeSession.open_queue_tiers?.includes(0) || false}
                                onChange={() => toggleGate(0)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {/* Paid Tiers */}
                    {tiers.map((tier) => (
                        <div key={tier.value} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                            <span className="text-white font-medium">{tier.label}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={activeSession.open_queue_tiers?.includes(tier.value) || false}
                                    onChange={() => toggleGate(tier.value)}
                                />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
