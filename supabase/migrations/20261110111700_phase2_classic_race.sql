-- SUDUEL Phase 2. Solutions and entries are never in a client-readable table.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
create extension if not exists pg_cron;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text not null check (length(display_name) between 1 and 40),
  avatar_url text check (avatar_url is null or (length(avatar_url) < 2048 and avatar_url ~ '^https://')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index profiles_username_ci on public.profiles(lower(username));
create table public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_matches integer not null default 0, wins integer not null default 0,
  losses integer not null default 0, draws integer not null default 0,
  total_playtime bigint not null default 0, completed_puzzles integer not null default 0,
  total_completion_time bigint not null default 0,
  check (total_matches = wins + losses + draws)
);
create table public.game_rooms (
  id uuid primary key default gen_random_uuid(), code text unique not null,
  host_id uuid not null references public.profiles(id),
  difficulty text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  time_limit integer not null default 300 check (time_limit in (180,300,600)),
  status text not null default 'waiting' check (status in ('waiting','playing','finished','closed')),
  current_match_id uuid, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);
create index game_rooms_host on public.game_rooms(host_id);
create table public.room_players (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id), seat integer not null check (seat in (1,2)),
  ready boolean not null default false, joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(), primary key(room_id,user_id), unique(room_id,seat)
);
create index room_players_user on public.room_players(user_id);
create table public.game_matches (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.game_rooms(id),
  clues integer[] not null check (array_length(clues,1) = 81 and clues <@ array[0,1,2,3,4,5,6,7,8,9]),
  difficulty text not null, status text not null default 'active' check(status in ('active','finished')),
  started_at timestamptz not null, ends_at timestamptz not null,
  completed_at timestamptz, winner_id uuid references public.profiles(id),
  outcome text check(outcome in ('solved','timeout','forfeit','disconnect','abandoned')),
  previous_match_id uuid unique references public.game_matches(id), check(ends_at > started_at)
);
alter table public.game_rooms add constraint room_current_match foreign key(current_match_id) references public.game_matches(id);
create index matches_room on public.game_matches(room_id);
create index matches_active on public.game_matches(ends_at) where status='active';
create table public.match_players (
  match_id uuid not null references public.game_matches(id), user_id uuid not null references public.profiles(id),
  correct_cells integer not null default 0 check(correct_cells between 0 and 81),
  mistakes integer not null default 0, completed_at timestamptz,
  rematch text not null default 'none' check(rematch in ('none','requested','accepted','declined')),
  primary key(match_id,user_id)
);
create index match_players_user on public.match_players(user_id);
create table private.match_secrets (
  match_id uuid primary key references public.game_matches(id),
  solution integer[] not null check(array_length(solution,1)=81 and solution <@ array[1,2,3,4,5,6,7,8,9])
);
create table private.player_boards (
  match_id uuid not null references public.game_matches(id), user_id uuid not null references public.profiles(id),
  entries integer[] not null, version integer not null default 0,
  primary key(match_id,user_id)
);
create table private.action_receipts (
  actor_id uuid not null references public.profiles(id), action_id uuid not null,
  command text not null, room_id uuid references public.game_rooms(id),
  result jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  primary key(actor_id,action_id)
);
create index receipts_rate_limit on private.action_receipts(actor_id,created_at desc);
create table private.match_moves (
  match_id uuid not null references public.game_matches(id), actor_id uuid not null references public.profiles(id),
  action_id uuid not null, cell integer not null, digit integer not null, accepted boolean not null,
  created_at timestamptz not null default now(), primary key(actor_id,action_id)
);
create index moves_match on private.match_moves(match_id,actor_id);
create table public.match_events (
  sequence bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id), match_id uuid references public.game_matches(id),
  kind text not null, created_at timestamptz not null default now()
);
create index match_events_room_sequence on public.match_events(room_id,sequence);

