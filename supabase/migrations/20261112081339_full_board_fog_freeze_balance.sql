-- Versioned balance for new Battle series. Existing series retain saved rules.
insert into private.battle_config(version,rules)
select 6,jsonb_set(rules||'{"version":6,"fogScope":"board"}'::jsonb,'{skills,freeze,durationMs}','3500')
from private.battle_config where version=5;

-- A null Fog region means the entire board. A present lateral row distinguishes
-- full-board Fog from no active Fog; old numbered box regions remain supported.
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
    'boards',(select coalesce(jsonb_agg(jsonb_build_object('user_id',b.user_id,'clues',p.clues,'version',b.version,'difficulty_estimate',(select bp.difficulty_estimate from private.battle_puzzles bp where bp.match_id=b.match_id and bp.user_id=b.user_id),
      'entries',(select jsonb_agg(case when f.present and (f.region is null or ((i-1)/27)*3+((i-1)%9)/3=f.region) then null else b.entries[i] end order by i) from generate_series(1,81) i),
      'redacted_cells',(select coalesce(jsonb_agg(i-1 order by i),'[]') from generate_series(1,81) i where f.present and (f.region is null or ((i-1)/27)*3+((i-1)%9)/3=f.region))
    ) order by rp.seat),'[]') from private.player_boards b join public.room_players rp on rp.room_id=p_room and rp.user_id=b.user_id
      cross join lateral private.puzzle_for(b.match_id,b.user_id) p
      left join lateral(select e.region,true as present from public.skill_effects e where b.user_id<>p_user and e.match_id=v_match and e.target_id=b.user_id and e.skill='fog' and e.consumed_at is null and e.expires_at>clock_timestamp() and v_base->'match'->>'status'='active' limit 1) f on true
      where b.match_id=v_match)
  ) else null end,
  'events',(select coalesce(jsonb_agg(to_jsonb(e) order by sequence),'[]') from (select sequence,match_id,kind,created_at,payload from public.match_events where room_id=p_room order by sequence desc limit 64) e));
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
      if v_skill='fog' then
        if m.battle_rules->>'fogScope'='board' then v_region:=null; else v_region:=floor(random()*9); end if;
      end if;
      if v_skill='scramble' then
        v_keypad:=private.scramble_digits();
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
