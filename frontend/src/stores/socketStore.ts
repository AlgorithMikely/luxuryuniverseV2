import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  connect: (token: string, reviewerId: number) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connect: (token, reviewerId) => {
    // Disconnect any existing socket
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }

    // Connect to the new socket with authentication
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
      auth: { token },
      query: { reviewerId: String(reviewerId) }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      set({ socket: newSocket });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      set({ socket: null });
    });

    newSocket.on('connect__error', (error) => {
        console.error('Socket connection error:', error.message);
    });

  },
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
