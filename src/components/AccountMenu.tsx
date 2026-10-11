import { useEffect, useRef, useState, type FormEvent } from 'react';
import { friendlyError } from '../lib/errors';

type Props = {
  name: string;
  email: string;
  onRename: (name: string) => Promise<void>;
  onLogout: () => void;
};

/** The round account button in the top bar: shows the first letter of the name and opens a small menu. */
export function AccountMenu({ name, email, onRename, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const letter = Array.from(name.trim())[0] ?? '؟';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { if (!open) { setEditing(false); setError(''); } }, [open]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onRename(draft.trim());
      setEditing(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account" ref={box}>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`الحساب: ${name}`} onClick={() => setOpen((o) => !o)}>
        {letter}
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <p className="account-name">{name}</p>
          <p className="muted account-mail" dir="ltr">{email}</p>
          {editing ? (
            <form className="form" onSubmit={save}>
              <label>
                الاسم الجديد
                <input value={draft} onChange={(e) => setDraft(e.target.value)} minLength={2} maxLength={24} required autoFocus />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="row">
                <button className="btn small primary" disabled={busy}>احفظ</button>
                <button type="button" className="btn small ghost" onClick={() => setEditing(false)}>إلغاء</button>
              </div>
            </form>
          ) : (
            <>
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setDraft(name); setEditing(true); }}>غيّر الاسم</button>
              <button type="button" role="menuitem" className="menu-item danger" onClick={onLogout}>تسجيل خروج</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
