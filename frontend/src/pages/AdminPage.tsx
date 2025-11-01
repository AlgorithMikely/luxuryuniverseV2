import { useState, useEffect } from 'react';
import api from '../services/api';
import { UserProfile } from '../stores/authStore'; // Assuming UserProfile is exported from authStore

const AdminPage = () => {
  const [reviewers, setReviewers] = useState<UserProfile[]>([]);
  const [discordId, setDiscordId] = useState('');
  const [channelId, setChannelId] = useState('');

  const fetchReviewers = async () => {
    try {
      const response = await api.get('/admin/reviewers');
      setReviewers(response.data);
    } catch (error) {
      console.error('Failed to fetch reviewers:', error);
    }
  };

  useEffect(() => {
    fetchReviewers();
  }, []);

  const handleAddReviewer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/reviewers', {
        discord_id: discordId,
        discord_channel_id: channelId,
      });
      fetchReviewers(); // Refresh the list
      setDiscordId('');
      setChannelId('');
    } catch (error) {
      console.error('Failed to add reviewer:', error);
    }
  };

  const handleRemoveReviewer = async (reviewerId: number) => {
    try {
      await api.delete(`/admin/reviewers/${reviewerId}`);
      fetchReviewers(); // Refresh the list
    } catch (error) {
      console.error('Failed to remove reviewer:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Admin - Manage Reviewers</h1>

      {/* Add Reviewer Form */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Add New Reviewer</h2>
        <form onSubmit={handleAddReviewer} className="flex gap-4">
          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Discord User ID"
            className="input bg-gray-700 p-2 rounded"
          />
          <input
            type="text"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="Discord Channel ID"
            className="input bg-gray-700 p-2 rounded"
          />
          <button type="submit" className="btn bg-purple-600 p-2 rounded">
            Add Reviewer
          </button>
        </form>
      </div>

      {/* Reviewer List */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Current Reviewers</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2">Username</th>
              <th className="text-left p-2">Discord ID</th>
              <th className="text-left p-2">Channel ID</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviewers.map((reviewer) => (
              <tr key={reviewer.id}>
                <td className="p-2">{reviewer.username}</td>
                <td className="p-2">{reviewer.discord_id}</td>
                <td className="p-2">{reviewer.reviewer_profile?.discord_channel_id}</td>
                <td className="p-2">
                  <button
                    onClick={() => handleRemoveReviewer(reviewer.reviewer_profile!.id)}
                    className="btn bg-red-600 p-2 rounded"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPage;