create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare v_username text := new.raw_user_meta_data->>'username';
begin
  if v_username is null or v_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'Username must have 3–20 letters, numbers or underscores.'; end if;
  insert into public.profiles(id,username,display_name) values(new.id,v_username,v_username);
  insert into public.player_stats(user_id) values(new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();

create function private.member(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.room_players where room_id=p_room and user_id=(select auth.uid()))
$$;
create function private.verified_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until < now())) then
    raise exception 'Sign in with a verified email to play multiplayer.' using errcode='42501';
  end if;
  return v_user;
end $$;

-- All callers lock game_rooms before matches. Terminal updates and stats occur once.
create function private.finish(p_match uuid, p_winner uuid, p_outcome text) returns void
language plpgsql security definer set search_path='' as $$
declare v_match public.game_matches; v_player record; v_seconds bigint;
begin
  select * into v_match from public.game_matches where id=p_match for update;
  if v_match.status <> 'active' then return; end if;
  update public.game_matches set status='finished',winner_id=p_winner,outcome=p_outcome,completed_at=clock_timestamp() where id=p_match;
  update public.game_rooms set status='finished' where id=v_match.room_id;
  v_seconds := greatest(0, floor(extract(epoch from least(clock_timestamp(),v_match.ends_at)-v_match.started_at)));
  for v_player in select * from public.match_players where match_id=p_match loop
    update public.player_stats set total_matches=total_matches+1,
      wins=wins+case when p_winner=v_player.user_id then 1 else 0 end,
      losses=losses+case when p_winner is not null and p_winner<>v_player.user_id then 1 else 0 end,
      draws=draws+case when p_winner is null then 1 else 0 end,
      total_playtime=total_playtime+v_seconds,
      completed_puzzles=completed_puzzles+case when v_player.completed_at is not null then 1 else 0 end,
      total_completion_time=total_completion_time+case when v_player.completed_at is not null then greatest(0,floor(extract(epoch from v_player.completed_at-v_match.started_at))) else 0 end
    where user_id=v_player.user_id;
  end loop;
  insert into public.match_events(room_id,match_id,kind) values(v_match.room_id,p_match,'finished');
end $$;

