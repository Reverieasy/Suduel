-- Battle-only pressure and participant-visible boards. Classic validation stays unchanged.
alter table public.battle_players
  add column mistake_pressure integer not null default 0 check(mistake_pressure>=0),
  add column genuine_mistakes integer not null default 0 check(genuine_mistakes>=0),
  add column pressure_rewards integer not null default 0 check(pressure_rewards>=0),
  add column pressure_energy_received integer not null default 0 check(pressure_energy_received>=0),
  add column input_recovery_until timestamptz;
alter table private.player_boards add column cell_versions integer[] not null default array_fill(0,array[81]) check(cardinality(cell_versions)=81);
alter table private.match_moves add column genuine_mistake boolean not null default false;
create index match_moves_actor_time on private.match_moves(actor_id,created_at desc);
create table private.battle_puzzles (
  match_id uuid not null, user_id uuid not null, clues integer[] not null check(cardinality(clues)=81),
  solution integer[] not null check(cardinality(solution)=81),
  primary key(match_id,user_id), foreign key(match_id,user_id) references private.player_boards(match_id,user_id)
);
create table private.battle_rejections (
  match_id uuid not null, user_id uuid not null, cell integer not null check(cell between 0 and 80),
  cell_version integer not null check(cell_version>=0), created_at timestamptz not null default clock_timestamp(),
  primary key(match_id,user_id,cell,cell_version), foreign key(match_id,user_id) references private.player_boards(match_id,user_id)
);
alter table private.battle_puzzles enable row level security;
alter table private.battle_rejections enable row level security;
create policy server_only on private.battle_puzzles for all to anon,authenticated using(false) with check(false);
create policy server_only on private.battle_rejections for all to anon,authenticated using(false) with check(false);
revoke all on private.battle_puzzles,private.battle_rejections from public,anon,authenticated;
insert into private.battle_config(version,rules)
select 2,rules||'{"version":2,"puzzleAssignment":"independent-matched-v1","mistakePressure":{"threshold":3,"energyPerBreak":1,"maxRewardsPerRound":2,"recoveryMs":500,"rateWindowMs":1000,"maxActionsPerWindow":8}}'::jsonb
from private.battle_config where version=1;

create function private.puzzle_for(p_match uuid,p_user uuid) returns table(clues integer[],solution integer[])
language sql stable security definer set search_path='' as $$
  select coalesce(p.clues,m.clues),coalesce(p.solution,s.solution) from public.game_matches m
  join private.match_secrets s on s.match_id=m.id
  left join private.battle_puzzles p on p.match_id=m.id and p.user_id=p_user where m.id=p_match
$$;

create or replace function private.snapshot(p_room uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_base jsonb; v_match uuid; v_series uuid; v_clues integer[];
begin
  v_base:=private.classic_snapshot(p_room,p_user);
  v_match:=(v_base->'match'->>'id')::uuid; v_series:=(v_base->'match'->>'series_id')::uuid;
  if v_series is not null then
    select clues into v_clues from private.puzzle_for(v_match,p_user);
    v_base:=jsonb_set(v_base,'{match,clues}',to_jsonb(v_clues));
  end if;
  return v_base||jsonb_build_object('battle',case when v_series is not null then jsonb_build_object(
    'series',(select to_jsonb(s) from public.battle_series s where id=v_series),
    'score',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.battle_series_players p where series_id=v_series),
    'players',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.battle_players p where match_id=v_match),
    'effects',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.skill_effects e where e.match_id=v_match and e.consumed_at is null and e.expires_at>clock_timestamp() and v_base->'match'->>'status'='active'),
    'boards',(select coalesce(jsonb_agg(jsonb_build_object('user_id',b.user_id,'clues',p.clues,'version',b.version,
      'entries',(select jsonb_agg(case when f.region is not null and ((i-1)/27)*3+((i-1)%9)/3=f.region then null else b.entries[i] end order by i) from generate_series(1,81) i),
      'redacted_cells',(select coalesce(jsonb_agg(i-1 order by i),'[]') from generate_series(1,81) i where f.region is not null and ((i-1)/27)*3+((i-1)%9)/3=f.region)
    ) order by rp.seat),'[]') from private.player_boards b join public.room_players rp on rp.room_id=p_room and rp.user_id=b.user_id
      cross join lateral private.puzzle_for(b.match_id,b.user_id) p
      left join lateral(select e.region from public.skill_effects e where b.user_id<>p_user and e.match_id=v_match and e.target_id=b.user_id and e.skill='fog' and e.consumed_at is null and e.expires_at>clock_timestamp() and v_base->'match'->>'status'='active' limit 1) f on true
      where b.match_id=v_match)
  ) else null end,
  'events',(select coalesce(jsonb_agg(to_jsonb(e) order by sequence),'[]') from (select sequence,match_id,kind,created_at,payload from public.match_events where room_id=p_room order by sequence desc limit 64) e));
