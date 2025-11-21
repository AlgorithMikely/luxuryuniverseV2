import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import io, { Socket } from 'socket.io-client';
import { Submission } from '../types';
import api from '../services/api'; // Make sure api service is imported

export type { Submission };

export interface FullQueueState {
  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
  spotlight: Submission[];
  current_track?: Submission | null;
}

interface QueueState {
  socket: Socket | null;
  socketStatus: 'connected' | 'disconnected' | 'connecting' | 'disabled';
  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
  spotlight: Submission[];
  currentTrack: Submission | null;
  connect: (token: string, reviewerId: string) => void;
  fetchInitialStateHttp: (reviewerId: string) => Promise<void>;
  disconnect: () => void;
  setCurrentTrack: (track: Submission | null) => void;
  updateSubmission: (updatedSubmission: Submission) => void;
  toggleBookmark: (trackId: number) => void;
  toggleSpotlight: (trackId: number) => void;
}

export const useQueueStore = create<QueueState>()(
  devtools(
    (set, get) => ({
      socket: null,
      socketStatus: 'disconnected',
      queue: [],
      history: [],
      bookmarks: [],
      spotlight: [],
      currentTrack: null,

      fetchInitialStateHttp: async (reviewerId) => {
        try {
          const response = await api.get<FullQueueState>(`/reviewer/${reviewerId}/queue/initial-state`);
          console.log('fetchInitialStateHttp response:', response.data);
          set({
            queue: response.data.queue || [],
            history: response.data.history || [],
            bookmarks: response.data.bookmarks || [],
            spotlight: response.data.spotlight || [],
            // Set the current track from the response, or fallback to first in queue if not provided (legacy behavior, though backend now provides it)
            currentTrack: response.data.current_track || response.data.queue?.[0] || null,
          });
        } catch (error) {
          console.error("Failed to fetch initial state via HTTP:", error);
        }
      },

      connect: (token, reviewerId) => {
        if (import.meta.env.VITE_DISABLE_SOCKETIO === 'true') {
          console.log("Socket.IO disabled. Fetching initial state via HTTP.");
          set({ socketStatus: 'disabled' });
          get().fetchInitialStateHttp(reviewerId);
          return;
        }

        if (get().socket || get().socketStatus === 'connecting') return;

        set({ socketStatus: 'connecting' });
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
          auth: { token },
          transports: ['websocket'],
        });

        newSocket.on('connect', () => {
          set({ socket: newSocket, socketStatus: 'connected' });
          console.log(`Connected to socket, joining reviewer room: ${reviewerId}`);
          newSocket.emit('join_reviewer_room', reviewerId);
        });

        newSocket.on('disconnect', () => {
          set({ socket: null, socketStatus: 'disconnected', queue: [], history: [], bookmarks: [], spotlight: [], currentTrack: null });
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          set({ socketStatus: 'disconnected' });
          get().disconnect();
        });

        newSocket.on('initial_state', (state: FullQueueState) => {
          set({
            queue: state.queue || [],
            history: state.history || [],
            bookmarks: state.bookmarks || [],
            spotlight: state.spotlight || [],
            currentTrack: state.current_track || state.queue?.[0] || null,
          });
        });

        newSocket.on('queue_updated', (newQueue: Submission[]) => set({ queue: newQueue }));
        newSocket.on('history_updated', (newHistory: Submission[]) => set({ history: newHistory }));
        newSocket.on('history_updated', (newHistory: Submission[]) => set({ history: newHistory }));
        newSocket.on('current_track_updated', (track: Submission | null) => {
          // If we receive a null update (clearing player) but we have a track loaded locally,
          // ignore it to prevent interrupting the reviewer's preview/playback.
          if (track === null && get().currentTrack !== null) {
            return;
          }
          set({ currentTrack: track });
        });
      },

      disconnect: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
        }
        set({
          socket: null,
          socketStatus: 'disconnected',
          queue: [],
          history: [],
          bookmarks: [],
          spotlight: [],
          currentTrack: null
        });
      },

      setCurrentTrack: (track) => set({ currentTrack: track }),

      updateSubmission: (updatedSubmission) => {
        const updateList = (list: Submission[]) =>
          list.map((item) => (item.id === updatedSubmission.id ? { ...item, ...updatedSubmission } : item));
        set((state) => ({
          queue: updateList(state.queue),
          history: updateList(state.history),
          bookmarks: updateList(state.bookmarks),
          spotlight: updateList(state.spotlight),
          currentTrack:
            state.currentTrack?.id === updatedSubmission.id ? { ...state.currentTrack, ...updatedSubmission } : state.currentTrack,
        }));
      },

      toggleBookmark: async (trackId) => {
        const { queue, history, bookmarks } = get();
        const allTracks = [...queue, ...history, ...bookmarks];
        const track = allTracks.find((t) => t.id === trackId);
        if (!track) return;

        // Optimistic update
        const isBookmarked = bookmarks.some((b) => b.id === trackId);
        if (isBookmarked) {
          set({ bookmarks: bookmarks.filter((b) => b.id !== trackId) });
        } else {
          set({ bookmarks: [...bookmarks, { ...track, bookmarked: true }] });
        }

        try {
          await api.post(`/reviewer/${track.reviewer_id}/queue/${trackId}/bookmark`);
        } catch (error) {
          console.error("Failed to toggle bookmark:", error);
          // Revert on error (could be improved)
        }
      },

      toggleSpotlight: async (trackId) => {
        const { queue, history, spotlight } = get();
        const allTracks = [...queue, ...history, ...spotlight];
        const track = allTracks.find((t) => t.id === trackId);
        if (!track) return;

        // Optimistic update
        const isSpotlighted = spotlight.some((s) => s.id === trackId);
        if (isSpotlighted) {
          set({ spotlight: spotlight.filter((s) => s.id !== trackId) });
        } else {
          set({ spotlight: [...spotlight, { ...track, spotlighted: true }] });
        }

        try {
          await api.post(`/reviewer/${track.reviewer_id}/queue/${trackId}/spotlight`);
        } catch (error) {
          console.error("Failed to toggle spotlight:", error);
          // Revert on error
        }
      },
    }),
    { name: 'QueueStore' }
  )
);
