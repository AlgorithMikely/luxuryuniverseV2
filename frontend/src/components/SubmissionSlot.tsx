import React from "react";
import { useDropzone } from "react-dropzone";
import { FolderOpen, Upload, Music, X } from "lucide-react";
import { SmartSubmissionItem } from "../types";

interface SubmissionSlotProps {
    slotNum: number;
    item: SmartSubmissionItem | null;
    onClear: () => void;
    onOpenDrawer: () => void;
    onDrop: (files: File[]) => void;
    onPaste: (e: React.ClipboardEvent) => void;
    onUpdate: (updates: Partial<SmartSubmissionItem>) => void;
    isVipSlot?: boolean;
    isLoggedIn: boolean;
}

const SubmissionSlot: React.FC<SubmissionSlotProps> = ({
    slotNum,
    item,
    onClear,
    onOpenDrawer,
    onDrop,
    onPaste,
    onUpdate,
    isVipSlot,
    isLoggedIn
}) => {

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: !!item, maxFiles: 1 });

    return (
        <div
            {...getRootProps()}
            className={`
                relative rounded-2xl border-2 transition-all duration-300 min-h-[160px] flex flex-col justify-center
                ${item ? 'border-solid bg-gray-900/80 border-transparent' : 'border-dashed cursor-pointer hover:bg-white/5'}
                ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}
                ${isVipSlot ? 'shadow-[0_0_15px_rgba(234,179,8,0.2)]' : ''}
            `}
            onPaste={!item ? onPaste : undefined}
        >
            <input {...getInputProps()} disabled={!!item} />

            {!item ? (
                <div className="flex flex-col items-center text-gray-400 p-4 md:p-6">
                    <Upload size={24} className="mb-2 opacity-50" />
                    <p className="font-medium text-sm">Drag track or paste link</p>

                    <div className="w-full max-w-[90%] mt-3 mb-2">
                        <input
                            type="text"
                            placeholder="Paste Link..."
                            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                            onPaste={onPaste}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value;
                                    if (val) {
                                        const clipboardData = { getData: () => val } as any;
                                        onPaste({ clipboardData, preventDefault: () => { } } as any);
                                    }
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {isLoggedIn && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenDrawer(); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs transition-colors mt-2"
                        >
                            <FolderOpen size={12} />
                            Load Recent
                        </button>
                    )}
                </div>
            ) : (
                <div className="p-4 w-full h-full flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-gray-500">
                                <Music size={20} />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold truncate max-w-[180px] text-sm">{item.track_title || "Unknown Track"}</span>
                                <span className="text-xs text-gray-500 truncate max-w-[180px]">{item.track_url}</span>
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="p-1 hover:text-red-400 transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="text"
                            placeholder="Artist"
                            value={item.artist || ""}
                            onChange={(e) => onUpdate({ artist: e.target.value })}
                            className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
                        />
                        <input
                            type="text"
                            placeholder="Title"
                            value={item.track_title || ""}
                            onChange={(e) => onUpdate({ track_title: e.target.value })}
                            className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubmissionSlot;
