import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import api from "../services/api";
import toast from "react-hot-toast";
import { ReviewerProfile, Submission } from "../types";
import SmartZone from "../components/SmartZone";
import { motion } from "framer-motion";

const SubmissionPage = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const navigate = useNavigate();
  const { user, checkAuth, isLoading: isAuthLoading } = useAuthStore();

  const [reviewer, setReviewer] = useState<ReviewerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth(true);
  }, [checkAuth]);

  useEffect(() => {
    const fetchReviewer = async () => {
      if (!reviewerId) return;
      try {
        const { data } = await api.get<ReviewerProfile>(`/reviewer/${reviewerId}/settings`);
        setReviewer(data);
      } catch (error) {
        console.error("Failed to load reviewer", error);
        toast.error("Could not find reviewer");
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };
    fetchReviewer();
  }, [reviewerId, navigate]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        Loading...
      </div>
    );
  }

  if (!reviewer) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden font-sans">

      {/* Dynamic Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-110 z-0"
        style={{
          backgroundImage: user?.avatar
            ? `url(${user.avatar.startsWith('http') ? user.avatar : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`})`
            : 'none'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/95 to-gray-900 z-0" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8 h-full flex flex-col items-center justify-center min-h-screen">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-4xl font-bold mb-2">Submit to {reviewer.tiktok_handle || reviewer.user?.username}</h1>
          <p className="text-gray-400">Drag & drop your track or load from library.</p>
        </motion.div>

        {/* The Glass Canvas */}
        <div className="w-full max-w-5xl">
          <SmartZone reviewer={reviewer} />
        </div>

      </div>
    </div>
  );
};

export default SubmissionPage;
