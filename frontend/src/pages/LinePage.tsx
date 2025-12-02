import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Zap, Crown, ChevronRight, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import CheckoutModal from '../components/CheckoutModal';
import UpgradeZone from '../components/UpgradeZone';
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
}

const QueueSection: React.FC<QueueSectionProps> = React.memo(({
    priority_queue,
    free_queue,
    lowestTier,
    peopleAhead,
    activeGoal,
    handlePurchase
}) => (
    <div className="view-queue">
        {/* VIP Section */}
        <div className="queue-section">
            <div className="section-header">
                <h2>VIP ACCESS</h2>
                <span className="header-meta">{priority_queue.length} in line</span>
            </div>
            <div className="queue-list">
                {/* Upsell Card */}
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

                {priority_queue.map((item) => (
                    <div key={item.pos} className={`queue-card vip-card ${item.style === 'FIRE' ? 'style-fire' : ''}`}>
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
                            {item.type === 'PAID_PRIORITY' && <Zap size={16} className="icon-vip" />}
                            {item.type === 'HOT_SEAT' && <span className="icon-fire">🔥</span>}
                        </div>
                    </div>
                ))}
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
    const [selectedSubmissionForUpgrade, setSelectedSubmissionForUpgrade] = useState<Submission | null>(null);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);

    const isInitialized = React.useRef(false);

    // Data Fetching
    const fetchLineState = useCallback(async () => {
        if (!reviewerHandle) return;
        try {
            // Only show loading spinner on very first load
            if (!isInitialized.current) {
                setLoading(true);
            }

            const response = await api.get(`/queue/line/${reviewerHandle}`);

            // Map backend data to frontend interfaces
            const data = response.data;
            if (data.community_goals) {
                data.community_goals = data.community_goals.map((g: any) => ({
                    ...g,
                    current: g.progress, // Map progress -> current
                    percent: (g.progress / g.target) * 100, // Calculate percent
                    status: g.is_active ? 'active' : 'completed'
                }));
            }

            setLineState(data);
            setError(null);
            isInitialized.current = true;
        } catch (err: any) {
            console.error("Error fetching line state:", err);
            setError("Failed to load line data. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [reviewerHandle]);

    useEffect(() => {
        fetchLineState();

        const interval = setInterval(fetchLineState, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [fetchLineState]);

    // Goal Selection (Random on Mount + Rotation)
    useEffect(() => {
        if (!lineState?.community_goals || lineState.community_goals.length === 0) return;

        // Pick a random goal to display initially if not already set (or just let it rotate)
        // We only want to set random index once on mount, but this effect runs when goals change.
        // Actually, let's just set up the interval.

        const interval = setInterval(() => {
            setCurrentGoalIndex((prevIndex) => {
                if (!lineState.community_goals || lineState.community_goals.length === 0) return 0;
                return (prevIndex + 1) % lineState.community_goals.length;
            });
        }, 15000); // Rotate every 15 seconds

        return () => clearInterval(interval);
    }, [lineState?.community_goals?.length]); // Re-run if goals length changes

    // WebSocket Connection
    useEffect(() => {
        if (!lineState?.reviewer?.id) return;

        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        console.log('Connecting to socket at:', socketUrl);

        const socket = io(socketUrl, {
            transports: ['websocket'],
            auth: { is_public: true }
        });

        socket.on('connect', () => {
            console.log('Connected to socket, joining reviewer room:', lineState.reviewer.id);
            socket.emit('join_reviewer_room', lineState.reviewer.id);
            socket.emit('ping'); // Send ping
        });

        socket.on('welcome', (data: any) => {
            console.log('Received welcome from socket:', data);
        });

        socket.on('pong', (data: any) => {
            console.log('Received pong from socket:', data);
        });

        socket.on('initial_state', (data: any) => {
            console.log('Received initial state from socket:', data);
        });

        socket.on('error', (data: any) => {
            console.error('Received socket error:', data);
        });

        socket.on('giveaway_updated', (updatedGoal: any) => {
            console.log('Received giveaway update:', updatedGoal);
            setLineState((prevState) => {
                if (!prevState) return null;

                // Map backend GiveawayState to frontend MissionBar
                const mappedGoal: MissionBar = {
                    status: updatedGoal.is_active ? 'active' : 'completed',
                    type: updatedGoal.type,
                    target: updatedGoal.target,
                    current: updatedGoal.progress,
                    percent: (updatedGoal.progress / updatedGoal.target) * 100
                };

                // Update the specific goal in the array
                const newGoals = prevState.community_goals?.map(g =>
                    g.type === mappedGoal.type ? mappedGoal : g
                ) || [];

                // If it's a new goal type not in the list (unlikely but possible), add it
                if (!newGoals.find(g => g.type === mappedGoal.type)) {
                    newGoals.push(mappedGoal);
                }

                return {
                    ...prevState,
                    community_goals: newGoals,
                    // Also update legacy field if it matches
                    giveaway_state: prevState.giveaway_state?.type === mappedGoal.type ? mappedGoal : prevState.giveaway_state
                };
            });
        });

        socket.on('queue_updated', (newQueue: any[]) => {
            console.log('Queue updated, re-fetching line state...');
            fetchLineState();
        });

        socket.on('current_track_updated', (track: any) => {
            console.log('Current track updated:', track);
            fetchLineState();
        });

        socket.on('reviewer_settings_updated', (settings: any) => {
            console.log('Reviewer settings updated:', settings);
            fetchLineState();
        });

        return () => {
            socket.disconnect();
        };
    }, [lineState?.reviewer?.id, fetchLineState]);

    // Handlers
    const handlePurchase = (tier: PriorityTier) => {
        console.log("handlePurchase called with tier:", tier);
        if (lineState?.user_status?.is_in_queue) {
            console.log("User is in queue, upgrading...");
            handleUpgradeClick();
        } else {
            console.log("User not in queue, new submission...");
            setSelectedSubmissionForUpgrade(null);
            setIsUpgradeModalOpen(true);
        }
    };

    const handleUpgradeClick = () => {
        console.log("handleUpgradeClick called");
        const sub = lineState?.user_status.submissions[0];
        if (sub) {
            console.log("Found submission:", sub);
            setSelectedSubmissionForUpgrade({
                id: sub.submission_id,
                reviewer_id: lineState?.reviewer.id || 0,
                user: user,
                track_url: "",
                track_title: "My Track",
                artist: "Me",
                status: "pending",
                submitted_at: new Date().toISOString(),
                is_priority: false,
                priority_value: sub.priority_value || 0,
                bookmarked: false,
                spotlighted: false,
            } as any);
            setIsUpgradeModalOpen(true);
        } else {
            console.log("No submission found, falling back to new...");
            setSelectedSubmissionForUpgrade(null);
            setIsUpgradeModalOpen(true);
        }
    };

    const handleCheckoutSuccess = () => {
        setIsCheckoutOpen(false);
    };

    const handleUpgradeSuccess = () => {
        setIsUpgradeModalOpen(false);
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
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
                            existingSubmission={selectedSubmissionForUpgrade}
                            onClose={() => setIsUpgradeModalOpen(false)}
                            onSuccess={handleUpgradeSuccess}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LinePage;
