import { useState } from "react";
import {
  ClockIcon,
  BookmarkIcon,
  StarIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";

const mockRecentlyPlayed = [
  { id: 1, title: "Yesterday's Jam", artist: "The Boops" },
  { id: 2, title: "Old News Blues", artist: "DJ Regret" },
];

const mockBookmarked = [
  { id: 3, title: "Save For Later", artist: "Procrastinators" },
];

const mockSpotlighted = [
  { id: 4, title: "Track of the Week", artist: "The Chosen One" },
];

const mockSubmitter = {
  name: "@SubmitterA",
  tiktok: "@TikTokA",
  history: [
    { title: "First Submission", score: 8 },
    { title: "Another One", score: 7 },
  ],
};

const HistoryPanel = () => {
  const [activeTab, setActiveTab] = useState("recently");

  const renderTabContent = () => {
    switch (activeTab) {
      case "recently":
        return (
          <ul className="space-y-2">
            {mockRecentlyPlayed.map((item) => (
              <li key={item.id} className="text-sm p-2 bg-gray-700 rounded-md">
                <p className="font-semibold">{item.title}</p>
                <p className="text-gray-400">{item.artist}</p>
              </li>
            ))}
          </ul>
        );
      case "bookmarked":
        return (
           <ul className="space-y-2">
            {mockBookmarked.map((item) => (
              <li key={item.id} className="text-sm p-2 bg-gray-700 rounded-md">
                <p className="font-semibold">{item.title}</p>
                <p className="text-gray-400">{item.artist}</p>
              </li>
            ))}
          </ul>
        );
      case "spotlighted":
        return (
           <ul className="space-y-2">
            {mockSpotlighted.map((item) => (
              <li key={item.id} className="text-sm p-2 bg-gray-700 rounded-md">
                <p className="font-semibold">{item.title}</p>
                <p className="text-gray-400">{item.artist}</p>
              </li>
            ))}
          </ul>
        );
      case "submitter":
        return (
            <div className="space-y-2 text-sm">
                <p className="font-bold text-lg">{mockSubmitter.name}</p>
                <p className="text-purple-400">{mockSubmitter.tiktok}</p>
                <h4 className="font-semibold pt-2">Submission History:</h4>
                 <ul className="space-y-1">
                    {mockSubmitter.history.map(s => (
                        <li key={s.title} className="flex justify-between"><span>{s.title}</span> <span>Score: {s.score}/10</span></li>
                    ))}
                </ul>
            </div>
        );
      default:
        return null;
    }
  };

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 flex items-center justify-center p-2 text-sm border-b-2 ${
        activeTab === id
          ? "border-purple-500 text-white"
          : "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200"
      }`}
    >
      <Icon className="h-5 w-5 mr-1" /> {label}
    </button>
  );

  return (
    <div className="w-1/4 bg-gray-800 p-4 overflow-y-auto h-full flex flex-col">
      <div className="border-b border-gray-700 mb-4">
        <div className="flex -mb-px">
          <TabButton id="recently" label="Recent" icon={ClockIcon} />
          <TabButton id="bookmarked" label="Saved" icon={BookmarkIcon} />
          <TabButton id="spotlighted" label="Picks" icon={StarIcon} />
          <TabButton id="submitter" label="User" icon={UserCircleIcon} />
        </div>
      </div>
      <div>{renderTabContent()}</div>
    </div>
  );
};

export default HistoryPanel;
