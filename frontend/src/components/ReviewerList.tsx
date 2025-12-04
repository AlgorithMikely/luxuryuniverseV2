import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { ReviewerProfile } from "../types";
import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext";

const ReviewerList = () => {
    const [reviewers, setReviewers] = useState<ReviewerProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { socket } = useSocket();

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

    // Socket Listeners for Live Status
    useEffect(() => {
        if (!socket) return;

        // Join global room for updates
        socket.emit("join_global_room");

        const handleGlobalUpdate = (data: { reviewer_id: number, is_live: boolean }) => {
            setReviewers(prev => prev.map(r =>
                r.id === data.reviewer_id ? { ...r, is_live: data.is_live } : r
            ));
        };

        socket.on("global_reviewer_update", handleGlobalUpdate);

        return () => {
            socket.off("global_reviewer_update", handleGlobalUpdate);
        };
    }, [socket]);

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
                    className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col items-center space-y-4 hover:border-purple-500/50 transition-colors relative overflow-hidden"
                >
                    {/* Live Tag */}
                    {reviewer.is_live && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 z-10">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="text-[10px] font-bold text-red-500 leading-none tracking-wider">LIVE</span>
                        </div>
                    )}

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
