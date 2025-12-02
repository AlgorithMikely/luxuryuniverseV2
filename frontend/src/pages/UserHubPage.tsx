import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import toast from "react-hot-toast";
import WalletCard from "../components/WalletCard";
import ManagedQueueCard from "../components/ManagedQueueCard";
import SubmissionItem from "../components/SubmissionItem";
import EditSubmissionDrawer from "../components/EditSubmissionDrawer";
import AchievementsTab from "../components/AchievementsTab";
import { Submission } from "../types";
import CheckoutModal from "../components/CheckoutModal";

import ReviewerList from "../components/ReviewerList";
import { Coins, Trophy } from "lucide-react";

const UserHubPage = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements'>('overview');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [skippingSubmission, setSkippingSubmission] = useState<Submission | null>(null);
  const { user, checkAuth } = useAuthStore();

  const [balance, setBalance] = useState(0);
  const [activeReviewerId, setActiveReviewerId] = useState<number>(1); // Default to 1

  const fetchBalance = async (reviewerId: number) => {
    try {
      const { data } = await api.get<{ balance: number }>(`/user/me/balance?reviewer_id=${reviewerId}`);
      setBalance(data.balance);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Submission[]>("/user/me/submissions");
      if (Array.isArray(response.data) && response.data.length > 0) {
        setSubmissions(response.data);
        // Use the reviewer from the most recent submission
        const latest = response.data[0];
        setActiveReviewerId(latest.reviewer_id);
        fetchBalance(latest.reviewer_id);
      } else {
        setSubmissions([]);
        // Default to 1 if no submissions
        fetchBalance(1);
      }
    } catch (error: any) {
      console.error("Failed to fetch submissions:", error);
      if (error.response) {
        console.error("Error response:", error.response.status, error.response.data);
      }
      toast.error("Could not load your submissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'overview') {
      fetchSubmissions();
    }
  }, [user, activeTab]);

  const handleEdit = (submission: Submission) => {
    setEditingSubmission(submission);
  };

  const handleSkip = (submission: Submission) => {
    setSkippingSubmission(submission);
  };

  const handleSaveSubmission = async (updatedSubmission: Submission) => {
    // Update local state
    setSubmissions(prev => prev.map(s => s.id === updatedSubmission.id ? updatedSubmission : s));
    // Refresh user profile to get updated social handles if changed
    await checkAuth();
  };

  if (!user) return null;

  return (
    <div className="bg-gray-900 text-white min-h-screen pb-20">
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">

        {/* Tabs */}
        <div className="flex space-x-4 border-b border-gray-800 pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === 'overview' ? "text-purple-400" : "text-gray-400 hover:text-white"
              }`}
          >
            <Coins size={16} />
            Overview
            {activeTab === 'overview' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-400 rounded-t-full"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-2 pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === 'achievements' ? "text-purple-400" : "text-gray-400 hover:text-white"
              }`}
          >
            <Trophy size={16} />
            Achievements
            {activeTab === 'achievements' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-400 rounded-t-full"></span>
            )}
          </button>
        </div>

        {activeTab === 'overview' ? (
          <>
            {/* Top Row: Wallet & Managed Queues */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Wallet Card (Left, 4 columns) */}
              <div className="lg:col-span-4">
                <WalletCard
                  balance={balance}
                  xp={user.xp || 0}
                  level={user.level || 0}
                  reviewerId={activeReviewerId}
                />
              </div>

              {/* Active Queue / Status Card (Right, 8 columns) */}
              <div className="lg:col-span-8">
                {user.moderated_reviewers && user.moderated_reviewers.length > 0 ? (
                  <div className="space-y-4">
                    {user.moderated_reviewers.map(reviewer => (
                      <ManagedQueueCard key={reviewer.id} reviewer={reviewer} />
                    ))}
                  </div>
                ) : (
                  <div className="h-full bg-gray-800/50 rounded-xl p-6 flex flex-col justify-center items-center text-gray-400 border border-gray-700">
                    <p className="mb-2">You are not managing any queues.</p>
                    <Link to="/settings" className="text-purple-400 hover:text-purple-300 font-bold text-sm">Become a Reviewer</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Reviewers List */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Reviewers</h2>
              <ReviewerList />
            </div>

            {/* Submissions Section */}
            <div>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-2xl font-bold">Your Submissions</h2>
              </div>

              <div className="bg-gray-900/50 rounded-xl min-h-[300px]">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : submissions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {Object.values(
                      submissions.reduce((acc, submission) => {
                        const key = submission.track_url;
                        if (!acc[key]) {
                          acc[key] = [];
                        }
                        acc[key].push(submission);
                        return acc;
                      }, {} as Record<string, Submission[]>)
                    ).map((groupSubmissions) => (
                      <SubmissionItem
                        key={groupSubmissions[0].track_url}
                        submissions={groupSubmissions}
                        onEdit={handleEdit}
                        onSkip={handleSkip}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center border-2 border-dashed border-gray-800 rounded-xl">
                    <p className="text-gray-500 mb-4">You haven't submitted any tracks yet.</p>
                    <p className="text-sm text-gray-600">Join a reviewer's queue to get started!</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <AchievementsTab />
        )}

      </div>

      {/* Edit Drawer */}
      <EditSubmissionDrawer
        isOpen={!!editingSubmission}
        submission={editingSubmission}
        onClose={() => setEditingSubmission(null)}
        onSave={handleSaveSubmission}
      />

      {/* Checkout Modal */}
      {skippingSubmission && (
        <CheckoutModal
          isOpen={!!skippingSubmission}
          onClose={() => setSkippingSubmission(null)}
          reviewerId={skippingSubmission.reviewer_id}
          submissionId={skippingSubmission.id}
          onSuccess={() => {
            toast.success("Skip applied successfully!");
            fetchSubmissions();
          }}
        />
      )}
    </div>
  );
};

export default UserHubPage;
