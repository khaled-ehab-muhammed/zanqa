import { useState, type FormEvent } from 'react';
import { createRoom, joinRoom } from '../lib/api';
import { friendlyError } from '../lib/errors';

export function Home({ onEnter }: { onEnter: (code: string) => void }) {
  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'' | 'create' | 'join'>('');
  const [error, setError] = useState('');

  async function run(kind: 'create' | 'join', fn: () => Promise<string>) {
    if (busy) return;
    setBusy(kind);
    setError('');
    try {
      onEnter(await fn());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="stack">
      <form className="card form" onSubmit={(e: FormEvent) => { e.preventDefault(); void run('create', () => createRoom(roomName)); }}>
        <h2>اعمل روم جديد</h2>
        <label>
          اسم الروم (اختياري)
          <input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={40} placeholder="شلة الثانوية العامة" />
        </label>
        <button className="btn primary" disabled={!!busy}>{busy === 'create' ? 'بنجهّز الروم...' : 'اعمل الروم'}</button>
      </form>

      <form className="card form" onSubmit={(e: FormEvent) => { e.preventDefault(); void run('join', () => joinRoom(code)); }}>
        <h2>عندي كود روم</h2>
        <label>
          الكود
          <input className="code-input" dir="ltr" value={code} maxLength={6} required placeholder="ABC234"
            onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <button className="btn secondary" disabled={!!busy}>{busy === 'join' ? 'بندخّلك...' : 'ادخل الروم'}</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
