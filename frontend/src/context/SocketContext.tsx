
import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { token, logout } = useAuthStore((state) => ({ token: state.token, logout: state.logout }));

  useEffect(() => {
    if (token) {
      // Specify the backend URL explicitly
      const newSocket = io("http://localhost:8000", {
        path: "/socket.io/",
        auth: { token },
      });

      newSocket.on("connect_error", (err) => {
        // Don't log out on connection error, as the socket will try to reconnect automatically.
        // This prevents race conditions on initial login from killing the user's session.
        console.error("Socket connection error:", err.message);
      });

      setSocket(newSocket);

      return () => {
        newSocket.off("connect_error");
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
    }
  }, [token, logout]);

  return (
      <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};