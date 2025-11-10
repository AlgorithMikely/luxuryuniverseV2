import React, { useState } from 'react';
import HistoryPanel from './HistoryPanel';
import SessionManagerTab from './SessionManagerTab';
import BookmarkPanel from './BookmarkPanel';
import SpotlightPanel from './SpotlightPanel';

const RightPanelTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('History');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'History':
        return <HistoryPanel />;
      case 'Bookmarks':
        return <BookmarkPanel />;
      case 'Spotlight':
        return <SpotlightPanel />;
      case 'Session Manager':
        return <SessionManagerTab />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg h-full flex flex-col">
      <div className="flex border-b border-gray-700">
        <TabButton title="History" activeTab={activeTab} onClick={setActiveTab} />
        <TabButton title="Bookmarks" activeTab={activeTab} onClick={setActiveTab} />
        <TabButton title="Spotlight" activeTab={activeTab} onClick={setActiveTab} />
        <TabButton title="Session Manager" activeTab={activeTab} onClick={setActiveTab} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

interface TabButtonProps {
  title: string;
  activeTab: string;
  onClick: (title: string) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ title, activeTab, onClick }) => (
  <button
    className={`px-4 py-2 text-sm font-medium ${
      activeTab === title
        ? 'text-white border-b-2 border-purple-500'
        : 'text-gray-400 hover:text-white'
    }`}
    onClick={() => onClick(title)}
  >
    {title}
  </button>
);

export default RightPanelTabs;
