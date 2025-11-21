import React, { useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FolderOpen, Upload, Music, X, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReviewerProfile, Submission } from "../types";
import RecentTracksDrawer from "./RecentTracksDrawer";
import WaveformPlayer from "./WaveformPlayer";
import PrioritySlider from "./PrioritySlider";
import api from "../services/api";
import toast from "react-hot-toast";

interface SmartZoneProps {
  reviewer: ReviewerProfile;
}

export interface SmartSubmissionItem {
  track_url: string;
  track_title?: string;
  file?: File;
  hook_start_time?: number;
  hook_end_time?: number;
  priority_value: number;
  sequence_order: number;
}

const SmartZone: React.FC<SmartZoneProps> = ({ reviewer }) => {
  const [slot1, setSlot1] = useState<SmartSubmissionItem | null>(null);
  const [slot2, setSlot2] = useState<SmartSubmissionItem | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<1 | 2>(1); // Which slot is requesting from drawer

  const [priorityValue, setPriorityValue] = useState(0); // Coin/Tier value
  const [isVIP, setIsVIP] = useState(false); // If >= 25 (or whatever logic)

  // Determine if double feature is unlocked
  const vipThreshold = 25;
  useEffect(() => {
    setIsVIP(priorityValue >= vipThreshold);
    if (priorityValue < vipThreshold && slot2) {
        // Optional: Clear slot 2 if needed
    }
  }, [priorityValue, slot2]);

  const onDrop = async (acceptedFiles: File[], slotNum: 1 | 2) => {
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
    else setSlot2(item);
  };

  const handleLinkPaste = (e: React.ClipboardEvent, slotNum: 1 | 2) => {
      const text = e.clipboardData.getData('text');
      if (text && (text.includes('spotify') || text.includes('soundcloud') || text.includes('http'))) {
          e.preventDefault();
          const item: SmartSubmissionItem = {
              track_url: text,
              track_title: "Loading...", // We might want to fetch metadata
              priority_value: 0,
              sequence_order: slotNum
          };
          if (slotNum === 1) setSlot1(item);
          else setSlot2(item);
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
      else setSlot2(item);
      setIsDrawerOpen(false);
  };

  const handleSubmit = async () => {
      // Validate
      if (!slot1) {
          toast.error("Slot 1 is empty!");
          return;
      }

      // Prepare FormData
      const formData = new FormData();
      const items: SmartSubmissionItem[] = [];

      // Process Slot 1
      items.push({ ...slot1, priority_value: priorityValue });
      if (slot1.file) {
          formData.append('files', slot1.file);
      }

      // Process Slot 2 (if VIP)
      if (isVIP && slot2) {
          items.push({ ...slot2, priority_value: priorityValue });
           if (slot2.file) {
              formData.append('files', slot2.file);
          }
      }

      // Add metadata as JSON string
      // We need to ensure track_url for files is distinct or handled by backend index matching
      // The backend assumes order of 'files' matches order of items with 'blob:' URLs.

      const payload = {
          submissions: items,
          is_priority: isVIP
      };

      formData.append('submissions_json', JSON.stringify(payload));

      try {
          await api.post(`/reviewer/${reviewer.id}/submit`, formData, {
              headers: {
                  'Content-Type': 'multipart/form-data',
              },
          });
          toast.success("Submitted successfully!");
          setSlot1(null);
          setSlot2(null);
          setPriorityValue(0);
      } catch (e: any) {
          console.error(e);
          const msg = e.response?.data?.detail || "Submission failed.";
          toast.error(msg);
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
            />

            {/* Slot 2 - Only visible/active if VIP or conditionally shown */}
            <AnimatePresence>
                {isVIP && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                         <div className="flex items-center justify-center -my-3 z-10 relative text-yellow-500">
                             <div className="bg-gray-900 px-2 rounded-full border border-yellow-500/30">
                                <LinkIcon size={16} />
                             </div>
                         </div>
                         <SubmissionSlot
                            slotNum={2}
                            item={slot2}
                            onClear={() => setSlot2(null)}
                            onOpenDrawer={() => { setActiveSlot(2); setIsDrawerOpen(true); }}
                            onDrop={(files) => onDrop(files, 2)}
                            onPaste={(e) => handleLinkPaste(e, 2)}
                            onUpdate={(updates) => setSlot2(prev => prev ? { ...prev, ...updates } : null)}
                            isVipSlot
                        />
                    </motion.div>
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
                    onClick={handleSubmit}
                    disabled={!slot1 || reviewer.queue_status === 'closed'}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                        ${!slot1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                          isVIP ? 'bg-gradient-to-r from-yellow-600 to-yellow-400 text-black hover:scale-[1.02]' :
                          'bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02]'}
                    `}
                 >
                     {isVIP ? `Submit Double Feature (${priorityValue} Credits)` : `Submit Track (${priorityValue > 0 ? priorityValue + ' Credits' : 'Free'})`}
                 </button>
            </div>
        </div>

      </div>

      <RecentTracksDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelect={loadFromDrawer}
      />
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
}> = ({ slotNum, item, onClear, onOpenDrawer, onDrop, onPaste, onUpdate, isVipSlot }) => {

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
                    <div className="my-2 text-xs opacity-50">- OR -</div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenDrawer(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-sm transition-colors"
                    >
                        <FolderOpen size={14} />
                        Load Recent
                    </button>
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
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="p-1 hover:text-red-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Waveform / Hook Editor */}
                    <div className="flex-1 bg-gray-800/50 rounded-lg p-2">
                        <WaveformPlayer
                            url={item.track_url}
                            hookStartTime={item.hook_start_time}
                            onHookChange={(start, end) => onUpdate({ hook_start_time: start, hook_end_time: end })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartZone;
