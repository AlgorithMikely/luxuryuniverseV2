import React, { useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { SmartSubmissionItem } from "../types";

interface UseSubmissionSlotsProps {
    initialSlots?: {
        slot1?: SmartSubmissionItem | null;
        slot2?: SmartSubmissionItem | null;
        slot3?: SmartSubmissionItem | null;
    };
}

export const useSubmissionSlots = ({ initialSlots = {} }: UseSubmissionSlotsProps = {}) => {
    const [slot1, setSlot1] = useState<SmartSubmissionItem | null>(initialSlots.slot1 || null);
    const [slot2, setSlot2] = useState<SmartSubmissionItem | null>(initialSlots.slot2 || null);
    const [slot3, setSlot3] = useState<SmartSubmissionItem | null>(initialSlots.slot3 || null);

    // Track which slot is currently requesting data (e.g. from drawer)
    const [activeSlot, setActiveSlot] = useState<1 | 2 | 3>(1);

    const updateSlot = (slotNum: 1 | 2 | 3, updates: Partial<SmartSubmissionItem> | null) => {
        if (slotNum === 1) setSlot1(prev => prev && updates ? { ...prev, ...updates } : updates as any);
        else if (slotNum === 2) setSlot2(prev => prev && updates ? { ...prev, ...updates } : updates as any);
        else setSlot3(prev => prev && updates ? { ...prev, ...updates } : updates as any);
    };

    const handleDrop = async (acceptedFiles: File[], slotNum: 1 | 2 | 3) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const item: SmartSubmissionItem = {
            track_url: url,
            track_title: file.name.replace(/\.[^/.]+$/, ""),
            file: file,
            priority_value: 0,
            sequence_order: slotNum
        };

        updateSlot(slotNum, item);
    };

    const handlePaste = async (e: React.ClipboardEvent, slotNum: 1 | 2 | 3) => {
        const text = e.clipboardData.getData('text');
        if (text && (text.includes('spotify') || text.includes('soundcloud') || text.includes('http'))) {
            e.preventDefault();

            let title = "Loading...";
            let artist = "";
            let previewUrl = "";

            const item: SmartSubmissionItem = {
                track_url: text,
                track_title: title,
                priority_value: 0,
                sequence_order: slotNum
            };

            updateSlot(slotNum, item);

            // Metadata fetching logic
            try {
                if (text.includes('spotify.com/track')) {
                    const { data } = await api.post('/spotify/proxy/track', { url: text });
                    title = data.name;
                    artist = data.artists.map((a: any) => a.name).join(', ');
                    previewUrl = data.preview_url;
                    const genre = data.primary_genre || (data.genres && data.genres.length > 0 ? data.genres[0] : "");

                    const updatedItem = { ...item, track_title: title, artist, genre, preview_url: previewUrl };
                    updateSlot(slotNum, updatedItem);
                } else if (text.includes('youtube.com') || text.includes('youtu.be')) {
                    const { data } = await api.post('/proxy/metadata', { url: text });
                    const updatedItem = { ...item, track_title: data.title || "YouTube Video", artist: data.artist || "", genre: data.genre || "" };
                    updateSlot(slotNum, updatedItem);
                } else if (text.includes('soundcloud.com')) {
                    const { data } = await api.post('/soundcloud/metadata', { url: text });
                    const updatedItem = { ...item, track_title: data.title || "SoundCloud Track", artist: data.artist || "", genre: data.genre || "" };
                    updateSlot(slotNum, updatedItem);
                } else {
                    const loadedItem = { ...item, track_title: "Link Loaded" };
                    updateSlot(slotNum, loadedItem);
                }
            } catch (err) {
                console.error("Metadata fetch failed", err);
                const fallbackItem = { ...item, track_title: "Track (Metadata Failed)" };
                updateSlot(slotNum, fallbackItem);
            }
        }
    };

    const loadFromDrawer = (track: any) => {
        const item: SmartSubmissionItem = {
            track_url: track.file_url,
            track_title: track.track_title,
            hook_start_time: track.hook_start_time,
            priority_value: 0,
            sequence_order: activeSlot,
            is_history: true
        };
        updateSlot(activeSlot, item);
    };

    return {
        slot1, setSlot1,
        slot2, setSlot2,
        slot3, setSlot3,
        activeSlot, setActiveSlot,
        handleDrop,
        handlePaste,
        loadFromDrawer,
        updateSlot
    };
};
