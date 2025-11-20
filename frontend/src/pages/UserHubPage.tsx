import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuthStore } from "../stores/authStore";
import toast from "react-hot-toast";
import WalletCard from "../components/WalletCard";
import ManagedQueueCard from "../components/ManagedQueueCard";
import SubmissionItem from "../components/SubmissionItem";
import EditSubmissionDrawer from "../components/EditSubmissionDrawer";
import { Submission } from "../types";

const UserHubPage = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const { user, checkAuth } = useAuthStore();

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Submission[]>("/user/me/submissions");
      if (Array.isArray(response.data)) {
        setSubmissions(response.data);
      } else {
        setSubmissions([]);
      }
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
      toast.error("Could not load your submissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const handleEdit = (submission: Submission) => {
    setEditingSubmission(submission);
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

        {/* Top Row: Wallet & Managed Queues */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Wallet Card (Left, 4 columns) */}
            <div className="lg:col-span-4">
                <WalletCard
                    balance={0}
                    xp={user.xp || 0}
                    level={user.level || 0}
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
                        {submissions.map((submission) => (
                            <SubmissionItem
                                key={submission.id}
                                submission={submission}
                                onEdit={handleEdit}
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

      </div>

      {/* Edit Drawer */}
      <EditSubmissionDrawer
        isOpen={!!editingSubmission}
        submission={editingSubmission}
        onClose={() => setEditingSubmission(null)}
        onSave={handleSaveSubmission}
      />
    </div>
  );
};

export default UserHubPage;
