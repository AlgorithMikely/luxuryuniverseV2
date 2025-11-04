import { useState, useEffect } from 'react';
import api from '../services/api';
import { UserProfile } from '../stores/authStore';

// Define a type for the cached Discord users
interface DiscordUser {
  id: number;
  discord_id: string;
  username: string;
}

const AdminPage = () => {
  const [reviewers, setReviewers] = useState<UserProfile[]>([]);
  const [discordUsers, setDiscordUsers] = useState<DiscordUser[]>([]);
  const [selectedDiscordId, setSelectedDiscordId] = useState<string>('');
  const [tiktokHandle, setTiktokHandle] = useState('');

  const fetchReviewers = async () => {
    try {
      const response = await api.get('/admin/reviewers');
      setReviewers(response.data);
    } catch (error) {
      console.error('Failed to fetch reviewers:', error);
    }
  };

  const fetchDiscordUsers = async () => {
    try {
      const response = await api.get('/admin/discord-users');
      setDiscordUsers(response.data);
      // Set default selection if list is not empty
      if (response.data.length > 0) {
        setSelectedDiscordId(response.data[0].discord_id);
      }
    } catch (error) {
      console.error('Failed to fetch Discord users:', error);
    }
  };

  useEffect(() => {
    fetchReviewers();
    fetchDiscordUsers();
  }, []);

  const handleAddReviewer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscordId) {
      alert('Please select a Discord user.');
      return;
    }
    try {
      await api.post('/admin/reviewers', {
        discord_id: selectedDiscordId,
        tiktok_handle: tiktokHandle,
      });
      fetchReviewers(); // Refresh the list
      // Reset form
      if (discordUsers.length > 0) {
        setSelectedDiscordId(discordUsers[0].discord_id);
      }
      setTiktokHandle('');
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
        <form onSubmit={handleAddReviewer} className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedDiscordId}
            onChange={(e) => setSelectedDiscordId(e.target.value)}
            className="input bg-gray-700 p-2 rounded"
          >
            {discordUsers.map((user) => (
              <option key={user.id} value={user.discord_id}>
                {user.username}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={tiktokHandle}
            onChange={(e) => setTiktokHandle(e.target.value)}
            placeholder="TikTok Handle (optional)"
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2">Username</th>
                <th className="text-left p-2">Discord ID</th>
                <th className="text-left p-2">TikTok Handle</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewers.map((reviewer) => (
                <tr key={reviewer.id}>
                  <td className="p-2">{reviewer?.username || 'Unknown User'}</td>
                  <td className="p-2">{reviewer.discord_id}</td>
                  <td className="p-2">{reviewer.reviewer_profile?.tiktok_handle || 'N/A'}</td>
                  <td className="p-2">
                    <button
                      onClick={() => reviewer.reviewer_profile && handleRemoveReviewer(reviewer.reviewer_profile.id)}
                      disabled={!reviewer.reviewer_profile}
                      className="btn bg-red-600 p-2 rounded disabled:bg-gray-500"
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
    </div>
  );
};

export default AdminPage;
