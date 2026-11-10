-- Solver-assessed public metadata contains no solution or solving trace.
alter table private.battle_puzzles add column difficulty_estimate jsonb not null default '{}'::jsonb check(jsonb_typeof(difficulty_estimate)='object');
insert into private.battle_config(version,rules) select 4,rules||'{"version":4,"puzzleAssignment":"independent-solver-matched-v1"}'::jsonb from private.battle_config where version=3;

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
      'entries',(select jsonb_agg(case when f.region is not null and ((i-1)/27)*3+((i-1)%9)/3=f.region then null else b.entries[i] end order by i) from generate_series(1,81) i),
      'redacted_cells',(select coalesce(jsonb_agg(i-1 order by i),'[]') from generate_series(1,81) i where f.region is not null and ((i-1)/27)*3+((i-1)%9)/3=f.region)
    ) order by rp.seat),'[]') from private.player_boards b join public.room_players rp on rp.room_id=p_room and rp.user_id=b.user_id
      cross join lateral private.puzzle_for(b.match_id,b.user_id) p
      left join lateral(select e.region from public.skill_effects e where b.user_id<>p_user and e.match_id=v_match and e.target_id=b.user_id and e.skill='fog' and e.consumed_at is null and e.expires_at>clock_timestamp() and v_base->'match'->>'status'='active' limit 1) f on true
      where b.match_id=v_match)
  ) else null end,
  'events',(select coalesce(jsonb_agg(to_jsonb(e) order by sequence),'[]') from (select sequence,match_id,kind,created_at,payload from public.match_events where room_id=p_room order by sequence desc limit 64) e));
end $$;

create or replace function private.start_battle(p_room uuid,p_actor uuid,p_action uuid,p_puzzles jsonb) returns uuid
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
    insert into private.battle_puzzles(match_id,user_id,clues,solution,difficulty_estimate) values(v_match,v_user,v_clues,v_solution,coalesce(item->'estimate','{}'::jsonb));
    update private.player_boards set entries=v_clues where match_id=v_match and user_id=v_user;
  end loop;
  if abs(v_counts[1]-v_counts[2])>2 then raise exception 'Battle puzzles must have comparable clue counts.'; end if;

  if p_puzzles->0 ? 'estimate' and p_puzzles->1 ? 'estimate' then
    if p_puzzles->0->'estimate'->>'method'<>'solver-work-v1' or p_puzzles->1->'estimate'->>'method'<>'solver-work-v1'
      or (((p_puzzles->0->'estimate'->>'guesses')::integer>0) is distinct from ((p_puzzles->1->'estimate'->>'guesses')::integer>0))
      or abs((p_puzzles->0->'estimate'->>'score')::numeric-(p_puzzles->1->'estimate'->>'score')::numeric)>greatest(6,least((p_puzzles->0->'estimate'->>'score')::numeric,(p_puzzles->1->'estimate'->>'score')::numeric)*.2) then raise exception 'Solver estimates do not match.'; end if;
    if exists(select 1 from jsonb_array_elements(p_puzzles) p cross join lateral jsonb_object_keys(p->'estimate') k where k not in ('method','score','editableCells','nakedSingles','hiddenSingles','searchNodes','guesses','backtracks','maxGuessDepth')) then raise exception 'Only aggregate difficulty estimates may be shared.'; end if;
  end if;
  return v_match;
end $$;

create or replace function public.suduel_start_battle(p_room uuid,p_actor uuid,p_action uuid,p_puzzles jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
  if coalesce(p_puzzles->0->'estimate'->>'method','')<>'solver-work-v1' or coalesce(p_puzzles->1->'estimate'->>'method','')<>'solver-work-v1' then raise exception 'Server-generated solver estimates are required.'; end if;
  return private.start_battle(p_room,p_actor,p_action,p_puzzles);
end $$;
