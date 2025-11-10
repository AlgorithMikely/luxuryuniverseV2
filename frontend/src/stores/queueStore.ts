import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import io, { Socket } from 'socket.io-client';

// Define the shape of a User, matching the backend schema.
interface User {
  id: number;
  username: string;
  tiktok_username?: string | null;
}

// Expand the Submission interface to include all relevant data from the backend.
export interface Submission {
  id: number;
  session_id: number;
  user: User;
  track_url: string;
  track_title?: string | null;
  archived_url?: string | null;
  status: 'pending' | 'played' | 'bookmarked';
  submitted_at: string;
  notes?: string;
  score?: number;
  skip_count: number;
}

// This is the shape of the data received from the 'queue_state' WebSocket event.
export interface FullQueueState {
  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
}

// Define the state structure for our new unified store.
interface UnifiedQueueState {
  socket: Socket | null;
  socketStatus: 'connected' | 'disconnected' | 'connecting';

  // Core data arrays
  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
  currentTrack: Submission | null;

  // --- ACTIONS ---
  connect: (token: string) => void;
  disconnect: () => void;
  setCurrentTrack: (track: Submission | null) => void;
  updateSubmission: (updatedSubmission: Submission) => void; // For optimistic UI updates
}

export const useQueueStore = create<UnifiedQueueState>()(
  devtools(
    (set, get) => ({
      // Initial state
      socket: null,
      socketStatus: 'disconnected',
      queue: [],
      history: [],
      bookmarks: [],
      currentTrack: null,

      // --- ACTION IMPLEMENTATIONS ---

      connect: (token) => {
        const { socket } = get();
        if (socket?.connected) {
          return; // Prevent multiple connections
        }

        set({ socketStatus: 'connecting' });

        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
          auth: { token },
          transports: ['websocket'],
        });

        newSocket.on('connect', () => {
          console.log('Socket connected:', newSocket.id);
          set({ socket: newSocket, socketStatus: 'connected' });
        });

        newSocket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          // Reset state on disconnect
          set({
            socket: null,
            socketStatus: 'disconnected',
            queue: [],
            history: [],
            bookmarks: [],
            currentTrack: null,
          });
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error.message);
          set({ socketStatus: 'disconnected' });
        });

        // Main event listener for receiving the entire queue state from the backend
        newSocket.on('queue_state', (state: FullQueueState) => {
          set({
            queue: state.queue,
            history: state.history,
            bookmarks: state.bookmarks,
          });
        });

        // Event listener for incremental queue updates
        newSocket.on('queue_updated', (newQueue: Submission[]) => {
          set({ queue: newQueue });
        });

        // Event listener for history updates
        newSocket.on('history_updated', (newHistory: Submission[]) => {
          set({ history: newHistory });
        });

        // Event listener for receiving the initial state upon connection
        newSocket.on('initial_state', (state: FullQueueState) => {
            set({
                queue: state.queue,
                history: state.history,
            });
        });
      },

      disconnect: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
        }
      },

      setCurrentTrack: (track) => set({ currentTrack: track }),

      updateSubmission: (updatedSubmission) => {
        // Optimistically update the submission wherever it appears
        const updateList = (list: Submission[]) =>
          list.map((item) =>
            item.id === updatedSubmission.id ? { ...item, ...updatedSubmission } : item
          );

        set((state) => ({
          queue: updateList(state.queue),
          history: updateList(state.history),
          bookmarks: updateList(state.bookmarks),
          currentTrack:
            state.currentTrack?.id === updatedSubmission.id
              ? { ...state.currentTrack, ...updatedSubmission }
              : state.currentTrack,
        }));
      },
    }),
    { name: 'QueueStore' }
  )
);
