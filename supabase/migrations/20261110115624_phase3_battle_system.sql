-- Additive Battle Mode; preserve Classic Race command validation and grants.
alter table public.game_rooms add column mode text not null default 'classic' check(mode in ('classic','battle'));
alter table public.game_matches add column mode text not null default 'classic' check(mode in ('classic','battle'));
alter table public.match_events add column payload jsonb not null default '{}'::jsonb;

create table private.battle_config (
  version integer primary key,
  rules jsonb not null
);
insert into private.battle_config values(1,'{
  "version":1,"maxEnergy":5,"cooldownMs":1000,"freezeImmunityMs":3000,
  "rewards":{"row":1,"column":1,"box":2},
  "skills":{"fog":{"cost":1,"durationMs":3000},"freeze":{"cost":2,"durationMs":1500},"scramble":{"cost":2,"durationMs":5000},"shield":{"cost":2,"durationMs":15000}}
}');
create table public.battle_series (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.game_rooms(id),
  status text not null default 'active' check(status in ('active','finished')),
  winner_id uuid references public.profiles(id), outcome text,
  created_at timestamptz not null default now(), completed_at timestamptz,
  rules jsonb not null
);
create index battle_series_room on public.battle_series(room_id);
create index battle_series_winner on public.battle_series(winner_id);
create table public.battle_series_players (
  series_id uuid not null references public.battle_series(id), user_id uuid not null references public.profiles(id),
  rounds_won integer not null default 0 check(rounds_won between 0 and 2),
  primary key(series_id,user_id)
);
create index series_players_user on public.battle_series_players(user_id);
alter table public.game_matches add column series_id uuid references public.battle_series(id);
alter table public.game_matches add column round_number integer not null default 1 check(round_number between 1 and 3);
alter table public.game_matches add column battle_rules jsonb;
create index matches_series on public.game_matches(series_id);
create table public.battle_players (
  match_id uuid not null references public.game_matches(id), user_id uuid not null references public.profiles(id),
  energy integer not null default 0 check(energy between 0 and 5), version integer not null default 0,
  cooldown_until timestamptz, freeze_immunity_until timestamptz,
  energy_generated integer not null default 0, energy_stored integer not null default 0,
  skills_cast integer not null default 0, attacks_blocked integer not null default 0,
  primary key(match_id,user_id)
);
create index battle_players_user on public.battle_players(user_id);
create table private.unit_rewards (
  match_id uuid not null references public.game_matches(id), user_id uuid not null references public.profiles(id),
  unit_kind text not null check(unit_kind in ('row','column','box')),
  unit_index integer not null check(unit_index between 0 and 8), reward integer not null,
  awarded_at timestamptz not null default now(), primary key(match_id,user_id,unit_kind,unit_index)
);
create index unit_rewards_user on private.unit_rewards(user_id);
create table public.skill_effects (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.game_matches(id),
  source_id uuid not null references public.profiles(id), target_id uuid not null references public.profiles(id),
  skill text not null check(skill in ('fog','freeze','scramble','shield')),
  starts_at timestamptz not null, expires_at timestamptz not null, consumed_at timestamptz,
  region integer check(region between 0 and 8), keypad integer[],
  check(expires_at>starts_at)
);
create index skill_effects_match_target on public.skill_effects(match_id,target_id,expires_at);
create index skill_effects_source on public.skill_effects(source_id);
create index skill_effects_target on public.skill_effects(target_id);

alter function private.command(text,jsonb,uuid) rename to classic_command;
alter function private.snapshot(uuid,uuid) rename to classic_snapshot;
alter function private.start_match(uuid,uuid,uuid,integer[],integer[]) rename to classic_start;
alter function private.finish(uuid,uuid,text) rename to classic_finish;

create function private.snapshot(p_room uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_base jsonb; v_match uuid; v_series uuid;
begin
  v_base:=private.classic_snapshot(p_room,p_user);
  v_match:=(v_base->'match'->>'id')::uuid;
  v_series:=(v_base->'match'->>'series_id')::uuid;
  return v_base||jsonb_build_object('battle',case when v_series is not null then jsonb_build_object(
    'series',(select to_jsonb(s) from public.battle_series s where id=v_series),
    'score',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.battle_series_players p where series_id=v_series),
    'players',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.battle_players p where match_id=v_match),
    'effects',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.skill_effects e where e.match_id=v_match and e.consumed_at is null and e.expires_at>clock_timestamp() and v_base->'match'->>'status'='active')
  ) else null end,
  'events',(select coalesce(jsonb_agg(to_jsonb(e) order by sequence),'[]') from (select sequence,match_id,kind,created_at,payload from public.match_events where room_id=p_room order by sequence desc limit 64) e));