create function private.advance(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_match public.game_matches; v_now timestamptz:=clock_timestamp(); v_winner uuid; v_offline integer;
begin
  select m.* into v_match from public.game_matches m join public.game_rooms r on r.current_match_id=m.id where r.id=p_room for update of m;
  if not found or v_match.status<>'active' then return; end if;
  if v_now >= v_match.ends_at then
    select user_id into v_winner from public.match_players where match_id=v_match.id order by correct_cells desc limit 1;
    if (select count(distinct correct_cells) from public.match_players where match_id=v_match.id)=1 then v_winner:=null; end if;
    perform private.finish(v_match.id,v_winner,'timeout'); return;
  end if;
  select count(*) into v_offline from public.room_players where room_id=p_room and last_seen < v_now-interval '45 seconds';
  if v_offline>0 then
    select user_id into v_winner from public.room_players where room_id=p_room and last_seen >= v_now-interval '45 seconds' limit 1;
    perform private.finish(v_match.id,v_winner,case when v_winner is null then 'abandoned' else 'disconnect' end);
  end if;
end $$;

create function private.snapshot(p_room uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.room_players where room_id=p_room and user_id=p_user) then raise exception 'You are not a member of this room.' using errcode='42501'; end if;
  select jsonb_build_object('server_now',clock_timestamp(),'room',to_jsonb(r),
    'players',(select coalesce(jsonb_agg(jsonb_build_object('user_id',rp.user_id,'seat',rp.seat,'ready',rp.ready,'last_seen',rp.last_seen,'username',p.username,'display_name',p.display_name,'avatar_url',p.avatar_url) order by rp.seat),'[]') from public.room_players rp join public.profiles p on p.id=rp.user_id where rp.room_id=r.id),
    'match',(select to_jsonb(m) from public.game_matches m where m.id=r.current_match_id),
    'progress',(select coalesce(jsonb_agg(to_jsonb(mp)),'[]') from public.match_players mp where mp.match_id=r.current_match_id),
    'board',(select jsonb_build_object('entries',b.entries,'version',b.version) from private.player_boards b where b.match_id=r.current_match_id and b.user_id=p_user),
    'cursor',(select coalesce(max(sequence),0) from public.match_events where room_id=r.id)) into v_result from public.game_rooms r where r.id=p_room;
  return v_result;
end $$;

create function private.command(p_command text,p_payload jsonb,p_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=private.verified_actor(); v_room public.game_rooms; v_match public.game_matches;
  v_board private.player_boards; v_receipt private.action_receipts; v_code text;
  v_cell integer; v_digit integer; v_solution integer[]; v_count integer; v_total integer;
  v_result jsonb:='{}'; v_other uuid;
begin
  if octet_length(p_payload::text)>8192 then raise exception 'Request too large.'; end if;
  -- Serialize an actor's duplicate requests, including room creation before a room exists.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  if p_command<>'snapshot' and p_action_id is null then raise exception 'Action ID required.'; end if;
  select * into v_receipt from private.action_receipts where actor_id=v_user and action_id=p_action_id;
  if found then
    if v_receipt.command<>p_command then raise exception 'Action ID has already been used.'; end if;
    if v_receipt.room_id is null then return v_receipt.result; end if;
    return private.snapshot(v_receipt.room_id,v_user)||jsonb_build_object('action',v_receipt.result);
  end if;

  if p_command='create' then
    if (select count(*) from private.action_receipts where actor_id=v_user and command='create' and created_at>now()-interval '1 minute')>=5 then raise exception 'Please wait before creating another room.'; end if;
    if coalesce(p_payload->>'difficulty','easy') not in ('easy','medium','hard') or coalesce((p_payload->>'time_limit')::integer,300) not in (180,300,600) then raise exception 'Invalid room settings.'; end if;
    loop
      v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      begin
        insert into public.game_rooms(code,host_id,difficulty,time_limit) values(v_code,v_user,coalesce(p_payload->>'difficulty','easy'),coalesce((p_payload->>'time_limit')::integer,300)) returning * into v_room;
        exit;
      exception when unique_violation then null; end;
    end loop;
    insert into public.room_players(room_id,user_id,seat) values(v_room.id,v_user,1);
  else
    if p_command='join' and (select count(*) from private.action_receipts where actor_id=v_user and command='join' and created_at>now()-interval '1 minute')>=10 then raise exception 'Please wait before joining another room.'; end if;
    select * into v_room from public.game_rooms where code=upper(trim(p_payload->>'code')) for update;
    if not found then raise exception 'Room not found. Check the invitation code.'; end if;
    if p_command='join' then
      if not exists(select 1 from public.room_players where room_id=v_room.id and user_id=v_user) then
        if v_room.status<>'waiting' or v_room.expires_at<clock_timestamp() then raise exception 'This room has started, closed, or expired.'; end if;
        if (select count(*) from public.room_players where room_id=v_room.id)>=2 then raise exception 'This room is full.'; end if;
        insert into public.room_players(room_id,user_id,seat) values(v_room.id,v_user,2);
      end if;
    elsif not exists(select 1 from public.room_players where room_id=v_room.id and user_id=v_user) then
      raise exception 'You are not a member of this room.' using errcode='42501';
    end if;
    -- Resolve expired grace periods BEFORE refreshing the heartbeat.
    perform private.advance(v_room.id);
    select * into v_room from public.game_rooms where id=v_room.id;
    if p_command='snapshot' then
      update public.room_players set last_seen=clock_timestamp() where room_id=v_room.id and user_id=v_user;
      return private.snapshot(v_room.id,v_user);
    end if;
    if p_command='ready' then
      if v_room.status<>'waiting' or v_room.expires_at<clock_timestamp() then raise exception 'Readiness cannot change now.'; end if;
      update public.room_players set ready=(p_payload->>'ready')::boolean,last_seen=clock_timestamp() where room_id=v_room.id and user_id=v_user;
    elsif p_command='settings' then
      if v_room.host_id<>v_user or v_room.status<>'waiting' then raise exception 'Only the host can change settings before a match.'; end if;
      update public.game_rooms set difficulty=p_payload->>'difficulty',time_limit=(p_payload->>'time_limit')::integer where id=v_room.id;
      update public.room_players set ready=false where room_id=v_room.id;
    elsif p_command in ('move','forfeit','rematch_request','rematch_accept','rematch_decline') then
      if v_room.current_match_id is null or v_room.current_match_id is distinct from (p_payload->>'match_id')::uuid then raise exception 'This match is no longer current. Refresh the room.'; end if;
      select * into v_match from public.game_matches where id=v_room.current_match_id for update;
      if p_command='move' then
        if v_match.status<>'active' or clock_timestamp()<v_match.started_at then raise exception 'The match is not accepting moves.'; end if;
        if (select count(*) from private.match_moves where actor_id=v_user and created_at>clock_timestamp()-interval '1 second')>=15 then raise exception 'Too many moves. Please slow down.'; end if;
        select * into v_board from private.player_boards where match_id=v_match.id and user_id=v_user for update;
        if v_board.version is distinct from (p_payload->>'version')::integer then raise exception 'Your board changed in another request or tab. Resynchronizing.' using errcode='40001'; end if;
        v_cell:=(p_payload->>'cell')::integer; v_digit:=(p_payload->>'digit')::integer;
        if v_cell is null or v_cell not between 0 and 80 or v_digit is null or v_digit not between 0 and 9 then raise exception 'Invalid cell or number.'; end if;
        if v_match.clues[v_cell+1]<>0 then raise exception 'Original clues cannot be changed.'; end if;
        select solution into v_solution from private.match_secrets where match_id=v_match.id;
        if v_digit<>0 and v_digit<>v_solution[v_cell+1] then
          update public.match_players set mistakes=mistakes+1 where match_id=v_match.id and user_id=v_user;
          v_result:=jsonb_build_object('rejected',true,'message','That number is incorrect. Your confirmed board has not changed.');
        else
          v_board.entries[v_cell+1]:=v_digit;
          update private.player_boards set entries=v_board.entries,version=version+1 where match_id=v_match.id and user_id=v_user;
          select count(*) into v_count from generate_subscripts(v_board.entries,1) i where v_match.clues[i]=0 and v_board.entries[i]=v_solution[i];
          select count(*) into v_total from unnest(v_match.clues) n where n=0;
          update public.match_players set correct_cells=v_count where match_id=v_match.id and user_id=v_user;
          if v_count=v_total then
            update public.match_players set completed_at=clock_timestamp() where match_id=v_match.id and user_id=v_user;
            perform private.finish(v_match.id,v_user,'solved');
          end if;
        end if;
        insert into private.match_moves(match_id,actor_id,action_id,cell,digit,accepted) values(v_match.id,v_user,p_action_id,v_cell,v_digit,not coalesce((v_result->>'rejected')::boolean,false));
      elsif p_command='forfeit' then
        if v_match.status<>'active' then raise exception 'This match has already finished.'; end if;
        select user_id into v_other from public.match_players where match_id=v_match.id and user_id<>v_user;
        perform private.finish(v_match.id,v_other,'forfeit');
      else
        if v_match.status<>'finished' or v_room.status='closed' then raise exception 'A rematch is not available.'; end if;
        if p_command='rematch_request' then
          if exists(select 1 from public.match_players where match_id=v_match.id and rematch='declined') then update public.match_players set rematch='none' where match_id=v_match.id; end if;
          update public.match_players set rematch='requested' where match_id=v_match.id and user_id=v_user;
        elsif p_command='rematch_accept' then
          if not exists(select 1 from public.match_players where match_id=v_match.id and user_id<>v_user and rematch='requested') then raise exception 'There is no pending rematch request.'; end if;
          update public.match_players set rematch='accepted' where match_id=v_match.id and user_id=v_user;
        else update public.match_players set rematch='declined' where match_id=v_match.id and user_id=v_user;
        end if;
      end if;
    elsif p_command='leave' then
      if v_room.status='playing' then raise exception 'Forfeit the active match before leaving.'; end if;
      if v_room.status='finished' or v_room.host_id=v_user then update public.game_rooms set status='closed' where id=v_room.id;
      else delete from public.room_players where room_id=v_room.id and user_id=v_user;
      end if;
      insert into public.match_events(room_id,kind) values(v_room.id,'left');
      insert into private.action_receipts(actor_id,action_id,command,result) values(v_user,p_action_id,p_command,'{"left":true}');
      return '{"left":true}'::jsonb;
    elsif p_command<>'join' then raise exception 'Unknown command.';
    end if;
  end if;
  insert into private.action_receipts(actor_id,action_id,command,room_id,result) values(v_user,p_action_id,p_command,v_room.id,v_result);
  insert into public.match_events(room_id,match_id,kind) values(v_room.id,v_room.current_match_id,p_command);
  return private.snapshot(v_room.id,v_user)||jsonb_build_object('action',v_result);
end $$;

-- This function is callable ONLY by the authenticated Edge Function's service client.
create function private.start_match(p_room uuid,p_actor uuid,p_action uuid,p_clues integer[],p_solution integer[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_room public.game_rooms; v_match uuid; v_player record; v_prev uuid;
begin
  if not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<now())) then raise exception 'Verified account required.'; end if;
  select * into v_room from public.game_rooms where id=p_room for update;
  if not found or not exists(select 1 from public.room_players where room_id=p_room and user_id=p_actor) then raise exception 'Room membership required.'; end if;
  select (result->>'match_id')::uuid into v_match from private.action_receipts where actor_id=p_actor and action_id=p_action and command='start';
  if found then return v_match; end if;
  if v_room.expires_at<clock_timestamp() then raise exception 'This room has expired.'; end if;
  if (select count(*) from public.room_players where room_id=p_room and last_seen>clock_timestamp()-interval '15 seconds')<>2 then raise exception 'Both players must be connected.'; end if;
  if v_room.status='finished' then
    if (select count(*) from public.match_players where match_id=v_room.current_match_id and rematch in ('requested','accepted'))<>2 then raise exception 'Both players must agree to a rematch.'; end if;
    v_prev:=v_room.current_match_id;
  elsif v_room.status='waiting' then
    if v_room.host_id<>p_actor then raise exception 'Only the host can start.'; end if;
    if (select count(*) from public.room_players where room_id=p_room and ready)<>2 then raise exception 'Both players must be ready.'; end if;
  else raise exception 'This room already has an active match or is closed.';
  end if;
  if array_length(p_clues,1)<>81 or array_length(p_solution,1)<>81 or not p_solution <@ array[1,2,3,4,5,6,7,8,9] then raise exception 'Invalid generated puzzle.'; end if;
  if exists(select 1 from generate_series(1,81) i where p_clues[i]<>0 and p_clues[i]<>p_solution[i]) then raise exception 'Clues do not match solution.'; end if;
  insert into public.game_matches(room_id,clues,difficulty,started_at,ends_at,previous_match_id)
    values(p_room,p_clues,v_room.difficulty,clock_timestamp()+interval '3 seconds',clock_timestamp()+make_interval(secs=>v_room.time_limit+3),v_prev) returning id into v_match;
  insert into private.match_secrets(match_id,solution) values(v_match,p_solution);
  for v_player in select user_id from public.room_players where room_id=p_room loop
    insert into public.match_players(match_id,user_id) values(v_match,v_player.user_id);
    insert into private.player_boards(match_id,user_id,entries) values(v_match,v_player.user_id,p_clues);
  end loop;
  update public.game_rooms set current_match_id=v_match,status='playing' where id=p_room;
  update public.room_players set last_seen=clock_timestamp(),ready=false where room_id=p_room;
  insert into private.action_receipts(actor_id,action_id,command,room_id,result) values(p_actor,p_action,'start',p_room,jsonb_build_object('match_id',v_match));
  insert into public.match_events(room_id,match_id,kind) values(p_room,v_match,'started');
  return v_match;
end $$;

create function private.tick() returns void language plpgsql security definer set search_path='' as $$
declare v_room record;
begin
  for v_room in select id from public.game_rooms where status='playing' order by id for update skip locked loop perform private.advance(v_room.id); end loop;
  update public.game_rooms set status='closed' where status='waiting' and expires_at<clock_timestamp();
  delete from private.action_receipts where created_at<now()-interval '7 days';
  delete from public.match_events where created_at<now()-interval '7 days';
end $$;

create function public.suduel_command(p_command text,p_payload jsonb,p_action_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.command(p_command,p_payload,p_action_id) $$;
create function public.suduel_start(p_room uuid,p_actor uuid,p_action uuid,p_clues integer[],p_solution integer[]) returns uuid language sql security invoker set search_path='' as $$ select private.start_match(p_room,p_actor,p_action,p_clues,p_solution) $$;
create function public.suduel_username_available(p_username text) returns boolean language sql stable security definer set search_path='' as $$ select p_username ~ '^[A-Za-z0-9_]{3,20}$' and not exists(select 1 from public.profiles where lower(username)=lower(p_username)) $$;
-- Keep elevated username lookup in the private schema too.
alter function public.suduel_username_available(text) set schema private;
create function public.suduel_username_available(p_username text) returns boolean language sql stable security invoker set search_path='' as $$ select private.suduel_username_available(p_username) $$;

alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.game_matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_events enable row level security;
alter table private.match_secrets enable row level security;
alter table private.player_boards enable row level security;
alter table private.action_receipts enable row level security;
alter table private.match_moves enable row level security;
create policy profiles_self_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy stats_self_read on public.player_stats for select to authenticated using(user_id=(select auth.uid()));
create policy rooms_member_read on public.game_rooms for select to authenticated using(private.member(id));
create policy players_member_read on public.room_players for select to authenticated using(private.member(room_id));
create policy matches_member_read on public.game_matches for select to authenticated using(private.member(room_id));
create policy progress_member_read on public.match_players for select to authenticated using(exists(select 1 from public.game_matches m where m.id=match_id and private.member(m.room_id)));
create policy events_member_read on public.match_events for select to authenticated using(private.member(room_id));

revoke all on all tables in schema public from anon,authenticated;
revoke all on all tables in schema private from anon,authenticated;
grant select on public.profiles,public.player_stats,public.game_rooms,public.room_players,public.game_matches,public.match_players,public.match_events to authenticated;
grant update(display_name,avatar_url) on public.profiles to authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
revoke all on function public.suduel_command(text,jsonb,uuid),public.suduel_start(uuid,uuid,uuid,integer[],integer[]),public.suduel_username_available(text) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.suduel_username_available(text),public.suduel_username_available(text) to anon,authenticated;
grant execute on function private.member(uuid),private.command(text,jsonb,uuid),public.suduel_command(text,jsonb,uuid) to authenticated;
grant execute on function private.start_match(uuid,uuid,uuid,integer[],integer[]),public.suduel_start(uuid,uuid,uuid,integer[],integer[]) to service_role;
alter publication supabase_realtime add table public.match_events;
select cron.schedule('suduel-match-clock','5 seconds','select private.tick()');
select cron.schedule('suduel-cron-history','0 3 * * *',$$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname in ('suduel-match-clock','suduel-cron-history')) and end_time<now()-interval '7 days'$$);
