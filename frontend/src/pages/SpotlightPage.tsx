import React, { useEffect, useState } from "react";
import api from "../services/api";

interface SpotlightItem {
    id: number;
    track_title: string;
    artist: string;
    genre: string | null;
    review_score: number | null;
    submitter_username: string;
    submitter_avatar: string | null;
    submitter_discord_id: string | null;
    submitted_at: string | null;
    reviewer_name: string;
    reviewer_id: number;
}

const SpotlightPage = () => {
    const [items, setItems] = useState<SpotlightItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSpotlight = async () => {
            try {
                const { data } = await api.get<SpotlightItem[]>("/spotlight");
                setItems(data);
            } catch (error) {
                console.error("Failed to fetch spotlight items:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSpotlight();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="animate-pulse text-purple-400 font-bold text-xl">Loading Spotlight...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-4">
                        The Spotlight
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Top rated submissions from the community. Discover the best tracks reviewed by our creators.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            className="group relative bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1"
                        >
                            {/* Rank Badge */}
                            <div className="absolute top-4 left-4 z-10">
                                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg
                  ${index === 0 ? 'bg-yellow-400 text-black' :
                                        index === 1 ? 'bg-gray-300 text-black' :
                                            index === 2 ? 'bg-amber-600 text-white' :
                                                'bg-gray-700 text-gray-300'}
                `}>
                                    #{index + 1}
                                </div>
                            </div>

                            {/* Score Badge */}
                            {item.review_score !== null && (
                                <div className="absolute top-4 right-4 z-10">
                                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-purple-500/30 flex items-center gap-1">
                                        <span className="text-yellow-400">★</span>
                                        <span className="font-bold text-purple-200">{item.review_score.toFixed(1)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Card Content */}
                            <div className="p-6 pt-16">
                                <div className="flex items-start gap-4 mb-4">
                                    <img
                                        src={
                                            item.submitter_discord_id && item.submitter_avatar
                                                ? `https://cdn.discordapp.com/avatars/${item.submitter_discord_id}/${item.submitter_avatar}.png`
                                                : "https://cdn.discordapp.com/embed/avatars/0.png"
                                        }
                                        alt={item.submitter_username}
                                        className="w-12 h-12 rounded-full border-2 border-purple-500/30"
                                    />
                                    <div>
                                        <h3 className="font-bold text-xl text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
                                            {item.track_title}
                                        </h3>
                                        <p className="text-gray-400 text-sm">{item.artist}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {item.genre && (
                                        <div className="inline-block px-3 py-1 rounded-full bg-gray-700/50 text-xs text-gray-300 border border-gray-600">
                                            {item.genre}
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-gray-700/50 flex flex-col gap-1 text-sm text-gray-500">
                                        <div className="flex justify-between items-center">
                                            <span>Submitted by <span className="text-gray-300">{item.submitter_username}</span></span>
                                            {item.submitted_at && (
                                                <span>{new Date(item.submitted_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span>Spotlighted by <span className="text-purple-400 font-bold">{item.reviewer_name}</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hover Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                    ))}
                </div>

                {items.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-gray-500 text-xl">No spotlight items found yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpotlightPage;
