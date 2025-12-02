import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { ReviewerProfile } from "../types";
import toast from "react-hot-toast";

const ReviewerList = () => {
    const [reviewers, setReviewers] = useState<ReviewerProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReviewers = async () => {
            try {
                const { data } = await api.get<ReviewerProfile[]>("/reviewer/all");
                setReviewers(data);
            } catch (error) {
                console.error("Failed to fetch reviewers:", error);
                toast.error("Could not load reviewers.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchReviewers();
    }, []);

    if (isLoading) {
        return <div className="text-center text-gray-500 py-8">Loading reviewers...</div>;
    }

    if (reviewers.length === 0) {
        return <div className="text-center text-gray-500 py-8">No reviewers found.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviewers.map((reviewer) => (
                <div
                    key={reviewer.id}
                    className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col items-center space-y-4 hover:border-purple-500/50 transition-colors"
                >
                    {/* Avatar */}
                    <div className="relative">
                        <img
                            src={
                                reviewer.avatar_url ||
                                (reviewer.user?.avatar && reviewer.user?.discord_id
                                    ? `https://cdn.discordapp.com/avatars/${reviewer.user.discord_id}/${reviewer.user.avatar}.png`
                                    : "https://cdn.discordapp.com/embed/avatars/0.png")
                            }
                            alt={reviewer.user?.username}
                            className="w-20 h-20 rounded-full object-cover border-2 border-gray-600"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png";
                            }}
                        />
                        {/* Status Indicator */}
                        <div
                            className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-gray-800 ${reviewer.queue_status === "open" ? "bg-green-500" : "bg-red-500"
                                }`}
                            title={reviewer.queue_status === "open" ? "Queue Open" : "Queue Closed"}
                        />
                    </div>

                    {/* Info */}
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-white">{reviewer.user?.username}</h3>
                        {reviewer.tiktok_handle && (
                            <p className="text-sm text-gray-400">@{reviewer.tiktok_handle}</p>
                        )}
                    </div>

                    {/* Action Button */}
                    <Link
                        to={`/submit/${reviewer.tiktok_handle || reviewer.id}`}
                        className={`w-full py-2 px-4 rounded-lg font-bold text-center transition-colors ${reviewer.queue_status === "open"
                            ? "bg-purple-600 hover:bg-purple-500 text-white"
                            : "bg-gray-700 text-gray-400 cursor-not-allowed"
                            }`}
                        onClick={(e) => {
                            if (reviewer.queue_status !== "open") {
                                e.preventDefault();
                                toast.error("This queue is currently closed.");
                            }
                        }}
                    >
                        {reviewer.queue_status === "open" ? "Submit Here" : "Queue Closed"}
                    </Link>
                </div>
            ))}
        </div>
    );
};

export default ReviewerList;
