import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Submission } from '../../stores/queueStore'; // Assuming a Submission type is defined

interface SessionHistoryProps {
  sessionId: number;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({ sessionId }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!sessionId) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<Submission[]>(`/sessions/${sessionId}`);
        setSubmissions(response.data);
      } catch (err) {
        setError('Failed to fetch session history.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [sessionId]);

  const handleExport = () => {
    // Basic CSV export logic
    const headers = ['Track Title', 'Submitter', 'URL', 'Rating', 'Notes'];
    const rows = submissions.map(s => [
      s.track_title || 'N/A',
      s.user.username,
      s.track_url,
      s.score ?? 'N/A',
      s.notes || ''
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `session_${sessionId}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (isLoading) return <p>Loading history...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Session History</h2>
        <button
            onClick={handleExport}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            disabled={submissions.length === 0}
            >
            Export as CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
            <thead className="border-b border-gray-600">
                <tr>
                    <th className="p-2">Track</th>
                    <th className="p-2">Submitter</th>
                    <th className="p-2">Rating</th>
                </tr>
            </thead>
            <tbody>
                {submissions.map(submission => (
                    <tr key={submission.id} className="border-b border-gray-700">
                        <td className="p-2">
                          <a href={submission.track_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-400">
                            {submission.track_title || 'Untitled Track'}
                          </a>
                        </td>
                        <td className="p-2">{submission.user.username}</td>
                        <td className="p-2">{submission.score ?? 'N/A'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        {submissions.length === 0 && <p className="text-gray-400 mt-4">No submissions found for this session.</p>}
      </div>
    </div>
  );
};

export default SessionHistory;
