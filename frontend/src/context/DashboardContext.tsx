import React, { createContext, useContext, useState } from "react";
import { Submission } from "../stores/queueStore";

type PanelType = "queue" | "history" | "saved" | "picks" | "users";

interface DashboardContextType {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
  selectedUser: Submission["user"] | null;
  setSelectedUser: (user: Submission["user"] | null) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activePanel, setActivePanel] = useState<PanelType>("queue");
  const [selectedUser, setSelectedUser] = useState<Submission["user"] | null>(
    null
  );

  return (
    <DashboardContext.Provider
      value={{
        activePanel,
        setActivePanel,
        selectedUser,
        setSelectedUser,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};
