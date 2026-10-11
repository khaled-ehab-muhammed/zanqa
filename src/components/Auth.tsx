import { useEffect, useState, type FormEvent } from 'react';
import { resendConfirmation, sendPasswordReset, setNewPassword, signIn, signUp } from '../lib/auth';
import { friendlyError } from '../lib/errors';

type Mode = 'login' | 'signup' | 'forgot';
type Sent = { kind: 'confirm' | 'reset'; email: string } | null;

const RESEND_WAIT = 60;

export function AuthForm({ initialMode = 'signup' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notConfirmed, setNotConfirmed] = useState(false);
  const [sent, setSent] = useState<Sent>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setNotConfirmed(false); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotConfirmed(false);
    const mail = email.trim();
    try {
      if (mode === 'signup') {
        const r = await signUp(mail, password, name.trim());
        if (r === 'exists') { setError('الإيميل ده مسجّل قبل كده. جرّب تسجيل الدخول'); setMode('login'); }
        else if (r === 'confirm') { setSent({ kind: 'confirm', email: mail }); setWait(RESEND_WAIT); }
        // 'signedin': the app notices the new session by itself
      } else if (mode === 'login') {
        await signIn(mail, password);
      } else {
        await sendPasswordReset(mail);
        setSent({ kind: 'reset', email: mail });
        setWait(RESEND_WAIT);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/email not confirmed/i.test(msg)) setNotConfirmed(true);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend(kind: 'confirm' | 'reset', to: string) {
    if (busy || wait > 0) return;
    setBusy(true);
    setError('');
    try {
      if (kind === 'confirm') await resendConfirmation(to); else await sendPasswordReset(to);
      setWait(RESEND_WAIT);
      if (!sent) setSent({ kind, email: to });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card form" role="status">
        <h2>{sent.kind === 'confirm' ? 'بعتنالك إيميل تفعيل' : 'بعتنالك لينك تغيير الباسورد'}</h2>
        <p>
          فتحنا رسالة على <b dir="ltr">{sent.email}</b>.{' '}
          {sent.kind === 'confirm'
            ? 'افتح الإيميل وادوس على لينك التفعيل، وبعدها ارجع هنا وسجّل دخول.'
            : 'افتح الإيميل وادوس على اللينك. افتحه من نفس المتصفح اللي طلبت منه.'}
        </p>
        <p className="muted">لو ما لقيتهاش، بُص في Spam أو Promotions.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn ghost" disabled={busy || wait > 0} onClick={() => void resend(sent.kind, sent.email)}>
          {wait > 0 ? `ابعت تاني بعد ${wait} ثانية` : 'ابعت الإيميل تاني'}
        </button>
        <button type="button" className="link" onClick={() => { setSent(null); switchMode('login'); }}>رجوع لتسجيل الدخول</button>
      </div>
    );
  }

  return (
    <form className="card form" onSubmit={submit}>
      {mode !== 'forgot' && (
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'tab on' : 'tab'} onClick={() => switchMode('signup')}>حساب جديد</button>
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'tab on' : 'tab'} onClick={() => switchMode('login')}>تسجيل دخول</button>
        </div>
      )}
      {mode === 'forgot' && <h2>نسيت الباسورد</h2>}

      {mode === 'signup' && (
        <label>
          اسمك اللي هيظهر لصحابك
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={24}
            required placeholder="مثلاً: سلمى" autoComplete="nickname" />
        </label>
      )}
      <label>
        الإيميل
        <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
          required placeholder="name@gmail.com" autoComplete="email" inputMode="email" />
      </label>
      {mode !== 'forgot' && (
        <label>
          الباسورد
          <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={mode === 'signup' ? 8 : 1}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          {mode === 'signup' && <span className="muted">8 حروف على الأقل</span>}
        </label>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {notConfirmed && (
        <button type="button" className="btn ghost small" disabled={busy || wait > 0} onClick={() => void resend('confirm', email.trim())}>
          {wait > 0 ? `ابعت تاني بعد ${wait} ثانية` : 'ابعتلي إيميل التفعيل تاني'}
        </button>
      )}

      <button className="btn primary" disabled={busy}>
        {busy ? 'ثانية واحدة...' : mode === 'signup' ? 'اعمل الحساب' : mode === 'login' ? 'ادخل' : 'ابعتلي لينك'}
      </button>
      {mode === 'login' && <button type="button" className="link" onClick={() => switchMode('forgot')}>نسيت الباسورد؟</button>}
      {mode === 'forgot' && <button type="button" className="link" onClick={() => switchMode('login')}>رجوع</button>}
    </form>
  );
}

/** Shown after someone opens a "reset password" email link. */
export function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await setNewPassword(password);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <form className="card form" onSubmit={submit}>
        <h2>اختار باسورد جديد</h2>
        <label>
          الباسورد الجديد
          <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} autoComplete="new-password" autoFocus />
          <span className="muted">8 حروف على الأقل</span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'ثانية واحدة...' : 'احفظ'}</button>
      </form>
    </main>
  );
}
