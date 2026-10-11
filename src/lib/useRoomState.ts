import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getRoomState } from './api';
import { errorCode, friendlyError } from './errors';
import type { RoomState } from './types';

/** Loads room state, keeps it fresh via Realtime, and falls back to polling + refetch on reconnect. */
export function useRoomState(code: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState(Date.now());
  const fetchedAt = useRef(Date.now());
  const rolloverTried = useRef('');

  const refresh = useCallback(async () => {
    try {
      const s = await getRoomState(code);
      fetchedAt.current = Date.now();
      setState(s);
      setFatal(null);
      setConnected(true);
    } catch (e) {
      if (errorCode(e) === 'ROOM_NOT_FOUND' || errorCode(e) === 'NOT_AUTHENTICATED') {
        setFatal(friendlyError(e));
      } else {
        setConnected(false); // network trouble: keep showing last known state and retry
      }
    }
  }, [code]);

  useEffect(() => {
    setState(null);
    setFatal(null);
    void refresh();
    const poll = window.setInterval(() => void refresh(), 10_000);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  // 1s ticker for display only; the truth always comes from server timestamps.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Refetch right after the room's day boundary so the leaderboard resets on time.
  useEffect(() => {
    if (!state) return;
    const serverNowEst = Date.parse(state.server_now) + (now - fetchedAt.current);
    if (serverNowEst >= Date.parse(state.day_end) && rolloverTried.current !== state.day_end) {
      rolloverTried.current = state.day_end;
      void refresh();
    }
  }, [now, state, refresh]);

  const roomId = state?.room.id;
  useEffect(() => {
    if (!roomId) return;
    let timer: number | undefined;
    const trigger = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 150);
    };
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_sessions', filter: `room_id=eq.${roomId}` }, trigger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, trigger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, trigger)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          void refresh(); // resync anything missed while disconnected
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
        }
      });
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  return { state, fatal, connected, now, elapsedMs: now - fetchedAt.current, refresh };
}
