import { useParams } from 'react-router-dom';
import SubmissionQueue from '../components/SubmissionQueue';
import WebPlayer from '../components/WebPlayer';
import RightPanelTabs from '../components/RightPanelTabs';
import ActiveSubmission from '../components/ActiveSubmission';

const ReviewerDashboard = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();

  if (!reviewerId) {
    return <div>Reviewer not found.</div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] text-white bg-gray-900">
      {/* Left Panel: Submission Queue */}
      <div className="w-1/4 h-full overflow-y-auto p-4 border-r border-gray-700">
        <h2 className="text-xl font-bold mb-4">Submission Queue</h2>
        <SubmissionQueue reviewerId={reviewerId} />
      </div>

      {/* Middle Panel: Player and Active Submission */}
      <div className="w-1/2 h-full flex flex-col p-4">
        <div className="flex-shrink-0">
          <WebPlayer />
        </div>
        <div className="flex-grow mt-4">
          <ActiveSubmission reviewerId={reviewerId} />
        </div>
      </div>

      {/* Right Panel: Tabs */}
      <div className="w-1/4 h-full overflow-y-auto p-4 border-l border-gray-700">
        <RightPanelTabs reviewerId={reviewerId} />
      </div>
    </div>
  );
};

export default ReviewerDashboard;
