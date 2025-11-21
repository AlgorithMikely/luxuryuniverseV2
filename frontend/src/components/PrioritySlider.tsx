import React from "react";
import * as Slider from "@radix-ui/react-slider";
import { Lock, Unlock, Zap } from "lucide-react";

interface PriorityTier {
    value: number;
    label: string;
    color: string;
}

interface PrioritySliderProps {
    value: number;
    onChange: (value: number) => void;
    tiers: PriorityTier[];
}

const PrioritySlider: React.FC<PrioritySliderProps> = ({ value, onChange, tiers }) => {
    // Determine current tier index
    // If exact match isn't found, find nearest or just use value
    // We assume the slider steps between defined tiers.

    // Ensure we have tiers sorted
    const sortedTiers = [...tiers].sort((a, b) => a.value - b.value);

    // Calculate max value
    const max = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1].value : 50;

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

            <Slider.Root
                className="relative flex items-center select-none touch-none w-full h-10 group"
                value={[value]}
                max={max}
                step={1} // We'll snap to tiers below via logic if desired, or let it slide free if tiers are just markers
                onValueChange={(val) => {
                    // Snap to nearest tier?
                    // Let's just find the closest tier value for better UX
                    const raw = val[0];
                    const closest = sortedTiers.reduce((prev, curr) => {
                        return (Math.abs(curr.value - raw) < Math.abs(prev.value - raw) ? curr : prev);
                    });
                    onChange(closest.value);
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

            <div className="flex justify-between mt-2 px-1">
                {sortedTiers.map((tier) => (
                    <div
                        key={tier.value}
                        className={`flex flex-col items-center cursor-pointer transition-opacity ${value === tier.value ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                        onClick={() => onChange(tier.value)}
                    >
                        <div className={`w-1 h-2 mb-1 rounded-full ${tier.value >= 25 ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                        <span className="text-[10px] font-medium">{tier.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PrioritySlider;
