# زنقة (Zanqa)

Social study timer: friends join a private room by code and compete on how much each studies today.
React + TypeScript + Vite on the front, Supabase (anonymous auth, Postgres + RLS, Realtime) on the back.

> **Status:** code, database migration and brand assets are written. The app has **not yet been installed,
> built or run against a real Supabase project** — see `PROJECT_STATUS.md` for exactly what was and wasn't verified.

## 1. What you need
- Node.js 18+ (https://nodejs.org) and a free Supabase account (https://supabase.com).

## 2. Create the backend (about 5 minutes)
1. Supabase Dashboard → **New project**. Wait until it is ready.
2. **Accounts:** follow `AUTH_SETUP.md` (email confirmation, redirect URL, custom SMTP). Anonymous sign-ins are no longer used.
3. **SQL Editor → New query**, paste the whole of `supabase/migrations/0001_init.sql`, press **Run**.
   If the last line (`alter publication supabase_realtime ...`) errors, open **Database → Replication/Publications**
   and enable Realtime for the tables `rooms`, `room_members`, `study_sessions`, then re-run only the remaining lines.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
   Never use the `service_role` key in this project.

## 3. Run it
```bash
cp .env.example .env      # then edit .env and paste the two values from step 2.4
npm install
npm run dev               # open the printed http://localhost:5173
```
Other commands: `npm run build` (typecheck + production build), `npm test` (unit tests for timer math / ranking).

## 4. Try it with a friend
1. Browser A: enter a name → "اعمل الروم" → copy the code (or link).
2. Browser B (a different browser or a private window — each browser is a separate anonymous user): enter a name + the code.
3. A presses "ابدأ الزنقة" (needs 2+ members). Each person presses "ابدأ المذاكرة" / "وقّف التايمر" on their own.
   The other side updates without refreshing.

## 5. Deploy (optional)
`npm run build`, then upload `dist/` to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
Set the same two `VITE_` variables in the host's settings. Hash routing means no server rewrites are needed.

## How it works (short)
- **Identity:** Supabase Auth accounts (email + password, with a confirmation email). The display name is a profile field.
  Setup steps (email confirmation, redirect URL, custom SMTP) are in `AUTH_SETUP.md`.
- **Security:** clients cannot write tables at all. Every change goes through `SECURITY DEFINER` functions that use
  `auth.uid()` (never a client-sent id) and validate state. Only members can read a room's data.
- **Timer:** each "studying stretch" is a row with `started_at`/`ended_at` (UTC). Totals are computed in SQL from
  timestamps and count everything since the room started (no midnight reset), so refreshes and throttled tabs are handled.
  Everything is wiped when the last member leaves the room.
  One active session per user per room is enforced by a unique index.
- **Realtime:** the app subscribes to row changes and re-fetches `get_room_state`; it also polls every 10 s and on
  reconnect, so a missed event self-heals.

## Known limitations
A room is deleted when its last member leaves; no history screens; the wordmark SVG uses live
Arabic text (see `brand/brand-guidelines.md`).
