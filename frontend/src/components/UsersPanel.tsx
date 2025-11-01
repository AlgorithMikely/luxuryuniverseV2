import React from "react";
import { useDashboard } from "../context/DashboardContext";

const UsersPanel: React.FC = () => {
  const { selectedUser } = useDashboard();

  if (!selectedUser) {
    return <div>Select a user to see their details</div>;
  }

  return (    <div>
      <h2 className="text-xl font-bold mb-4">{selectedUser.username}</h2>
      {/* Display user's submissions, stats, etc. */}
    </div>
  );
};

export default UsersPanel;
