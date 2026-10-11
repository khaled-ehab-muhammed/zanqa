# Project status

## Written (exists in the repo)
- Brand: `brand/` SVGs (symbol, primary, dark, favicon, avatar), PNG app icons, guidelines, colors, typography.
- Database: `supabase/migrations/0001_init.sql` (tables, constraints, indexes, RLS, 8 RPCs, realtime).
- App: landing, onboarding, create/join, waiting room, founder-only start, independent timers, leaderboard, leave, errors.

## Verified (actually run)
- `npm test`: 3 unit tests pass (duration formatting, live-time math, deterministic ranking).
- App icon geometry checked visually (PNG render). The SVGs use the same numbers but were not rendered in a browser.

## NOT verified (no network, no Supabase project, no Postgres in the build sandbox)
- `npm install`, `npm run build`, TypeScript checks — never run. Expect possible small type/build fixes.
- The SQL migration was never executed. Expect possible small syntax fixes on first run.
- RLS/authorization behavior, room-code validation, timer start/pause/resume against a real DB, midnight rollover,
  two-browser realtime sync, mobile/RTL appearance, keyboard/contrast audit.
- Wordmark rendering of Arabic text in the SVG logos (depends on the Alexandria font being available).

## Pending / manual
- Create Supabase project, enable Anonymous sign-ins, run the migration, fill `.env` (see README).
- Outline the wordmark text in a vector tool for a font-independent logo; optional custom ligature work.
- Rate-limiting / abuse protection for room creation (not in MVP).