end $$;

create function private.finish(p_match uuid,p_winner uuid,p_outcome text) returns void language plpgsql security definer set search_path='' as $$
declare m public.game_matches; s public.battle_series; p record; v_series_winner uuid; v_terminal boolean; v_seconds bigint;
begin
  select * into m from public.game_matches where id=p_match for update;
  if m.mode='classic' then perform private.classic_finish(p_match,p_winner,p_outcome); return; end if;
  if m.status<>'active' then return; end if;
  select * into s from public.battle_series where id=m.series_id for update;
  update public.game_matches set status='finished',winner_id=p_winner,outcome=p_outcome,completed_at=clock_timestamp() where id=p_match;
  update public.game_rooms set status='finished' where id=m.room_id;
  update public.skill_effects set consumed_at=clock_timestamp() where match_id=p_match and consumed_at is null;
  if p_winner is not null and p_outcome in ('solved','timeout') then
    update public.battle_series_players set rounds_won=rounds_won+1 where series_id=s.id and user_id=p_winner;
  end if;
  select user_id into v_series_winner from public.battle_series_players where series_id=s.id and rounds_won=2;
  v_terminal:=v_series_winner is not null or p_outcome in ('forfeit','disconnect','abandoned');
  if p_outcome in ('forfeit','disconnect','abandoned') then v_series_winner:=p_winner; end if;
  if v_terminal and s.status='active' then
    update public.battle_series set status='finished',winner_id=v_series_winner,outcome=p_outcome,completed_at=clock_timestamp() where id=s.id;
    for p in select user_id from public.battle_series_players where series_id=s.id loop
      select coalesce(sum(greatest(0,floor(extract(epoch from least(g.completed_at,g.ends_at)-g.started_at)))),0) into v_seconds from public.game_matches g where g.series_id=s.id;
      update public.player_stats set total_matches=total_matches+1,
        wins=wins+case when v_series_winner=p.user_id then 1 else 0 end,
        losses=losses+case when v_series_winner is not null and v_series_winner<>p.user_id then 1 else 0 end,
        draws=draws+case when v_series_winner is null then 1 else 0 end,
        total_playtime=total_playtime+v_seconds,
        completed_puzzles=completed_puzzles+(select count(*) from public.match_players mp join public.game_matches gm on gm.id=mp.match_id where gm.series_id=s.id and mp.user_id=p.user_id and mp.completed_at is not null),
        total_completion_time=total_completion_time+(select coalesce(sum(greatest(0,floor(extract(epoch from mp.completed_at-gm.started_at)))),0) from public.match_players mp join public.game_matches gm on gm.id=mp.match_id where gm.series_id=s.id and mp.user_id=p.user_id and mp.completed_at is not null)
      where user_id=p.user_id;
    end loop;
  end if;
  insert into public.match_events(room_id,match_id,kind,payload) values(m.room_id,m.id,'round_finished',jsonb_build_object('winner_id',p_winner,'series_finished',v_terminal,'outcome',p_outcome));
end $$;

