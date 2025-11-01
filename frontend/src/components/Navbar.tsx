import React from "react";
import { useDashboard } from "../context/DashboardContext";
import { useAuthStore } from "../stores/authStore";

const Navbar: React.FC = () => {
  const { setActivePanel } = useDashboard();
  const { user, logout } = useAuthStore();

  return (
    <div className="bg-gray-800 p-4 flex justify-between items-center">
      <div>
        <button
          onClick={() => setActivePanel("queue")}
          className="text-white mr-4"
        >
          Queue
        </button>
        <button
          onClick={() => setActivePanel("history")}
          className="text-white mr-4"
        >
          History
        </button>
        <button
          onClick={() => setActivePanel("saved")}
          className="text-white mr-4"
        >
          Saved
        </button>
        <button
          onClick={() => setActivePanel("picks")}
          className="text-white mr-4"
        >
          Picks
        </button>
      </div>
      <div>
        <span className="text-white mr-4">{user?.username}</span>
        <button onClick={logout} className="text-white">
          Logout
        </button>
      </div>
    </div>
  );
};

export default Navbar;
