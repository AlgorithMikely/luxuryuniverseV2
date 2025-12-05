import React, { useState, useEffect } from "react";
import { Music, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReviewerProfile, Submission } from "../types";
import RecentTracksDrawer from "./RecentTracksDrawer";
import PrioritySlider from "./PrioritySlider";
import api from "../services/api";
import toast from "react-hot-toast";
import CheckoutModal from "./CheckoutModal";
import TopUpModal from "./TopUpModal";
import { useAuthStore } from "../stores/authStore";
import SubmissionSlot from "./SubmissionSlot";
import { SmartSubmissionItem } from "../types";
import { useSubmissionSlots } from "../hooks/useSubmissionSlots";
import { useSubmission } from "../hooks/useSubmission";

console.log("UpgradeZone Module Loaded - DEBUG CHECK " + Date.now());

interface UpgradeZoneProps {
    reviewer: ReviewerProfile;
    existingSubmissions: Submission[];
    onClose: () => void;
    onSuccess: () => void;
}

const UpgradeZone: React.FC<UpgradeZoneProps> = ({ reviewer, existingSubmissions, onClose, onSuccess }) => {
    // Initialize slots with existing submissions
    const initialSlot1: SmartSubmissionItem | null = existingSubmissions[0] ? {
        id: existingSubmissions[0].id,
        track_url: existingSubmissions[0].track_url,
        track_title: existingSubmissions[0].track_title || "Existing Submission",
        artist: existingSubmissions[0].artist,
        genre: existingSubmissions[0].genre,
        priority_value: existingSubmissions[0].priority_value,
        sequence_order: 1,
        hook_start_time: existingSubmissions[0].hook_start_time,
        hook_end_time: existingSubmissions[0].hook_end_time,
        cover_art_url: existingSubmissions[0].cover_art_url,
        is_history: false // It's an existing submission, not from history drawer in this context
    } : null;

    const initialSlot2: SmartSubmissionItem | null = existingSubmissions[1] ? {
        id: existingSubmissions[1].id,
        track_url: existingSubmissions[1].track_url,
        track_title: existingSubmissions[1].track_title || "Existing Submission",
        artist: existingSubmissions[1].artist,
        genre: existingSubmissions[1].genre,
        priority_value: existingSubmissions[1].priority_value,
        sequence_order: 2,
        hook_start_time: existingSubmissions[1].hook_start_time,
        hook_end_time: existingSubmissions[1].hook_end_time,
        cover_art_url: existingSubmissions[1].cover_art_url,
        is_history: false
    } : null;

    const initialSlot3: SmartSubmissionItem | null = existingSubmissions[2] ? {
        id: existingSubmissions[2].id,
        track_url: existingSubmissions[2].track_url,
        track_title: existingSubmissions[2].track_title || "Existing Submission",
        artist: existingSubmissions[2].artist,
        genre: existingSubmissions[2].genre,
        priority_value: existingSubmissions[2].priority_value,
        sequence_order: 3,
        hook_start_time: existingSubmissions[2].hook_start_time,
        hook_end_time: existingSubmissions[2].hook_end_time,
        cover_art_url: existingSubmissions[2].cover_art_url,
        is_history: false
    } : null;

    const {
        slot1, setSlot1,
        slot2, setSlot2,
        slot3, setSlot3,
        activeSlot, setActiveSlot,
        handleDrop,
        handlePaste,
        loadFromDrawer,
        updateSlot
    } = useSubmissionSlots({
        initialSlots: { slot1: initialSlot1, slot2: initialSlot2, slot3: initialSlot3 }
    });

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Determine initial priority value
    // We must find a tier that supports the number of existing submissions
    const minRequiredSlots = existingSubmissions.length || 1;

    // Find the lowest value tier that supports at least minRequiredSlots
    // AND is >= the current max priority of the submissions (to ensure it's an upgrade or at least same level)
    const maxExistingPriority = Math.max(0, ...existingSubmissions.map(s => s.priority_value || 0));

    const getInitialPriority = () => {
        if (!reviewer.configuration?.priority_tiers) return maxExistingPriority;

        // Filter tiers that support enough slots
        const capableTiers = reviewer.configuration.priority_tiers.filter(t =>
            (t.submissions_count || 1) >= minRequiredSlots
        );

        if (capableTiers.length === 0) return maxExistingPriority;

        // From capable tiers, find one that is >= maxExistingPriority
        // If all are lower (unlikely if we are upgrading), just take the highest capable one?
        // Or if we are just setting initial state, we want the *cheapest* capable tier that is valid.

        // Let's sort by value
        capableTiers.sort((a, b) => a.value - b.value);

        // Find first one >= maxExistingPriority
        const upgradeTier = capableTiers.find(t => t.value >= maxExistingPriority);

        return upgradeTier ? upgradeTier.value : capableTiers[capableTiers.length - 1].value;
    };

    const [priorityValue, setPriorityValue] = useState(getInitialPriority);

    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isTopUpOpen, setIsTopUpOpen] = useState(false);
    const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
    const { user } = useAuthStore();

    // Determine allowed submissions based on tier
    const selectedTier = reviewer.configuration?.priority_tiers?.find(t => t.value === priorityValue);
    const allowedSubmissions = selectedTier?.submissions_count || 1;
    const isVIP = allowedSubmissions > 1;

    // Base value for upgrade calculation
    const baseValue = maxExistingPriority;

    // Available tiers for slider: must support current number of filled slots?
    // Or we let the user select a tier, and if it doesn't support enough slots, we might have to warn or clear?
    // The previous logic cleared slots. Let's keep that but ensure we don't offer tiers that are "too small" if we can help it,
    // OR just let the effect handle it.
    // Better UX: Only show tiers that support the *currently filled* slots? 
    // No, that prevents downgrading/clearing. 
    // Let's show all tiers >= baseValue.
    const availableTiers = reviewer.configuration?.priority_tiers?.filter(t => t.value >= baseValue) || [];

    useEffect(() => {
        // Clear slots if they are no longer allowed
        if (allowedSubmissions < 2 && slot2) setSlot2(null);
        if (allowedSubmissions < 3 && slot3) setSlot3(null);
    }, [allowedSubmissions, slot2, slot3]);

    const [checkoutAmount, setCheckoutAmount] = useState<number | null>(null);

    const { submit, upgrade, isSubmitting } = useSubmission({
        reviewer,
        onSuccess: () => {
            onSuccess();
            onClose();
        },
        onOpenCheckout: (shortfall) => {
            // If shortfall is small (less than $6 aka 600 cents) or undefined, open TopUpModal
            // Actually, we want to force TopUp for ANY credit deficiency to encourage buying packs.
            // But if they want to pay exact amount?
            // The requirement says "users should not be allowed to upgrade for less than the $6 for 500 credits".
            // This implies we should push them to the $6 pack minimum.
            setIsTopUpOpen(true);
        },
        onOpenDuplicateModal: (info) => {
            toast.error("This track is already in the queue.");
        },
        onHistoryDuplicate: (info) => {
            let cleared = false;
            if (slot1?.is_history && slot1.track_url === info.track_url) { setSlot1(null); cleared = true; }
            if (slot2?.is_history && slot2.track_url === info.track_url) { setSlot2(null); cleared = true; }
            if (slot3?.is_history && slot3.track_url === info.track_url) { setSlot3(null); cleared = true; }
        }
    });

    const processUpgrade = async () => {
        console.log("processUpgrade START");
        const cost = Math.max(0, priorityValue - baseValue);

        if (cost <= 0 && priorityValue === baseValue && existingSubmissions.length > 0) {
            toast.error("Please select a higher tier to upgrade.");
            return;
        }

        if (existingSubmissions.length === 0 && !slot1) {
            toast.error("Please add a track to submit.");
            return;
        }

        if (existingSubmissions.length > 0) {
            await upgrade(
                existingSubmissions[0].id,
                priorityValue,
                { slot1, slot2, slot3 }, // These slots are populated with existing submission data
                allowedSubmissions
            );
        } else {
            await submit(
                { slot1, slot2, slot3 },
                priorityValue,
                allowedSubmissions
            );
        }
    };

    const upgradeCost = Math.max(0, priorityValue - baseValue);
    const buttonText = existingSubmissions.length > 0 ? `Upgrade for $${upgradeCost}` : `Submit for $${upgradeCost}`;

    return (
        <div className="flex flex-col gap-6 h-full w-full max-w-full overflow-hidden">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">{existingSubmissions.length > 0 ? "Upgrade Submission" : "New Submission"}</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 md:gap-6 items-start overflow-y-auto pr-1 md:pr-2">
                {/* Left Column: Slots */}
                <div className="space-y-6">
                    {/* Helper for Read Only Slot */}
                    {/* We can define this outside, but for now inline logic is fine or a small render function */}

                    {/* Slot 1 */}
                    {existingSubmissions[0] ? (
                        <div className="relative rounded-2xl border-2 border-solid bg-gray-900/80 border-blue-500/50 min-h-[120px] flex flex-col justify-center p-4">
                            <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-bold">
                                TRACK 1
                            </div>
                            <div className="flex items-center gap-3">
                                {slot1?.cover_art_url ? (
                                    <img src={slot1.cover_art_url} alt="Cover" className="w-12 h-12 rounded object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-gray-500">
                                        <Music size={24} />
                                    </div>
                                )}
                                <div className="flex flex-col overflow-hidden">
                                    <span className="font-bold truncate text-lg">{slot1?.track_title}</span>
                                    <span className="text-sm text-gray-400">{slot1?.artist || "Unknown Artist"}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <SubmissionSlot
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
                    )}

                    {/* Slot 2 */}
                    <AnimatePresence>
                        {allowedSubmissions >= 2 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                {existingSubmissions[1] ? (
                                    <div className="relative rounded-2xl border-2 border-solid bg-gray-900/80 border-blue-500/50 min-h-[120px] flex flex-col justify-center p-4">
                                        <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-bold">
                                            TRACK 2
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {slot2?.cover_art_url ? (
                                                <img src={slot2.cover_art_url} alt="Cover" className="w-12 h-12 rounded object-cover" />
                                            ) : (
                                                <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-gray-500">
                                                    <Music size={24} />
                                                </div>
                                            )}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-bold truncate text-lg">{slot2?.track_title}</span>
                                                <span className="text-sm text-gray-400">{slot2?.artist || "Unknown Artist"}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
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
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Slot 3 */}
                    <AnimatePresence>
                        {allowedSubmissions >= 3 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                {existingSubmissions[2] ? (
                                    <div className="relative rounded-2xl border-2 border-solid bg-gray-900/80 border-blue-500/50 min-h-[120px] flex flex-col justify-center p-4">
                                        <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-bold">
                                            TRACK 3
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {slot3?.cover_art_url ? (
                                                <img src={slot3.cover_art_url} alt="Cover" className="w-12 h-12 rounded object-cover" />
                                            ) : (
                                                <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-gray-500">
                                                    <Music size={24} />
                                                </div>
                                            )}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-bold truncate text-lg">{slot3?.track_title}</span>
                                                <span className="text-sm text-gray-400">{slot3?.artist || "Unknown Artist"}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
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
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right Column: Controls */}
                <div className="bg-gray-800/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 shadow-xl">
                    <h3 className="text-xl font-bold mb-4">Select {existingSubmissions.length > 0 ? "Upgrade" : "Priority"} Tier</h3>

                    <PrioritySlider
                        value={priorityValue}
                        onChange={setPriorityValue}
                        tiers={availableTiers}
                        openTiers={reviewer.open_queue_tiers}
                    />

                    <div className="mt-8 space-y-4">
                        <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl">
                            <span className="text-gray-400">{existingSubmissions.length > 0 ? "Upgrade Cost" : "Total Cost"}</span>
                            <span className="text-2xl font-bold text-green-400">${upgradeCost}</span>
                        </div>

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
                            onClick={processUpgrade}
                            disabled={isSubmitting || (existingSubmissions.length > 0 ? upgradeCost <= 0 : !slot1) || !isDisclaimerChecked}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                                ${(isSubmitting || (existingSubmissions.length > 0 ? upgradeCost <= 0 : !slot1) || !isDisclaimerChecked) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-[1.02]'}
                            `}
                        >
                            {isSubmitting ? 'Processing...' : buttonText}
                        </button>
                    </div>
                </div>
            </div>

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
                amount={checkoutAmount !== null ? checkoutAmount : upgradeCost}
                reviewerId={reviewer.id}
                submissionId={existingSubmissions[0]?.id}
                metadata={{
                    type: 'wallet_topup', // Just top up, we handle upgrade after
                    email: (user as any)?.email, // Ensure email is passed if needed
                    track_url: slot1?.track_url || (slot1?.file ? "File Upload" : undefined),
                    track_title: slot1?.track_title,
                    artist: slot1?.artist,
                    genre: slot1?.genre,
                    tier: existingSubmissions.length > 0 ? "Upgrade" : "Submission"
                }}
                onSuccess={() => {
                    setIsCheckoutOpen(false);
                    processUpgrade(); // Trigger upgrade/submission after successful payment/topup
                }}
            />

            <TopUpModal
                isOpen={isTopUpOpen}
                onClose={() => setIsTopUpOpen(false)}
                onSuccess={() => {
                    setIsTopUpOpen(false);
                    toast.success("Wallet topped up! Processing upgrade...");
                    processUpgrade();
                }}
                reviewerId={reviewer.id}
                requiredAmount={upgradeCost * 100} // Pass required amount in cents (since TopUpModal usually deals with credits/cents)
            />
        </div>
    );
};

export default UpgradeZone;