create function private.reward_units(p_match uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.game_matches; b private.player_boards; v_solution integer[]; v_kind text; v_unit integer; v_indices integer[];
  v_units jsonb:='[]'; v_reward integer; v_generated integer:=0; v_before integer; v_stored integer;
begin
  select * into m from public.game_matches where id=p_match;
  select * into b from private.player_boards where match_id=p_match and user_id=p_user;
  select solution into v_solution from private.match_secrets where match_id=p_match;
  foreach v_kind in array array['row','column','box'] loop
    for v_unit in 0..8 loop
      select array_agg(i) into v_indices from generate_series(1,81) i where
        case v_kind when 'row' then (i-1)/9=v_unit when 'column' then (i-1)%9=v_unit else ((i-1)/27)*3+((i-1)%9)/3=v_unit end;
      if not exists(select 1 from unnest(v_indices) i where m.clues[i]=0) then continue; end if;
      if exists(select 1 from unnest(v_indices) i where b.entries[i]<>v_solution[i]) then continue; end if;
      v_reward:=(m.battle_rules->'rewards'->>v_kind)::integer;
      insert into private.unit_rewards(match_id,user_id,unit_kind,unit_index,reward) values(p_match,p_user,v_kind,v_unit,v_reward) on conflict do nothing;
      if found then v_generated:=v_generated+v_reward; v_units:=v_units||jsonb_build_array(jsonb_build_object('kind',v_kind,'index',v_unit,'reward',v_reward)); end if;
    end loop;
  end loop;
  if v_generated=0 then return; end if;
  select energy into v_before from public.battle_players where match_id=p_match and user_id=p_user for update;
  v_stored:=least((m.battle_rules->>'maxEnergy')::integer-v_before,v_generated);
  update public.battle_players set energy=energy+v_stored,version=version+1,energy_generated=energy_generated+v_generated,energy_stored=energy_stored+v_stored where match_id=p_match and user_id=p_user;
  insert into public.match_events(room_id,match_id,kind,payload) values(m.room_id,p_match,'energy',jsonb_build_object('actor_id',p_user,'units',v_units,'generated',v_generated,'stored',v_stored,'combo',jsonb_array_length(v_units)));
end $$;

create function private.start_match(p_room uuid,p_actor uuid,p_action uuid,p_clues integer[],p_solution integer[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; v_match uuid; v_series public.battle_series; v_old public.game_matches; v_round integer;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.mode='classic' then return private.classic_start(p_room,p_actor,p_action,p_clues,p_solution); end if;
  select (result->>'match_id')::uuid into v_match from private.action_receipts where actor_id=p_actor and action_id=p_action and command='start';
  if found then return v_match; end if;
  select * into v_old from public.game_matches where id=r.current_match_id;
  if v_old.series_id is not null then select * into v_series from public.battle_series where id=v_old.series_id for update; end if;
  if v_series.id is null or v_series.status='finished' then
    insert into public.battle_series(room_id,rules) select p_room,rules from private.battle_config order by version desc limit 1 returning * into v_series;
    insert into public.battle_series_players(series_id,user_id) select v_series.id,user_id from public.room_players where room_id=p_room;
  end if;
  v_match:=private.classic_start(p_room,p_actor,p_action,p_clues,p_solution);
  select 1+coalesce(sum(rounds_won),0) into v_round from public.battle_series_players where series_id=v_series.id;
  update public.game_matches set mode='battle',series_id=v_series.id,round_number=v_round,battle_rules=v_series.rules where id=v_match;
  insert into public.battle_players(match_id,user_id) select v_match,user_id from public.room_players where room_id=p_room;
  return v_match;
end $$;

create function private.command(p_command text,p_payload jsonb,p_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.verified_actor(); r public.game_rooms; m public.game_matches;
  v_reply jsonb; v_receipt private.action_receipts; v_state public.battle_players; v_target uuid;
  v_skill text; v_cost integer; v_ms integer; v_now timestamptz:=clock_timestamp();
  v_block uuid; v_effect uuid; v_region integer; v_keypad integer[]; v_result jsonb;
begin
  if octet_length(p_payload::text)>8192 then raise exception 'Request too large.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  if p_command<>'snapshot' and p_action_id is null then raise exception 'Action ID required.'; end if;
  select * into v_receipt from private.action_receipts where actor_id=v_user and action_id=p_action_id;
  if found then
    if v_receipt.command<>p_command then raise exception 'Action ID has already been used.'; end if;
    if v_receipt.room_id is null then return v_receipt.result; end if;
    return private.snapshot(v_receipt.room_id,v_user)||jsonb_build_object('action',v_receipt.result||jsonb_build_object('id',p_action_id));
  end if;
  if p_command='create' then
    if coalesce(p_payload->>'mode','classic') not in ('classic','battle') then raise exception 'Invalid game mode.'; end if;
    v_reply:=private.classic_command(p_command,p_payload,p_action_id);
    update public.game_rooms set mode=coalesce(p_payload->>'mode','classic') where id=(v_reply->'room'->>'id')::uuid returning * into r;
    return private.snapshot(r.id,v_user);
  end if;
  select * into r from public.game_rooms where code=upper(trim(p_payload->>'code')) for update;
  if not found then raise exception 'Room not found. Check the invitation code.'; end if;
  if p_command='join' then return private.classic_command(p_command,p_payload,p_action_id); end if;
  if not exists(select 1 from public.room_players where room_id=r.id and user_id=v_user) then raise exception 'You are not a member of this room.' using errcode='42501'; end if;
  perform private.advance(r.id);
  select * into m from public.game_matches where id=r.current_match_id;
  v_now:=clock_timestamp();
  if p_command='settings' and p_payload ? 'mode' and p_payload->>'mode' not in ('classic','battle') then raise exception 'Invalid game mode.'; end if;
  if p_command='next_ready' then
    if m.mode<>'battle' or m.status<>'finished' or m.id is distinct from (p_payload->>'match_id')::uuid or not exists(select 1 from public.battle_series where id=m.series_id and status='active') then raise exception 'The next round is not available.'; end if;
    update public.match_players set rematch='accepted' where match_id=m.id and user_id=v_user;
    insert into private.action_receipts(actor_id,action_id,command,room_id) values(v_user,p_action_id,p_command,r.id);
    insert into public.match_events(room_id,match_id,kind) values(r.id,m.id,'next_ready');
    return private.snapshot(r.id,v_user);
  end if;
  if p_command='cast' then
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('code','match_id','skill','battle_version')) then raise exception 'Skill targets, costs and durations are chosen by the server.'; end if;
    if m.id is null or m.mode<>'battle' or m.id is distinct from (p_payload->>'match_id')::uuid or m.status<>'active' or v_now<m.started_at or v_now>=m.ends_at then raise exception 'This round is not accepting attacks.'; end if;
    v_skill:=p_payload->>'skill';
    if v_skill is null or v_skill not in ('fog','freeze','scramble','shield') then raise exception 'Unknown skill.'; end if;
    select * into v_state from public.battle_players where match_id=m.id and user_id=v_user for update;
    if v_state.version is distinct from (p_payload->>'battle_version')::integer then raise exception 'Battle state changed. Resynchronize before casting.' using errcode='40001'; end if;
    v_cost:=(m.battle_rules->'skills'->v_skill->>'cost')::integer;
    v_ms:=(m.battle_rules->'skills'->v_skill->>'durationMs')::integer;
    if v_state.energy<v_cost then raise exception 'Not enough energy: need %, available %.',v_cost,v_state.energy; end if;
    if v_state.cooldown_until>v_now then raise exception 'Your skills are cooling down.'; end if;
    if v_skill='shield' then v_target:=v_user;
    else select user_id into v_target from public.match_players where match_id=m.id and user_id<>v_user;
    end if;
    if exists(select 1 from public.skill_effects where match_id=m.id and target_id=v_target and skill=v_skill and consumed_at is null and expires_at>v_now) then raise exception 'That effect is already active. Effects do not stack.'; end if;
    if v_skill='freeze' and exists(select 1 from public.battle_players where match_id=m.id and user_id=v_target and freeze_immunity_until>v_now) then raise exception 'Your opponent has temporary Freeze immunity.'; end if;
    if v_skill<>'shield' then
      select id into v_block from public.skill_effects where match_id=m.id and target_id=v_target and skill='shield' and consumed_at is null and expires_at>v_now order by starts_at limit 1 for update;
    end if;
    update public.battle_players set energy=energy-v_cost,version=version+1,skills_cast=skills_cast+1,cooldown_until=v_now+make_interval(secs=>(m.battle_rules->>'cooldownMs')::double precision/1000) where match_id=m.id and user_id=v_user;
    if v_block is not null then
      update public.skill_effects set consumed_at=v_now where id=v_block;
      update public.battle_players set attacks_blocked=attacks_blocked+1,version=version+1 where match_id=m.id and user_id=v_target;
    else
      if v_skill='fog' then v_region:=floor(random()*9); end if;
      if v_skill='scramble' then
        select array_agg(n order by random()) into v_keypad from generate_series(1,9) n;
        if v_keypad=array[1,2,3,4,5,6,7,8,9] then v_keypad:=array[2,3,4,5,6,7,8,9,1]; end if;
      end if;
      insert into public.skill_effects(match_id,source_id,target_id,skill,starts_at,expires_at,region,keypad) values(m.id,v_user,v_target,v_skill,v_now,v_now+make_interval(secs=>v_ms::double precision/1000),v_region,v_keypad) returning id into v_effect;
      if v_skill='freeze' then update public.battle_players set freeze_immunity_until=v_now+make_interval(secs=>(v_ms+(m.battle_rules->>'freezeImmunityMs')::integer)::double precision/1000),version=version+1 where match_id=m.id and user_id=v_target; end if;
    end if;
    v_result:=jsonb_build_object('id',p_action_id,'skill',v_skill,'blocked',v_block is not null);
    insert into private.action_receipts(actor_id,action_id,command,room_id,result) values(v_user,p_action_id,p_command,r.id,v_result);
    insert into public.match_events(room_id,match_id,kind,payload) values(r.id,m.id,case when v_block is not null then 'shield_block' else 'cast' end,
      jsonb_build_object('action_id',p_action_id,'actor_id',v_user,'target_id',v_target,'skill',v_skill,'cost',v_cost,'effect_id',v_effect,'blocked',v_block is not null));
    return private.snapshot(r.id,v_user)||jsonb_build_object('action',v_result);
  end if;
  if p_command='move' and m.mode='battle' and exists(select 1 from public.skill_effects where match_id=m.id and target_id=v_user and skill='freeze' and consumed_at is null and expires_at>v_now) then
    raise exception 'Frozen: number entry is temporarily locked by the server.';
  end if;
  v_reply:=private.classic_command(p_command,p_payload,p_action_id);
  if p_command='leave' then return v_reply; end if;
  if p_command='settings' and p_payload ? 'mode' then update public.game_rooms set mode=p_payload->>'mode' where id=r.id; end if;
  if p_command='move' then
    -- Only the actor's receipt holds cell coordinates; public events never carry entered digits.
    update private.action_receipts set result=result||jsonb_build_object('id',p_action_id,'cell',(p_payload->>'cell')::integer) where actor_id=v_user and action_id=p_action_id;
    if m.mode='battle' and not coalesce((v_reply->'action'->>'rejected')::boolean,false) and (p_payload->>'digit')::integer>0 then perform private.reward_units(m.id,v_user); end if;
  end if;
  select result into v_result from private.action_receipts where actor_id=v_user and action_id=p_action_id;
  return private.snapshot(r.id,v_user)||jsonb_build_object('action',v_result||jsonb_build_object('id',p_action_id));
end $$;

create or replace function public.suduel_command(p_command text,p_payload jsonb,p_action_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.command(p_command,p_payload,p_action_id)$$;
create or replace function public.suduel_start(p_room uuid,p_actor uuid,p_action uuid,p_clues integer[],p_solution integer[]) returns uuid language sql security invoker set search_path='' as $$select private.start_match(p_room,p_actor,p_action,p_clues,p_solution)$$;

alter table private.battle_config enable row level security;
alter table private.unit_rewards enable row level security;
alter table public.battle_series enable row level security;
alter table public.battle_series_players enable row level security;
alter table public.battle_players enable row level security;
alter table public.skill_effects enable row level security;
create policy server_only on private.battle_config for all to anon,authenticated using(false) with check(false);
create policy server_only on private.unit_rewards for all to anon,authenticated using(false) with check(false);
create policy series_members on public.battle_series for select to authenticated using(private.member(room_id));
create policy series_score_members on public.battle_series_players for select to authenticated using(exists(select 1 from public.battle_series s where s.id=series_id and private.member(s.room_id)));
create policy battle_members on public.battle_players for select to authenticated using(exists(select 1 from public.game_matches m where m.id=match_id and private.member(m.room_id)));
create policy effects_members on public.skill_effects for select to authenticated using(exists(select 1 from public.game_matches m where m.id=match_id and private.member(m.room_id)));
revoke all on private.battle_config,private.unit_rewards from public,anon,authenticated;
revoke all on public.battle_series,public.battle_series_players,public.battle_players,public.skill_effects from public,anon,authenticated;
grant select on public.battle_series,public.battle_series_players,public.battle_players,public.skill_effects to authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.suduel_username_available(text) to anon,authenticated;
grant execute on function private.member(uuid),private.command(text,jsonb,uuid) to authenticated;
grant execute on function private.start_match(uuid,uuid,uuid,integer[],integer[]) to service_role;
