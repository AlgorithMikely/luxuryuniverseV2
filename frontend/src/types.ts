// --- User and Auth ---
export interface User {
  id: number;
  discord_id: string;
  username: string;
  tiktok_username?: string;
  reviewer_profile?: ReviewerProfile;
  spotify_connected?: boolean;
}

export interface UserProfile extends User {
    roles: string[];
    moderated_reviewers?: ReviewerProfile[];
}

export interface ReviewerProfile {
    id: number;
    user_id: number;
    tiktok_handle: string;
    discord_channel_id?: string;
    queue_status: 'open' | 'closed';
}

// --- Submissions & Queue ---
export interface Submission {
  id: number;
  reviewer_id: number;
  user_id: number;
  track_url: string;
  track_title?: string;
  archived_url?: string;
  status: 'pending' | 'played' | 'next';
  submitted_at: string;
  score?: number;
  notes?: string;
  user: User;
  bookmarked?: boolean;
  spotlighted?: boolean;
}
