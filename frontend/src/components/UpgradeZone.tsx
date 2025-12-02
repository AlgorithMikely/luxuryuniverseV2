import React, { useState, useEffect } from "react";
import { Music, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReviewerProfile, Submission } from "../types";
import RecentTracksDrawer from "./RecentTracksDrawer";
import PrioritySlider from "./PrioritySlider";
import api from "../services/api";
import toast from "react-hot-toast";
import CheckoutModal from "./CheckoutModal";
import { useAuthStore } from "../stores/authStore";
import SubmissionSlot from "./SubmissionSlot";
import { SmartSubmissionItem } from "../types";
import { useSubmissionSlots } from "../hooks/useSubmissionSlots";

interface UpgradeZoneProps {
    reviewer: ReviewerProfile;
    existingSubmission: Submission | null;
    onClose: () => void;
    onSuccess: () => void;
}

const UpgradeZone: React.FC<UpgradeZoneProps> = ({ reviewer, existingSubmission, onClose, onSuccess }) => {
    // Initialize slot1 with existing submission if present
    const initialSlot1: SmartSubmissionItem | null = existingSubmission ? {
        track_url: existingSubmission.track_url,
        track_title: existingSubmission.track_title || "Existing Submission",
        artist: existingSubmission.artist,
        genre: existingSubmission.genre,
        priority_value: existingSubmission.priority_value,
        sequence_order: 1,
        hook_start_time: existingSubmission.hook_start_time,
        hook_end_time: existingSubmission.hook_end_time
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
        initialSlots: { slot1: initialSlot1 }
    });

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [priorityValue, setPriorityValue] = useState(existingSubmission?.priority_value || 0);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
    const { user } = useAuthStore();

    // Determine allowed submissions based on tier
    const selectedTier = reviewer.configuration?.priority_tiers?.find(t => t.value === priorityValue);
    const allowedSubmissions = selectedTier?.submissions_count || 1;
    const isVIP = allowedSubmissions > 1;

    // Filter tiers: if existing, show upgrades (>= current). If new, show all (>= 0).
    const baseValue = existingSubmission?.priority_value || 0;
    const availableTiers = reviewer.configuration?.priority_tiers?.filter(t => t.value >= baseValue) || [];

    useEffect(() => {
        // Clear slots if they are no longer allowed
        if (allowedSubmissions < 2 && slot2) setSlot2(null);
        if (allowedSubmissions < 3 && slot3) setSlot3(null);
    }, [allowedSubmissions, slot2, slot3]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleUpgrade = async () => {
        const cost = Math.max(0, priorityValue - baseValue);

        if (cost <= 0 && priorityValue === baseValue && existingSubmission) {
            // No upgrade selected
            toast.error("Please select a higher tier to upgrade.");
            return;
        }

        if (!existingSubmission && !slot1) {
            toast.error("Please add a track to submit.");
            return;
        }

        setIsCheckoutOpen(true);
    };

    const performUpgrade = async () => {
        setIsSubmitting(true);
        try {
            if (!existingSubmission) {
                // NEW SUBMISSION FLOW
                await performNewSubmission();
                return;
            }

            // UPGRADE FLOW
            const newSubmissions = [];
            if (allowedSubmissions >= 2 && slot2) newSubmissions.push(slot2);
            if (allowedSubmissions >= 3 && slot3) newSubmissions.push(slot3);

            if ((slot2?.file) || (slot3?.file)) {
                toast.error("File uploads are not yet supported for upgrades. Please use links (SoundCloud, Dropbox, etc).");
                setIsSubmitting(false);
                return;
            }

            const payload = {
                target_priority_value: priorityValue,
                new_submissions: newSubmissions
            };

            await api.post(`/queue/line/${reviewer.id}/submission/${existingSubmission.id}/upgrade`, payload);

            toast.success("Upgrade successful!");
            onSuccess();
            onClose();

        } catch (e: any) {
            console.error(e);
            if (e.response?.status === 402) {
                toast.error("Insufficient funds. Please top up.");
                setIsCheckoutOpen(true);
            } else {
                toast.error(e.response?.data?.detail || "Upgrade failed.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const performNewSubmission = async () => {
        // Construct FormData for new submission
        const formData = new FormData();
        const items = [];

        if (slot1) items.push({ ...slot1, sequence_order: 1, priority_value: priorityValue });
        if (allowedSubmissions >= 2 && slot2) items.push({ ...slot2, sequence_order: 2, priority_value: priorityValue });
        if (allowedSubmissions >= 3 && slot3) items.push({ ...slot3, sequence_order: 3, priority_value: priorityValue });

        // Handle files
        if (slot1?.file) formData.append('files', slot1.file);
        if (slot2?.file) formData.append('files', slot2.file);
        if (slot3?.file) formData.append('files', slot3.file);

        // Sanitize items for JSON (remove file objects)
        const sanitizedItems = items.map(item => {
            const { file, ...rest } = item;
            return rest;
        });

        const payload = {
            submissions: sanitizedItems,
            is_priority: priorityValue > 0
        };

        formData.append('submissions_json', JSON.stringify(payload));
        if ((user as any)?.email) formData.append('email', (user as any).email);

        await api.post(`/reviewer/${reviewer.id}/submit`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        toast.success("Submission successful!");
        onSuccess();
        onClose();
    };

    const upgradeCost = Math.max(0, priorityValue - baseValue);
    const buttonText = existingSubmission ? `Upgrade for $${upgradeCost}` : `Submit for $${upgradeCost}`;

    return (
        <div className="flex flex-col gap-6 h-full w-full max-w-full overflow-hidden">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">{existingSubmission ? "Upgrade Submission" : "New Submission"}</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 md:gap-6 items-start overflow-y-auto pr-1 md:pr-2">
                {/* Left Column: Slots */}
                <div className="space-y-6">
                    {/* Slot 1 */}
                    {existingSubmission ? (
                        <div className="relative rounded-2xl border-2 border-solid bg-gray-900/80 border-blue-500/50 min-h-[120px] flex flex-col justify-center p-4">
                            <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-bold">
                                CURRENT TRACK
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-gray-500">
                                    <Music size={24} />
                                </div>
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

                    {/* Slot 3 */}
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
                </div>

                {/* Right Column: Controls */}
                <div className="bg-gray-800/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 shadow-xl">
                    <h3 className="text-xl font-bold mb-4">Select {existingSubmission ? "Upgrade" : "Priority"} Tier</h3>

                    <PrioritySlider
                        value={priorityValue}
                        onChange={setPriorityValue}
                        tiers={availableTiers}
                        openTiers={reviewer.open_queue_tiers}
                    />

                    <div className="mt-8 space-y-4">
                        <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl">
                            <span className="text-gray-400">{existingSubmission ? "Upgrade Cost" : "Total Cost"}</span>
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
                            onClick={handleUpgrade}
                            disabled={isSubmitting || (existingSubmission ? upgradeCost <= 0 : !slot1) || !isDisclaimerChecked}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                                ${(isSubmitting || (existingSubmission ? upgradeCost <= 0 : !slot1) || !isDisclaimerChecked) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-[1.02]'}
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
                amount={upgradeCost}
                reviewerId={reviewer.id}
                metadata={{
                    type: 'wallet_topup', // Just top up, we handle upgrade after
                    email: (user as any)?.email, // Ensure email is passed if needed
                    track_url: slot1?.track_url,
                    track_title: slot1?.track_title,
                    artist: slot1?.artist,
                    genre: slot1?.genre
                }}
                onSuccess={() => {
                    setIsCheckoutOpen(false);
                    performUpgrade(); // Trigger upgrade after successful payment/topup
                }}
            />
        </div>
    );
};

export default UpgradeZone;
