import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Zap, Crown, ChevronRight, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import CheckoutModal from '../components/CheckoutModal';
import UpgradeZone from '../components/UpgradeZone';
import SubmissionSelectionModal from '../components/SubmissionSelectionModal';
import Navbar from '../components/Navbar';
import './SeeTheLinePage.css';

import { ReviewerProfile, Submission, PriorityTier } from "../types";

// --- Interfaces ---
interface MissionBar {
    status: 'active' | 'completed' | 'failed';
    type: string;
    target: number;
    current: number;
    percent: number;
}

interface PriorityQueueItem {
    pos: number;
    submission_id: number;
    user: string;
    type: 'PAID_PRIORITY' | 'HOT_SEAT';
    amount: number;
    style: 'GOLD' | 'FIRE' | 'DEFAULT';
    track_title: string;
    artist: string;
    cover_art_url?: string | null;
    track_url?: string;
    is_community_winner?: boolean;
}

interface FreeQueueItem {
    pos: number;
    submission_id: number;
    user: string;
    track_title: string;
    artist: string;
    cover_art_url?: string | null;
    track_url?: string;
}

interface LineViewState {
    session_id: string;
    status: 'active' | 'paused' | 'offline';
    now_playing: {
        track_title: string;
        artist: string;
        cover_art_url: string | null;
        user: { username: string; avatar: string | null; discord_id?: string };
        mission_bar: MissionBar | null;
        track_url?: string;
    } | null;
    priority_queue: PriorityQueueItem[];
    free_queue: {
        display_limit: number;
        total_waiting: number;
        items: FreeQueueItem[];
    };
    user_status: {
        is_in_queue: boolean;
        position: number;
        est_wait_minutes: number;
        submissions: any[];
    };
    spotlights: any[];
    is_live: boolean;
    pricing_tiers: PriorityTier[];
    reviewer: { id: number; username: string; avatar_url: string | null; tiktok_handle?: string; configuration?: any; open_queue_tiers?: any[] };
    giveaway_state?: any;
    community_goals?: MissionBar[]; // New field
}

