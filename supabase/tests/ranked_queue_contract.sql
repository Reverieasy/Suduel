-- Database-role regression only. No real signups, credentials, queued players or
-- persistent test data are changed; all synthetic records roll back.
begin;
set local plpgsql.check_asserts=on;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); r jsonb; v_code text;
  v_room uuid; v_match uuid; v_rating integer; blocked boolean;
  sol_a integer[]; sol_b integer[]; clues_a integer[]; clues_b integer[];
begin
  insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values
    (a,jsonb_build_object('username','qa_'||substr(replace(a::text,'-',''),1,12)),now()),
    (b,jsonb_build_object('username','qa_'||substr(replace(b::text,'-',''),1,12)),now());
  -- Keep test matchmaking outside every real player's current rating window.
  select greatest(coalesce((select max(rating) from public.player_ratings),0),coalesce((select max(rating) from public.ranked_queue),0))
    +coalesce((select greatest(max(search_window),100) from public.ranked_queue),100)+10000 into v_rating;
  update public.player_ratings set rating=v_rating where user_id in(a,b);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',a::text,true);
  r:=public.enter_ranked_queue();
  assert r->>'status'='queued','First player did not enter queue';
  r:=public.enter_ranked_queue();
  assert r->>'status'='queued','Repeated first-player request changed queue state';
  perform set_config('request.jwt.claim.sub',b::text,true);
  r:=public.enter_ranked_queue();
  assert r->>'status'='matched','Second player did not match';
  v_code:=r->>'room_code';
  assert v_code ~ '^[A-F0-9]{8}$','Ranked room code is invalid';
  r:=public.ranked_queue_status();
  assert r->>'status'='matched' and r->>'room_code'=v_code,'Second player lost matched state';
  r:=public.enter_ranked_queue();
  assert r->>'status'='matched' and r->>'room_code'=v_code,'Second-player retry created another match';
  perform set_config('request.jwt.claim.sub',a::text,true);
  r:=public.ranked_queue_status();
  assert r->>'status'='matched' and r->>'room_code'=v_code,'First player did not see the same match';
  r:=public.enter_ranked_queue();
  assert r->>'status'='matched' and r->>'room_code'=v_code,'First-player retry created another match';
  blocked:=false;
  begin update public.ranked_queue set status='matched' where user_id=a;
  exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Browser could directly mutate queue state';
  execute 'reset role';
  select id into v_room from public.game_rooms where public.game_rooms.code=v_code;
  assert (select count(*)=2 and bool_and(status='matched') from public.ranked_queue where user_id in(a,b)),'Both matched queue rows were not persisted';
  assert (select ranked and mode='battle' and host_id=b from public.game_rooms where id=v_room),'Ranked Battle room not created';
  assert (select count(*)=2 and bool_and(ready) from public.room_players where room_id=v_room),'Both ranked players were not seated and ready';
  assert (select count(*)=1 from public.ranked_matches where player_one in(a,b) or player_two in(a,b)),'Duplicate ranked match created';
  assert (select status='queued' and room_id=v_room from public.ranked_matches where player_one=b and player_two=a),'Pre-start ranked status was not queued';
  assert (select bool_and(rating=v_rating and ranked_matches=0) from public.player_ratings where user_id in(a,b)),'Queueing changed ranked ratings';
  -- The lobby's automatic start must be able to activate the queued match.
  select array_agg(((i/9)*3+(i/9)/3+i%9)%9+1 order by i) into sol_a from generate_series(0,80) i;
  select array_agg(d.n%9+1 order by d.i) into sol_b from unnest(sol_a) with ordinality d(n,i);
  clues_a:=sol_a; clues_b:=sol_b; clues_a[1]:=0; clues_b[1]:=0;
  v_match:=private.start_battle(v_room,b,gen_random_uuid(),jsonb_build_array(jsonb_build_object('clues',clues_a,'solution',sol_a),jsonb_build_object('clues',clues_b,'solution',sol_b)));
  assert (select status='active' and game_match_id=v_match from public.ranked_matches where room_id=v_room),'Ranked match did not activate when Battle started';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',b::text,true);
  r:=public.ranked_queue_status();
  assert r->>'status'='matched' and r->>'room_code'=v_code,'Active ranked room was not recoverable';
  blocked:=false;
  begin perform public.enter_ranked_queue(); exception when others then blocked:=position('Finish your current ranked match' in sqlerrm)>0; end;
  assert blocked,'An active player could queue into another ranked match';
  execute 'reset role';
  assert not has_function_privilege('anon','public.enter_ranked_queue()','EXECUTE'),'Anonymous ranked entry enabled';
  assert has_function_privilege('authenticated','public.enter_ranked_queue()','EXECUTE'),'Authenticated ranked entry disabled';
  raise notice 'Ranked two-player queue contract passed.';
end $$;
rollback;
