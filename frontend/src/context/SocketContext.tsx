import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { token } = useAuthStore();

    useEffect(() => {
        // If we have a token, connect as authenticated user
        // If no token, connect as public guest (if allowed by backend)

        const authPayload = token ? { token } : { is_public: true };

        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
            auth: authPayload,
            transports: ['websocket'],
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
            // If authentication failed, and we were trying to use a token, maybe clear it?
            if (err.message === "Authentication failed" && token) {
                console.warn("Token expired or invalid. Logging out...");
                useAuthStore.getState().logout();
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
