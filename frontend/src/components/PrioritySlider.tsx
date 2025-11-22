import React from "react";
import * as Slider from "@radix-ui/react-slider";
import { Lock, Unlock, Zap } from "lucide-react";

import { PriorityTier } from "../types";

interface PrioritySliderProps {
    value: number;
    onChange: (value: number) => void;
    tiers: PriorityTier[];
    openTiers?: number[];
}

const PrioritySlider: React.FC<PrioritySliderProps> = ({ value, onChange, tiers, openTiers }) => {
    // Determine current tier index
    // If exact match isn't found, find nearest or just use value
    // We assume the slider steps between defined tiers.

    // Ensure we have tiers sorted
    const sortedTiers = [...tiers].sort((a, b) => a.value - b.value);

    // Use index-based positioning for equal spacing
    const maxIndex = Math.max(0, sortedTiers.length - 1);
    const currentIndex = sortedTiers.findIndex(t => t.value === value);
    const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;

    const isVIP = value >= 25; // Threshold

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Queue Priority
                </span>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all
                    ${isVIP ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'bg-gray-700 text-gray-400'}
                `}>
                    {isVIP ? <Unlock size={12} /> : <Lock size={12} />}
                    {isVIP ? "VIP UNLOCKED" : "STANDARD"}
                </div>
            </div>

            <div className="relative w-full h-16">
                <Slider.Root
                    className="relative flex items-center select-none touch-none w-full h-6 group z-10"
                    value={[effectiveIndex]}
                    max={maxIndex}
                    step={1}
                    onValueChange={(val: number[]) => {
                        const newIndex = val[0];
                        if (sortedTiers[newIndex]) {
                            // Check if tier is open
                            const tierValue = sortedTiers[newIndex].value;
                            if (!openTiers || openTiers.includes(tierValue)) {
                                onChange(tierValue);
                            }
                        }
                    }}
                >
                    <Slider.Track className="bg-gray-700 relative grow rounded-full h-[6px]">
                        <Slider.Range className={`absolute h-full rounded-full transition-colors duration-300 ${isVIP ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' : 'bg-blue-500'}`} />
                    </Slider.Track>
                    <Slider.Thumb
                        className={`block w-6 h-6 rounded-full shadow-lg border-2 focus:outline-none transition-transform hover:scale-110
                            ${isVIP ? 'bg-yellow-400 border-yellow-200 shadow-yellow-500/50' : 'bg-white border-blue-500'}
                        `}
                        aria-label="Priority"
                    >
                        {isVIP && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap size={12} className="text-black fill-current" />
                            </div>
                        )}
                    </Slider.Thumb>
                </Slider.Root>

                {/* Ticks and Labels - Positioned absolutely within the same container to ensure perfect alignment */}
                <div className="absolute top-6 left-3 right-3 h-10 pointer-events-none">
                    {sortedTiers.map((tier, index) => {
                        const percent = maxIndex === 0 ? 0 : (index / maxIndex) * 100;
                        const isOpen = !openTiers || openTiers.includes(tier.value);

                        return (
                            <div
                                key={tier.value}
                                className={`absolute flex flex-col items-center transition-opacity transform -translate-x-1/2 
                                    ${value === tier.value ? 'opacity-100' : isOpen ? 'opacity-40' : 'opacity-20 grayscale'}
                                `}
                                style={{ left: `${percent}%` }}
                            >
                                {/* Tick mark */}
                                <div className={`w-1 h-2 mb-1 rounded-full ${tier.value >= 25 ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                                {/* Label */}
                                <span
                                    className={`text-[10px] font-medium whitespace-nowrap pointer-events-auto ${isOpen ? 'cursor-pointer hover:text-white' : 'cursor-not-allowed text-gray-600'}`}
                                    onClick={() => {
                                        if (isOpen) onChange(tier.value);
                                    }}
                                >
                                    {tier.label}
                                </span>
                                {tier.submissions_count && tier.submissions_count > 1 && (
                                    <span
                                        className={`text-[9px] whitespace-nowrap pointer-events-auto mt-0.5 ${isOpen ? 'cursor-pointer hover:text-white' : 'cursor-not-allowed text-gray-600'}`}
                                        onClick={() => {
                                            if (isOpen) onChange(tier.value);
                                        }}
                                    >
                                        ({tier.submissions_count} songs)
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PrioritySlider;
