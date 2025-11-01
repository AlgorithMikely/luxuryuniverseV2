import React from "react";
import { useQueueStore } from "../stores/queueStore";
import { useDashboard } from "../context/DashboardContext";

const QueuePanel: React.FC = () => {
  const { queue, setNowPlaying } = useQueueStore();
  const { setActivePanel, setSelectedUser } = useDashboard();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Queue</h2>
      <ul>
        {queue.map((submission) => (
          <li
            key={submission.id}
            className="flex justify-between items-center p-2 hover:bg-gray-700 cursor-pointer"
            onClick={() => setNowPlaying(submission)}
          >
            <span>{submission.track_url}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedUser(submission.user);
                setActivePanel("users");
              }}
              className="text-sm text-gray-400"
            >
              {submission.user.username}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default QueuePanel;
