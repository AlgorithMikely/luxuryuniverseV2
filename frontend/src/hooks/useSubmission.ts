import { useState } from 'react';
import { SmartSubmissionItem, ReviewerProfile } from '../types';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

interface UseSubmissionProps {
    reviewer: ReviewerProfile;
    onSuccess: () => void;
    onOpenCheckout: (shortfall?: number) => void;
    onOpenDuplicateModal: (info: any) => void;
    onHistoryDuplicate?: (info: any) => void;
}

export const useSubmission = ({ reviewer, onSuccess, onOpenCheckout, onOpenDuplicateModal, onHistoryDuplicate }: UseSubmissionProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuthStore();

    const submit = async (
        slots: { slot1: SmartSubmissionItem | null, slot2: SmartSubmissionItem | null, slot3: SmartSubmissionItem | null },
        priorityValue: number,
        allowedSubmissions: number,
        force: boolean = false,
        reuseHash: string | null = null
    ) => {
        const { slot1, slot2, slot3 } = slots;

        // Validate
        if (!slot1) {
            toast.error("Slot 1 is empty!");
            return;
        }

        // Check if Guest
        if (!user) {
            onOpenCheckout();
            return;
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
            is_priority: priorityValue > 0
        };

        formData.append('submissions_json', JSON.stringify(payload));
        if (force) formData.append('force_upload', 'true');
        if (reuseHash) formData.append('reuse_hash', reuseHash);
        if ((user as any)?.email) formData.append('email', (user as any).email);

        try {
            await api.post(`/reviewer/${reviewer.id}/submit`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            toast.success("Submission successful!");
            onSuccess();
        } catch (e: any) {
            console.error("Submission Error:", e);
            const status = e.response?.status || e.status;
            const detail = e.response?.data?.detail || "";

            console.log("Debug Submission Error Check:", { status, detail, includes: typeof detail === 'string' && detail.includes("Insufficient") });

            if (status == 402 || (typeof detail === 'string' && detail.includes("Insufficient"))) {
                toast.error("Insufficient funds. Please top up.");

                let shortfall = undefined;
                if (typeof detail === 'string') {
                    const match = detail.match(/Required:\s*(\d+),\s*Available:\s*(\d+)/);
                    if (match) {
                        const required = parseInt(match[1]);
                        const available = parseInt(match[2]);
                        shortfall = required - available;
                    }
                }

                onOpenCheckout(shortfall);
                return;
            }

            if (status === 409) {
                try {
                    const info = JSON.parse(detail);
                    // Check if ANY slot is a history load. 
                    const hasHistoryItem = slot1?.is_history || slot2?.is_history || slot3?.is_history;

                    if (hasHistoryItem && info.is_active) {
                        toast.error("This track is already active in the queue. Please select another.");
                        if (onHistoryDuplicate) {
                            onHistoryDuplicate(info);
                        }
                        return;
                    }

                    onOpenDuplicateModal(info);
                    return;
                } catch (err) {
                    console.error("Failed to parse duplicate info", err);
                }
            }

            const msg = typeof detail === 'string' ? detail : "Submission failed.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const upgrade = async (
        submissionId: number,
        priorityValue: number,
        slots: { slot1: SmartSubmissionItem | null, slot2: SmartSubmissionItem | null, slot3: SmartSubmissionItem | null },
        allowedSubmissions: number
    ) => {
        const { slot1, slot2, slot3 } = slots;
        setIsSubmitting(true);

        try {
            if ((slot2?.file) || (slot3?.file)) {
                toast.error("File uploads are not yet supported for upgrades. Please use links (SoundCloud, Dropbox, etc).");
                setIsSubmitting(false);
                return;
            }

            const newSubmissions = [];
            if (allowedSubmissions >= 2 && slot2) newSubmissions.push(slot2);
            if (allowedSubmissions >= 3 && slot3) newSubmissions.push(slot3);

            const payload = {
                target_priority_value: priorityValue,
                new_submissions: newSubmissions,
                note: slot1?.note,
                genre: slot1?.genre
            };

            await api.post(`/queue/line/${reviewer.id}/submission/${submissionId}/upgrade`, payload);

            toast.success("Upgrade successful!");
            onSuccess();
        } catch (e: any) {
            console.error("Upgrade Error:", e);
            const status = e.response?.status || e.status;
            const detail = e.response?.data?.detail || "";

            console.log("Debug Upgrade Error Check:", { status, detail, includes: typeof detail === 'string' && detail.includes("Insufficient") });

            if (status == 402 || (typeof detail === 'string' && detail.includes("Insufficient"))) {
                toast.error("Insufficient funds. Please top up.");

                let shortfall = undefined;
                if (typeof detail === 'string') {
                    const match = detail.match(/Required:\s*(\d+),\s*Available:\s*(\d+)/);
                    if (match) {
                        const required = parseInt(match[1]);
                        const available = parseInt(match[2]);
                        shortfall = required - available;
                    }
                }

                onOpenCheckout(shortfall);
            } else {
                toast.error(detail || "Upgrade failed.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        submit,
        upgrade,
        isSubmitting
    };
};
