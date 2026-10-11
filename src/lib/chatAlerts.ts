import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ChatMessage } from './types';

const SOUND_KEY = 'zanqa.chat.sound';
type Perm = NotificationPermission | 'unsupported';

function readSoundPref(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
function writeSoundPref(on: boolean) {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode: keep it in memory only */ }
}
const readPerm = (): Perm => ('Notification' in window ? Notification.permission : 'unsupported');

// Browsers only allow sound after the person has touched the page once, so the context is unlocked on first tap/key.
let ctx: AudioContext | null = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio support */ }
}

/** Short two-note "ding" made in code, so there is no sound file to host. */
function playDing() {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  [[880, 0], [1320, 0.12]].forEach(([freq, delay]) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + delay);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.35);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 0.4);
  });
}

async function notifyNewMessage() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // No message text on purpose: only a heads-up that something arrived.
  const opts = {
    body: 'وصلت رسالة جديدة في الروم',
    tag: 'zanqa-chat',
    renotify: true,
    lang: 'ar',
    dir: 'rtl',
    icon: new URL('apple-touch-icon.png', document.baseURI).href,
    vibrate: [200, 100, 200],
  } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification('زنقة', opts); return; }
  } catch { /* fall through to the plain API */ }
  try { new Notification('زنقة', opts); } catch { /* not allowed on this device */ }
}

/**
 * Chat alerts: unread counter, a sound for each incoming message, and a notification when the tab is in the background.
 * "Seen" means the page is visible AND the chat card is on screen.
 */
export function useChatAlerts(messages: ChatMessage[], loaded: boolean, me: string, cardRef: RefObject<HTMLElement>) {
  const [unread, setUnread] = useState(0);
  const [soundOn, setSoundOn] = useState(readSoundPref);
  const [perm, setPerm] = useState<Perm>(readPerm);
  const known = useRef<Set<string> | null>(null);
  const inView = useRef(false);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const seen = () => document.visibilityState === 'visible' && inView.current;

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => { /* unsupported (e.g. http) */ });
    }
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    const check = () => { if (seen()) setUnread(0); };
    let io: IntersectionObserver | undefined;
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => { inView.current = entry.isIntersecting; check(); }, { threshold: 0.15 });
      io.observe(el);
    } else {
      inView.current = true;
    }
    document.addEventListener('visibilitychange', check);
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', check); };
  }, [cardRef]);

  useEffect(() => {
    if (!loaded) return;
    if (known.current === null) { known.current = new Set(messages.map((m) => m.id)); return; } // old messages are not "new"
    const fresh = messages.filter((m) => !known.current!.has(m.id));
    fresh.forEach((m) => known.current!.add(m.id));
    const incoming = fresh.filter((m) => m.user_id !== me);
    if (incoming.length === 0) return;
    if (!seen()) setUnread((n) => n + incoming.length);
    if (soundRef.current) playDing();
    if (document.visibilityState === 'hidden') void notifyNewMessage();
  }, [messages, loaded, me]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = unread > 0 ? `(${unread > 9 ? '9+' : unread}) ${base}` : base;
    return () => { document.title = base; };
  }, [unread]);

  const toggleSound = useCallback(() => {
    unlockAudio();
    const next = !soundRef.current;
    setSoundOn(next);
    writeSoundPref(next);
    if (next) window.setTimeout(playDing, 50);
  }, []);

  const enableNotifications = useCallback(async () => {
    unlockAudio();
    if (!('Notification' in window)) return;
    try { setPerm(await Notification.requestPermission()); } catch { setPerm(readPerm()); }
  }, []);

  return { unread, soundOn, toggleSound, perm, enableNotifications };
}
