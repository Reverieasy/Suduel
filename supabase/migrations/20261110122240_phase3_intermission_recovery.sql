-- Keep active Battle series authoritative between rounds as well as during play.
create or replace function private.finish(p_match uuid,p_winner uuid,p_outcome text) returns void language plpgsql security definer set search_path='' as $$
declare m public.game_matches; s public.battle_series; p record; v_series_winner uuid; v_terminal boolean; v_seconds bigint;
begin
  select * into m from public.game_matches where id=p_match for update;
  if m.mode='classic' then perform private.classic_finish(p_match,p_winner,p_outcome); return; end if;
  if m.status<>'active' and not (p_outcome in ('forfeit','disconnect','abandoned') and exists(select 1 from public.battle_series where id=m.series_id and status='active')) then return; end if;
  select * into s from public.battle_series where id=m.series_id for update;
  update public.game_matches set status='finished',winner_id=p_winner,outcome=p_outcome,completed_at=clock_timestamp() where id=p_match and status='active';
  update public.game_rooms set status='finished' where id=m.room_id;
  update public.skill_effects set consumed_at=clock_timestamp() where match_id=p_match and consumed_at is null;
  if m.status='active' and p_winner is not null and p_outcome in ('solved','timeout') then
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
  insert into public.match_events(room_id,match_id,kind,payload) values(m.room_id,m.id,case when m.status='active' then 'round_finished' else 'series_finished' end,jsonb_build_object('winner_id',p_winner,'series_finished',v_terminal,'outcome',p_outcome));
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

create or replace function private.advance(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_match public.game_matches; v_now timestamptz:=clock_timestamp(); v_winner uuid; v_offline integer;
begin
  select m.* into v_match from public.game_matches m join public.game_rooms r on r.current_match_id=m.id where r.id=p_room for update of m;
  if not found then return; end if;
  if v_match.status<>'active' then
    if v_match.mode='battle' and exists(select 1 from public.battle_series where id=v_match.series_id and status='active') then
      select count(*) into v_offline from public.room_players where room_id=p_room and last_seen<v_now-interval '45 seconds';
      if v_offline>0 then
        select user_id into v_winner from public.room_players where room_id=p_room and last_seen>=v_now-interval '45 seconds' limit 1;
        perform private.finish(v_match.id,v_winner,case when v_winner is null then 'abandoned' else 'disconnect' end);
      end if;
    end if;
    return;
  end if;
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

create or replace function private.tick() returns void language plpgsql security definer set search_path='' as $$
declare v_room record;
begin
  for v_room in select r.id from public.game_rooms r where r.status='playing' or (r.status='finished' and exists(select 1 from public.game_matches m join public.battle_series s on s.id=m.series_id where m.id=r.current_match_id and s.status='active')) order by r.id for update of r skip locked loop perform private.advance(v_room.id); end loop;
  update public.game_rooms set status='closed' where status='waiting' and expires_at<clock_timestamp();
  delete from private.action_receipts where created_at<now()-interval '7 days';
  delete from public.match_events where created_at<now()-interval '7 days';
end $$;
