import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getRoomState, heartbeat } from './api';
import { errorCode, friendlyError } from './errors';
import type { RoomState } from './types';

const ROOM_CLOSED = 'الروم اتقفلت لأن محدش كان متصل فترة. اعمل روم جديد وكمّلوا من هناك.';
const BEAT_EVERY_MS = 20_000;
const TIMER_STOPS_AFTER_MS = 180_000; // keep in sync with the 3 minutes in supabase/migrations/0004_heartbeat.sql

/** Loads room state, keeps it fresh via Realtime, and falls back to polling + refetch on reconnect. */
export function useRoomState(code: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState(Date.now());
  const fetchedAt = useRef(Date.now());
  const lastBeatOk = useRef(Date.now()); // last time the server accepted our heartbeat
  const hadState = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getRoomState(code);
      fetchedAt.current = Date.now();
      hadState.current = true;
      setState(s);
      setFatal(null);
      setConnected(true);
    } catch (e) {
      if (errorCode(e) === 'ROOM_NOT_FOUND' && hadState.current) {
        setFatal(ROOM_CLOSED);
      } else if (errorCode(e) === 'ROOM_NOT_FOUND' || errorCode(e) === 'NOT_AUTHENTICATED') {
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

  // Heartbeat: tells the server "I am here" every 20 s. Without it the server stops this person's timer after 3 minutes.
  const inRoom = !!state;
  useEffect(() => {
    if (!inRoom) return;
    let dead = false;
    const beat = async () => {
      try {
        await heartbeat(code);
        if (!dead) lastBeatOk.current = Date.now();
      } catch (e) {
        if (dead) return;
        if (errorCode(e) === 'ROOM_NOT_FOUND') setFatal(hadState.current ? ROOM_CLOSED : friendlyError(e));
        /* otherwise: network trouble; the status light turns red by itself */
      }
    };
    void beat();
    const t = window.setInterval(() => void beat(), BEAT_EVERY_MS);
    const onWake = () => { if (document.visibilityState === 'visible') void beat(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    return () => { dead = true; window.clearInterval(t); document.removeEventListener('visibilitychange', onWake); window.removeEventListener('online', onWake); };
  }, [inRoom, code]);

  const sinceBeat = now - lastBeatOk.current;
  /** ok = green pulse, weak = red pulse (no heartbeat for a while), lost = timer already stopped on the server. */
  const link: 'ok' | 'weak' | 'lost' = sinceBeat < 45_000 ? 'ok' : sinceBeat < TIMER_STOPS_AFTER_MS ? 'weak' : 'lost';
  // If we lost the connection, freeze the on-screen timer when the server will have stopped it (3 minutes without a heartbeat).
  const displayNow = Math.min(now, lastBeatOk.current + TIMER_STOPS_AFTER_MS);

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

  return { state, fatal, connected, link, now, elapsedMs: Math.max(0, displayNow - fetchedAt.current), refresh };
}
