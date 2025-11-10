import React from 'react';
import SessionControls from './SessionControls';
import SessionManager from './SessionManager';

const SessionManagerTab: React.FC = () => {
  return (
    <div className="p-4 flex flex-col gap-4">
      <SessionControls />
      <SessionManager />
    </div>
  );
};

export default SessionManagerTab;
