import { useState, type FormEvent } from 'react';
import { Logo } from './Logo';
import { friendlyError } from '../lib/errors';

type Props = {
  presetCode?: string;
  onStart: (name: string, code?: string) => Promise<void>;
};

const DEMO = [
  { name: 'سلمى', time: '3:12:40', studying: true },
  { name: 'يوسف', time: '2:45:05', studying: true },
  { name: 'مريم', time: '1:58:31', studying: false },
];

export function Landing({ presetCode, onStart }: Props) {
  const [mode, setMode] = useState<'closed' | 'create' | 'join'>(presetCode ? 'join' : 'closed');
  const [name, setName] = useState('');
  const [code, setCode] = useState(presetCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onStart(name, mode === 'join' ? code : undefined);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <header className="topbar"><Logo size={36} /></header>

      <section className="hero">
        <h1>ذاكر أكتر. <span className="accent">سيبهم وراك.</span></h1>
        <p className="lead">لمّ صحابك في زنقة، شغّل التايمر، وخلي مذاكرتك تتكلم.</p>

        {mode === 'closed' ? (
          <div className="row">
            <button className="btn primary" onClick={() => setMode('create')}>يلا نبدأ</button>
            <button className="btn ghost" onClick={() => setMode('join')}>عندي كود روم</button>
          </div>
        ) : (
          <form className="card form" onSubmit={submit}>
            <label>
              اسمك اللي هيظهر لصحابك
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24}
                autoFocus required placeholder="مثلاً: سلمى" autoComplete="nickname" />
            </label>
            {mode === 'join' && (
              <label>
                كود الروم
                <input className="code-input" value={code} dir="ltr" maxLength={6} required
                  onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234" />
              </label>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary" disabled={busy}>
              {busy ? 'ثانية واحدة...' : mode === 'join' ? 'ادخل الروم' : 'كمّل'}
            </button>
            {!presetCode && (
              <button type="button" className="link" onClick={() => setMode(mode === 'join' ? 'create' : 'join')}>
                {mode === 'join' ? 'عايز أعمل روم جديد' : 'عندي كود روم'}
              </button>
            )}
          </form>
        )}
      </section>

      <section className="demo card" aria-label="مثال توضيحي">
        <p className="demo-tag">مثال توضيحي — مش بيانات حقيقية</p>
        <ol className="board">
          {DEMO.map((m, i) => (
            <li key={m.name} className={m.studying ? 'row-item studying' : 'row-item'}>
              <span className="rank">{i + 1}</span>
              <span className="who">{m.name}</span>
              <span className="badge">{m.studying ? 'بيذاكر دلوقتي' : 'واقف'}</span>
              <span className="time">{m.time}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="how">
        <h2>إزاي بتشتغل</h2>
        <ol className="steps">
          <li><b>١</b> اعمل حسابك.</li>
          <li><b>٢</b> لمّ صحابك في روم.</li>
          <li><b>٣</b> شغّل التايمر ونافسهم.</li>
        </ol>
      </section>
    </main>
  );
}
