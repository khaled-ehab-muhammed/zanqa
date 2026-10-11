/** "H:MM:SS" — always Western digits so timers stay stable and aligned. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * The server returns today's total as of the moment of the fetch (running session included).
 * While someone is studying we add only the time elapsed since that fetch, so the display is
 * always anchored to server timestamps and never drifts or double-counts across refreshes.
 */
export function liveSeconds(
  m: { total_seconds: number; studying: boolean },
  elapsedSinceFetchMs: number,
): number {
  return m.total_seconds + (m.studying ? Math.max(0, Math.floor(elapsedSinceFetchMs / 1000)) : 0);
}

/** Highest time first; ties broken by earlier join, then user id — never random. */
export function rankMembers<T extends { user_id: string; joined_at: string; live: number }>(
  list: T[],
): T[] {
  return [...list].sort(
    (a, b) =>
      b.live - a.live ||
      Date.parse(a.joined_at) - Date.parse(b.joined_at) ||
      (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0),
  );
}
