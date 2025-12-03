import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { UserProfile, DiscordChannel, TikTokAccount } from '../types';
import { useAuthStore } from '../stores/authStore';

// Define a type for the cached Discord users
interface DiscordUser {
  id: number;
  discord_id: string;
  username: string;
}

const AdminPage = () => {
  const [reviewers, setReviewers] = useState<UserProfile[]>([]);
  const [discordUsers, setDiscordUsers] = useState<DiscordUser[]>([]);
  const [availableChannels, setAvailableChannels] = useState<DiscordChannel[]>([]);
  const [selectedDiscordId, setSelectedDiscordId] = useState<string>('');
  const [reviewerTiktokHandle, setReviewerTiktokHandle] = useState('');
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

  const fetchChannels = async () => {
    try {
      const response = await api.get<DiscordChannel[]>('/admin/discord/channels');
      setAvailableChannels(response.data);
    } catch (error) {
      console.error('Failed to fetch Discord channels:', error);
    }
  };

  const [authorizedGuildId, setAuthorizedGuildId] = useState('');

  const fetchGlobalSettings = async () => {
    try {
      const response = await api.get('/admin/global-settings');
      setAuthorizedGuildId(response.data.authorized_guild_id || '');
    } catch (error) {
      console.error("Failed to fetch global settings", error);
    }
  }

  const handleSaveGlobalSettings = async () => {
    try {
      await api.patch('/admin/global-settings', { authorized_guild_id: authorizedGuildId });
      alert("Global settings saved!");
    } catch (error) {
      console.error("Failed to save global settings", error);
      alert("Failed to save global settings.");
    }
  }

  useEffect(() => {
    fetchReviewers();
    fetchDiscordUsers();
    fetchChannels();
    fetchGlobalSettings();
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
        tiktok_handle: reviewerTiktokHandle,
      });
      fetchReviewers(); // Refresh the list

      // Check if we just added ourselves, if so refresh our profile
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.discord_id === selectedDiscordId) {
        useAuthStore.getState().checkAuth(true);
      }

      // Reset form
      if (discordUsers.length > 0) {
        setSelectedDiscordId(discordUsers[0].discord_id);
      }
      setReviewerTiktokHandle('');
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

  const handleUpdateChannel = async (reviewerId: number, field: 'discord_channel_id' | 'see_the_line_channel_id', value: string) => {
    try {
      await api.patch(`/reviewer/${reviewerId}/settings`, {
        [field]: value
      });
      // Optimistically update or refresh
      fetchReviewers();
    } catch (error) {
      console.error(`Failed to update reviewer ${field}:`, error);
      alert('Failed to update channel.');
    }
  };

  // --- TikTok Account Management ---
  const [tiktokAccounts, setTiktokAccounts] = useState<TikTokAccount[]>([]);
  const [sortField, setSortField] = useState<string>('points');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchTiktokAccounts = async () => {
    try {
      const response = await api.get('/admin/tiktok-accounts');
      setTiktokAccounts(response.data);
    } catch (error) {
      console.error('Failed to fetch TikTok accounts:', error);
    }
  };

  useEffect(() => {
    fetchTiktokAccounts();
  }, []);

  const handleUpdateTikTokMonitoring = async (accountId: number, monitored: boolean) => {
    try {
      await api.patch(`/admin/tiktok-accounts/${accountId}`, { monitored });
      fetchTiktokAccounts();
    } catch (error) {
      console.error("Failed to update monitoring status", error);
      alert("Failed to update monitoring status");
    }
  };

  const handleDeleteTikTokAccount = async (accountId: number) => {
    // Confirmation is handled in the button onClick
    try {
      await api.delete(`/admin/tiktok-accounts/${accountId}`);
      fetchTiktokAccounts(); // Refresh
    } catch (error) {
      console.error('Failed to remove TikTok account:', error);
    }
  };

  // Sorting Logic
  // Filter first
  const monitoredAccounts = tiktokAccounts.filter(a => a.monitored);

  // Sorting Logic
  // Sorting Logic
  const sortedAccounts = [...monitoredAccounts].sort((a, b) => {
    const key = sortField as keyof TikTokAccount;
    const aVal = a[key];
    const bVal = b[key];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    let aComp = aVal;
    let bComp = bVal;

    // Handle strings case-insensitive
    if (typeof aComp === 'string' && typeof bComp === 'string') {
      aComp = aComp.toLowerCase();
      bComp = bComp.toLowerCase();
    }

    if (aComp < bComp) return sortDirection === 'asc' ? -1 : 1;
    if (aComp > bComp) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedAccounts.length / itemsPerPage);
  const paginatedAccounts = sortedAccounts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to desc for new field (usually better for points/dates)
    }
  };

  // Filter Reviewers List to show Reviewers AND Admins (or "Mods")
  // The API now returns all users, so we must filter.
  const displayedUsers = reviewers.filter(u =>
    u.reviewer_profile || u.roles.includes('admin') || u.roles.includes('moderator')
  );

  return (
    <div className="container mx-auto p-4 text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Admin - Manage Reviewers</h1>
        <Link to="/admin/economy" className="btn bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-colors">
          View Economy Logs
        </Link>
      </div>

      {/* Global Settings */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Global Settings</h2>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Authorized Discord Guild ID (for "See the Line")</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Guild ID"
              className="input bg-gray-700 p-2 rounded flex-grow max-w-xs"
              value={authorizedGuildId}
              onChange={(e) => setAuthorizedGuildId(e.target.value)}
            />
            <button
              onClick={handleSaveGlobalSettings}
              className="btn bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-gray-500">Users must be a member of this Discord server to access the "See the Line" page.</p>
        </div>
      </div>

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
            value={reviewerTiktokHandle}
            onChange={(e) => setReviewerTiktokHandle(e.target.value)}
            placeholder="TikTok Handle (optional)"
            className="input bg-gray-700 p-2 rounded"
          />
          <button type="submit" className="btn bg-purple-600 p-2 rounded">
            Add Reviewer
          </button>
        </form>
      </div>

      {/* Reviewer List */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Current Reviewers & Mods</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2">Username</th>
                <th className="text-left p-2">Roles</th>
                <th className="text-left p-2">TikTok Handle</th>
                <th className="text-left p-2">Discord Channel</th>
                <th className="text-left p-2">"See the Line" Channel</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="p-2">{user?.username || 'Unknown User'}</td>
                  <td className="p-2">
                    {user.roles.map(r => (
                      <span key={r} className="bg-blue-600 text-xs px-2 py-1 rounded mr-1 uppercase">{r}</span>
                    ))}
                  </td>
                  <td className="p-2">{user.reviewer_profile?.tiktok_handle || 'N/A'}</td>
                  <td className="p-2">
                    {user.reviewer_profile ? (
                      <select
                        value={user.reviewer_profile.discord_channel_id || ''}
                        onChange={(e) => user.reviewer_profile && handleUpdateChannel(user.reviewer_profile.id, 'discord_channel_id', e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500 text-white w-full max-w-xs"
                      >
                        <option value="">Select a channel...</option>
                        {availableChannels
                          .filter(c => c.type === 'text')
                          .map(channel => (
                            <option key={channel.id} value={channel.id}>
                              {channel.category ? `${channel.category} / ` : ''}{channel.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-gray-500 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="p-2">
                    {user.reviewer_profile ? (
                      <select
                        value={user.reviewer_profile.see_the_line_channel_id || ''}
                        onChange={(e) => user.reviewer_profile && handleUpdateChannel(user.reviewer_profile.id, 'see_the_line_channel_id', e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500 text-white w-full max-w-xs"
                      >
                        <option value="">Select a channel...</option>
                        {availableChannels
                          .filter(c => c.type === 'text')
                          .map(channel => (
                            <option key={channel.id} value={channel.id}>
                              {channel.category ? `${channel.category} / ` : ''}{channel.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-gray-500 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => user.reviewer_profile && handleRemoveReviewer(user.reviewer_profile.id)}
                      disabled={!user.reviewer_profile}
                      className="btn bg-red-600 p-2 rounded disabled:bg-gray-500"
                    >
                      Remove Reviewer
                    </button>
                  </td>
                </tr>
              ))}
              {displayedUsers.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">No reviewers or mods found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TikTok Account List */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Connected TikTok Accounts</h2>
          <div className="text-sm text-gray-400">
            Page {currentPage} of {totalPages || 1}
          </div>
        </div>

        {/* Add TikTok Account Form */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            placeholder="Enter TikTok Handle"
            className="input bg-gray-700 p-2 rounded flex-grow max-w-xs"
            value={tiktokHandle}
            onChange={(e) => setTiktokHandle(e.target.value)}
          />
          <button
            onClick={async () => {
              if (!tiktokHandle) return;
              try {
                await api.post('/admin/tiktok-accounts', { handle_name: tiktokHandle });
                setTiktokHandle('');
                fetchTiktokAccounts();
              } catch (error) {
                console.error("Failed to add account", error);
                alert("Failed to add account");
              }
            }}
            className="btn bg-green-600 px-4 py-2 rounded hover:bg-green-700 font-medium"
          >
            Connect & Add
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-2 cursor-pointer hover:text-purple-400" onClick={() => handleSort('handle_name')}>
                  Handle {sortField === 'handle_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-2 cursor-pointer hover:text-purple-400" onClick={() => handleSort('avg_concurrent_viewers')}>
                  Avg Concurrent {sortField === 'avg_concurrent_viewers' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-2 cursor-pointer hover:text-purple-400" onClick={() => handleSort('max_concurrent_viewers')}>
                  Max Concurrent {sortField === 'max_concurrent_viewers' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-2 cursor-pointer hover:text-purple-400" onClick={() => handleSort('avg_total_viewers')}>
                  Avg Total {sortField === 'avg_total_viewers' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-2 cursor-pointer hover:text-purple-400" onClick={() => handleSort('max_total_viewers')}>
                  Max Total {sortField === 'max_total_viewers' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-700/50">
                  <td className="p-2">@{account.handle_name}</td>
                  <td className="p-2">{account.avg_concurrent_viewers}</td>
                  <td className="p-2">{account.max_concurrent_viewers}</td>
                  <td className="p-2">{account.avg_total_viewers}</td>
                  <td className="p-2">{account.max_total_viewers}</td>
                  <td className="p-2">
                    <button
                      onClick={() => {
                        if (window.confirm("Are you sure you want to remove this account?")) {
                          handleDeleteTikTokAccount(account.id);
                        }
                      }}
                      className="btn bg-red-600 p-2 rounded hover:bg-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedAccounts.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-400">No monitored TikTok accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-4 gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
      {/* Platform Fees */}
      <div className="bg-gray-800 p-4 rounded-lg mt-6">
        <h2 className="text-xl font-semibold mb-4">Platform Fees (Owed)</h2>
        <PlatformFeesTable />
      </div>
    </div>
  );
};

const PlatformFeesTable = () => {
  const [fees, setFees] = useState<any[]>([]);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const res = await api.get('/admin/platform-fees');
        setFees(res.data);
      } catch (err) {
        console.error("Failed to fetch fees", err);
      }
    };
    fetchFees();
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-400">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Reviewer</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Ref ID</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {fees.map((fee) => (
            <tr key={fee.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
              <td className="px-4 py-3">{new Date(fee.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 font-medium text-white">{fee.reviewer_name}</td>
              <td className="px-4 py-3 uppercase">{fee.source}</td>
              <td className="px-4 py-3 font-mono text-xs">{fee.reference_id}</td>
              <td className="px-4 py-3 text-right text-white">
                ${(fee.amount / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-center">
                {fee.is_settled ? (
                  <span className="bg-green-900 text-green-300 text-xs font-medium px-2.5 py-0.5 rounded">Paid</span>
                ) : (
                  <span className="bg-yellow-900 text-yellow-300 text-xs font-medium px-2.5 py-0.5 rounded">Owed</span>
                )}
              </td>
            </tr>
          ))}
          {fees.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-3 text-center">No fees recorded.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPage;
