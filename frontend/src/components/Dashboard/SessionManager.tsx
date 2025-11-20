import React, { useState, useEffect } from 'react';
import { useSessionStore, Session } from '../../stores/sessionStore';
import api from '../../services/api';

interface SessionManagerProps {
  reviewerId?: string;
}

const SessionManager: React.FC<SessionManagerProps> = ({ reviewerId }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { activeSession, fetchActiveSession } = useSessionStore();

  const fetchSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = reviewerId ? `/sessions?reviewer_id=${reviewerId}` : '/sessions';
      const response = await api.get<Session[]>(url);
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
    fetchActiveSession(reviewerId);
  }, [reviewerId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const url = reviewerId ? `/sessions?reviewer_id=${reviewerId}` : '/sessions';
      await api.post(url, { name: newSessionName });
      setNewSessionName('');
      await fetchSessions();
      await fetchActiveSession(reviewerId);
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
      const url = reviewerId ? `/sessions/${sessionId}/activate?reviewer_id=${reviewerId}` : `/sessions/${sessionId}/activate`;
      await api.post(url);
      await fetchActiveSession(reviewerId);
      await fetchSessions();
    } catch (err) {
      setError('Failed to activate session.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    try {
      const url = reviewerId ? `/sessions/${activeSession.id}/archive?reviewer_id=${reviewerId}` : `/sessions/${activeSession.id}/archive`;
      await api.post(url);
      await fetchActiveSession(reviewerId);
      await fetchSessions();
    } catch (err) {
      console.error("Failed to end session", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGate = async (tier: number) => {
    if (!activeSession) return;
    const currentTiers = activeSession.open_queue_tiers || [];
    let newTiers;
    if (currentTiers.includes(tier)) {
      newTiers = currentTiers.filter(t => t !== tier);
    } else {
      newTiers = [...currentTiers, tier];
    }

    try {
      const url = reviewerId ? `/sessions/${activeSession.id}?reviewer_id=${reviewerId}` : `/sessions/${activeSession.id}`;
      await api.patch(url, { open_queue_tiers: newTiers });
      await fetchActiveSession(reviewerId);
    } catch (err) {
      console.error("Failed to update session tiers", err);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-4 relative">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
        <h2 className="text-xl font-bold">
          {activeSession ? `Session: ${activeSession.name}` : 'No Active Session'}
        </h2>
        <span className="text-gray-400">{isDropdownOpen ? '▲' : '▼'}</span>
      </div>

      {isDropdownOpen && (
        <div className="mt-4 border-t border-gray-700 pt-4">
          {error && <p className="text-red-500 bg-red-900 p-2 rounded mb-2">{error}</p>}

          {/* Row 1: Global Controls */}
          <div className="flex justify-between items-center mb-4">
            <span className="font-semibold text-lg">{activeSession?.name || "Session Controls"}</span>
            {activeSession && (
              <button
                onClick={handleEndSession}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                End Session
              </button>
            )}
          </div>

          {activeSession ? (
            <>
              <div className="bg-gray-900 p-3 rounded text-sm text-gray-400 mb-4">
                <h3 className="font-semibold text-white mb-2">Queue Configuration</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0, label: 'Free', borderColor: 'border-green-500', textColor: 'text-green-500', shadowColor: 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' },
                    { value: 5, label: '$5 Skip', borderColor: 'border-blue-500', textColor: 'text-blue-500', shadowColor: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' },
                    { value: 10, label: '$10 Skip', borderColor: 'border-indigo-500', textColor: 'text-indigo-500', shadowColor: 'shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
                    { value: 15, label: '$15 Skip', borderColor: 'border-purple-500', textColor: 'text-purple-500', shadowColor: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]' },
                    { value: 20, label: '$20 Skip', borderColor: 'border-pink-500', textColor: 'text-pink-500', shadowColor: 'shadow-[0_0_15px_rgba(236,72,153,0.5)]' },
                    { value: 25, label: '$25 Skip', borderColor: 'border-red-500', textColor: 'text-red-500', shadowColor: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' },
                    { value: 50, label: '$50 Skip', borderColor: 'border-amber-500', textColor: 'text-amber-500', shadowColor: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]' },
                  ].map((tier) => {
                    const isOpen = activeSession.open_queue_tiers?.includes(tier.value);
                    return (
                      <button
                        key={tier.value}
                        onClick={() => toggleGate(tier.value)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 border flex flex-col items-center justify-center ${isOpen
                          ? `bg-transparent ${tier.borderColor} ${tier.textColor} ${tier.shadowColor}`
                          : 'bg-gray-700 border-transparent text-gray-500 hover:bg-gray-600 hover:text-gray-300'
                          }`}
                      >
                        <span>{tier.label}</span>
                        <span className="text-xs uppercase mt-1">{isOpen ? 'ON' : 'OFF'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stats (Placeholder for now) */}
              <div className="flex justify-between text-sm text-gray-400 bg-gray-900 p-2 rounded">
                <span>Total Revenue: $--</span>
                <span>Total Skips: --</span>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <p className="mb-2">Start a session to begin.</p>
              <form onSubmit={handleCreateSession} className="flex gap-2">
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="New Session Name"
                  className="bg-gray-700 text-white p-2 rounded flex-grow"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  disabled={!newSessionName.trim()}
                >
                  Create
                </button>
              </form>
            </div>
          )}

          {/* Archived Sessions List */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Switch Session</h3>
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {sessions.map(s => (
                <li key={s.id} className="flex justify-between items-center text-sm p-1 hover:bg-gray-700 rounded">
                  <span className={s.id === activeSession?.id ? 'text-green-400' : 'text-gray-300'}>
                    {s.name}
                  </span>
                  {s.id !== activeSession?.id && (
                    <button
                      onClick={() => handleActivateSession(s.id)}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      Activate
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManager;
