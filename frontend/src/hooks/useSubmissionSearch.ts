import { useMemo } from 'react';
import { Submission } from '../types';

export const useSubmissionSearch = (submissions: Submission[], query: string) => {
  return useMemo(() => {
    if (!query.trim()) {
      return submissions;
    }

    const lowerQuery = query.toLowerCase();

    return submissions.filter((submission) => {
      const trackTitle = submission.track_title?.toLowerCase() || '';
      const artist = submission.artist?.toLowerCase() || '';
      const username = submission.user?.username?.toLowerCase() || '';
      const tiktok = submission.user?.tiktok_username?.toLowerCase() || '';
      const trackUrl = submission.track_url?.toLowerCase() || '';

      return (
        trackTitle.includes(lowerQuery) ||
        artist.includes(lowerQuery) ||
        username.includes(lowerQuery) ||
        tiktok.includes(lowerQuery) ||
        trackUrl.includes(lowerQuery)
      );
    });
  }, [submissions, query]);
};
