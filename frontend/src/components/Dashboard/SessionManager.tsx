import React, { useState, useEffect } from 'react';
import { useSessionStore, Session } from '../../stores/sessionStore';
import api from '../../services/api';

const SessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { activeSession, fetchActiveSession } = useSessionStore();

  const fetchSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<Session[]>('/sessions');
      setSessions(response.data);
    } catch (err) {
      setError('Failed to fetch sessions.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.post('/sessions', { name: newSessionName });
      setNewSessionName('');
      await fetchSessions(); // Refresh the list
      await fetchActiveSession(); // Check if this new session is now active
    } catch (err) {
      setError('Failed to create session.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateSession = async (sessionId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.post(`/sessions/${sessionId}/activate`);
      await fetchActiveSession();
      await fetchSessions(); // The status of the sessions will have changed
    } catch (err) {
      setError('Failed to activate session.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Session Manager</h2>
      {error && <p className="text-red-500 bg-red-900 p-2 rounded">{error}</p>}

      <form onSubmit={handleCreateSession} className="mb-4">
        <input
          type="text"
          value={newSessionName}
          onChange={(e) => setNewSessionName(e.target.value)}
          placeholder="New Session Name"
          className="bg-gray-700 text-white p-2 rounded w-full"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
          disabled={isLoading || !newSessionName.trim()}
        >
          {isLoading ? 'Creating...' : 'Create New Session'}
        </button>
      </form>

      <div>
        <h3 className="text-lg font-semibold mb-2">Available Sessions</h3>
        {isLoading && <p>Loading sessions...</p>}
        <ul className="space-y-2">
          {sessions
            .filter((s) => s.status !== 'active')
            .map((session) => (
              <li key={session.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                <span>{session.name} ({session.status})</span>
                <button
                  onClick={() => handleActivateSession(session.id)}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded"
                  disabled={isLoading || !!activeSession}
                >
                  Activate
                </button>
              </li>
            ))}
        </ul>
        {sessions.filter((s) => s.status !== 'active').length === 0 && !isLoading && (
            <p className="text-gray-400">No archived sessions found.</p>
        )}
      </div>
    </div>
  );
};

export default SessionManager;
