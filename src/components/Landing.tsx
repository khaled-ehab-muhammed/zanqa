import { useState } from 'react';
import { Logo } from './Logo';
import { AuthForm } from './Auth';

type Props = {
  presetCode?: string;
  notice?: string;
};

const DEMO = [
  { name: 'سلمى', time: '3:12:40', studying: true },
  { name: 'يوسف', time: '2:45:05', studying: true },
  { name: 'مريم', time: '1:58:31', studying: false },
];

export function Landing({ presetCode, notice }: Props) {
  const [mode, setMode] = useState<'closed' | 'signup' | 'login'>(presetCode ? 'signup' : 'closed');

  return (
    <main className="landing">
      <header className="topbar"><Logo size={36} /></header>

      <section className="hero">
        <h1>ذاكر أكتر. <span className="accent">سيبهم وراك.</span></h1>
        <p className="lead">لمّ صحابك في زنقة، شغّل التايمر، وخلي مذاكرتك تتكلم.</p>

        {notice && <p className="banner" role="status">{notice}</p>}
        {presetCode && <p className="muted">عشان تدخل الروم <b dir="ltr">{presetCode}</b> سجّل دخول بحسابك الأول (أو اعمل حساب جديد).</p>}

        {mode === 'closed' ? (
          <div className="row">
            <button className="btn primary" onClick={() => setMode('signup')}>يلا نبدأ</button>
            <button className="btn ghost" onClick={() => setMode('login')}>عندي حساب</button>
          </div>
        ) : (
          <AuthForm key={mode} initialMode={mode} />
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
