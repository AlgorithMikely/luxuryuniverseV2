import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import io, { Socket } from 'socket.io-client';
import { Submission } from '../types';

export type { Submission };

// This is the shape of the data received from the WebSocket events.
export interface FullQueueState {
  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
  spotlight: Submission[];
}

// Define the state structure for our store.
interface QueueState {
  socket: Socket | null;
  socketStatus: 'connected' | 'disconnected' | 'connecting';

  // Core data arrays
  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
  spotlight: Submission[];
  currentTrack: Submission | null;

  // --- ACTIONS ---
  connect: (token: string) => void;
  disconnect: () => void;
  setCurrentTrack: (track: Submission | null) => void;
  updateSubmission: (updatedSubmission: Submission) => void;
  toggleBookmark: (trackId: number) => void;
  toggleSpotlight: (trackId: number) => void;
}

export const useQueueStore = create<QueueState>()(
  devtools(
    (set, get) => ({
      // Initial state
      socket: null,
      socketStatus: 'disconnected',
      queue: [],
      history: [],
      bookmarks: [],
      spotlight: [],
      currentTrack: null,

      // --- ACTION IMPLEMENTATIONS ---

      connect: (token) => {
        const { socket } = get();
        if (socket?.connected) return;

        set({ socketStatus: 'connecting' });
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
          auth: { token },
          transports: ['websocket'],
        });

        newSocket.on('connect', () => {
          set({ socket: newSocket, socketStatus: 'connected' });
        });

        newSocket.on('disconnect', () => {
          set({ socket: null, socketStatus: 'disconnected' });
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          set({ socketStatus: 'disconnected' });
        });

        // Combined state update event
        newSocket.on('initial_state', (state: FullQueueState) => {
          set({
            queue: state.queue || [],
            history: state.history || [],
            bookmarks: state.bookmarks || [],
            spotlight: state.spotlight || [],
          });
        });
         newSocket.on('queue_updated', (newQueue: Submission[]) => set({ queue: newQueue }));
         newSocket.on('history_updated', (newHistory: Submission[]) => set({ history: newHistory }));

      },

      disconnect: () => {
        get().socket?.disconnect();
      },

      setCurrentTrack: (track) => set({ currentTrack: track }),

      updateSubmission: (updatedSubmission) => {
        const updateList = (list: Submission[]) =>
          list.map((item) =>
            item.id === updatedSubmission.id ? { ...item, ...updatedSubmission } : item
          );
        set((state) => ({
          queue: updateList(state.queue),
          history: updateList(state.history),
          bookmarks: updateList(state.bookmarks),
          spotlight: updateList(state.spotlight),
          currentTrack:
            state.currentTrack?.id === updatedSubmission.id
              ? { ...state.currentTrack, ...updatedSubmission }
              : state.currentTrack,
        }));
      },

      toggleBookmark: (trackId) => {
          const { queue, history, bookmarks } = get();
          const allTracks = [...queue, ...history];
          const track = allTracks.find(t => t.id === trackId);

          if(!track) return;

          const isBookmarked = bookmarks.some(b => b.id === trackId);

          if(isBookmarked) {
              set({ bookmarks: bookmarks.filter(b => b.id !== trackId) });
          } else {
              set({ bookmarks: [...bookmarks, { ...track, bookmarked: true }] });
          }
      },

      toggleSpotlight: (trackId) => {
          const { queue, history, spotlight } = get();
          const allTracks = [...queue, ...history];
          const track = allTracks.find(t => t.id === trackId);

          if(!track) return;

          const isSpotlighted = spotlight.some(s => s.id === trackId);

          if(isSpotlighted) {
              set({ spotlight: spotlight.filter(s => s.id !== trackId) });
          } else {
              set({ spotlight: [...spotlight, { ...track, spotlighted: true }] });
          }
      },

    }),
    { name: 'QueueStore' }
  )
);
