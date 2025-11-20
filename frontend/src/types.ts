// --- User and Auth ---
export interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar?: string;
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
  username?: string;
}

// --- Submissions & Queue ---
export interface Submission {
  id: number;
  reviewer_id: number;
  user: User;
  track_url: string;
  track_title?: string;
  archived_url?: string;
  status: 'pending' | 'playing' | 'reviewed' | 'played';
  score?: number;
  notes?: string;
  note?: string; // Alias for notes to match frontend usage
  rating?: number; // User rating (1-10)
  submitted_at: string;
  is_priority: boolean;
  priority_value: number;
  bookmarked: boolean;
  spotlighted: boolean;
}

export interface Session {
  id: number;
  reviewer_id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  open_queue_tiers: number[];
}
