export interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
  roles: string[];
  reviewer_profile: {
    id: number;
  } | null;
  moderated_reviewers?: Array<{
    id: number;
    username: string;
  }>;
}
