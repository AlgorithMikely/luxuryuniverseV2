import { useState } from 'react';
import { useQueueStore, Submission } from '../../stores/queueStore';

type Tab = 'history' | 'bookmarks';

const HistoryPanel = () => {
  const { history, bookmarks, setCurrentTrack } = useQueueStore();
  const [activeTab, setActiveTab] = useState<Tab>('history');

  const handleTrackSelect = (track: Submission) => {
    setCurrentTrack(track);
  };

  const renderList = (list: Submission[]) => {
    if (list.length === 0) {
      return <p className="text-gray-400 p-4">This list is empty.</p>;
    }
    return (
      <ul className="space-y-2 p-1">
        {list.map((submission) => (
          <li
            key={submission.id}
            onClick={() => handleTrackSelect(submission)}
            className="p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-purple-600 transition-colors duration-200"
          >
            <a href={submission.archived_url || submission.track_url} target="_blank" rel="noopener noreferrer" className="font-semibold truncate hover:underline">
              {submission.track_title || submission.track_url}
            </a>
            <p className="text-sm text-gray-400">
              Submitted by: {submission.user?.username || 'Unknown User'}
            </p>
          </li>
        ))}
      </ul>
    );
  };

  const tabs: { id: Tab; label: string; list: Submission[] }[] = [
    { id: 'history', label: 'History', list: history },
    { id: 'bookmarks', label: 'Bookmarks', list: bookmarks },
  ];

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-full flex flex-col">
      <div className="flex border-b border-gray-700 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === tab.id
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto flex-grow">
        {renderList(tabs.find((t) => t.id === activeTab)!.list)}
      </div>
    </div>
  );
};

export default HistoryPanel;
