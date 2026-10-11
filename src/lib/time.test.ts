import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, liveSeconds, rankMembers } from './time.ts';

test('formatDuration formats and clamps', () => {
  assert.equal(formatDuration(0), '0:00:00');
  assert.equal(formatDuration(65), '0:01:05');
  assert.equal(formatDuration(3661), '1:01:01');
  assert.equal(formatDuration(-5), '0:00:00');
  assert.equal(formatDuration(59.9), '0:00:59');
});

test('liveSeconds only advances while studying', () => {
  assert.equal(liveSeconds({ total_seconds: 100, studying: false }, 30_000), 100);
  assert.equal(liveSeconds({ total_seconds: 100, studying: true }, 30_999), 130);
  assert.equal(liveSeconds({ total_seconds: 100, studying: true }, -500), 100);
});

test('rankMembers sorts by time, then join time, then id (deterministic)', () => {
  const a = { user_id: 'a', joined_at: '2026-10-10T08:00:00Z', live: 50 };
  const b = { user_id: 'b', joined_at: '2026-10-10T07:00:00Z', live: 50 };
  const c = { user_id: 'c', joined_at: '2026-10-10T09:00:00Z', live: 90 };
  const d = { user_id: 'd', joined_at: '2026-10-10T07:00:00Z', live: 50 };
  assert.deepEqual(rankMembers([a, b, c, d]).map((x) => x.user_id), ['c', 'b', 'd', 'a']);
  assert.deepEqual(rankMembers([d, c, b, a]).map((x) => x.user_id), ['c', 'b', 'd', 'a']);
});
