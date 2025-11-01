import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      // Connect to the backend server, which is on port 8000
      const newSocket = io("http://localhost:8000", {
        path: "/socket.io/",
        auth: { token },
      });
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      // If there's no token, ensure the socket is disconnected.
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
    }
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