// --- Helpers ---
const generateGradient = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 40) % 360;
    const h3 = (h1 + 80) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 60%, 40%), hsl(${h2}, 75%, 50%), hsl(${h3}, 90%, 60%))`;
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

const getTierColor = (amount: number, tiers: PriorityTier[]) => {
    const tier = tiers.find(t => t.value === amount);
    if (!tier) return '#8b5cf6'; // Default purple
    const colorOpt = colorOptions.find(c => c.value === tier.color);
    return colorOpt ? colorOpt.hex : '#8b5cf6';
};

const PlatformIcon = ({ url }: { url: string }) => {
    if (!url) return <Music size={14} />;
    if (url.includes('spotify')) return <img src="https://open.spotifycdn.com/cdn/images/favicon.png" alt="Spotify" className="w-4 h-4" />;
    if (url.includes('soundcloud')) return <img src="https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico" alt="SoundCloud" className="w-4 h-4" />;
    if (url.includes('youtube') || url.includes('youtu.be')) return <img src="https://www.youtube.com/s/desktop/10c3c4b7/img/favicon.ico" alt="YouTube" className="w-4 h-4" />;
    return <Music size={14} />;
};

// --- Components ---

const MissionBarComponent = ({ mission }: { mission: MissionBar }) => {
    console.log("MissionBarComponent rendering with:", mission);
    const currentVal = mission.current !== undefined ? mission.current : (mission as any).progress || 0;
    const percentVal = mission.percent !== undefined ? mission.percent : ((currentVal / mission.target) * 100) || 0;

    return (
        <div className="mission-bar-container">
            <div className="mission-info">
                <span className="mission-type">{mission.type} Goal</span>
                <span className="mission-values">{currentVal} / {mission.target}</span>
            </div>
            <div className="progress-track">
                <motion.div
                    className="progress-fill"
                    initial={{ width: `${Math.min(100, percentVal)}%` }}
                    animate={{ width: `${Math.min(100, percentVal)}%`, backgroundColor: percentVal >= 100 ? '#10b981' : '#8b5cf6' }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>
            <p className="mission-hint">Reach {mission.target} {mission.type.toLowerCase()} for a Free Skip!</p>
        </div>
    );
};

// --- Extracted Components ---

interface NowPlayingSectionProps {
    now_playing: any;
    is_live: boolean;
}

const NowPlayingSection: React.FC<NowPlayingSectionProps> = React.memo(({ now_playing, is_live }) => (
    <div className="view-now-playing">
        <div className="np-card-large">
            <div className="np-art-large-container">
                {now_playing?.cover_art_url ? (
                    <img src={now_playing.cover_art_url} alt="Art" className="np-art-large" />
                ) : (
                    <div className="np-art-placeholder-large" style={{ background: generateGradient(now_playing?.track_title || 'track') }}>
                        <Music size={64} color="white" />
                    </div>
                )}
                {is_live && <div className="live-badge-large">🔴 LIVE</div>}
            </div>

            <div className="np-info-large">
                <h1 className="np-title-large">{now_playing?.track_title || "Waiting..."}</h1>
                <p className="np-artist-large">{now_playing?.artist || "Unknown Artist"}</p>

                {now_playing?.user && (
                    <div className="np-submitter-large">
                        <span className="text-muted">Submitted by</span>
                        <span className="text-highlight">{now_playing.user.username}</span>
                    </div>
                )}
            </div>
        </div>
    </div>
));

interface QueueSectionProps {
    priority_queue: PriorityQueueItem[];
    free_queue: { items: FreeQueueItem[]; total_waiting: number; display_limit: number };
    lowestTier: PriorityTier | null;
    peopleAhead: number;
    activeGoal: MissionBar | null;
    handlePurchase: (tier: PriorityTier) => void;
    pricing_tiers: PriorityTier[];
    freeSkipColor?: string;
}

const QueueSection: React.FC<QueueSectionProps> = React.memo(({
    priority_queue,
    free_queue,
    lowestTier,
    peopleAhead,
    activeGoal,
    handlePurchase,
    pricing_tiers,
    freeSkipColor
}) => (
    <div className="view-queue">
        {/* VIP Section */}
        <div className="queue-section">
            <div className="section-header">
                <h2>VIP ACCESS</h2>
                <span className="header-meta">{priority_queue.length} in line</span>
            </div>
            <div className="queue-list">
                {/* Upsell Card - Only visible if VIP queue is empty */}
                {priority_queue.length === 0 && (
                    <div
                        className="queue-card vip-card cursor-pointer hover:brightness-110 transition-all"
                        onClick={() => lowestTier && handlePurchase(lowestTier)}
                        style={{ borderStyle: 'dashed', borderColor: 'rgba(139, 92, 246, 0.5)', background: 'rgba(139, 92, 246, 0.05)' }}
                    >
                        <div className="qc-left">
                            <span className="qc-rank" style={{ color: '#a78bfa', width: 'auto', paddingRight: '8px' }}>You could go next.</span>
                            <div className="qc-art">
                                <div className="qc-art-placeholder" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                                    <Zap size={16} color="#a78bfa" />
                                </div>
                            </div>
                            <div className="qc-info">
                                <div className="qc-title-row">
                                    <span className="qc-title" style={{ color: '#e9d5ff' }}>Your Song Here</span>
                                </div>
                                <div className="qc-meta-row">
                                    <span className="qc-artist" style={{ color: 'rgba(167, 139, 250, 0.7)' }}>Skip {peopleAhead} people</span>
                                </div>
                            </div>
                        </div>
                        <div className="qc-right">
                            <div style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: '12px', color: '#d8b4fe', fontWeight: 500 }}>
                                Starting at ${lowestTier?.value ?? 5}
                            </div>
                        </div>
                    </div>
                )}

                {priority_queue.map((item, index) => {
                    let tierColor = getTierColor(item.amount, pricing_tiers);
                    const isWinner = item.is_community_winner;

                    if (isWinner && freeSkipColor) {
                        const mappedColor = colorOptions.find(c => c.value === freeSkipColor);
                        if (mappedColor) {
                            tierColor = mappedColor.hex;
                        }
                    }

                    // Determine if we need a divider
                    const prevItem = index > 0 ? priority_queue[index - 1] : null;
                    const showDivider = !prevItem || prevItem.amount !== item.amount;
                    const tierName = showDivider ? pricing_tiers.find(t => t.value === item.amount)?.tier_name : null;

                    return (
                        <React.Fragment key={item.pos}>
                            {showDivider && tierName && (
                                <div className="flex items-center gap-3 my-4 px-2">
                                    <div
                                        className="h-px flex-1"
                                        style={{ background: `linear-gradient(90deg, transparent, ${tierColor}80, transparent)` }}
                                    ></div>
                                    <span
                                        className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded"
                                        style={{
                                            color: tierColor,
                                            backgroundColor: `${tierColor}20`,
                                            border: `1px solid ${tierColor}40`
                                        }}
                                    >
                                        {tierName}
                                    </span>
                                    <div
                                        className="h-px flex-1"
                                        style={{ background: `linear-gradient(90deg, transparent, ${tierColor}80, transparent)` }}
                                    ></div>
                                </div>
                            )}
                            <div
                                className={`queue-card vip-card ${item.style === 'FIRE' ? 'style-fire' : ''}`}
                                style={{
                                    borderColor: `${tierColor}80`, // 50% opacity border
                                    background: `linear-gradient(90deg, ${tierColor}10 0%, ${tierColor}05 100%)` // Subtle gradient background
                                }}
                            >
                                <div className="qc-left">
                                    <span className="qc-rank" style={{ color: tierColor }}>#{item.pos}</span>
                                    <div className="qc-art">
                                        {item.cover_art_url ? (
                                            <img src={item.cover_art_url} alt="Art" style={{ borderColor: `${tierColor}40` }} />
                                        ) : (
                                            <div className="qc-art-placeholder" style={{ background: generateGradient(item.track_title || '') }}>
                                                <Music size={16} color="white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="qc-info">
                                        <div className="qc-title-row">
                                            <span className="qc-title">{item.track_title}</span>
                                        </div>
                                        <div className="qc-meta-row">
                                            <span className="qc-artist">{item.artist}</span>
                                            <span className="qc-dot">•</span>
                                            <span className="qc-user">@{item.user}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="qc-right">
                                    {isWinner && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 flex items-center gap-1">
                                            🏆 WINNER
                                        </span>
                                    )}
                                    {item.type === 'PAID_PRIORITY' && <Zap size={16} style={{ color: tierColor }} />}
                                    {item.type === 'HOT_SEAT' && <span className="icon-fire">🔥</span>}
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>

        {/* Upsell Banner */}
        <div className="upsell-banner" onClick={() => lowestTier && handlePurchase(lowestTier)}>
            <div className="upsell-content">
                <div className="upsell-icon-area">
                    <Crown size={20} className="text-purple" />
                </div>
                <div className="upsell-text">
                    <span className="upsell-title">Skip {peopleAhead} people</span>
                    <span className="upsell-subtitle">Jump to Priority Queue</span>
                </div>
                <div className="upsell-action">
                    <span className="upsell-price">Starting at ${lowestTier?.value || 5}</span>
                    <ChevronRight size={16} />
                </div>
            </div>
        </div>

        {/* Community Goal */}
        {activeGoal && (
            <div className="np-mission-large mb-6">
                <MissionBarComponent mission={activeGoal} />
            </div>
        )}

        {/* General Admission */}
        <div className="queue-section">
            <div className="section-header">
                <h2>GENERAL ADMISSION</h2>
                <span className="header-meta">Top 5</span>
            </div>
            <div className="queue-list">
                {free_queue.items.slice(0, 5).map((item) => (
                    <div key={item.pos} className="queue-card free-card">
                        <div className="qc-left">
                            <span className="qc-rank">#{item.pos}</span>
                            <div className="qc-art">
                                {item.cover_art_url ? (
                                    <img src={item.cover_art_url} alt="Art" />
                                ) : (
                                    <div className="qc-art-placeholder" style={{ background: generateGradient(item.track_title || '') }}>
                                        <Music size={16} color="white" />
                                    </div>
                                )}
                            </div>
                            <div className="qc-info">
                                <div className="qc-title-row">
                                    <span className="qc-title">{item.track_title}</span>
                                </div>
                                <div className="qc-meta-row">
                                    <span className="qc-artist">{item.artist}</span>
                                    <span className="qc-dot">•</span>
                                    <span className="qc-user">@{item.user}</span>
                                </div>
                            </div>
                        </div>
                        <div className="qc-right">
                            <PlatformIcon url={item.track_url || ''} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
));

const LinePage = () => {
    const { reviewerHandle } = useParams();
    // ... (rest of the component)
    const navigate = useNavigate();
    const { user } = useAuthStore();

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lineState, setLineState] = useState<LineViewState | null>(null);
    const [activeTab, setActiveTab] = useState<'queue' | 'current'>('queue');

    // Goal Rotation State
    const [currentGoalIndex, setCurrentGoalIndex] = useState(0);

    // Checkout / Upgrade State
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [selectedTier, setSelectedTier] = useState<PriorityTier | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [selectedSubmissionsForUpgrade, setSelectedSubmissionsForUpgrade] = useState<Submission[]>([]);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);

    const isInitialized = React.useRef(false);

    const fetchLineState = useCallback(async () => {
        if (!reviewerHandle) return;
        try {
            // setLoading(true); // Don't reset loading on poll to avoid flicker
            const response = await api.get(`/queue/line/${reviewerHandle}`);
            setLineState(response.data);
            setLoading(false);
        } catch (err: any) {
            console.error("Error fetching line state:", err);
            setError(err.response?.data?.detail || "Failed to load line");
            setLoading(false);
        }
    }, [reviewerHandle]);

    useEffect(() => {
        if (!reviewerHandle) return;

        fetchLineState();

        // Socket connection
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
            path: '/socket.io',
            transports: ['websocket'],
            reconnection: true,
            auth: { is_public: true }
        });

        socket.on('connect', () => {
            console.log('Socket connected');
            socket.emit('join_line_room', { reviewer_handle: reviewerHandle });
        });

        socket.on('queue_update', (data) => {
            console.log('Queue update received:', data);
            fetchLineState();
        });

        socket.on('current_track_update', (data) => {
            console.log('Current track update received:', data);
            fetchLineState();
        });

        // Poll every 30 seconds as backup
        const interval = setInterval(fetchLineState, 30000);

        // Goal Rotation
        const goalInterval = setInterval(() => {
            setLineState(prev => {
                if (!prev || !prev.community_goals || prev.community_goals.length <= 1) return prev;
                setCurrentGoalIndex(curr => (curr + 1) % prev.community_goals!.length);
                return prev;
            });
        }, 5000);

        return () => {
            socket.disconnect();
            clearInterval(interval);
            clearInterval(goalInterval);
        };
    }, [reviewerHandle, fetchLineState]);

    // Handlers
    const handlePurchase = (tier: PriorityTier) => {
        console.log("handlePurchase called with tier:", tier);
        if (lineState?.user_status?.is_in_queue) {
            console.log("User is in queue, upgrading...");
            handleUpgradeClick();
        } else {
            console.log("User not in queue, new submission...");
            setSelectedSubmissionsForUpgrade([]);
            setIsUpgradeModalOpen(true);
        }
    };

    const handleUpgradeClick = () => {
        console.log("handleUpgradeClick called");
        const submissions = lineState?.user_status.submissions || [];

        if (submissions.length > 0) {
            setIsSelectionModalOpen(true);
        } else {
            console.log("No submission found, falling back to new...");
            setSelectedSubmissionsForUpgrade([]);
            setIsUpgradeModalOpen(true);
        }
    };

    const handleSubmissionSelect = (subs: any[]) => {
        const mappedSubs = subs.map(sub => ({
            id: sub.submission_id,
            reviewer_id: lineState?.reviewer.id || 0,
            user: user,
            track_url: sub.track_url || "",
            track_title: sub.track_title || "Untitled",
            artist: sub.artist || "Unknown Artist",
            status: sub.status || "pending",
            submitted_at: sub.submitted_at || new Date().toISOString(),
            is_priority: sub.is_priority || false,
            priority_value: sub.priority_value || 0,
            bookmarked: sub.bookmarked || false,
            spotlighted: sub.spotlighted || false,
            cover_art_url: sub.cover_art_url,
            genre: "",
            description: "",
            file_hash: "",
            hook_start_time: 0,
            hook_end_time: 0
        } as any));

        setSelectedSubmissionsForUpgrade(mappedSubs);
        setIsSelectionModalOpen(false);
        setIsUpgradeModalOpen(true);
    };

    const handleCreateNewSubmission = () => {
        setSelectedSubmissionsForUpgrade([]);
        setIsSelectionModalOpen(false);
        setIsUpgradeModalOpen(true);
    };

    const handleCheckoutSuccess = () => {
        setIsCheckoutOpen(false);
    };

    const handleUpgradeSuccess = () => {
        setIsUpgradeModalOpen(false);
        setSelectedSubmissionsForUpgrade([]);
        fetchLineState();
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <div className="text-center p-8 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <h2 className="text-2xl font-bold text-red-400 mb-2">Error Loading Line</h2>
                    <p className="text-gray-300">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-bold transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!lineState) return null;

    const { now_playing, priority_queue, free_queue, pricing_tiers, is_live, community_goals } = lineState;
    const skipTier = pricing_tiers[0];

    // Determine Active Goal
    const activeGoal = (community_goals && community_goals.length > 0
        ? community_goals[currentGoalIndex]
        : now_playing?.mission_bar) || null; // Fallback to legacy if list missing, ensure null if undefined

    // --- Sub-Components for Views ---
    // (Removed inner definitions)

    // Filter out free tier (value 0) for upsell pricing
    const paidTiers = pricing_tiers.filter(t => t.value > 0);
    const lowestTier = paidTiers.length > 0
        ? paidTiers.reduce((min, t) => t.value < min.value ? t : min, paidTiers[0])
        : null;

    // Calculate people ahead
    let peopleAhead = 0;
    if (lineState.user_status.is_in_queue) {
        peopleAhead = Math.max(0, lineState.user_status.position - 1);
    } else {
        peopleAhead = priority_queue.length + free_queue.total_waiting;
    }

    return (
        <div className="app-shell">
            {/* --- GLOBAL NAVBAR (Responsive) --- */}
            <div className="global-navbar-wrapper">
                <Navbar />
            </div>

            {/* --- MOBILE SUB-HEADER (Tabs) --- */}
            <div className="mobile-tabs-container">
                <div className="mobile-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
                        onClick={() => setActiveTab('queue')}
                    >
                        Queue
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'current' ? 'active' : ''}`}
                        onClick={() => setActiveTab('current')}
                    >
                        Current Song
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT AREA (Scrollable) --- */}
            <main className="app-content">
                {/* Mobile: Conditional Render */}
                <div className="mobile-view-container">
                    <AnimatePresence mode="wait">
                        {activeTab === 'queue' ? (
                            <motion.div
                                key="queue"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="tab-content"
                            >
                                <QueueSection
                                    priority_queue={priority_queue}
                                    free_queue={free_queue}
                                    lowestTier={lowestTier}
                                    peopleAhead={peopleAhead}
                                    activeGoal={activeGoal}
                                    handlePurchase={handlePurchase}
                                    pricing_tiers={pricing_tiers}
                                    freeSkipColor={lineState.reviewer.configuration?.free_skip_color}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="current"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="tab-content"
                            >
                                <NowPlayingSection
                                    now_playing={now_playing}
                                    is_live={is_live}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Desktop: Split View (Grid) */}
                <div className="desktop-view-container">
                    <div className="desktop-left">
                        <NowPlayingSection
                            now_playing={now_playing}
                            is_live={is_live}
                        />
                    </div>
                    <div className="desktop-right">
                        <QueueSection
                            priority_queue={priority_queue}
                            free_queue={free_queue}
                            lowestTier={lowestTier}
                            peopleAhead={peopleAhead}
                            activeGoal={activeGoal}
                            handlePurchase={handlePurchase}
                            pricing_tiers={pricing_tiers}
                            freeSkipColor={lineState.reviewer.configuration?.free_skip_color}
                        />
                    </div>
                </div>
            </main>

            {/* --- BOTTOM ACTION FOOTER (Fixed) --- */}
            <footer className="app-footer">
                <div className="footer-content-wrapper">
                    <div className="footer-status-row">
                        <div className="status-item">
                            <span className="status-label">Your Position</span>
                            <span className="status-value">#{lineState.user_status.position || '-'}</span>
                        </div>
                        <div className="status-item right-align">
                            <span className="status-label">Wait Time</span>
                            <span className="status-value">~{lineState.user_status.est_wait_minutes}m</span>
                        </div>
                    </div>
                    <button className="action-btn-main" onClick={() => skipTier && handlePurchase(skipTier)}>
                        Skip / Upgrade Skip
                    </button>
                </div>
            </footer>

            {/* --- MODALS --- */}
            {selectedTier && (
                <CheckoutModal
                    isOpen={isCheckoutOpen}
                    onClose={() => setIsCheckoutOpen(false)}
                    amount={selectedTier.value}
                    reviewerId={lineState.reviewer.id}
                    onSuccess={handleCheckoutSuccess}
                    metadata={{ tier: selectedTier.label, type: 'skip_line' }}
                />
            )}

            {/* Upgrade Zone Modal */}
            {isUpgradeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-5xl h-[90vh] p-6 relative shadow-2xl overflow-hidden">
                        <UpgradeZone
                            reviewer={lineState.reviewer as any}
                            existingSubmissions={selectedSubmissionsForUpgrade}
                            onClose={() => setIsUpgradeModalOpen(false)}
                            onSuccess={handleUpgradeSuccess}
                        />
                    </div>
                </div>
            )}

            <SubmissionSelectionModal
                isOpen={isSelectionModalOpen}
                onClose={() => setIsSelectionModalOpen(false)}
                submissions={lineState.user_status?.submissions || []}
                onSelect={handleSubmissionSelect}
                onCreateNew={handleCreateNewSubmission}
            />
        </div>
    );
};

export default LinePage;
