import React, { useState } from 'react';
import HistoryPanel from './HistoryPanel';
import BookmarkPanel from './BookmarkPanel';
import SpotlightPanel from './SpotlightPanel';

type Tab = 'History' | 'Bookmarks' | 'Spotlight';

interface RightPanelTabsProps {
  reviewerId?: string;
}

const RightPanelTabs: React.FC<RightPanelTabsProps> = ({ reviewerId }) => {
  const [activeTab, setActiveTab] = useState<Tab>('History');

  const renderContent = () => {
    switch (activeTab) {
      case 'History':
        return <HistoryPanel />;
      case 'Bookmarks':
        return <BookmarkPanel />;
      case 'Spotlight':
        return <SpotlightPanel />;
      default:
        return null;
    }
  };

  interface TabButtonProps {
    label: Tab;
    isActive: boolean;
    onClick: (label: Tab) => void;
  }

  const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => (
    <button
      className={`px-4 py-2 text-sm font-medium rounded-t-lg ${isActive
        ? 'bg-purple-600 text-white'
        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      onClick={() => onClick(label)}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
      <div className="flex border-b border-gray-700 overflow-x-auto">
        <TabButton label="History" isActive={activeTab === 'History'} onClick={setActiveTab} />
        <TabButton label="Bookmarks" isActive={activeTab === 'Bookmarks'} onClick={setActiveTab} />
        <TabButton label="Spotlight" isActive={activeTab === 'Spotlight'} onClick={setActiveTab} />
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default RightPanelTabs;
