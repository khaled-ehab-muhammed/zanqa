import { useEffect, useState } from 'react';
import { configMissing, supabase } from './lib/supabase';
import { ensureSession, getProfile, joinRoom, upsertProfile } from './lib/api';
import type { Profile } from './lib/types';
import { Landing } from './components/Landing';
import { Home } from './components/Home';
import { RoomPage } from './components/RoomPage';
import { Logo } from './components/Logo';

function parseRoute(): string | null {
  const m = location.hash.match(/^#\/room\/([A-Za-z0-9]{6})$/);
  return m ? m[1].toUpperCase() : null;
}

function SetupNotice() {
  return (
    <main className="shell">
      <div className="card">
        <h2>لسه محتاجين نربط Supabase</h2>
        <p>انسخ ملف <code dir="ltr">.env.example</code> باسم <code dir="ltr">.env</code> وحط فيه
          <code dir="ltr"> VITE_SUPABASE_URL</code> و <code dir="ltr">VITE_SUPABASE_ANON_KEY</code>، وبعدين شغّل المشروع تاني.
          التفاصيل في README.md.</p>
      </div>
    </main>
  );
}

export default function App() {
  return configMissing ? <SetupNotice /> : <AppInner />;
}

function AppInner() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(parseRoute());

  useEffect(() => {
    const onHash = () => setRoomCode(parseRoute());
    window.addEventListener('hashchange', onHash);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) setProfile(await getProfile());
      } catch { /* offline: fall through to the landing page */ }
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setProfile(null);
    });
    return () => { window.removeEventListener('hashchange', onHash); sub.subscription.unsubscribe(); };
  }, []);

  const go = (code: string | null) => { location.hash = code ? `#/room/${code}` : ''; };

  async function onboard(name: string, code?: string) {
    await ensureSession();
    await upsertProfile(name);
    const target = code ? await joinRoom(code) : null;
    setProfile(await getProfile());
    if (target) go(target);
  }

  async function logout() {
    if (!window.confirm('لو خرجت، الجهاز ده هينسى حسابك ومش هتقدر ترجع لنفس الحساب. تكمّل؟')) return;
    await supabase.auth.signOut();
    setProfile(null);
    go(null);
  }

  if (!ready) return <p className="center muted" role="status">لحظة...</p>;
  if (!profile) return <Landing presetCode={roomCode ?? undefined} onStart={onboard} />;

  return (
    <main className="shell">
      <header className="topbar">
        <a href="#" onClick={(e) => { e.preventDefault(); go(null); }} aria-label="الرئيسية"><Logo size={32} /></a>
        <span className="me">
          {profile.display_name}
          <button className="link" onClick={() => void logout()}>خروج</button>
        </span>
      </header>
      {roomCode
        ? <RoomPage key={roomCode} code={roomCode} onExit={() => go(null)} />
        : <Home onEnter={go} />}
    </main>
  );
}
