import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Upload, Music, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReviewerProfile, SmartSubmissionItem } from "../types";
import RecentTracksDrawer from "./RecentTracksDrawer";
import PrioritySlider from "./PrioritySlider";
import api from "../services/api";
import toast from "react-hot-toast";
import CheckoutModal from "./CheckoutModal";
import { useAuthStore } from "../stores/authStore";
import SubmissionSlot from "./SubmissionSlot";
import { useSubmissionSlots } from "../hooks/useSubmissionSlots";
import { useSubmission } from "../hooks/useSubmission";

interface SmartZoneProps {
    reviewer: ReviewerProfile;
}

const SmartZone: React.FC<SmartZoneProps> = ({ reviewer }) => {
    const { user } = useAuthStore();

    const {
        slot1, setSlot1,
        slot2, setSlot2,
        slot3, setSlot3,
        activeSlot, setActiveSlot,
        handleDrop,
        handlePaste,
        loadFromDrawer,
        updateSlot
    } = useSubmissionSlots({ defaultArtistName: user?.artist_name });

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [priorityValue, setPriorityValue] = useState(0); // Coin/Tier value
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);

    // Determine allowed submissions based on tier
    const selectedTier = reviewer.configuration?.priority_tiers?.find(t => t.value === priorityValue);
    const allowedSubmissions = selectedTier?.submissions_count || 1;
    const isVIP = allowedSubmissions > 1;

    useEffect(() => {
        // Clear slots if they are no longer allowed
        if (allowedSubmissions < 2 && slot2) setSlot2(null);
        if (allowedSubmissions < 3 && slot3) setSlot3(null);
        else if (slot3?.is_history) setSlot3(null);
    }, [allowedSubmissions, slot2, slot3]);

    const [duplicateInfo, setDuplicateInfo] = useState<any | null>(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [checkoutAmount, setCheckoutAmount] = useState<number | null>(null);
    const navigate = useNavigate();

    const { submit, isSubmitting } = useSubmission({
        reviewer,
        onSuccess: () => {
            setSlot1(null);
            setSlot2(null);
            setSlot3(null);
            setPriorityValue(0);
            setDuplicateInfo(null);
            setIsDuplicateModalOpen(false);
            if (user) navigate('/hub');
        },
        onOpenCheckout: (shortfall) => {
            if (shortfall !== undefined) {
                setCheckoutAmount(shortfall / 100);
            } else {
                setCheckoutAmount(null);
            }
            setIsCheckoutOpen(true);
        },
        onOpenDuplicateModal: (info) => {
            setDuplicateInfo(info);
            setIsDuplicateModalOpen(true);
        },
        onHistoryDuplicate: (info) => {
            let cleared = false;
            if (slot1?.is_history && slot1.track_url === info.track_url) { setSlot1(null); cleared = true; }
            if (slot2?.is_history && slot2.track_url === info.track_url) { setSlot2(null); cleared = true; }
            if (slot3?.is_history && slot3.track_url === info.track_url) { setSlot3(null); cleared = true; }

            if (!cleared) {
                const historySlots = [slot1, slot2, slot3].filter(s => s?.is_history);
                if (historySlots.length === 1) {
                    if (slot1?.is_history) setSlot1(null);
                    else if (slot2?.is_history) setSlot2(null);
                    else if (slot3?.is_history) setSlot3(null);
                }
            }
        }
    });

    const handleSubmit = async (force = false, reuseHash: string | null = null) => {
        await submit(
            { slot1, slot2, slot3 },
            priorityValue,
            allowedSubmissions,
            force,
            reuseHash
        );
    };

    const handleCheckoutSuccess = () => {
        setIsCheckoutOpen(false);
        handleSubmit();
    };

    return (
        <div className="smart-zone-container w-full max-w-6xl mx-auto p-4 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Submission Slots */}
                <div className="lg:col-span-7 space-y-6">
                    <h2 className="text-3xl font-bold mb-6 text-white flex items-center gap-3">
                        <Upload className="text-blue-400" />
                        Submit Your Track
                    </h2>

                    {/* Slot 1 */}
                    < SubmissionSlot
                        slotNum={1}
                        item={slot1}
                        onClear={() => setSlot1(null)}
                        onOpenDrawer={() => { setActiveSlot(1); setIsDrawerOpen(true); }}
                        onDrop={(files) => handleDrop(files, 1)}
                        onPaste={(e) => handlePaste(e, 1)}
                        onUpdate={(updates) => updateSlot(1, updates)}
                        isVipSlot={false}
                        isLoggedIn={!!user}
                    />

                    {/* Slot 2 (VIP) */}
                    <AnimatePresence>
                        {allowedSubmissions >= 2 && (
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
                                    onDrop={(files) => handleDrop(files, 2)}
                                    onPaste={(e) => handlePaste(e, 2)}
                                    onUpdate={(updates) => updateSlot(2, updates)}
                                    isVipSlot
                                    isLoggedIn={!!user}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Slot 3 (VIP) */}
                    <AnimatePresence>
                        {allowedSubmissions >= 3 && (
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
                                    onDrop={(files) => handleDrop(files, 3)}
                                    onPaste={(e) => handlePaste(e, 3)}
                                    onUpdate={(updates) => updateSlot(3, updates)}
                                    isVipSlot
                                    isLoggedIn={!!user}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div >

                {/* Right Column: Controls */}
                < div className="lg:col-span-5 space-y-6" >
                    <div className="bg-gray-800/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl lg:sticky lg:top-24">
                        <h3 className="text-xl font-bold mb-6 text-white">Select Priority</h3>

                        <PrioritySlider
                            value={priorityValue}
                            onChange={setPriorityValue}
                            tiers={reviewer.configuration?.priority_tiers || []}
                            openTiers={reviewer.open_queue_tiers}
                        />

                        <div className="mt-8 space-y-4">
                            {/* Disclaimer */}
                            <div className="flex items-start gap-3 p-4 bg-black/20 rounded-xl border border-white/5">
                                <input
                                    type="checkbox"
                                    id="disclaimer"
                                    checked={isDisclaimerChecked}
                                    onChange={(e) => setIsDisclaimerChecked(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                />
                                <label htmlFor="disclaimer" className="text-xs text-gray-400 cursor-pointer select-none">
                                    I certify that I own or have the rights to use this content. I grant {reviewer.tiktok_handle} permission to review this content live.
                                </label>
                            </div>

                            {/* Free Submission Message */}
                            {priorityValue === 0 && (
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                                    <p className="text-sm text-blue-300">
                                        Free submissions are welcome! Please follow me on Instagram to support the stream: <a href={reviewer.configuration?.social_link_url || `https://instagram.com/${reviewer.tiktok_handle}`} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-white">{reviewer.configuration?.social_link_text || `@${reviewer.tiktok_handle}`}</a>
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={() => handleSubmit()}
                                disabled={isSubmitting || !slot1 || !isDisclaimerChecked}
                                className={`
                                    w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02]
                                    ${(!slot1 || !isDisclaimerChecked) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-blue-500/25'}
                                `}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                                        Processing...
                                    </span>
                                ) : (
                                    `Submit ${priorityValue > 0 ? `($${priorityValue})` : '(Free)'}`
                                )}
                            </button>
                        </div>
                    </div>
                </div >
            </div >

            <RecentTracksDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSelect={(track) => {
                    loadFromDrawer(track);
                    setIsDrawerOpen(false);
                }}
            />

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                amount={checkoutAmount !== null ? checkoutAmount : priorityValue}
                reviewerId={reviewer.id}
                metadata={{
                    type: user ? 'wallet_topup' : 'priority_request',
                    tier: selectedTier?.label || 'Custom',
                    artist: slot1?.artist,
                    genre: slot1?.genre,
                    track_url: slot1?.track_url || (slot1?.file ? "File Upload" : undefined),
                    track_title: slot1?.track_title,
                    email: (user as any)?.email
                }}
                onSuccess={handleCheckoutSuccess}
            />

            {/* Duplicate Modal */}
            <AnimatePresence>
                {isDuplicateModalOpen && duplicateInfo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-2">Track Already in Queue</h3>
                            <p className="text-gray-400 mb-4 text-sm">
                                This track is currently active in the queue.
                            </p>

                            <div className="bg-black/40 rounded-xl p-4 mb-6 border border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <Music className="text-gray-500" size={20} />
                                    <span className="font-bold text-white">{duplicateInfo.existing_submission.track_title}</span>
                                </div>
                                <p className="text-xs text-gray-500">Submitted on: {duplicateInfo.existing_submission.submitted_at ? new Date(duplicateInfo.existing_submission.submitted_at).toLocaleDateString() : 'Unknown'}</p>
                            </div>

                            <p className="text-gray-300 text-sm mb-6">
                                Would you like to update the file (keeping its spot) or submit it as a new entry?
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => handleSubmit(true, duplicateInfo.file_hash)}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
                                >
                                    Use Existing File
                                </button>
                                <button
                                    onClick={() => handleSubmit(true)}
                                    className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                                >
                                    Upload New Version
                                </button>
                                <button
                                    onClick={() => setIsDuplicateModalOpen(false)}
                                    className="w-full py-2 text-gray-500 hover:text-white transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default SmartZone;
