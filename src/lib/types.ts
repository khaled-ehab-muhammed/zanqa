export type Member = {
  user_id: string;
  display_name: string;
  is_founder: boolean;
  joined_at: string;
  total_seconds: number; // today's total as of server_now (includes the running session)
  studying: boolean;
  active_started_at: string | null;
  has_started: boolean;
};

export type RoomInfo = {
  id: string;
  code: string;
  name: string;
  status: 'waiting' | 'active';
  started_at: string | null;
  timezone: string;
  max_members: number;
  founder_id: string;
};

export type RoomState = {
  room: RoomInfo;
  members: Member[];
  day_start: string;
  day_end: string;
  server_now: string;
  me: string;
};

export type Profile = { id: string; display_name: string };

export type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
};
