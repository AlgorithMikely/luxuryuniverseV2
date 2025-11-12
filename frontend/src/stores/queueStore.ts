import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';
import { Submission, ReviewSession } from '../types';
import api from '../services/api';

interface QueueState {
  socket: Socket | null;
  connect: (reviewerId: string) => void;
  disconnect: () => void;

  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
  spotlight: Submission[];
  activeSubmission: Submission | null;
  activeSession: ReviewSession | null;

  setActiveSubmission: (submissionId: number, reviewerId: string, isFromHistory?: boolean) => void;
  updateSubmission: (submission: Submission) => void;
  advanceQueue: (reviewerId: string) => void;
  setActiveSession: (session: ReviewSession) => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  socket: null,
  queue: [],
  history: [],
  bookmarks: [],
  spotlight: [],
  activeSubmission: null,
  activeSession: null,

  connect: (reviewerId: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('Authentication token not found');
      return;
    }

    // Disconnect existing socket if any before creating a new one
    get().disconnect();

    const socket: Socket = io({
      auth: { token, reviewer_id: reviewerId },
    });

    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ socket: null, queue: [], history: [], activeSubmission: null, bookmarks: [], spotlight: [] });
    });

    socket.on('initial_state', (data: { queue: Submission[], history: Submission[], active_session: ReviewSession | null }) => {
        const bookmarks = [...data.queue, ...data.history].filter(s => s.bookmarked);
        const spotlight = [...data.queue, ...data.history].filter(s => s.spotlighted);
        set({
            queue: data.queue,
            history: data.history,
            bookmarks,
            spotlight,
            activeSession: data.active_session,
        });
    });

    socket.on('queue_updated', (newQueue: Submission[]) => {
      set(state => {
        const allSubs = [...newQueue, ...state.history];
        return {
          queue: newQueue,
          bookmarks: allSubs.filter(s => s.bookmarked),
          spotlight: allSubs.filter(s => s.spotlighted),
        };
      });
    });

    socket.on('history_updated', (newHistory: Submission[]) => {
      set(state => {
        const allSubs = [...state.queue, ...newHistory];
        return {
          history: newHistory,
          bookmarks: allSubs.filter(s => s.bookmarked),
          spotlight: allSubs.filter(s => s.spotlighted),
        };
      });
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null });
  },

  setActiveSubmission: (submissionId: number, reviewerId: string, isFromHistory = false) => {
    const source = isFromHistory ? get().history : get().queue;
    const submission = source.find(s => s.id === submissionId);
    if (submission) {
      set({ activeSubmission: submission });
    }
  },

  updateSubmission: (submission: Submission) => {
    const updateList = (list: Submission[]) => list.map(s => s.id === submission.id ? submission : s);
    set(state => {
      const newQueue = updateList(state.queue);
      const newHistory = updateList(state.history);
      const allSubs = [...newQueue, ...newHistory];
      return {
        queue: newQueue,
        history: newHistory,
        activeSubmission: state.activeSubmission?.id === submission.id ? submission : state.activeSubmission,
        bookmarks: allSubs.filter(s => s.bookmarked),
        spotlight: allSubs.filter(s => s.spotlighted),
      }
    });
  },

  advanceQueue: async (reviewerId: string) => {
    try {
        const response = await api.post(`/reviewers/${reviewerId}/queue/next`);
        const nextSubmission = response.data;
        set({ activeSubmission: nextSubmission || null });
    } catch (error) {
        console.error("Failed to advance queue:", error);
        // Handle error, maybe show a toast notification
    }
  },

  setActiveSession: (session: ReviewSession) => {
    set({ activeSession: session });
  },
}));
