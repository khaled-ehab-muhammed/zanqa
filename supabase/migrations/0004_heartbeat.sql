-- Zanqa — connection heartbeat (green/red pulse) and automatic clean-up.
--
-- Rules (change the numbers here and in sweep_rooms/get_room_state/heartbeat if you ever want other values):
--   * the page sends a heartbeat every 20 seconds while it is open;
--   * no heartbeat for 60 seconds   -> shown as "not connected" (red), the timer still counts;
--   * no heartbeat for 3 minutes    -> the timer STOPS, and the time is counted only up to the last heartbeat;
--   * nobody in the room sent a heartbeat for 3 minutes -> the whole room is deleted (with its chat and times);
--   * one person with no heartbeat for 30 minutes -> removed from the room (like "leave room"; their time is cleared).
--
-- BEFORE running this file: Supabase Dashboard -> Integrations -> Cron -> enable it (this turns on pg_cron).
-- ORDER: first publish the new website version (it sends the heartbeats), THEN run this file once in the SQL Editor.
-- If this runs while the old website is still live, rooms look "empty" after 3 minutes and get deleted.

alter table public.room_members add column if not exists last_seen_at timestamptz not null default now();
create index if not exists room_members_last_seen_idx on public.room_members (last_seen_at);

-- ───────────── heartbeat (called by the page every 20 s) ─────────────
create or replace function public.heartbeat (p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_seen timestamptz;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select last_seen_at into v_seen from public.room_members
   where room_id = v_room.id and user_id = v_user for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- Coming back after being away for 3+ minutes: close the old running session at the last heartbeat,
  -- so the time spent away is never counted (the person presses "continue" to start again).
  if v_seen < now() - interval '3 minutes' then
    update public.study_sessions set ended_at = greatest(started_at, v_seen)
     where room_id = v_room.id and user_id = v_user and ended_at is null;
  end if;

  update public.room_members set last_seen_at = now()
   where room_id = v_room.id and user_id = v_user;
end;
$$;

-- ───────────── room state: totals stop at the last heartbeat for people who disappeared ─────────────
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
      'studying', (x.active_start is not null and x.fresh),
      'active_started_at', case when x.fresh then x.active_start else null end,
      'has_started', x.n > 0,
      'online', x.last_seen_at >= v_now - interval '60 seconds'
    ) order by x.total desc, x.joined_at asc, x.user_id asc), '[]'::jsonb)
  into v_members
  from (
    select rm.user_id, p.display_name, rm.joined_at, rm.last_seen_at,
           (rm.last_seen_at >= v_now - interval '3 minutes') as fresh,
           coalesce(floor(sum(extract(epoch from
             greatest(
               case when s.ended_at is not null then s.ended_at
                    when rm.last_seen_at >= v_now - interval '3 minutes' then v_now
                    else rm.last_seen_at end,
               s.started_at) - s.started_at
           ))), 0)::int as total,
           max(s.started_at) filter (where s.ended_at is null) as active_start,
           count(s.id) as n
      from public.room_members rm
      join public.profiles p on p.id = rm.user_id
      left join public.study_sessions s
        on s.room_id = rm.room_id and s.user_id = rm.user_id
     where rm.room_id = v_room.id
     group by rm.user_id, p.display_name, rm.joined_at, rm.last_seen_at
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

-- ───────────── clean-up job (runs every minute from pg_cron, never from the browser) ─────────────
create or replace function public.sweep_rooms ()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
begin
  -- 1. stop timers of people who stopped sending heartbeats (counted up to their last heartbeat)
  update public.study_sessions s
     set ended_at = greatest(s.started_at, rm.last_seen_at)
    from public.room_members rm
   where s.room_id = rm.room_id and s.user_id = rm.user_id
     and s.ended_at is null
     and rm.last_seen_at < now() - interval '3 minutes';

  -- 2. delete rooms where nobody has been connected for 3 minutes (members, times and chat go with them)
  delete from public.rooms ro
   where not exists (
     select 1 from public.room_members rm
      where rm.room_id = ro.id and rm.last_seen_at >= now() - interval '3 minutes'
   );

  -- 3. remove people who have been gone for 30 minutes while others are still connected
  for r in
    select rm.room_id, rm.user_id from public.room_members rm
     where rm.last_seen_at < now() - interval '30 minutes'
  loop
    delete from public.study_sessions where room_id = r.room_id and user_id = r.user_id;
    delete from public.room_members where room_id = r.room_id and user_id = r.user_id;
    update public.rooms ro
       set founder_id = (select m.user_id from public.room_members m where m.room_id = ro.id
                          order by m.joined_at, m.user_id limit 1)
     where ro.id = r.room_id and ro.founder_id = r.user_id
       and exists (select 1 from public.room_members m where m.room_id = ro.id);
  end loop;
end;
$$;

-- ───────────── privileges ─────────────
revoke execute on function public.heartbeat (text), public.sweep_rooms () from public, anon;
grant execute on function public.heartbeat (text) to authenticated;
revoke execute on function public.sweep_rooms () from authenticated;  -- only the scheduler may run it
revoke execute on function public.get_room_state (text) from public, anon;
grant execute on function public.get_room_state (text) to authenticated;

-- ───────────── schedule: every minute (needs Integrations -> Cron enabled first) ─────────────
do $$ begin perform cron.unschedule('zanqa-sweep'); exception when others then null; end $$;
select cron.schedule('zanqa-sweep', '* * * * *', 'select public.sweep_rooms()');
