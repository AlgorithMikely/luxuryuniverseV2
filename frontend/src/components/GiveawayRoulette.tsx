import React, { useEffect, useState } from 'react';
import { useQueueStore } from '../stores/queueStore';
import { motion, AnimatePresence } from 'framer-motion';

const GiveawayRoulette: React.FC = () => {
    const { giveawayWinner, setGiveawayWinner } = useQueueStore();
    const [isSpinning, setIsSpinning] = useState(false);
    const [displayedName, setDisplayedName] = useState("Loading...");

    useEffect(() => {
        if (giveawayWinner) {
            setIsSpinning(true);

            // Simulate spinning names
            const names = ["@user1", "@fan_123", "@music_lover", "@hype_beast", "@vip_member", "???"];
            let interval: any;
            let counter = 0;

            interval = setInterval(() => {
                setDisplayedName(names[counter % names.length]);
                counter++;
            }, 100);

            // Stop spinning after 4 seconds
            const timeout = setTimeout(() => {
                clearInterval(interval);
                setIsSpinning(false);
                setDisplayedName(giveawayWinner.username);
                // Trigger confetti here if possible
            }, 4000);

            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }
    }, [giveawayWinner]);

    if (!giveawayWinner) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gray-900 border-2 border-yellow-500/50 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center relative overflow-hidden"
                >
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-yellow-500/10 blur-3xl" />

                    <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-widest relative z-10">
                        {isSpinning ? "Picking Winner..." : "🎉 WINNER! 🎉"}
                    </h2>

                    <div className="relative z-10 py-8">
                        <motion.div
                            key={displayedName}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className={`text-4xl md:text-5xl font-bold ${isSpinning ? "text-gray-400" : "text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                                }`}
                        >
                            {displayedName}
                        </motion.div>

                        {!isSpinning && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="mt-4 text-purple-300 font-mono text-lg"
                            >
                                Prize: {giveawayWinner.prize}
                            </motion.div>
                        )}
                    </div>

                    {!isSpinning && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setGiveawayWinner(null)}
                            className="mt-6 px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full uppercase tracking-wider shadow-lg relative z-10"
                        >
                            Claim & Close
                        </motion.button>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GiveawayRoulette;
