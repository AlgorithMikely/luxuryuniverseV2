// --- Configuration & Profiles ---

export interface PriorityTier {
  value: number;
  label: string;
  color: string;
  tier_name?: string;
  submissions_count?: number;
}

export interface ReviewerConfiguration {
  priority_tiers: PriorityTier[];
  free_line_limit?: number;
  visible_free_limit?: number; // Added this
  line_show_skips?: boolean;
  banner_url?: string;
  banner_r2_uri?: string;
  theme_color?: string;
  social_link_url?: string;
  social_link_text?: string;
  social_platform?: string;
  social_handle?: string;
  max_free_submissions_session?: number;
  giveaway_settings?: {
    [key: string]: {
      base_target: number;
      description?: string;
      ticket_weight?: number;
    };
  };
}

export interface PaymentConfig {
  id: number;
  provider: string;
  is_enabled: boolean;
  credentials?: Record<string, any>;
}

export interface EconomyConfig {
  id: number;
  reviewer_id: number;
  event_name: string;
  coin_amount: number;
}

// --- User and Auth ---

// Forward declaration not needed in TS interfaces, but let's define ReviewerProfile first if possible, 
// but it needs User. 
// Let's define User first.

export interface User {
  id: number;
  discord_id: string;
  username: string;
  email?: string;
  avatar?: string;
  tiktok_username?: string;
  // Settings
  artist_name?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  youtube_channel?: string;
  soundcloud_url?: string;
  apple_music_url?: string;

  reviewer_profile?: ReviewerProfile;
  spotify_connected?: boolean;
  xp: number;
  level: number;
  roles: string[];
  moderated_reviewers?: ReviewerProfile[];
  average_review_score?: number;
  total_submissions_graded?: number;
  is_line_authorized?: boolean;
}

export interface UserProfile extends User { }

export interface ReviewerProfile {
  id: number;
  user_id: number;
  tiktok_handle: string;
  discord_channel_id?: string;
  see_the_line_channel_id?: string;
  queue_status: 'open' | 'closed';
  open_queue_tiers?: number[];
  configuration?: ReviewerConfiguration;
  payment_configs?: PaymentConfig[];
  economy_configs?: EconomyConfig[];
  user?: User;
  avatar_url?: string;
  avatar_r2_uri?: string;
  bio?: string;
  community_goal_cooldown_minutes?: number;
}
// --- Submissions & Queue ---
export interface Submission {
  id: number;
  reviewer_id: number;
  user: User;
  reviewer?: ReviewerProfile;
  track_url: string;
  track_title?: string;
  artist?: string;
  archived_url?: string;
  status: 'pending' | 'playing' | 'reviewed' | 'played' | 'rejected';
  score?: number;
  notes?: string;
  note?: string;
  rating?: number;
  submitted_at: string;
  is_priority: boolean;
  priority_value: number;
  bookmarked: boolean;
  spotlighted: boolean;
  start_time?: string;
  end_time?: string;
  genre?: string;
  tags?: string[];
  poll_result_w_percent?: number;
  average_concurrent_viewers?: number;
  batch_id?: string;
  sequence_order?: number;
  hook_start_time?: number;
  hook_end_time?: number;
  is_community_winner?: boolean;
}

export interface Session {
  id: number;
  reviewer_id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  open_queue_tiers: number[];
}

export interface SubmitterStats {
  user: User;
  average_review_score: number;
  average_poll_result: number;
  genres: string[];
  submissions: Submission[];
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  category?: string;
}

export interface TikTokAccount {
  id: number;
  handle_name: string;
  points: number;
  monitored: boolean;
  user_id?: number;
  avg_concurrent_viewers: number;
  max_concurrent_viewers: number;
  avg_total_viewers: number;
  max_total_viewers: number;
}

export interface FullQueueState {
  queue: Submission[];
  history: Submission[];
  bookmarks: Submission[];
  spotlight: Submission[];
  current_track: Submission | null;
  is_live: boolean;
}

export interface SmartSubmissionItem {
  track_url: string;
  track_title?: string;
  artist?: string;
  genre?: string;
  file?: File;
  hook_start_time?: number;
  hook_end_time?: number;
  priority_value: number;
  sequence_order: number;
  preview_url?: string;
  is_history?: boolean;
}

