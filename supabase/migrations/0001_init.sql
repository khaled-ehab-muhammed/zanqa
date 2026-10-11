-- Zanqa (زنقة) — initial schema
-- Design: clients never write tables directly. All writes go through SECURITY DEFINER
-- functions that derive the user from auth.uid() and validate state. Tables are readable
-- (RLS) only by room members, which is also what makes Realtime events private.

create extension if not exists pgcrypto with schema extensions;

-- ───────────── tables ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  founder_id uuid not null references public.profiles (id),
  status text not null default 'waiting' check (status in ('waiting', 'active')),
  timezone text not null default 'Africa/Cairo',
  max_members int not null default 10 check (max_members between 2 and 50),
  started_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'waiting') = (started_at is null))
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id);

-- One row per uninterrupted studying stretch. ended_at IS NULL means "studying now".
-- Durations are never stored or trusted from the client: they are derived from timestamps.
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
-- At most one active session per user per room (prevents double counting / double clicks).
create unique index study_sessions_one_active
  on public.study_sessions (room_id, user_id) where ended_at is null;
create index study_sessions_room_time_idx on public.study_sessions (room_id, started_at);

-- ───────────── helpers ─────────────
create or replace function public.is_room_member (p_room uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members where room_id = p_room and user_id = auth.uid()
  );
$$;

-- ───────────── row level security ─────────────
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.study_sessions enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy rooms_select_member on public.rooms
  for select to authenticated using (public.is_room_member (id));

create policy members_select_member on public.room_members
  for select to authenticated using (public.is_room_member (room_id));

create policy sessions_select_member on public.study_sessions
  for select to authenticated using (public.is_room_member (room_id));

-- No insert/update/delete policies exist on purpose, and privileges are revoked as well.
revoke all on public.profiles, public.rooms, public.room_members, public.study_sessions
  from anon, authenticated;
grant select on public.profiles, public.rooms, public.room_members, public.study_sessions
  to authenticated;

-- ───────────── RPCs (the only write path) ─────────────
create or replace function public.upsert_profile (p_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    raise exception 'INVALID_NAME';
  end if;
  insert into public.profiles (id, display_name) values (auth.uid(), v_name)
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now();
end;
$$;

create or replace function public.create_room (p_name text default null)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars, no 0/O/1/I
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_name text;
  v_code text;
  v_room uuid;
  v_try int := 0;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'NO_PROFILE'; end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then v_name := 'زنقة ' || v_profile.display_name; end if;
  v_name := left(v_name, 40);

  loop
    select string_agg(substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1), '')
      into v_code from generate_series(1, 6);
    begin
      insert into public.rooms (code, name, founder_id)
      values (v_code, v_name, v_user) returning id into v_room;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 8 then raise exception 'CODE_GENERATION_FAILED'; end if;
    end;
  end loop;

  insert into public.room_members (room_id, user_id) values (v_room, v_user);
  return v_code;
end;
$$;

create or replace function public.join_room (p_code text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_count int;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'NO_PROFILE';
  end if;

  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  if exists (select 1 from public.room_members where room_id = v_room.id and user_id = v_user) then
    return v_room.code; -- already a member: idempotent
  end if;

  select count(*) into v_count from public.room_members where room_id = v_room.id;
  if v_count >= v_room.max_members then raise exception 'ROOM_FULL'; end if;

  insert into public.room_members (room_id, user_id) values (v_room.id, v_user)
  on conflict do nothing;
  return v_room.code;
end;
$$;

create or replace function public.leave_room (p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_next uuid;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = v_user
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  update public.study_sessions set ended_at = now()
   where room_id = v_room.id and user_id = v_user and ended_at is null;
  delete from public.room_members where room_id = v_room.id and user_id = v_user;

  if v_room.founder_id = v_user then
    select user_id into v_next from public.room_members
     where room_id = v_room.id order by joined_at, user_id limit 1;
    if v_next is null then
      delete from public.rooms where id = v_room.id; -- last person left
    else
      update public.rooms set founder_id = v_next where id = v_room.id;
    end if;
  end if;
end;
$$;

create or replace function public.start_competition (p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_count int;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = v_user
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.founder_id <> v_user then raise exception 'NOT_FOUNDER'; end if;
  if v_room.status <> 'waiting' then raise exception 'ALREADY_STARTED'; end if;
  select count(*) into v_count from public.room_members where room_id = v_room.id;
  if v_count < 2 then raise exception 'NEED_TWO_MEMBERS'; end if;

  update public.rooms set status = 'active', started_at = now() where id = v_room.id;
end;
$$;

create or replace function public.start_timer (p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = v_user
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.status <> 'active' then raise exception 'NOT_STARTED'; end if;

  insert into public.study_sessions (room_id, user_id) values (v_room.id, v_user);
exception when unique_violation then
  null; -- already studying (double click / second tab): idempotent no-op
end;
$$;

create or replace function public.pause_timer (p_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = v_user
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  update public.study_sessions set ended_at = now()
   where room_id = v_room.id and user_id = v_user and ended_at is null; -- no-op if already paused
end;
$$;

-- Everything the UI needs in one call: room, members, today's totals (server-computed).
-- Today = the room's timezone calendar day. A session crossing midnight is clipped to the day.
create or replace function public.get_room_state (p_code text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_now timestamptz := now();
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_members jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = auth.uid()
  ) then
    raise exception 'ROOM_NOT_FOUND'; -- same error for "no such room" and "not your room"
  end if;

  v_day_start := date_trunc('day', v_now at time zone v_room.timezone) at time zone v_room.timezone;
  v_day_end := (date_trunc('day', v_now at time zone v_room.timezone) + interval '1 day')
               at time zone v_room.timezone;

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
           coalesce(floor(sum(extract(epoch from
             least(coalesce(s.ended_at, v_now), v_day_end) - greatest(s.started_at, v_day_start)
           ))), 0)::int as total,
           max(s.started_at) filter (where s.ended_at is null) as active_start,
           count(s.id) as n
      from public.room_members rm
      join public.profiles p on p.id = rm.user_id
      left join public.study_sessions s
        on s.room_id = rm.room_id and s.user_id = rm.user_id
       and s.started_at < v_day_end and coalesce(s.ended_at, v_now) > v_day_start
     where rm.room_id = v_room.id
     group by rm.user_id, p.display_name, rm.joined_at
  ) x;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'code', v_room.code, 'name', v_room.name, 'status', v_room.status,
      'started_at', v_room.started_at, 'timezone', v_room.timezone,
      'max_members', v_room.max_members, 'founder_id', v_room.founder_id),
    'members', v_members,
    'day_start', v_day_start,
    'day_end', v_day_end,
    'server_now', v_now,
    'me', auth.uid());
end;
$$;

-- ───────────── privileges for functions ─────────────
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.upsert_profile (text), public.create_room (text), public.join_room (text),
  public.leave_room (text), public.start_competition (text), public.start_timer (text),
  public.pause_timer (text), public.get_room_state (text)
to authenticated;
-- is_room_member must stay callable by authenticated users because RLS policies use it.
grant execute on function public.is_room_member (uuid) to authenticated;

-- ───────────── realtime ─────────────
alter table public.room_members replica identity full;
alter table public.study_sessions replica identity full;
alter publication supabase_realtime add table public.rooms, public.room_members, public.study_sessions;
