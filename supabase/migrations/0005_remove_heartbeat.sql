-- Zanqa — REMOVE the connection heartbeat completely (undo 0004_heartbeat.sql). Safe to run once in the Supabase SQL Editor.
-- It stops the clean-up job, puts get_room_state back to the version from 0003 (no heartbeat, no "online" field),
-- and drops the heartbeat/sweep functions and the last_seen_at column. Rooms, members, times and chat are NOT touched.

-- 1) stop the scheduled clean-up (ignored if it is not there)
do $$ begin perform cron.unschedule('zanqa-sweep'); exception when others then null; end $$;

-- 2) put get_room_state back (this must come BEFORE dropping the column it reads)
create or replace function public.get_room_state (p_code text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_now timestamptz := now();
  v_members jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = auth.uid()
  ) then
    raise exception 'ROOM_NOT_FOUND'; -- same error for "no such room" and "not your room"
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', x.user_id,
      'display_name', x.display_name,
      'is_founder', x.user_id = v_room.founder_id,
      'joined_at', x.joined_at,
      'total_seconds', x.total,
      'studying', x.active_start is not null,
      'active_started_at', x.active_start,
      'has_started', x.n > 0
    ) order by x.total desc, x.joined_at asc, x.user_id asc), '[]'::jsonb)
  into v_members
  from (
    select rm.user_id, p.display_name, rm.joined_at,
           coalesce(floor(sum(extract(epoch from coalesce(s.ended_at, v_now) - s.started_at))), 0)::int as total,
           max(s.started_at) filter (where s.ended_at is null) as active_start,
           count(s.id) as n
      from public.room_members rm
      join public.profiles p on p.id = rm.user_id
      left join public.study_sessions s
        on s.room_id = rm.room_id and s.user_id = rm.user_id
     where rm.room_id = v_room.id
     group by rm.user_id, p.display_name, rm.joined_at
  ) x;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'code', v_room.code, 'name', v_room.name, 'status', v_room.status,
      'started_at', v_room.started_at, 'timezone', v_room.timezone,
      'max_members', v_room.max_members, 'founder_id', v_room.founder_id),
    'members', v_members,
    'server_now', v_now,
    'me', auth.uid());
end;
$$;

revoke execute on function public.get_room_state (text) from public, anon;
grant execute on function public.get_room_state (text) to authenticated;

-- 3) drop what the heartbeat added
drop function if exists public.sweep_rooms ();
drop function if exists public.heartbeat (text);
drop index if exists public.room_members_last_seen_idx;
alter table public.room_members drop column if exists last_seen_at;
