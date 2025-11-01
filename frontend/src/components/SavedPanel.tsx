import React from "react";
import { useQueueStore } from "../stores/queueStore";

const SavedPanel: React.FC = () => {
  const { saved, setNowPlaying } = useQueueStore();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Saved</h2>
      <ul>
        {saved.map((submission) => (
          <li
            key={submission.id}
            className="flex justify-between items-center p-2 hover:bg-gray-700 cursor-pointer"
            onClick={() => setNowPlaying(submission)}
          >
            <span>{submission.track_url}</span>
            <span className="text-sm text-gray-400">
              {submission.user.username}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SavedPanel;
