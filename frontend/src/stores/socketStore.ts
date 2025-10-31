import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  initializeSocket: (token: string) => void;
  disconnectSocket: () => void;
}

// By default, socket connection is enabled.
// Test environments can disable this by setting window.isSocketEnabled = false
const isSocketEnabled = () => (window as any).isSocketEnabled !== false;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  initializeSocket: (token) => {
    if (!isSocketEnabled() || get().socket) {
      console.log('Socket connection is disabled or already initialized.');
      return;
    }

    console.log('Initializing socket connection...');
    const newSocket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully.');
      set({ isConnected: true });
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected.');
      set({ isConnected: false });
    });

    set({ socket: newSocket });
  },
  disconnectSocket: () => {
    get().socket?.disconnect();
    set({ socket: null, isConnected: false });
  },
}));
