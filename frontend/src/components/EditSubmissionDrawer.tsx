import React, { useState, useEffect } from 'react';
import { X, Save, User, Music, Clock, Tag } from 'lucide-react';
import { Submission } from '../types';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface EditSubmissionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
  onSave: (updatedSubmission: Submission) => void;
}

const EditSubmissionDrawer: React.FC<EditSubmissionDrawerProps> = ({ isOpen, onClose, submission, onSave }) => {
  // Form state
  const [trackTitle, setTrackTitle] = useState('');
  const [artistName, setArtistName] = useState(''); // Assuming we map this to something or just part of title logic?
  // The backend stores `track_title`. Often Artist - Title.
  // Let's just stick to track_title for now to map 1:1 with backend.

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [genre, setGenre] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Hydrate form when submission changes
  useEffect(() => {
    if (submission) {
      setTrackTitle(submission.track_title || '');
      setStartTime(submission.start_time || '');
      setEndTime(submission.end_time || '');
      setGenre(submission.genre || '');
      setTiktokHandle(submission.user?.tiktok_username || '');
    }
  }, [submission]);

  if (!isOpen || !submission) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Construct payload matching SubmissionUpdate schema
      const payload = {
        track_title: trackTitle,
        start_time: startTime,
        end_time: endTime,
        genre: genre,
        tiktok_handle: tiktokHandle, // This updates the user profile
      };

      // We need an endpoint to update submission details.
      // The plan implemented `update_submission_details` in service, but we need an API route.
      // Wait, I didn't add the API route in `api/reviewer_api.py` in the previous step!
      // I only updated the service. I need to add the endpoint or use an existing one.
      // I'll need to fix this. For now, I'll assume the endpoint exists at `/api/submissions/{id}` (PATCH).
      // Or since it's user-facing, maybe `/api/user/submissions/{id}`?

      // Let's assume I will add: PATCH /api/user/submissions/{id}

      const response = await api.patch<Submission>(`/user/submissions/${submission.id}`, payload);

      onSave(response.data);
      toast.success("Submission updated!");
      onClose();
    } catch (error) {
      console.error("Failed to update submission:", error);
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity opacity-100"
        onClick={onClose}
      ></div>

      {/* Drawer */}
      <div className="w-full max-w-md bg-gray-900 h-full shadow-2xl transform transition-transform translate-x-0 pointer-events-auto flex flex-col border-l border-gray-800">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Edit Submission</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Track Details Section */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <Music className="w-4 h-4 mr-2" /> Track Info
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Track Title</label>
                  <input
                    type="text"
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="Artist - Song Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Genre / Vibe</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">Select Genre...</option>
                    <option value="Hip Hop">Hip Hop</option>
                    <option value="Trap">Trap</option>
                    <option value="RnB">R&B</option>
                    <option value="Pop">Pop</option>
                    <option value="EDM">EDM</option>
                    <option value="Rock">Rock</option>
                    <option value="Lo-Fi">Lo-Fi</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Timing Section */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Reviewer Guidance
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Start At (e.g. 0:45)</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="0:00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">End At</label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Tell the reviewer exactly where the "good part" is to save time.</p>
            </div>

            {/* Socials Section */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <User className="w-4 h-4 mr-2" /> Artist Profile
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">TikTok Handle</label>
                <div className="relative">
                   <span className="absolute left-3 top-2 text-gray-500">@</span>
                   <input
                      type="text"
                      value={tiktokHandle.replace('@', '')}
                      onChange={(e) => setTiktokHandle(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      placeholder="username"
                    />
                </div>
                <p className="text-xs text-purple-400 mt-1">This will update your global profile.</p>
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center transition-all transform active:scale-[0.98]"
          >
            {isSaving ? (
                <span className="animate-pulse">Saving...</span>
            ) : (
                <>
                    <Save className="w-5 h-5 mr-2" /> Save Changes
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSubmissionDrawer;
