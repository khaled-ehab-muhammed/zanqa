import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { configMissing, supabase } from './lib/supabase';
import { getProfile, joinRoom, upsertProfile } from './lib/api';
import { signOut } from './lib/auth';
import { friendlyError } from './lib/errors';
import type { Profile } from './lib/types';
import { Landing } from './components/Landing';
import { Home } from './components/Home';
import { RoomPage } from './components/RoomPage';
import { Logo } from './components/Logo';
import { AccountMenu } from './components/AccountMenu';
import { NewPasswordForm } from './components/Auth';

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

// Email links come back as "?code=..." (or "?error_description=..."). Remember that now; the address bar is tidied
// only after supabase-js has finished reading the code (see the auth listener below).
const cameFromEmailLink = new URLSearchParams(location.search).has('code');
const emailLinkFailed = new URLSearchParams(location.search).has('error_description');

/** A person's name for the profile row: what they typed at sign-up, or the part of the email before "@". */
function nameFor(user: User): string {
  const typed = String(user.user_metadata?.display_name ?? '').trim();
  const fallback = (user.email ?? '').split('@')[0].trim();
  const pick = typed.length >= 2 ? typed : fallback.length >= 2 ? fallback : 'صاحبنا';
  return Array.from(pick).slice(0, 24).join('');
}

function AppInner() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(parseRoute());

  useEffect(() => {
    const onHash = () => setRoomCode(parseRoute());
    window.addEventListener('hashchange', onHash);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      const u = session?.user ?? null;
      if (u?.is_anonymous) {
        // Old guest sessions from before accounts existed: sign them out so they can register properly.
        setTimeout(() => void supabase.auth.signOut(), 0);
        setUser(null);
      } else {
        setUser(u);
        if (!u) { setProfile(null); setRecovery(false); }
      }
      setAuthChecked(true);
      if (cameFromEmailLink || emailLinkFailed) history.replaceState(null, '', location.pathname + location.hash);
    });
    // Safety net in case the initial event never arrives (offline start).
    const t = window.setTimeout(() => setAuthChecked(true), 4000);
    return () => { window.removeEventListener('hashchange', onHash); window.clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  // Once someone is signed in, make sure they have a profile row (the first login creates it from the sign-up name).
  const userId = user?.id;
  useEffect(() => {
    if (!user) return;
    let dead = false;
    setProfileError('');
    (async () => {
      try {
        let p = await getProfile();
        if (!p) { await upsertProfile(nameFor(user)); p = await getProfile(); }
        if (!dead) setProfile(p);
      } catch (e) {
        if (!dead) setProfileError(friendlyError(e));
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const go = (code: string | null) => { location.hash = code ? `#/room/${code}` : ''; };

  async function rename(name: string) {
    await upsertProfile(name);
    setProfile(await getProfile());
  }

  async function logout() {
    await signOut();
    setProfile(null);
    go(null);
  }

  if (!authChecked) return <p className="center muted" role="status">لحظة...</p>;

  if (!user) {
    const notice = cameFromEmailLink
      ? 'لو دوست على لينك التفعيل يبقى حسابك اتفعّل. سجّل دخول بالإيميل والباسورد.'
      : emailLinkFailed
        ? 'اللينك ده منتهي أو اتستخدم قبل كده. اطلب إيميل جديد.'
        : undefined;
    return <Landing presetCode={roomCode ?? undefined} notice={notice} />;
  }

  if (recovery) return <NewPasswordForm onDone={() => setRecovery(false)} />;

  if (!profile) {
    return profileError
      ? (
        <main className="shell">
          <div className="card center">
            <p className="error" role="alert">{profileError}</p>
            <button className="btn secondary" onClick={() => location.reload()}>جرّب تاني</button>
            <button className="link" onClick={() => void logout()}>تسجيل خروج</button>
          </div>
        </main>
      )
      : <p className="center muted" role="status">بنجهّز حسابك...</p>;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a href="#" onClick={(e) => { e.preventDefault(); go(null); }} aria-label="الرئيسية"><Logo size={32} /></a>
        <AccountMenu name={profile.display_name} email={user.email ?? ''} onRename={rename} onLogout={() => void logout()} />
      </header>
      {roomCode
        ? <RoomGate key={roomCode} code={roomCode} onExit={() => go(null)} />
        : <Home onEnter={go} />}
    </main>
  );
}

/** Opening a room link joins the room first (a no-op for people already in it), then shows the room. */
function RoomGate({ code, onExit }: { code: string; onExit: () => void }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let dead = false;
    joinRoom(code).then(() => { if (!dead) setReady(true); }).catch((e) => { if (!dead) setError(friendlyError(e)); });
    return () => { dead = true; };
  }, [code]);

  if (error) {
    return (
      <div className="card center">
        <p className="error" role="alert">{error}</p>
        <button className="btn secondary" onClick={onExit}>رجوع</button>
      </div>
    );
  }
  if (!ready) return <p className="center muted" role="status">بندخّلك الروم...</p>;
  return <RoomPage code={code} onExit={onExit} />;
}
