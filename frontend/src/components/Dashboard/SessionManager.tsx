import React, { useState, useEffect, useRef } from 'react';
import { useSessionStore, Session } from '../../stores/sessionStore';
import { useQueueStore } from '../../stores/queueStore';
import api from '../../services/api';
import { PriorityTier, ReviewerProfile } from '../../types';
import { MessageSquare, ChevronDown, ChevronUp, Power, Plus, Settings, Radio } from 'lucide-react';

interface SessionManagerProps {
  reviewerId?: string;
}

const SessionManager: React.FC<SessionManagerProps> = ({ reviewerId }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [tiers, setTiers] = useState<PriorityTier[]>([
    { value: 0, label: 'Free', color: 'gray' },
    { value: 5, label: '$5 Tier', color: 'green' },
    { value: 10, label: '$10 Tier', color: 'blue' },
    { value: 15, label: '$15 Tier', color: 'purple' },
    { value: 20, label: '$20 Tier', color: 'yellow' },
    { value: 25, label: '$25+ Tier', color: 'red' },
    { value: 50, label: '50+ Tier', color: 'pink' },
  ]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { activeSession, fetchActiveSession } = useSessionStore();
  const { queue, isLive } = useQueueStore();

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

  const fetchSettings = async () => {
    if (!reviewerId) return;
    try {
      const response = await api.get<ReviewerProfile>(`/reviewer/${reviewerId}/settings`);
      if (response.data.configuration?.priority_tiers) {
        setTiers(response.data.configuration.priority_tiers);
      }
    } catch (err) {
      console.error("Failed to load reviewer settings for session manager", err);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchActiveSession(reviewerId);
    fetchSettings();
  }, [reviewerId]);

  useEffect(() => {
    if (isDropdownOpen) {
      fetchSettings();
    }
  }, [isDropdownOpen]);

  // Listen for real-time updates to settings/session
  const { socket } = useQueueStore();
  useEffect(() => {
    if (!socket) return;

    const handleSettingsUpdate = () => {
      console.log("SessionManager received settings update, refreshing...");
      fetchActiveSession(reviewerId);
      fetchSettings();
    };

    socket.on('reviewer_settings_updated', handleSettingsUpdate);

    return () => {
      socket.off('reviewer_settings_updated', handleSettingsUpdate);
    };
  }, [socket, reviewerId, fetchActiveSession]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const url = reviewerId ? `/sessions?reviewer_id=${reviewerId}` : '/sessions';
      await api.post(url, {
        name: newSessionName,
        open_queue_tiers: tiers.map(t => t.value)
      });
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

    if (queue.length > 0) {
      const confirmed = window.confirm(`There are ${queue.length} submissions in the queue. Ending the session will clear them. Are you sure you want to end the session?`);
      if (!confirmed) return;
    }

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

  const getTierStyles = (color: string) => {
    const colorMap: Record<string, { border: string, text: string, shadow: string }> = {
      red: { border: 'border-red-500', text: 'text-red-500', shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' },
      orange: { border: 'border-orange-500', text: 'text-orange-500', shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.5)]' },
      amber: { border: 'border-amber-500', text: 'text-amber-500', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]' },
      yellow: { border: 'border-yellow-400', text: 'text-yellow-400', shadow: 'shadow-[0_0_15px_rgba(250,204,21,0.5)]' },
      lime: { border: 'border-lime-500', text: 'text-lime-500', shadow: 'shadow-[0_0_15px_rgba(132,204,22,0.5)]' },
      green: { border: 'border-green-500', text: 'text-green-500', shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' },
      emerald: { border: 'border-emerald-500', text: 'text-emerald-500', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]' },
      teal: { border: 'border-teal-500', text: 'text-teal-500', shadow: 'shadow-[0_0_15px_rgba(20,184,166,0.5)]' },
      cyan: { border: 'border-cyan-500', text: 'text-cyan-500', shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.5)]' },
      sky: { border: 'border-sky-500', text: 'text-sky-500', shadow: 'shadow-[0_0_15px_rgba(14,165,233,0.5)]' },
      blue: { border: 'border-blue-500', text: 'text-blue-500', shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' },
      indigo: { border: 'border-indigo-500', text: 'text-indigo-500', shadow: 'shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
      violet: { border: 'border-violet-500', text: 'text-violet-500', shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.5)]' },
      purple: { border: 'border-purple-500', text: 'text-purple-500', shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]' },
      fuchsia: { border: 'border-fuchsia-500', text: 'text-fuchsia-500', shadow: 'shadow-[0_0_15px_rgba(217,70,239,0.5)]' },
      pink: { border: 'border-pink-500', text: 'text-pink-500', shadow: 'shadow-[0_0_15px_rgba(236,72,153,0.5)]' },
      rose: { border: 'border-rose-500', text: 'text-rose-500', shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)]' },
      gray: { border: 'border-gray-500', text: 'text-gray-500', shadow: 'shadow-[0_0_15px_rgba(107,114,128,0.5)]' },
    };
    return colorMap[color] || colorMap['gray'];
  };

  return (
    <div className="relative z-40" ref={dropdownRef}>
      {/* Main Header Bar */}
      <div className="bg-gray-800/80 backdrop-blur-md border border-white/10 rounded-xl p-2 flex items-center justify-between shadow-lg">

        {/* Left: Session Selector Trigger */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
        >
          <div className={`p-1.5 rounded-md ${activeSession ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Current Session</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              {activeSession ? activeSession.name : 'No Active Session'}
              {isDropdownOpen ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />}
            </div>
          </div>
        </button>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-2 pr-2">
          {/* Live Status Badge */}
          {isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 animate-pulse mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Live</span>
            </div>
          )}

          {/* Chat Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (reviewerId) {
                window.open(`/chat/${reviewerId}`, '_blank', 'width=400,height=600');
              }
            }}
            className="p-2.5 rounded-lg transition-all flex items-center gap-2 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            title="Open Live Chat"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:block">Chat</span>
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-full md:w-96 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

          {/* Header of Dropdown */}
          <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-white/40" />
              Session Manager
            </h3>
            {activeSession && (
              <button
                onClick={handleEndSession}
                className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded border border-red-500/20 transition-colors flex items-center gap-1"
              >
                <Power className="w-3 h-3" />
                End Session
              </button>
            )}
          </div>

          <div className="p-4 space-y-6">
            {error && <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}

            {/* Active Session Controls */}
            {activeSession ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Queue Gates</label>
                <div className="grid grid-cols-2 gap-2">
                  {tiers.map((tier) => {
                    const isOpen = activeSession.open_queue_tiers?.includes(tier.value);
                    const styles = getTierStyles(tier.color);
                    return (
                      <button
                        key={tier.value}
                        onClick={() => toggleGate(tier.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-between ${isOpen
                          ? `bg-transparent ${styles.border} ${styles.text} ${styles.shadow}`
                          : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        <span>{tier.label}</span>
                        <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-current' : 'bg-white/20'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Create New Session */
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Start New Session</label>
                <form onSubmit={handleCreateSession} className="flex gap-2">
                  <input
                    type="text"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder="Session Name (e.g. Friday Vibes)"
                    className="bg-black/20 text-white text-sm p-2.5 rounded-lg border border-white/10 flex-grow focus:outline-none focus:border-blue-500/50"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-lg transition-colors"
                    disabled={!newSessionName.trim()}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>
            )}

            {/* Switch Session List */}
            <div className="space-y-2 pt-4 border-t border-white/5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Switch Session</label>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                {sessions.length === 0 && <div className="text-sm text-white/20 italic">No other sessions found.</div>}
                {sessions.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg group transition-colors">
                    <span className={`text-sm font-medium ${s.id === activeSession?.id ? 'text-green-400' : 'text-white/60 group-hover:text-white'}`}>
                      {s.name}
                    </span>
                    {s.id !== activeSession?.id && (
                      <button
                        onClick={() => handleActivateSession(s.id)}
                        className="text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-2 py-1 rounded transition-colors"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionManager;
