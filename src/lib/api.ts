import { supabase } from './supabase';
import type { ChatMessage, Profile, RoomState } from './types';

async function rpc<T = void>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', u.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export const upsertProfile = (name: string) => rpc('upsert_profile', { p_name: name });
export const createRoom = (name: string) => rpc<string>('create_room', { p_name: name });
export const joinRoom = (code: string) => rpc<string>('join_room', { p_code: code });
export const leaveRoom = (code: string) => rpc('leave_room', { p_code: code });
export const startCompetition = (code: string) => rpc('start_competition', { p_code: code });
export const startTimer = (code: string) => rpc('start_timer', { p_code: code });
export const pauseTimer = (code: string) => rpc('pause_timer', { p_code: code });
export const getRoomState = (code: string) => rpc<RoomState>('get_room_state', { p_code: code });
export const sendMessage = (code: string, body: string) => rpc('send_message', { p_code: code, p_body: body });
export const getMessages = (code: string) => rpc<ChatMessage[]>('get_messages', { p_code: code });
export const heartbeat = (code: string) => rpc('heartbeat', { p_code: code });
