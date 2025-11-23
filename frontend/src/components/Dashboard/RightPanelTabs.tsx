import React, { useState, useMemo } from 'react';
import HistoryPanel from './HistoryPanel';
import BookmarkPanel from './BookmarkPanel';
import SpotlightPanel from './SpotlightPanel';
import { Search } from 'lucide-react';
import { useSubmissionSearch } from '../../hooks/useSubmissionSearch';
import { useQueueStore } from '../../stores/queueStore';
import { Submission } from '../../types';

type Tab = 'History' | 'Bookmarks' | 'Spotlight';

interface RightPanelTabsProps {
  reviewerId?: string;
}

const RightPanelTabs: React.FC<RightPanelTabsProps> = ({ reviewerId }) => {
  const [activeTab, setActiveTab] = useState<Tab>('History');
  const [searchQuery, setSearchQuery] = useState('');
  const { history, bookmarks, spotlight } = useQueueStore();

  // Derive the data for the current tab
  // Note: HistoryPanel logic for combining lists is complex (history + bookmarks + spotlight).
  // We need to replicate that logic here if we want to filter it effectively,
  // OR we can let the panels handle their own data if no search is present,
  // but for search to work, we need to pass filtered data.
  // Let's replicate the data source logic for each tab to pass to the search hook.

  const allHistoryItems = useMemo(() => {
    const combined = [...history, ...bookmarks, ...spotlight];
    const unique = new Map();
    combined.forEach(item => {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    });
    return Array.from(unique.values()).sort((a, b) => b.id - a.id);
  }, [history, bookmarks, spotlight]);

  const currentTabSubmissions = useMemo(() => {
    switch (activeTab) {
      case 'History':
        return allHistoryItems;
      case 'Bookmarks':
        return bookmarks;
      case 'Spotlight':
        return spotlight;
      default:
        return [];
    }
  }, [activeTab, allHistoryItems, bookmarks, spotlight]);

  const filteredSubmissions = useSubmissionSearch(currentTabSubmissions, searchQuery);

  const renderContent = () => {
    // We pass the filtered submissions to the panels.
    // If searchQuery is empty, filteredSubmissions is the full list (same as what panels would fetch themselves, roughly).
    // Note: BookmarkPanel/SpotlightPanel fetch from store by default. Passing props overrides that.
    switch (activeTab) {
      case 'History':
        return <HistoryPanel submissions={filteredSubmissions} />;
      case 'Bookmarks':
        return <BookmarkPanel submissions={filteredSubmissions} />;
      case 'Spotlight':
        return <SpotlightPanel submissions={filteredSubmissions} />;
      default:
        return null;
    }
  };

  interface TabButtonProps {
    label: Tab;
    isActive: boolean;
    count: number;
    onClick: (label: Tab) => void;
  }

  const TabButton: React.FC<TabButtonProps> = ({ label, isActive, count, onClick }) => (
    <button
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${isActive
        ? 'bg-purple-600 text-white'
        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      onClick={() => onClick(label)}
    >
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-black/20 text-gray-400'}`}>
        {count}
      </span>
    </button>
  );

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        <TabButton
          label="History"
          isActive={activeTab === 'History'}
          count={allHistoryItems.length}
          onClick={setActiveTab}
        />
        <TabButton
          label="Bookmarks"
          isActive={activeTab === 'Bookmarks'}
          count={bookmarks.length}
          onClick={setActiveTab}
        />
        <TabButton
          label="Spotlight"
          isActive={activeTab === 'Spotlight'}
          count={spotlight.length}
          onClick={setActiveTab}
        />
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-gray-800 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default RightPanelTabs;
