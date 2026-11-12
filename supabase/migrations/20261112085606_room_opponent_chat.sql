-- Chat is private to current room members; browser writes go through a verified RPC.
create table public.room_chat_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  body text not null check (char_length(body) between 1 and 300 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default clock_timestamp(),
  unique (user_id, client_id)
);
create index room_chat_history_idx on public.room_chat_messages(room_id, id desc);
create index room_chat_rate_idx on public.room_chat_messages(user_id, created_at desc);
alter table public.room_chat_messages enable row level security;
revoke all on public.room_chat_messages from anon, authenticated;
grant select (id, room_id, user_id, body, created_at) on public.room_chat_messages to authenticated;
create policy "Room members read chat" on public.room_chat_messages for select to authenticated using (private.member(room_id));

create function private.send_room_chat(p_room uuid, p_body text, p_action_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.verified_actor();
  v_body text := btrim(p_body);
  v_message public.room_chat_messages;
begin
  if p_action_id is null or v_body is null or char_length(v_body) not between 1 and 300 or v_body !~ '[^[:space:]]' then
    raise exception 'Write a message between 1 and 300 characters.' using errcode='22023';
  end if;
  if not private.member(p_room) or not exists(select 1 from public.game_rooms where id=p_room and status <> 'closed') then
    raise exception 'Chat is available only to players in this room.' using errcode='42501';
  end if;
  -- Serialize requests per sender, including across rooms, to enforce limits atomically.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('room-chat:' || v_user::text, 0));
  select * into v_message from public.room_chat_messages where user_id=v_user and client_id=p_action_id;
  if found then
    if v_message.room_id <> p_room or v_message.body <> v_body then
      raise exception 'This message request was already used.' using errcode='22023';
    end if;
  else
    if (select count(*) from public.room_chat_messages where user_id=v_user and created_at > clock_timestamp()-interval '5 seconds') >= 3 then
      raise exception 'Please wait a few seconds before sending another message.' using errcode='P0001';
    end if;
    insert into public.room_chat_messages(room_id,user_id,client_id,body) values(p_room,v_user,p_action_id,v_body) returning * into v_message;
  end if;
  return jsonb_build_object('id',v_message.id,'room_id',v_message.room_id,'user_id',v_message.user_id,'body',v_message.body,'created_at',v_message.created_at);
end $$;
revoke all on function private.send_room_chat(uuid,text,uuid) from public,anon;
grant execute on function private.send_room_chat(uuid,text,uuid) to authenticated;
create function public.send_room_chat(p_room uuid,p_body text,p_action_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.send_room_chat(p_room,p_body,p_action_id)
$$;
revoke all on function public.send_room_chat(uuid,text,uuid) from public,anon;
grant execute on function public.send_room_chat(uuid,text,uuid) to authenticated;
alter publication supabase_realtime add table public.room_chat_messages;
