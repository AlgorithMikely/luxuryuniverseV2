import { useState, useEffect } from 'react';
import api from '../services/api';
import { ReviewSession } from '../types';
import { useQueueStore } from '../stores/queueStore';

interface SessionManagerProps {
  reviewerId: string;
}

const SessionManager = ({ reviewerId }: SessionManagerProps) => {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const { activeSession, setActiveSession: setActiveSessionInStore } = useQueueStore();


  const fetchSessions = async () => {
    try {
      const response = await api.get(`/reviewers/${reviewerId}/sessions`);
      setSessions(response.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [reviewerId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    try {
      await api.post(`/reviewers/${reviewerId}/sessions`, { name: newSessionName });
      setNewSessionName('');
      fetchSessions();
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleActivateSession = async (sessionId: number) => {
    try {
      const response = await api.post(`/reviewers/${reviewerId}/sessions/${sessionId}/activate`);
      const activeSessionData = response.data;
      setActiveSessionInStore(activeSessionData); // Update store
    } catch (error) {
      console.error('Failed to activate session:', error);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="font-bold mb-2">Create New Session</h3>
        <form onSubmit={handleCreateSession} className="flex gap-2">
          <input
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="Session Name"
            className="input bg-gray-700 p-2 rounded flex-grow"
          />
          <button type="submit" className="btn bg-purple-600 p-2 rounded">
            Create
          </button>
        </form>
      </div>
      <div>
        <h3 className="font-bold mb-2">Available Sessions</h3>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-2 rounded flex justify-between items-center ${
                activeSession?.id === session.id ? 'bg-green-800/50' : 'bg-gray-800'
              }`}
            >
              <span>{session.name}</span>
              <button
                onClick={() => handleActivateSession(session.id)}
                disabled={activeSession?.id === session.id}
                className="btn bg-blue-600 p-1 px-2 text-sm rounded disabled:bg-gray-500"
              >
                {activeSession?.id === session.id ? 'Active' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
