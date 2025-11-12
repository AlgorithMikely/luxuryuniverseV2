// src/types.ts

export interface User {
  id: number;
  discord_id: string;
  username: string;
  // Add other user properties as needed
}

export interface Submission {
  id: number;
  track_url: string;
  track_title: string | null;
  user: User; // Embedded user object
  status: 'pending' | 'played' | 'next';
  score: number | null;
  notes: string | null;
  bookmarked: boolean;
  spotlighted: boolean;
  session_id: number;
  // Add other submission properties as needed
}

export interface ReviewSession {
  id: number;
  name: string;
  reviewer_id: number;
  is_active: boolean;
  // Add other session properties as needed
}