end $$;

create function private.battle_move(p_match uuid,p_user uuid,p_action uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.game_matches; b private.player_boards; state public.battle_players; puzzle record;
  v_cell integer; v_digit integer; v_now timestamptz:=clock_timestamp(); v_rules jsonb; v_result jsonb:='{}';
  v_genuine boolean:=false; v_break boolean:=false; v_generated integer:=0; v_stored integer:=0;
  v_target uuid; v_total integer; v_correct integer; v_pressure integer; v_mistakes integer; v_rewards integer;
begin
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('code','match_id','version','cell','digit')) then raise exception 'Only a cell, digit and confirmed board version may be submitted.'; end if;
  select * into m from public.game_matches where id=p_match for update;
  if m.mode<>'battle' or m.status<>'active' or v_now<m.started_at or v_now>=m.ends_at or m.id is distinct from (p_payload->>'match_id')::uuid then raise exception 'This round is not accepting moves.'; end if;
  select * into b from private.player_boards where match_id=m.id and user_id=p_user for update;
  if not found then raise exception 'Not a participant.' using errcode='42501'; end if;
  select * into state from public.battle_players where match_id=m.id and user_id=p_user for update;
  v_rules:=coalesce(m.battle_rules->'mistakePressure','{"threshold":3,"energyPerBreak":1,"maxRewardsPerRound":2,"recoveryMs":500,"rateWindowMs":1000,"maxActionsPerWindow":8}'::jsonb);
  if (select count(*) from private.match_moves where actor_id=p_user and created_at>v_now-make_interval(secs=>(v_rules->>'rateWindowMs')::double precision/1000)) >= (v_rules->>'maxActionsPerWindow')::integer then raise exception 'Action rate limit reached. Slow down before entering another number.'; end if;
  if state.input_recovery_until>v_now then raise exception 'Input is recovering from an incorrect number. Please wait.'; end if;
  if exists(select 1 from public.skill_effects where match_id=m.id and target_id=p_user and skill='freeze' and consumed_at is null and expires_at>v_now) then raise exception 'Frozen: number entry is temporarily locked by the server.'; end if;
  if b.version is distinct from (p_payload->>'version')::integer then raise exception 'Your board changed. Resynchronize before entering a number.' using errcode='40001'; end if;
  v_cell:=(p_payload->>'cell')::integer; v_digit:=(p_payload->>'digit')::integer;
  if v_cell is null or v_cell not between 0 and 80 or v_digit is null or v_digit not between 0 and 9 then raise exception 'Invalid cell or number.'; end if;
  select * into puzzle from private.puzzle_for(m.id,p_user);
  if puzzle.clues[v_cell+1]<>0 or b.entries[v_cell+1]=v_digit then
    v_result:=jsonb_build_object('ignored',true);
  elsif v_digit<>0 and v_digit<>puzzle.solution[v_cell+1] then
    insert into private.battle_rejections(match_id,user_id,cell,cell_version) values(m.id,p_user,v_cell,b.cell_versions[v_cell+1]) on conflict do nothing;
    v_genuine:=found;
    update public.battle_players set input_recovery_until=v_now+make_interval(secs=>(v_rules->>'recoveryMs')::double precision/1000) where match_id=m.id and user_id=p_user;
    if v_genuine then
      v_pressure:=(state.mistake_pressure+1) % (v_rules->>'threshold')::integer;
      v_break:=v_pressure=0;
      v_mistakes:=state.genuine_mistakes+1; v_rewards:=state.pressure_rewards;
      select user_id into v_target from public.match_players where match_id=m.id and user_id<>p_user;
      if v_break and v_rewards<(v_rules->>'maxRewardsPerRound')::integer then
        v_generated:=(v_rules->>'energyPerBreak')::integer; v_rewards:=v_rewards+1;
        select least(v_generated,greatest(0,(m.battle_rules->>'maxEnergy')::integer-energy)) into v_stored from public.battle_players where match_id=m.id and user_id=v_target for update;
        update public.battle_players set energy=energy+v_stored,energy_generated=energy_generated+v_generated,energy_stored=energy_stored+v_stored,
          pressure_energy_received=pressure_energy_received+v_stored,version=version+1 where match_id=m.id and user_id=v_target;
      end if;
      update public.battle_players set mistake_pressure=v_pressure,genuine_mistakes=v_mistakes,pressure_rewards=v_rewards,version=version+1 where match_id=m.id and user_id=p_user;
      update public.match_players set mistakes=mistakes+1 where match_id=m.id and user_id=p_user;
      insert into public.match_events(room_id,match_id,kind,payload) values(m.room_id,m.id,'mistake_pressure',jsonb_build_object(
        'actor_id',p_user,'target_id',v_target,'pressure',v_pressure,'genuine_mistakes',v_mistakes,'break',v_break,'generated',v_generated,'stored',v_stored,'rewards_used',v_rewards,'action_id',p_action));
    end if;
    v_result:=jsonb_build_object('rejected',true,'counted',v_genuine,'message',case when v_genuine then 'Incorrect number. Recovering for 0.5 seconds.' else 'This unchanged cell already counted a mistake. No extra pressure or reward.' end);
  else
    b.entries[v_cell+1]:=v_digit; b.cell_versions[v_cell+1]:=b.cell_versions[v_cell+1]+1;
    update private.player_boards set entries=b.entries,cell_versions=b.cell_versions,version=version+1 where match_id=m.id and user_id=p_user;
    select count(*) filter(where b.entries[i]=puzzle.solution[i]),count(*) into v_correct,v_total from generate_series(1,81) i where puzzle.clues[i]=0;
    update public.match_players set correct_cells=v_correct where match_id=m.id and user_id=p_user;
    insert into public.match_events(room_id,match_id,kind,payload) values(m.room_id,m.id,'battle_move',jsonb_build_object('actor_id',p_user,'cell',v_cell,'board_version',b.version+1,'erased',v_digit=0));
    if v_digit>0 then perform private.reward_units(m.id,p_user); end if;
    if v_correct=v_total then
      update public.match_players set completed_at=clock_timestamp() where match_id=m.id and user_id=p_user;
      perform private.finish(m.id,p_user,'solved');
    end if;
  end if;
  insert into private.match_moves(match_id,actor_id,action_id,cell,digit,accepted,genuine_mistake,created_at)
    values(m.id,p_user,p_action,v_cell,v_digit,not coalesce((v_result->>'rejected')::boolean,false) and not coalesce((v_result->>'ignored')::boolean,false),v_genuine,v_now);
  v_result:=v_result||jsonb_build_object('id',p_action,'cell',v_cell);
  insert into private.action_receipts(actor_id,action_id,command,room_id,result) values(p_user,p_action,'move',m.room_id,v_result);
  return private.snapshot(m.room_id,p_user)||jsonb_build_object('action',v_result);
