import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { FolderOpen, Upload, Music, X, Link as LinkIcon, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReviewerProfile, Submission } from "../types";
import RecentTracksDrawer from "./RecentTracksDrawer";
import WaveformPlayer from "./WaveformPlayer";
import PrioritySlider from "./PrioritySlider";
import api from "../services/api";
import toast from "react-hot-toast";
import CheckoutModal from "./CheckoutModal";
import { useAuthStore } from "../stores/authStore";

interface SmartZoneProps {
    reviewer: ReviewerProfile;
}

export interface SmartSubmissionItem {
    track_url: string;
    track_title?: string;
    artist?: string;
    genre?: string;
    file?: File;
    hook_start_time?: number;
    hook_end_time?: number;
    priority_value: number;
    sequence_order: number;
    preview_url?: string;
}

const SmartZone: React.FC<SmartZoneProps> = ({ reviewer }) => {
    const [slot1, setSlot1] = useState<SmartSubmissionItem | null>(null);
    const [slot2, setSlot2] = useState<SmartSubmissionItem | null>(null);
    const [slot3, setSlot3] = useState<SmartSubmissionItem | null>(null);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(1); // Which slot is requesting from drawer

    const [priorityValue, setPriorityValue] = useState(0); // Coin/Tier value
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const { user } = useAuthStore();

    // Determine allowed submissions based on tier
    const selectedTier = reviewer.configuration?.priority_tiers?.find(t => t.value === priorityValue);
    const allowedSubmissions = selectedTier?.submissions_count || 1;
    const isVIP = allowedSubmissions > 1;

    useEffect(() => {
        // Clear slots if they are no longer allowed
        if (allowedSubmissions < 2 && slot2) setSlot2(null);
        if (allowedSubmissions < 3 && slot3) setSlot3(null);
    }, [allowedSubmissions, slot2, slot3]);

    const onDrop = async (acceptedFiles: File[], slotNum: 1 | 2 | 3) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const item: SmartSubmissionItem = {
            track_url: url, // Preview URL
            track_title: file.name.replace(/\.[^/.]+$/, ""),
            file: file,
            priority_value: 0,
            sequence_order: slotNum
        };

        if (slotNum === 1) setSlot1(item);
        else if (slotNum === 2) setSlot2(item);
        else setSlot3(item);
    };

    const handleLinkPaste = async (e: React.ClipboardEvent, slotNum: 1 | 2 | 3) => {
        const text = e.clipboardData.getData('text');
        if (text && (text.includes('spotify') || text.includes('soundcloud') || text.includes('http'))) {
            e.preventDefault();

            // Check for Spotify and fetch metadata
            let title = "Loading...";
            let artist = "";
            let coverArt = "";
            let previewUrl = "";

            // Initial placeholder item
            const item: SmartSubmissionItem = {
                track_url: text,
                track_title: title,
                priority_value: 0,
                sequence_order: slotNum
            };

            if (slotNum === 1) setSlot1(item);
            else if (slotNum === 2) setSlot2(item);
            else setSlot3(item);

            if (text.includes('spotify.com/track')) {
                try {
                    const { data } = await api.post('/spotify/proxy/track', { url: text });

                    // Spotify Metadata Format
                    title = data.name;
                    artist = data.artists.map((a: any) => a.name).join(', ');
                    if (data.album?.images?.length > 0) {
                        coverArt = data.album.images[0].url;
                    }
                    previewUrl = data.preview_url; // Might be null

                    const genre = data.primary_genre || (data.genres && data.genres.length > 0 ? data.genres[0] : "");

                    // Update item with fetched metadata
                    const updatedItem = {
                        ...item,
                        track_title: title,
                        artist: artist,
                        genre: genre,
                        preview_url: previewUrl
                    };

                    if (slotNum === 1) setSlot1(updatedItem);
                    else if (slotNum === 2) setSlot2(updatedItem);
                    else setSlot3(updatedItem);

                } catch (err) {
                    console.error("Failed to fetch Spotify metadata", err);
                    // Fallback to basic title
                    const fallbackItem = { ...item, track_title: "Spotify Track (Metadata Failed)" };
                    if (slotNum === 1) setSlot1(fallbackItem);
                    else if (slotNum === 2) setSlot2(fallbackItem);
                    else setSlot3(fallbackItem);
                }
            } else if (text.includes('youtube.com') || text.includes('youtu.be')) {
                try {
                    const { data } = await api.post('/proxy/metadata', { url: text });

                    const updatedItem = {
                        ...item,
                        track_title: data.title || "YouTube Video",
                        artist: data.artist || "",
                        genre: data.genre || (data.tags && data.tags.length > 0 ? data.tags[0] : ""),
                    };

                    if (slotNum === 1) setSlot1(updatedItem);
                    else if (slotNum === 2) setSlot2(updatedItem);
                    else setSlot3(updatedItem);

                } catch (err) {
                    console.error("Failed to fetch YouTube metadata", err);
                    const fallbackItem = { ...item, track_title: "YouTube Video (Metadata Failed)" };
                    if (slotNum === 1) setSlot1(fallbackItem);
                    else if (slotNum === 2) setSlot2(fallbackItem);
                    else setSlot3(fallbackItem);
                }
            } else if (text.includes('soundcloud.com')) {
                try {
                    const { data } = await api.post('/soundcloud/metadata', { url: text });

                    const updatedItem = {
                        ...item,
                        track_title: data.title || "SoundCloud Track",
                        artist: data.artist || "",
                        genre: data.genre || "",
                        // We use the original URL for submission, but we can use the waveform_url for preview if we want
                        // For now, WaveformPlayer might not support the JSON waveform data from SoundCloud directly if it expects an audio file.
                        // But if we have a thumbnail, we can show it?
                        // The SmartSubmissionItem doesn't have a thumbnail field yet.
                        // Let's just set the basic info.
                    };

                    if (slotNum === 1) setSlot1(updatedItem);
                    else if (slotNum === 2) setSlot2(updatedItem);
                    else setSlot3(updatedItem);

                } catch (err) {
                    console.error("Failed to fetch SoundCloud metadata", err);
                    const fallbackItem = { ...item, track_title: "SoundCloud Track (Metadata Failed)" };
                    if (slotNum === 1) setSlot1(fallbackItem);
                    else if (slotNum === 2) setSlot2(fallbackItem);
                    else setSlot3(fallbackItem);
                }
            } else {
                // For non-Spotify/SoundCloud links
                const loadedItem = { ...item, track_title: "Link Loaded" };
                if (slotNum === 1) setSlot1(loadedItem);
                else if (slotNum === 2) setSlot2(loadedItem);
                else setSlot3(loadedItem);
            }
        }
    };

    const loadFromDrawer = (track: any) => {
        const item: SmartSubmissionItem = {
            track_url: track.file_url,
            track_title: track.track_title,
            hook_start_time: track.hook_start_time, // Restore hook!
            priority_value: 0,
            sequence_order: activeSlot
        };
        if (activeSlot === 1) setSlot1(item);
        else if (activeSlot === 2) setSlot2(item);
        else setSlot3(item);
        setIsDrawerOpen(false);
    };

    const [duplicateInfo, setDuplicateInfo] = useState<any | null>(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (force = false, reuseHash: string | null = null) => {
        // Validate
        if (!slot1) {
            toast.error("Slot 1 is empty!");
            return;
        }

        // Check if Guest
        if (!user) {
            if (priorityValue > 0) {
                setIsCheckoutOpen(true);
                return;
            } else {
                setIsCheckoutOpen(true);
                return;
            }
        }

        setIsSubmitting(true);

        // Prepare FormData
        const formData = new FormData();
        const items: SmartSubmissionItem[] = [];

        // Process Slot 1
        items.push({ ...slot1, priority_value: priorityValue });
        if (slot1.file && !reuseHash) {
            formData.append('files', slot1.file);
        }

        // Process Slot 2
        if (allowedSubmissions >= 2 && slot2) {
            items.push({ ...slot2, priority_value: priorityValue });
            if (slot2.file && !reuseHash) {
                formData.append('files', slot2.file);
            }
        }

        // Process Slot 3
        if (allowedSubmissions >= 3 && slot3) {
            items.push({ ...slot3, priority_value: priorityValue });
            if (slot3.file && !reuseHash) {
                formData.append('files', slot3.file);
            }
        }

        // Add metadata as JSON string
        const payload = {
            submissions: items,
            is_priority: isVIP
        };

        formData.append('submissions_json', JSON.stringify(payload));
        if (force) formData.append('force_upload', 'true');
        if (reuseHash) formData.append('reuse_hash', reuseHash);

        try {
            await api.post(`/reviewer/${reviewer.id}/submit`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            toast.success("Submitted successfully!");
            setSlot1(null);
            setSlot2(null);
            setSlot3(null);
            setPriorityValue(0);
            setDuplicateInfo(null);
            setIsDuplicateModalOpen(false);

            // Redirect to Hub if logged in
            if (user) {
                navigate('/hub');
            }
        } catch (e: any) {
            console.error(e);
            if (e.response?.status === 409) {
                try {
                    const info = JSON.parse(e.response.data.detail);
                    setDuplicateInfo(info);
                    setIsDuplicateModalOpen(true);
                    return;
                } catch (err) {
                    console.error("Failed to parse duplicate info", err);
                }
            }
            const msg = e.response?.data?.detail || "Submission failed.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* Left Column: Visuals/Player (The Input Slots) */}
                <div className="space-y-6">
                    <SubmissionSlot
                        slotNum={1}
                        item={slot1}
                        onClear={() => setSlot1(null)}
                        onOpenDrawer={() => { setActiveSlot(1); setIsDrawerOpen(true); }}
                        onDrop={(files) => onDrop(files, 1)}
                        onPaste={(e) => handleLinkPaste(e, 1)}
                        onUpdate={(updates) => setSlot1(prev => prev ? { ...prev, ...updates } : null)}
                        isLoggedIn={!!user}
                    />

                    {/* Slot 2 */}
                    <AnimatePresence>
                        {allowedSubmissions >= 2 && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center justify-center -mb-3 z-10 relative text-yellow-500"
                                >
                                    <div className="bg-gray-900 px-2 rounded-full border border-yellow-500/30">
                                        <LinkIcon size={16} />
                                    </div>
                                </motion.div>
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <SubmissionSlot
                                        slotNum={2}
                                        item={slot2}
                                        onClear={() => setSlot2(null)}
                                        onOpenDrawer={() => { setActiveSlot(2); setIsDrawerOpen(true); }}
                                        onDrop={(files) => onDrop(files, 2)}
                                        onPaste={(e) => handleLinkPaste(e, 2)}
                                        onUpdate={(updates) => setSlot2(prev => prev ? { ...prev, ...updates } : null)}
                                        isVipSlot
                                        isLoggedIn={!!user}
                                    />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    {/* Slot 3 */}
                    <AnimatePresence>
                        {allowedSubmissions >= 3 && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center justify-center -mb-3 z-10 relative text-yellow-500"
                                >
                                    <div className="bg-gray-900 px-2 rounded-full border border-yellow-500/30">
                                        <LinkIcon size={16} />
                                    </div>
                                </motion.div>
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <SubmissionSlot
                                        slotNum={3}
                                        item={slot3}
                                        onClear={() => setSlot3(null)}
                                        onOpenDrawer={() => { setActiveSlot(3); setIsDrawerOpen(true); }}
                                        onDrop={(files) => onDrop(files, 3)}
                                        onPaste={(e) => handleLinkPaste(e, 3)}
                                        onUpdate={(updates) => setSlot3(prev => prev ? { ...prev, ...updates } : null)}
                                        isVipSlot
                                        isLoggedIn={!!user}
                                    />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right Column: Data/Payment */}
                <div className="bg-gray-800/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold mb-4">Submission Details</h2>

                    {/* Priority Slider */}
                    <div className="mb-8">
                        <PrioritySlider
                            value={priorityValue}
                            onChange={setPriorityValue}
                            tiers={reviewer.configuration?.priority_tiers || []}
                            openTiers={reviewer.open_queue_tiers}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Queue Status</span>
                            <span className={`px-2 py-1 rounded-full ${reviewer.queue_status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {reviewer.queue_status?.toUpperCase() || "CLOSED"}
                            </span>
                        </div>

                        <button
                            onClick={() => handleSubmit()}
                            disabled={!slot1 || reviewer.queue_status === 'closed' || (reviewer.open_queue_tiers && !reviewer.open_queue_tiers.includes(priorityValue))}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                        ${(!slot1 || (reviewer.open_queue_tiers && !reviewer.open_queue_tiers.includes(priorityValue))) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                                    isVIP ? 'bg-gradient-to-r from-yellow-600 to-yellow-400 text-black hover:scale-[1.02]' :
                                        'bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02]'}
                    `}
                        >
                            {isVIP ? `Submit Bundle ($${priorityValue} Skip/${priorityValue * 100} Coins)` : `Submit Track (${priorityValue > 0 ? `$${priorityValue} Skip/${priorityValue * 100} Coins` : 'Free'})`}
                        </button>
                    </div>
                </div>

            </div>

            {/* Floating Toggle Button */}
            <button
                onClick={() => {
                    if (!isDrawerOpen) {
                        // Find first empty slot or default to 1
                        if (!slot1) setActiveSlot(1);
                        else if (!slot2 && allowedSubmissions >= 2) setActiveSlot(2);
                        else if (!slot3 && allowedSubmissions >= 3) setActiveSlot(3);
                        else setActiveSlot(1);
                    }
                    setIsDrawerOpen(!isDrawerOpen);
                }}
                className={`fixed right-0 top-1/2 transform -translate-y-1/2 bg-gray-900 border-l border-t border-b border-white/10 p-3 rounded-l-xl shadow-xl z-30 hover:bg-gray-800 transition-all group ${isDrawerOpen ? 'translate-x-full' : 'translate-x-0'}`}
                title="Recent Tracks"
            >
                <div className="relative">
                    <Clock className="text-blue-400 group-hover:text-blue-300" size={24} />
                    {/* Optional: Add a badge if there are recent tracks? We don't have the count here easily without fetching. */}
                </div>
            </button>

            <RecentTracksDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSelect={loadFromDrawer}
            />

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                amount={priorityValue} // Value is now in Dollars
                reviewerId={reviewer.id}
                metadata={{
                    tier: isVIP ? 'vip' : 'standard',
                    track_url: slot1?.track_url,
                    track_title: slot1?.track_title,
                    file: slot1?.file,
                    artist: slot1?.artist,
                    genre: slot1?.genre
                }}
                onSuccess={() => {
                    setIsCheckoutOpen(false);
                    setSlot1(null);
                    setSlot2(null);
                    setSlot3(null);
                    setPriorityValue(0);
                    toast.success("Submission sent! Check your email.");
                }}
            />

            {/* Duplicate Modal */}
            {isDuplicateModalOpen && duplicateInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-2 text-white">Duplicate File Detected</h3>
                        <p className="text-gray-400 mb-4">
                            This file has already been submitted as: <br />
                            <span className="text-white font-medium">{duplicateInfo.existing_submission.track_title}</span>
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleSubmit(false, duplicateInfo.hash)}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
                            >
                                Use Existing File
                            </button>
                            <button
                                onClick={() => handleSubmit(true)}
                                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
                            >
                                Upload Anyway (New Copy)
                            </button>
                            <button
                                onClick={() => setIsDuplicateModalOpen(false)}
                                className="w-full py-2 text-gray-500 hover:text-gray-400 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Modal */}
            {isSubmitting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <h3 className="text-xl font-bold mb-2 text-white">Submitting...</h3>
                        <p className="text-gray-400">Please wait while we upload your tracks.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const SubmissionSlot: React.FC<{
    slotNum: number;
    item: SmartSubmissionItem | null;
    onClear: () => void;
    onOpenDrawer: () => void;
    onDrop: (files: File[]) => void;
    onPaste: (e: React.ClipboardEvent) => void;
    onUpdate: (updates: Partial<SmartSubmissionItem>) => void;
    isVipSlot?: boolean;
    isLoggedIn: boolean;
}> = ({ slotNum, item, onClear, onOpenDrawer, onDrop, onPaste, onUpdate, isVipSlot, isLoggedIn }) => {

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: !!item, maxFiles: 1 });

    return (
        <div
            {...getRootProps()}
            className={`
                relative rounded-2xl border-2 transition-all duration-300 min-h-[200px] flex flex-col justify-center
                ${item ? 'border-solid bg-gray-900/80 border-transparent' : 'border-dashed cursor-pointer hover:bg-white/5'}
                ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}
                ${isVipSlot ? 'shadow-[0_0_15px_rgba(234,179,8,0.2)]' : ''}
            `}
            onPaste={!item ? onPaste : undefined}
        >
            <input {...getInputProps()} disabled={!!item} />

            {!item ? (
                <div className="flex flex-col items-center text-gray-400 p-8">
                    <Upload size={32} className="mb-2 opacity-50" />
                    <p className="font-medium">Drag track or paste link</p>

                    {/* Visible Link Input */}
                    <div className="w-full max-w-[80%] mt-4 mb-2">
                        <input
                            type="text"
                            placeholder="Paste SoundCloud, Spotify, YouTube, or Drive link..."
                            className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                            onPaste={onPaste}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value;
                                    if (val) {
                                        // Simulate paste event
                                        const clipboardData = { getData: () => val } as any;
                                        onPaste({ clipboardData, preventDefault: () => { } } as any);
                                    }
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    <div className="my-2 text-xs opacity-50">- OR -</div>

                    {/* Only show Load Recent if user is logged in (passed via onOpenDrawer prop check or similar, but here we rely on parent logic or just disable if no user) */}
                    {/* Actually, we need to know if user is logged in here. Let's assume onOpenDrawer handles the check or we pass a prop. */}
                    {/* For now, we'll add the Discord message below the button if it's disabled or just always show it for context */}

                    {isLoggedIn ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenDrawer(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-sm transition-colors mb-4"
                        >
                            <FolderOpen size={14} />
                            Load Recent
                        </button>
                    ) : (
                        <a
                            href="/api/auth/login"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] rounded-full text-sm text-white transition-colors mb-4 font-medium"
                        >
                            Login with Discord
                        </a>
                    )}

                    <div className="text-center space-y-1">
                        <p className="text-xs text-gray-500">
                            Need to join the community?
                        </p>
                        <a
                            href="https://discord.gg/lifeisluxury"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            Join Life is Luxury Discord
                        </a>
                    </div>
                </div>
            ) : (
                <div className="p-4 w-full h-full flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-gray-500">
                                <Music size={20} />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold truncate max-w-[200px]">{item.track_title || "Unknown Track"}</span>
                                <span className="text-xs text-gray-500 truncate max-w-[200px]">{item.track_url}</span>
                                {(item.track_url.includes('drive.google.com') || item.track_url.includes('dropbox.com') || item.track_url.includes('icloud.com')) && (
                                    <div className="flex items-center gap-1 text-amber-400 text-[10px] mt-1">
                                        <span>⚠️ Link must be public</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="p-1 hover:text-red-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Metadata Inputs */}
                    <div className="grid grid-cols-2 gap-3 mb-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Artist Name</label>
                            <input
                                type="text"
                                placeholder="Artist Name"
                                value={item.artist || ""}
                                onChange={(e) => onUpdate({ artist: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Track Title</label>
                            <input
                                type="text"
                                placeholder="Track Title"
                                value={item.track_title || ""}
                                onChange={(e) => onUpdate({ track_title: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
                            />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Genre</label>
                            <select
                                value={item.genre || ""}
                                onChange={(e) => onUpdate({ genre: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-full appearance-none"
                            >
                                <option value="" disabled>Select Genre</option>
                                {["Hip Hop", "Rap", "R&B", "Pop", "Electronic", "Rock", "Alternative", "Latin", "Country", "Jazz", "Classical", "Other"].map(g => (
                                    <option key={g} value={g} className="bg-gray-900">{g}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Waveform / Hook Editor / SoundCloud Embed */}
                    <div className="flex-1 bg-gray-800/50 rounded-lg p-2 overflow-hidden">
                        {item.track_url.includes('soundcloud.com') ? (
                            <iframe
                                width="100%"
                                height="120"
                                scrolling="no"
                                frameBorder="no"
                                allow="autoplay"
                                src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(item.track_url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`}
                            ></iframe>
                        ) : item.track_url.includes('spotify.com') && !item.preview_url ? (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">
                                Preview not available for this track
                            </div>
                        ) : (
                            <WaveformPlayer
                                url={item.preview_url || item.track_url}
                                hookStartTime={item.hook_start_time}
                                onHookChange={(start, end) => onUpdate({ hook_start_time: start, hook_end_time: end })}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartZone;
