-- Zanqa — small live chat inside a room.
-- Messages vanish with the room (ON DELETE CASCADE: the room is deleted when its last member
-- leaves) and anything older than 12 hours is deleted whenever someone sends a new message.

create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index room_messages_room_time_idx on public.room_messages (room_id, created_at);

alter table public.room_messages enable row level security;
create policy messages_select_member on public.room_messages
  for select to authenticated using (public.is_room_member (room_id));
revoke all on public.room_messages from anon, authenticated;
grant select on public.room_messages to authenticated;

create or replace function public.send_message (p_code text, p_body text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = v_user
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 300 then raise exception 'EMPTY_MESSAGE'; end if;

  -- simple flood guard: at most 5 messages per 5 seconds per person
  if (select count(*) from public.room_messages
       where room_id = v_room.id and user_id = v_user
         and created_at > now() - interval '5 seconds') >= 5 then
    raise exception 'RATE_LIMIT';
  end if;

  delete from public.room_messages
   where room_id = v_room.id and created_at < now() - interval '12 hours';
  insert into public.room_messages (room_id, user_id, body) values (v_room.id, v_user, v_body);
end;
$$;

create or replace function public.get_messages (p_code text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found or not exists (
    select 1 from public.room_members where room_id = v_room.id and user_id = auth.uid()
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'user_id', m.user_id, 'display_name', p.display_name,
             'body', m.body, 'created_at', m.created_at) order by m.created_at, m.id)
      from (select * from public.room_messages
             where room_id = v_room.id and created_at > now() - interval '12 hours'
             order by created_at desc, id desc limit 100) m
      join public.profiles p on p.id = m.user_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.send_message (text, text), public.get_messages (text) from public, anon;
grant execute on function public.send_message (text, text), public.get_messages (text) to authenticated;

alter publication supabase_realtime add table public.room_messages;
