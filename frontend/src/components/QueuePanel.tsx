import {
  MusicalNoteIcon,
  TrashIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";

// Mock data for the queue
const mockPriorityQueue = [
  {
    id: 1,
    submitter: {
      discord: "@SubmitterA",
      tiktok: "@TikTokA",
    },
    song: {
      title: "Priority Track 1",
      duration: "3:45",
    },
  },
  {
    id: 2,
    submitter: {
      discord: "@SubmitterB",
    },
    song: {
      title: "Priority Track 2",
      duration: "4:12",
    },
  },
];

const mockRegularQueue = [
  {
    id: 3,
    submitter: {
      discord: "@SubmitterC",
      tiktok: "@TikTokC",
    },
    song: {
      title: "Regular Song A",
      duration: "2:58",
    },
  },
  {
    id: 4,
    submitter: {
      discord: "@SubmitterD",
    },
    song: {
      title: "Another Regular One",
      duration: "3:30",
    },
  },
];

const QueueItem = ({ item }: { item: (typeof mockPriorityQueue)[0] }) => (
  <div className="bg-gray-700 p-3 rounded-md flex items-center justify-between hover:bg-gray-600 cursor-pointer">
    <div className="flex items-center space-x-3">
      <MusicalNoteIcon className="h-6 w-6 text-gray-400" />
      <div>
        <p className="font-semibold">{item.song.title}</p>
        <p className="text-sm text-gray-400">
          {item.submitter.discord}{" "}
          {item.submitter.tiktok && `(${item.submitter.tiktok})`} -{" "}
          {item.song.duration}
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

const QueuePanel = () => {
  return (
    <div className="w-1/4 bg-gray-800 p-4 overflow-y-auto h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4">Queue</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-purple-400 mb-2">
            Priority Line
          </h3>
          <div className="space-y-2">
            {mockPriorityQueue.map((item) => (
              <QueueItem key={item.id} item={item} />
            ))}
          </div>
        </div>
        <div className="border-t border-dashed border-gray-600 my-4"></div>
        <div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            Regular Line
          </h3>
          <div className="space-y-2">
            {mockRegularQueue.map((item) => (
              <QueueItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueuePanel;
