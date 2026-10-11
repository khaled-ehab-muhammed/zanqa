import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChat } from '../lib/useChat';
import { sendMessage } from '../lib/api';
import { friendlyError } from '../lib/errors';

export function Chat({ code, roomId, me }: { code: string; roomId: string; me: string }) {
  const { messages, refresh } = useChat(code, roomId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      await sendMessage(code, body);
      setText('');
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg.includes('RATE_LIMIT') ? 'براحة شوية، استنى ثانية' : friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });

  return (
    <section className="card" aria-label="الشات">
      <h2>الشات</h2>
      <p className="muted">الرسايل بتتمسح لما الروم تخلص.</p>
      <ol className="chat-list" ref={list} aria-live="polite">
        {messages.length === 0 && <li className="muted">مفيش رسايل لسه — ابدأ انت.</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.user_id === me ? 'msg mine' : 'msg'}>
            <span className="msg-name">{m.user_id === me ? 'إنت' : m.display_name}<span className="msg-time">{time(m.created_at)}</span></span>
            <p className="msg-body" dir="auto">{m.body}</p>
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
          placeholder="اكتب رسالة..." aria-label="اكتب رسالة" autoComplete="off" />
        <button className="btn secondary" disabled={busy || !text.trim()}>ابعت</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
