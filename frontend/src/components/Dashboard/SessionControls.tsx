import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import api from '../../services/api';

const SessionControls: React.FC = () => {
  const { activeSession, fetchActiveSession } = useSessionStore();
  const [isEditing, setIsEditing] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSession) {
      setSessionName(activeSession.name);
    }
  }, [activeSession]);

  if (!activeSession) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-4">No Active Session</h2>
        <p className="text-gray-400">Start a new session from the Session Manager.</p>
      </div>
    );
  }

  const handleUpdateName = async () => {
    if (sessionName.trim() === activeSession.name) {
      setIsEditing(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await api.patch(`/sessions/${activeSession.id}`, { name: sessionName });
      await fetchActiveSession();
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update session name.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Are you sure you want to archive this session? This action cannot be undone.')) {
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/sessions/${activeSession.id}/archive`);
      await fetchActiveSession(); // This will clear the active session
    } catch (err) {
      setError('Failed to archive session.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-2">Active Session</h2>
      {error && <p className="text-red-500 bg-red-900 p-2 rounded mb-4">{error}</p>}

      {isEditing ? (
        <div className="flex items-center space-x-2">
            <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded w-full"
            />
            <button onClick={handleUpdateName} className="bg-green-600 hover:bg-green-700 p-2 rounded" disabled={isLoading}>Save</button>
            <button onClick={() => setIsEditing(false)} className="bg-gray-600 hover:bg-gray-700 p-2 rounded" disabled={isLoading}>Cancel</button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
            <p className="text-lg">{activeSession.name}</p>
            <button onClick={() => setIsEditing(true)} className="text-blue-400 hover:underline">Rename</button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-700">
        <button
            onClick={handleArchive}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded w-full"
            disabled={isLoading}
            >
            {isLoading ? 'Archiving...' : 'Archive Session'}
        </button>
      </div>
    </div>
  );
};

export default SessionControls;