end $$;

create function private.start_battle(p_room uuid,p_actor uuid,p_action uuid,p_puzzles jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; v_match uuid; item jsonb; v_clues integer[]; v_solution integer[]; v_seat integer:=0; v_user uuid; v_counts integer[]:='{}';
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.mode<>'battle' then raise exception 'Battle room required.'; end if;
  select (result->>'match_id')::uuid into v_match from private.action_receipts where actor_id=p_actor and action_id=p_action and command='start';
  if found then return v_match; end if;
  if jsonb_typeof(p_puzzles)<>'array' or jsonb_array_length(p_puzzles)<>2 or p_puzzles->0->'solution'=p_puzzles->1->'solution' then raise exception 'Two distinct matched puzzles are required.'; end if;
  for item in select value from jsonb_array_elements(p_puzzles) loop
    v_seat:=v_seat+1;
    select array_agg(value::integer order by ordinality) into v_clues from jsonb_array_elements_text(item->'clues') with ordinality;
    select array_agg(value::integer order by ordinality) into v_solution from jsonb_array_elements_text(item->'solution') with ordinality;
    if cardinality(v_clues)<>81 or cardinality(v_solution)<>81 or exists(select 1 from unnest(v_clues) n where n is null or n not between 0 and 9) or exists(select 1 from unnest(v_solution) n where n is null or n not between 1 and 9) then raise exception 'Invalid generated puzzle.'; end if;
    if exists(select 1 from generate_series(1,81) i where v_clues[i]<>0 and v_clues[i]<>v_solution[i]) or exists(select 1 from generate_series(0,8) u where
      (select count(distinct v_solution[i]) from generate_series(1,81) i where (i-1)/9=u)<>9 or
      (select count(distinct v_solution[i]) from generate_series(1,81) i where (i-1)%9=u)<>9 or
      (select count(distinct v_solution[i]) from generate_series(1,81) i where ((i-1)/27)*3+((i-1)%9)/3=u)<>9) then raise exception 'Invalid generated solution.'; end if;
    v_counts:=v_counts||(select count(*)::integer from unnest(v_clues) n where n=0);
    if v_seat=1 then v_match:=private.start_match(p_room,p_actor,p_action,v_clues,v_solution); end if;
    select user_id into v_user from public.room_players where room_id=p_room and seat=v_seat;
    insert into private.battle_puzzles(match_id,user_id,clues,solution) values(v_match,v_user,v_clues,v_solution);
    update private.player_boards set entries=v_clues where match_id=v_match and user_id=v_user;
  end loop;
  if abs(v_counts[1]-v_counts[2])>2 then raise exception 'Battle puzzles must have comparable clue counts.'; end if;
  return v_match;
end $$;

create function public.suduel_start_battle(p_room uuid,p_actor uuid,p_action uuid,p_puzzles jsonb) returns uuid
language sql security invoker set search_path='' as $$select private.start_battle(p_room,p_actor,p_action,p_puzzles)$$;
revoke all on function public.suduel_start_battle(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.suduel_start_battle(uuid,uuid,uuid,jsonb) to service_role;
revoke all on function private.puzzle_for(uuid,uuid),private.battle_move(uuid,uuid,uuid,jsonb),private.start_battle(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.start_battle(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.suduel_start(p_room uuid,p_actor uuid,p_action uuid,p_clues integer[],p_solution integer[]) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.game_rooms where id=p_room and mode='battle') then raise exception 'Battle requires two independently generated puzzles.'; end if;
  return private.start_match(p_room,p_actor,p_action,p_clues,p_solution);
end $$;

create or replace function private.reward_units(p_match uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.game_matches; b private.player_boards; v_solution integer[]; v_kind text; v_unit integer; v_indices integer[];
  v_units jsonb:='[]'; v_reward integer; v_generated integer:=0; v_before integer; v_stored integer; v_clues integer[];
begin
  select * into m from public.game_matches where id=p_match;
  select * into b from private.player_boards where match_id=p_match and user_id=p_user;
  select clues,solution into v_clues,v_solution from private.puzzle_for(p_match,p_user);
  foreach v_kind in array array['row','column','box'] loop
    for v_unit in 0..8 loop
      select array_agg(i) into v_indices from generate_series(1,81) i where
        case v_kind when 'row' then (i-1)/9=v_unit when 'column' then (i-1)%9=v_unit else ((i-1)/27)*3+((i-1)%9)/3=v_unit end;
      if not exists(select 1 from unnest(v_indices) i where v_clues[i]=0) then continue; end if;
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

create or replace function private.command(p_command text,p_payload jsonb,p_action_id uuid) returns jsonb
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
  if p_command in ('rematch_request','rematch_accept','rematch_decline') and exists(select 1 from public.battle_series where id=m.series_id and status='active') then raise exception 'Finish the current series before requesting a rematch.'; end if;
  if p_command in ('forfeit','leave') and m.mode='battle' and m.status='finished' and exists(select 1 from public.battle_series where id=m.series_id and status='active') then
    if p_command='forfeit' and m.id is distinct from (p_payload->>'match_id')::uuid then raise exception 'This match is no longer current.'; end if;
    select user_id into v_target from public.match_players where match_id=m.id and user_id<>v_user;
    perform private.finish(m.id,v_target,'forfeit');
    if p_command='forfeit' then
      insert into private.action_receipts(actor_id,action_id,command,room_id) values(v_user,p_action_id,p_command,r.id);
      return private.snapshot(r.id,v_user);
    end if;
  end if;
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
  if p_command='move' and m.mode='battle' then return private.battle_move(m.id,v_user,p_action_id,p_payload); end if;
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
