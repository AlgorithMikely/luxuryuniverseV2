import React from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import api from '../../services/api';

interface SettingsPanelProps {
    reviewerId?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ reviewerId }) => {
    const { activeSession, fetchActiveSession } = useSessionStore();

    const tiers = [
        { value: 5, label: '$5 Skip' },
        { value: 10, label: '$10 Skip' },
        { value: 15, label: '$15 Skip' },
        { value: 20, label: '$20 Skip' },
        { value: 25, label: '$25+ Skip' },
    ];

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
            <div>
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
