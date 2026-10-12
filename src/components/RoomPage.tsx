import { useMemo, useState } from 'react';
import { useRoomState } from '../lib/useRoomState';
import { leaveRoom, pauseTimer, startCompetition, startTimer } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { Chat } from './Chat';
import { formatDuration, liveSeconds, rankMembers } from '../lib/time';

export function RoomPage({ code, onExit }: { code: string; onExit: () => void }) {
  const { state, fatal, connected, link: net, elapsedMs, refresh } = useRoomState(code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const ranked = useMemo(
    () => (state ? rankMembers(state.members.map((m) => ({ ...m, live: liveSeconds(m, elapsedMs) }))) : []),
    [state, elapsedMs],
  );

  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('ما قدرناش ننسخ — انسخه بإيدك');
    }
  }

  if (fatal) {
    return (
      <div className="card center">
        <p className="error" role="alert">{fatal}</p>
        <button className="btn secondary" onClick={onExit}>رجوع</button>
      </div>
    );
  }
  if (!state) return <p className="center muted" role="status">بنحمّل الروم...</p>;

  const { room } = state;
  const me = ranked.find((m) => m.user_id === state.me);
  const isFounder = room.founder_id === state.me;
  const active = room.status === 'active';
  const link = `${location.origin}${location.pathname}#/room/${room.code}`;

  return (
    <div className="stack">
      {net === 'lost'
        ? <p className="banner banner-red" role="status">الاتصال فصل من أكتر من 3 دقايق، فالتايمر وقف. أول ما يرجع الاتصال دوس "كمّل مذاكرة".</p>
        : (net === 'weak' || !connected) && <p className="banner banner-red" role="status">مفيش اتصال دلوقتي. لو فضل أكتر من 3 دقايق التايمر هيقف لوحده.</p>}

      <section className="card">
        <div className="room-head">
          <div>
            <h2>{room.name}</h2>
            <p className="muted">{ranked.length} من {room.max_members} في الروم</p>
            <p className="link-state" role="status">
              <span className={`pulse ${net === 'ok' ? 'on' : 'off'}`} aria-hidden="true" />
              {net === 'ok' ? 'إنت متصل' : net === 'weak' ? 'الاتصال ضعيف...' : 'مفيش اتصال'}
            </p>
          </div>
          <div className="code-box">
            <span className="muted">كود الروم</span>
            <strong className="code" dir="ltr">{room.code}</strong>
            <div className="row">
              <button className="btn small" onClick={() => copy(room.code, 'code')}>{copied === 'code' ? 'اتنسخ' : 'انسخ الكود'}</button>
              <button className="btn small ghost" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'اتنسخ' : 'انسخ الرابط'}</button>
            </div>
          </div>
        </div>
      </section>

      {!active && (
        <section className="card center">
          <p className="status">مستنيين باقي الشلة...</p>
          {isFounder ? (
            <>
              <button className="btn primary big" disabled={busy || ranked.length < 2}
                onClick={() => act(() => startCompetition(code))}>ابدأ الزنقة</button>
              {ranked.length < 2 && <p className="muted">محتاجين صاحب واحد على الأقل عشان نبدأ</p>}
            </>
          ) : (
            <p className="muted">مستنيين صاحب الروم يبدأ الزنقة</p>
          )}
        </section>
      )}

      {active && me && (
        <section className="card center timer-card">
          <p className="status">
            {me.studying ? 'إنت بتذاكر دلوقتي' : me.has_started ? 'وقفت التايمر — خد نفسك وارجع' : 'الزنقة بدأت!'}
          </p>
          <div className="timer" dir="ltr" aria-live="off">{formatDuration(me.live)}</div>
          {me.studying ? (
            <button className="btn secondary big" disabled={busy} onClick={() => act(() => pauseTimer(code))}>وقّف التايمر</button>
          ) : (
            <button className="btn primary big" disabled={busy} onClick={() => act(() => startTimer(code))}>
              {me.has_started ? 'كمّل مذاكرة' : 'ابدأ المذاكرة'}
            </button>
          )}
          <p className="muted">الوقت بيتحسب من أول ما الزنقة بدأت، وبيتصفّر لما الكل يسيب الروم</p>
          <p className="muted">سيب الصفحة والشاشة مفتوحين وإنت بتذاكر. لو الاتصال فصل أكتر من 3 دقايق التايمر بيقف.</p>
        </section>
      )}

      <section className="card" aria-label="الترتيب">
        <h2>{active ? 'الترتيب' : 'الأعضاء'}</h2>
        <ol className="board">
          {ranked.map((m, i) => (
            <li key={m.user_id} className={m.studying ? 'row-item studying' : 'row-item'}>
              <span className="rank">{active ? i + 1 : '•'}</span>
              <span className="who">
                <span className={`pulse ${m.online ? 'on' : 'off'}`} title={m.online ? 'متصل' : 'مش متصل'} aria-hidden="true" />
                <span className="sr-only">{m.online ? 'متصل' : 'مش متصل'}</span>
                {m.display_name}
                {m.user_id === state.me && <span className="tag">إنت</span>}
                {m.is_founder && <span className="tag">صاحب الروم</span>}
              </span>
              {active && (
                <>
                  <span className="badge">{m.studying ? 'بيذاكر دلوقتي' : m.has_started ? 'واقف' : 'لسه ما بدأش'}</span>
                  <span className="time" dir="ltr">{formatDuration(m.live)}</span>
                </>
              )}
            </li>
          ))}
        </ol>
      </section>

      <Chat code={code} roomId={room.id} me={state.me} />

      {error && <p className="error" role="alert">{error}</p>}

      <button className="link danger" onClick={() => {
        if (window.confirm('متأكد إنك عايز تسيب الروم؟')) void act(async () => { await leaveRoom(code); onExit(); });
      }}>سيب الروم</button>
    </div>
  );
}
