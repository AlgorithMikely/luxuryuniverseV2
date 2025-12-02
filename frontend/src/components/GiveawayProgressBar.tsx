import React, { useEffect, useState } from 'react';
import { useQueueStore, GiveawayState } from '../stores/queueStore';
import { motion } from 'framer-motion';

interface Props {
    overrideState?: GiveawayState | null;
}

const GiveawayProgressBar: React.FC<Props> = ({ overrideState }) => {
    const { giveawayState: storeState } = useQueueStore();
    const giveawayState = overrideState !== undefined ? overrideState : storeState;

    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (!giveawayState?.cooldown_end) {
            setTimeLeft(null);
            return;
        }

        const interval = setInterval(() => {
            const end = new Date(giveawayState.cooldown_end!).getTime();
            const now = new Date().getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft(null);
                clearInterval(interval);
            } else {
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [giveawayState?.cooldown_end]);

    if (!giveawayState) return null;

    const { progress, target, description } = giveawayState;
    const percent = Math.min((progress / target) * 100, 100);
    const isCooldown = !!timeLeft;

    return (
        <div className="w-full max-w-md mx-auto mb-4 relative group">
            {/* Animated Gradient Border */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-xl opacity-75 blur-[2px] group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-gradient-xy"></div>

            <div className="relative p-4 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Background Pulse Animation */}
                <div className="absolute inset-0 bg-purple-500/10 animate-pulse-slow pointer-events-none" />

                {/* Shiny Overlay Animation */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-center mb-2 relative z-10">
                    <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 uppercase tracking-widest drop-shadow-sm animate-text-shimmer bg-[length:200%_auto]">
                        {isCooldown ? "COOLDOWN ACTIVE" : "COMMUNITY SKIP GOAL"}
                    </h3>
                    <span className="text-xs text-white/90 font-mono font-bold drop-shadow-md">
                        {isCooldown ? timeLeft : `${progress} / ${target}`}
                    </span>
                </div>

                {/* Progress Bar Container */}
                <div className="relative h-6 bg-gray-900/90 rounded-full overflow-hidden border border-white/10 shadow-inner ring-1 ring-white/5">
                    {/* Fill */}
                    <motion.div
                        className={`absolute top-0 left-0 h-full ${isCooldown ? 'bg-gray-600' : 'bg-gradient-to-r from-pink-600 via-purple-500 to-indigo-500'
                            }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                    >
                        {/* Stronger Shimmer Effect */}
                        {!isCooldown && (
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12 animate-shimmer-fast" />
                        )}

                        {/* Leading Edge Glow */}
                        {!isCooldown && percent > 0 && percent < 100 && (
                            <div className="absolute right-0 top-0 h-full w-2 bg-white/80 blur-[4px] shadow-[0_0_10px_white]" />
                        )}
                    </motion.div>
                </div>

                {/* Description / Status */}
                <div className="mt-2 flex justify-between items-center relative z-10">
                    <p className="text-xs text-gray-200 font-medium drop-shadow-sm">
                        {isCooldown
                            ? "Next giveaway starts soon..."
                            : description || "Interactions fill the bar!"}
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes shimmer-fast {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer-fast {
                    animation: shimmer-fast 1.5s infinite linear;
                }
                @keyframes text-shimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-text-shimmer {
                    animation: text-shimmer 3s ease infinite;
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.1; }
                    50% { opacity: 0.3; }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 4s ease-in-out infinite;
                }
                @keyframes gradient-xy {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient-xy {
                    background-size: 200% 200%;
                    animation: gradient-xy 3s ease infinite;
                }
            `}</style>
        </div>
    );
};

export default GiveawayProgressBar;
