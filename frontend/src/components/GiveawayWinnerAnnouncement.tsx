import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueueStore } from '../stores/queueStore';
import confetti from 'canvas-confetti';

interface WinnerData {
    username: string;
    tickets: number;
    prize: string;
}

const GiveawayWinnerAnnouncement: React.FC = () => {
    const [winner, setWinner] = useState<WinnerData | null>(null);
    const { socket } = useQueueStore();

    useEffect(() => {
        if (!socket) return;

        const handleWinner = (data: WinnerData) => {
            setWinner(data);
            triggerConfetti();

            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                setWinner(null);
            }, 10000);
        };

        socket.on('giveaway_winner', handleWinner);

        return () => {
            socket.off('giveaway_winner', handleWinner);
        };
    }, [socket]);

    const triggerConfetti = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    return (
        <AnimatePresence>
            {winner && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -100 }}
                    className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
                >
                    <div className="bg-black/80 backdrop-blur-xl border-2 border-yellow-500/50 rounded-3xl p-12 text-center shadow-[0_0_100px_rgba(234,179,8,0.3)] relative overflow-hidden max-w-2xl w-full mx-4">
                        {/* Background Glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 mb-4 drop-shadow-sm uppercase tracking-tighter">
                                Giveaway Winner!
                            </h2>
                        </motion.div>

                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, delay: 0.4 }}
                            className="my-8"
                        >
                            <div className="w-32 h-32 mx-auto bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
                                <span className="text-6xl">👑</span>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                        >
                            <h3 className="text-4xl font-bold text-white mb-2">
                                @{winner.username}
                            </h3>
                            <p className="text-xl text-yellow-200/80 font-medium">
                                Won a {winner.prize} with {winner.tickets} tickets!
                            </p>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default GiveawayWinnerAnnouncement;
