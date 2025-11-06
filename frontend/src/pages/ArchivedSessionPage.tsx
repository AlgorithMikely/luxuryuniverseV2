import React from 'react';
import { useParams, Link } from 'react-router-dom';
import SessionHistory from '../components/Dashboard/SessionHistory';
import Navbar from '../components/Navbar'; // Assuming a Navbar component exists

const ArchivedSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  // Ensure sessionId is a number before passing it down
  const numericSessionId = sessionId ? parseInt(sessionId, 10) : undefined;

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <Navbar />
      <div className="p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Archived Session Details</h1>
          <Link to="/dashboard" className="text-blue-400 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </header>

        {numericSessionId ? (
          <SessionHistory sessionId={numericSessionId} />
        ) : (
          <p className="text-red-500">No session ID provided.</p>
        )}
      </div>
    </div>
  );
};

export default ArchivedSessionPage;
