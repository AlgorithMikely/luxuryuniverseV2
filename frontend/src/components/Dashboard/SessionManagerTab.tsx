import React from 'react';
import SessionControls from './SessionControls';
import SessionManager from './SessionManager';

const SessionManagerTab: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 h-full">
      <SessionControls />
      <SessionManager />
    </div>
  );
};

export default SessionManagerTab;
