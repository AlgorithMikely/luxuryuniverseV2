import { useState } from 'react';
import HistoryPanel from './HistoryPanel';
import BookmarkPanel from './BookmarkPanel';
import SpotlightPanel from './SpotlightPanel';
import SessionManager from './SessionManager';

interface RightPanelTabsProps {
  reviewerId: string;
}

type Tab = 'History' | 'Bookmarks' | 'Spotlight' | 'Session';

const RightPanelTabs = ({ reviewerId }: RightPanelTabsProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('History');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'History':
        return <HistoryPanel reviewerId={reviewerId} />;
      case 'Bookmarks':
        return <BookmarkPanel reviewerId={reviewerId} />;
      case 'Spotlight':
        return <SpotlightPanel reviewerId={reviewerId} />;
      case 'Session':
        return <SessionManager reviewerId={reviewerId} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex border-b border-gray-700">
        {(['History', 'Bookmarks', 'Spotlight', 'Session'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 -mb-px font-semibold text-gray-300 border-b-2 ${
              activeTab === tab
                ? 'border-purple-500 text-white'
                : 'border-transparent hover:border-gray-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="pt-4">{renderTabContent()}</div>
    </div>
  );
};

export default RightPanelTabs;
