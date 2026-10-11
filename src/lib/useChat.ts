import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getMessages } from './api';
import type { ChatMessage } from './types';

/** Loads chat messages, listens for new ones in realtime, and polls as a safety net. */
export function useChat(code: string, roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const refresh = useCallback(async () => {
    try {
      setMessages(await getMessages(code));
    } catch {
      /* keep the last messages; the room page already shows connection problems */
    }
  }, [code]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 8_000);
    let timer: number | undefined;
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void refresh(), 100);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refresh();
      });
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  return { messages, refresh };
}
