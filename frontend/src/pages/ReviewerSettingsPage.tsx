import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { PriorityTier, ReviewerProfile, EconomyConfig } from '../types';
import { Save, Trash2, Plus, RotateCcw } from 'lucide-react';

const ReviewerSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, checkAuth } = useAuthStore();
    const [reviewerProfile, setReviewerProfile] = useState<ReviewerProfile | null>(null);

    // Form States
    const [tiktokHandle, setTiktokHandle] = useState('');
    const [discordChannelId, setDiscordChannelId] = useState('');
    const [freeLineLimit, setFreeLineLimit] = useState<number | ''>('');
    const [tiers, setTiers] = useState<PriorityTier[]>([]);
    const [economyConfigs, setEconomyConfigs] = useState<EconomyConfig[]>([]);

    // Loading/Error States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // New Tier State
    const [newTierValue, setNewTierValue] = useState<number>(0);
    const [newTierLabel, setNewTierLabel] = useState('');
    const [newTierColor, setNewTierColor] = useState('gray');
    const [newTierSubmissions, setNewTierSubmissions] = useState<number>(1);

    const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
    const [activeColorDropdown, setActiveColorDropdown] = useState<number | null>(null);

    const handleTierChange = (index: number, field: keyof PriorityTier, value: any) => {
        const newTiers = [...tiers];
        newTiers[index] = { ...newTiers[index], [field]: value };
        // If value changed, re-sort? Maybe not while editing to avoid jumping rows.
        // Let's just update state. Sorting can happen on save or add.
        setTiers(newTiers);
    };

    const colorOptions = [
        { name: 'Gray', value: 'gray', hex: '#9ca3af' },
        { name: 'Slate', value: 'slate', hex: '#94a3b8' },
        { name: 'Zinc', value: 'zinc', hex: '#a1a1aa' },
        { name: 'Neutral', value: 'neutral', hex: '#a3a3a3' },
        { name: 'Stone', value: 'stone', hex: '#a8a29e' },
        { name: 'Red', value: 'red', hex: '#ef4444' },
        { name: 'Crimson', value: 'crimson', hex: '#dc2626' },
        { name: 'Orange', value: 'orange', hex: '#f97316' },
        { name: 'Amber', value: 'amber', hex: '#f59e0b' },
        { name: 'Gold', value: 'gold', hex: '#ffd700' },
        { name: 'Yellow', value: 'yellow', hex: '#eab308' },
        { name: 'Lime', value: 'lime', hex: '#84cc16' },
        { name: 'Green', value: 'green', hex: '#22c55e' },
        { name: 'Emerald', value: 'emerald', hex: '#10b981' },
        { name: 'Mint', value: 'mint', hex: '#6ee7b7' },
        { name: 'Teal', value: 'teal', hex: '#14b8a6' },
        { name: 'Cyan', value: 'cyan', hex: '#06b6d4' },
        { name: 'Sky', value: 'sky', hex: '#0ea5e9' },
        { name: 'Blue', value: 'blue', hex: '#3b82f6' },
        { name: 'Royal', value: 'royal', hex: '#1e40af' },
        { name: 'Indigo', value: 'indigo', hex: '#6366f1' },
        { name: 'Violet', value: 'violet', hex: '#8b5cf6' },
        { name: 'Purple', value: 'purple', hex: '#a855f7' },
        { name: 'Lavender', value: 'lavender', hex: '#c084fc' },
        { name: 'Fuchsia', value: 'fuchsia', hex: '#d946ef' },
        { name: 'Pink', value: 'pink', hex: '#ec4899' },
        { name: 'Rose', value: 'rose', hex: '#f43f5e' },
        { name: 'Coral', value: 'coral', hex: '#fb7185' },
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

            // Check for Stripe Connect return
            const params = new URLSearchParams(window.location.search);
            if (params.get('stripe_connect') === 'return' && params.get('account_id')) {
                try {
                    await api.post('/stripe/finalize-connection', { account_id: params.get('account_id') });
                    setMessage({ text: "Stripe account connected successfully!", type: 'success' });
                    // Clean URL
                    window.history.replaceState({}, '', window.location.pathname);
                } catch (err) {
                    setMessage({ text: "Failed to finalize Stripe connection.", type: 'error' });
                }
            }

            try {
                // Fetch full settings to ensure we get the config with defaults
                const response = await api.get<ReviewerProfile>(`/reviewer/${user.reviewer_profile.id}/settings`);
                const profile = response.data;

                setReviewerProfile(profile);
                setTiktokHandle(profile.tiktok_handle || '');
                setDiscordChannelId(profile.discord_channel_id || '');
                setFreeLineLimit(profile.configuration?.free_line_limit ?? '');

                if (profile.configuration?.priority_tiers) {
                    setTiers(profile.configuration.priority_tiers);
                } else {
                    setTiers(defaultTiers);
                }

                // Initialize economy configs with defaults if missing
                const defaultEvents = [
                    { event_name: 'like', coin_amount: 10 },
                    { event_name: 'comment', coin_amount: 5 },
                    { event_name: 'share', coin_amount: 50 },
                    { event_name: 'follow', coin_amount: 100 },
                    { event_name: 'join', coin_amount: 0 },
                ];

                const currentConfigs = profile.economy_configs || [];
                const mergedConfigs = defaultEvents.map(def => {
                    const existing = currentConfigs.find(c => c.event_name === def.event_name);
                    return existing || { ...def, id: 0, reviewer_id: profile.id } as EconomyConfig;
                });
                setEconomyConfigs(mergedConfigs);

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
                    priority_tiers: tiers,
                    free_line_limit: freeLineLimit === '' ? null : Number(freeLineLimit)
                },
                economy_configs: economyConfigs.map(c => ({ event_name: c.event_name, coin_amount: c.coin_amount }))
            };

            await api.patch(`/reviewer/${reviewerProfile.id}/settings`, updateData);
            setMessage({ text: "Settings saved successfully!", type: 'success' });
            await checkAuth(); // Refresh global user state
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
            color: newTierColor,
            submissions_count: newTierSubmissions
        };

        // Sort tiers by value
        const updatedTiers = [...tiers, newTier].sort((a, b) => a.value - b.value);
        setTiers(updatedTiers);

        // Reset form
        setNewTierValue(0);
        setNewTierLabel('');
        setNewTierColor('gray');
        setNewTierSubmissions(1);
        setIsColorDropdownOpen(false);
    };

    const handleDeleteTier = (value: number) => {
        setTiers(tiers.filter(t => t.value !== value));
    };

    const handleResetTiers = () => {
        if (window.confirm("Are you sure you want to reset priority tiers to defaults?")) {
            setTiers(defaultTiers);
        }
    };

    const getSelectedColorObj = () => {
        return colorOptions.find(c => c.value === newTierColor) || colorOptions[0];
    };

    const getAvailableColors = (excludeColor?: string) => {
        const usedColors = new Set(tiers.map(t => t.color));
        if (excludeColor) {
            usedColors.delete(excludeColor);
        }
        return colorOptions.filter(c => !usedColors.has(c.value));
    };

    // Ensure newTierColor is valid when tiers change
    useEffect(() => {
        const usedColors = new Set(tiers.map(t => t.color));
        if (usedColors.has(newTierColor)) {
            const available = colorOptions.find(c => !usedColors.has(c.value));
            if (available) {
                setNewTierColor(available.value);
            }
        }
    }, [tiers, newTierColor]);

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
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Free Line Submission Limit</label>
                                <input
                                    type="number"
                                    value={freeLineLimit}
                                    onChange={(e) => setFreeLineLimit(e.target.value === '' ? '' : parseInt(e.target.value))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                                    placeholder="No limit"
                                />
                                <p className="text-xs text-gray-500 mt-1">Limit the number of active submissions in the free queue. Leave empty for no limit.</p>
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
                                        <th className="p-3 font-medium"># of Submissions</th>
                                        <th className="p-3 font-medium">Theme</th>
                                        <th className="p-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tiers.map((tier, index) => {
                                        const colorObj = colorOptions.find(c => c.value === tier.color) || { name: tier.color, hex: '#9ca3af' };
                                        const availableColors = getAvailableColors(tier.color);

                                        return (
                                            <tr key={index} className="border-t border-gray-700 hover:bg-gray-700/30 transition-colors">
                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        value={tier.value}
                                                        onChange={(e) => handleTierChange(index, 'value', parseInt(e.target.value) || 0)}
                                                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 w-20 text-sm focus:outline-none focus:border-purple-500"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="text"
                                                        value={tier.label}
                                                        onChange={(e) => handleTierChange(index, 'label', e.target.value)}
                                                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 w-full text-sm focus:outline-none focus:border-purple-500"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={tier.submissions_count || 1}
                                                        onChange={(e) => handleTierChange(index, 'submissions_count', parseInt(e.target.value) || 1)}
                                                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 w-16 text-sm focus:outline-none focus:border-purple-500"
                                                    />
                                                </td>
                                                <td className="p-3 relative">
                                                    <button
                                                        onClick={() => setActiveColorDropdown(activeColorDropdown === index ? null : index)}
                                                        className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500 w-full justify-between"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-4 h-4 rounded-full`} style={{ backgroundColor: colorObj.hex || `var(--${tier.color}-500)` }}></span>
                                                            <span className="capitalize text-gray-300">{colorObj.name}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-500">▼</span>
                                                    </button>

                                                    {activeColorDropdown === index && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setActiveColorDropdown(null)}></div>
                                                            <div className="absolute top-full mt-1 left-0 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                                                                {availableColors.map(opt => (
                                                                    <button
                                                                        key={opt.value}
                                                                        onClick={() => {
                                                                            handleTierChange(index, 'color', opt.value);
                                                                            setActiveColorDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.hex }}></span>
                                                                        <span className="text-sm text-gray-200">{opt.name}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
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
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Add New Tier */}
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-300 mb-3">Add New Tier</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="w-full md:w-32">
                                    <label className="block text-xs text-gray-500 mb-1">Priority Value</label>
                                    <input
                                        type="number"
                                        value={newTierValue}
                                        onChange={(e) => setNewTierValue(parseInt(e.target.value) || 0)}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div className="flex-1 w-full">
                                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                                    <input
                                        type="text"
                                        value={newTierLabel}
                                        onChange={(e) => setNewTierLabel(e.target.value)}
                                        placeholder="e.g. Super Skip"
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div className="w-full md:w-24">
                                    <label className="block text-xs text-gray-500 mb-1"># of Submissions</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newTierSubmissions}
                                        onChange={(e) => setNewTierSubmissions(parseInt(e.target.value) || 1)}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div className="w-full md:w-40 relative">
                                    <label className="block text-xs text-gray-500 mb-1">Theme</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getSelectedColorObj().hex }}></span>
                                            <span>{getSelectedColorObj().name}</span>
                                        </div>
                                        <span className="text-gray-400 text-xs">▼</span>
                                    </button>

                                    {isColorDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsColorDropdownOpen(false)}></div>
                                            <div className="absolute bottom-full mb-1 left-0 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                                                {getAvailableColors().map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => {
                                                            setNewTierColor(opt.value);
                                                            setIsColorDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                                                    >
                                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.hex }}></span>
                                                        <span className="text-sm text-gray-200">{opt.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
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

                    {/* TikTok Interaction Points */}
                    <section className="bg-gray-800 rounded-xl p-6 shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 text-purple-400">TikTok Interaction Points</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            Configure how many luxury coins users earn for different TikTok interactions.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {economyConfigs.map((config, index) => (
                                <div key={config.event_name}>
                                    <label className="block text-sm font-medium text-gray-400 mb-2 capitalize">{config.event_name}</label>
                                    <input
                                        type="number"
                                        value={config.coin_amount}
                                        onChange={(e) => {
                                            const newConfigs = [...economyConfigs];
                                            newConfigs[index] = { ...config, coin_amount: parseInt(e.target.value) || 0 };
                                            setEconomyConfigs(newConfigs);
                                        }}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Integrations & Payments */}
                    <section className="bg-gray-800 rounded-xl p-6 shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 text-purple-400">Integrations & Payments</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            Connect your accounts to enable features and receive payments.
                        </p>

                        <div className="space-y-4">
                            {/* Spotify */}
                            <div className="bg-gray-700/50 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-[#1DB954] p-2 rounded text-white font-bold">Spotify</div>
                                    <div>
                                        <h3 className="font-medium text-white">Spotify</h3>
                                        <p className="text-xs text-gray-400">Connect to enable the web player and track info.</p>
                                    </div>
                                </div>
                                <div>
                                    {user?.spotify_connected ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 text-green-400 bg-green-900/30 px-3 py-1 rounded-full border border-green-800">
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                <span className="text-sm font-medium">Connected</span>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm("Are you sure you want to disconnect Spotify?")) {
                                                        try {
                                                            await api.post('/spotify/disconnect');
                                                            setMessage({ text: "Spotify disconnected successfully.", type: 'success' });
                                                            await checkAuth();
                                                        } catch (err) {
                                                            setMessage({ text: "Failed to disconnect Spotify.", type: 'error' });
                                                        }
                                                    }
                                                }}
                                                className="text-gray-400 hover:text-white text-sm underline"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const returnUrl = encodeURIComponent(window.location.href);
                                                    // Add force_login=true to ensure the user can switch accounts
                                                    const res = await api.get(`/spotify/login?return_url=${returnUrl}&force_login=true`);
                                                    window.location.href = res.data.url;
                                                } catch (err) {
                                                    setMessage({ text: "Failed to initiate Spotify connection.", type: 'error' });
                                                }
                                            }}
                                            className="bg-[#1DB954] hover:bg-[#1ed760] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                                        >
                                            Connect Spotify
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Stripe */}
                            <div className="bg-gray-700/50 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-[#635BFF] p-2 rounded text-white font-bold">Stripe</div>
                                    <div>
                                        <h3 className="font-medium text-white">Stripe Connect</h3>
                                        <p className="text-xs text-gray-400">Accept Cards, Apple Pay, Google Pay, and Cash App.</p>
                                    </div>
                                </div>
                                <div>
                                    {reviewerProfile?.payment_configs?.find(c => c.provider === 'stripe' && c.is_enabled) ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 text-green-400 bg-green-900/30 px-3 py-1 rounded-full border border-green-800">
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                <span className="text-sm font-medium">Connected</span>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm("Are you sure you want to disconnect Stripe?")) {
                                                        try {
                                                            await api.post('/stripe/disconnect');
                                                            setMessage({ text: "Stripe disconnected successfully.", type: 'success' });
                                                            // Refresh profile to update UI
                                                            const response = await api.get<ReviewerProfile>(`/reviewer/${user.reviewer_profile!.id}/settings`);
                                                            setReviewerProfile(response.data);
                                                        } catch (err) {
                                                            setMessage({ text: "Failed to disconnect Stripe.", type: 'error' });
                                                        }
                                                    }
                                                }}
                                                className="text-gray-400 hover:text-white text-sm underline"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await api.post('/stripe/connect');
                                                    window.location.href = res.data.url;
                                                } catch (err) {
                                                    setMessage({ text: "Failed to initiate Stripe connection.", type: 'error' });
                                                }
                                            }}
                                            className="bg-[#635BFF] hover:bg-[#534be0] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                                        >
                                            Connect Stripe
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* PayPal (Coming Soon) */}
                            <div className="bg-gray-700/30 p-4 rounded-lg flex items-center justify-between opacity-60">
                                <div className="flex items-center gap-4">
                                    <div className="bg-[#003087] p-2 rounded text-white font-bold">PayPal</div>
                                    <div>
                                        <h3 className="font-medium text-white">PayPal</h3>
                                        <p className="text-xs text-gray-400">Coming soon.</p>
                                    </div>
                                </div>
                                <button disabled className="bg-gray-600 text-gray-400 px-4 py-2 rounded text-sm font-medium cursor-not-allowed">
                                    Connect
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

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
        </div >
    );
};

export default ReviewerSettingsPage;
