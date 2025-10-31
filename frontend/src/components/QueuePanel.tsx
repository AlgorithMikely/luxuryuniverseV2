import {
  MusicalNoteIcon,
  TrashIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import { useQueueStore, Submission } from "../stores/queueStore";

const QueueItem = ({ submission }: { submission: Submission }) => {
  const setCurrentTrack = useQueueStore((state) => state.setCurrentTrack);

  const handlePlay = () => {
    setCurrentTrack(submission);
  };

  return (
    <div
      className="bg-gray-700 p-3 rounded-md flex items-center justify-between hover:bg-gray-600 cursor-pointer"
      onClick={handlePlay}
    >
      <div className="flex items-center space-x-3">
        <MusicalNoteIcon className="h-6 w-6 text-gray-400" />
        <div>
          <p className="font-semibold">
            {submission.track_title || "Untitled"}
          </p>
          <p className="text-sm text-gray-400">
            {submission.submitted_by.username}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2 text-gray-400">
        <button className="hover:text-white">
          <TrashIcon className="h-5 w-5" />
        </button>
        <button className="hover:text-white">
          <Bars3Icon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

const QueuePanel = () => {
  const queue = useQueueStore((state) => state.queue);
  const pendingQueue = queue.filter((s) => s.status === "pending");

  return (
    <div className="w-1/4 bg-gray-800 p-4 overflow-y-auto h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4">Queue</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            Upcoming Tracks
          </h3>
          <div className="space-y-2">
            {pendingQueue.map((submission) => (
              <QueueItem key={submission.id} submission={submission} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueuePanel;
