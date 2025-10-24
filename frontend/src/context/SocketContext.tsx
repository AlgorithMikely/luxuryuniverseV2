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
      const newSocket = io({
        path: "/socket.io/",
        auth: { token },
      });

      newSocket.on("connect_error", (err) => {
        if (err.message === "Authentication failed") {
          logout();
        }
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
  }, [token, logout, socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
