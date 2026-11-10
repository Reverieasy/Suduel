-- Database contract tests only: synthetic identities exist solely inside this
-- rolled-back transaction. This does not test signup, email delivery or real JWTs.
begin;
set local plpgsql.check_asserts = on;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  r jsonb; code text; room uuid; match uuid; again uuid; action uuid;
  solution integer[]; clues integer[]; snapshot jsonb; count_before integer;
  blocked boolean;
begin
  insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values
    (a,jsonb_build_object('username','qa_'||substr(replace(a::text,'-',''),1,12)),now()),
    (b,jsonb_build_object('username','qa_'||substr(replace(b::text,'-',''),1,12)),now()),
    (outsider,jsonb_build_object('username','qa_'||substr(replace(outsider::text,'-',''),1,12)),now());
  blocked:=false;
  begin
    insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values(gen_random_uuid(),jsonb_build_object('username',upper('qa_'||substr(replace(a::text,'-',''),1,12))),now());
  exception when unique_violation then blocked:=true; end;
  assert blocked,'Case-insensitive username uniqueness failed';
  perform set_config('request.jwt.claim.sub',a::text,true);
  action:=gen_random_uuid();
  r:=public.suduel_command('create','{"difficulty":"easy","time_limit":300}',action);
  code:=r->'room'->>'code'; room:=(r->'room'->>'id')::uuid;
  snapshot:=public.suduel_command('create','{"difficulty":"easy","time_limit":300}',action);
  assert snapshot->'room'->>'id'=room::text,'Repeated create made another room';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('join',jsonb_build_object('code',code),gen_random_uuid());
  perform public.suduel_command('join',jsonb_build_object('code',code),gen_random_uuid());
  assert (select count(*)=2 from public.room_players where room_id=room),'Duplicate join made another seat';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  blocked:=false; begin perform public.suduel_command('join',jsonb_build_object('code',code),gen_random_uuid()); exception when others then blocked:=true; end;
  assert blocked,'Full room accepted another player';
  blocked:=false; begin perform public.suduel_command('snapshot',jsonb_build_object('code',code)); exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Outsider could read a room snapshot';
  select array_agg(((i/9)*3+(i/9)/3+i%9)%9+1 order by i) into solution from generate_series(0,80) i;
  clues:=solution; clues[1]:=0; clues[2]:=0;
  blocked:=false; begin perform private.start_match(room,a,gen_random_uuid(),clues,solution); exception when others then blocked:=true; end;
  assert blocked,'Unready players could start';
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform public.suduel_command('ready',jsonb_build_object('code',code,'ready',true),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('ready',jsonb_build_object('code',code,'ready',true),gen_random_uuid());
  blocked:=false; begin perform private.start_match(room,b,gen_random_uuid(),clues,solution); exception when others then blocked:=true; end;
  assert blocked,'Nonhost could start';
  action:=gen_random_uuid(); match:=private.start_match(room,a,action,clues,solution);
  assert private.start_match(room,a,action,clues,solution)=match,'Duplicate start was not idempotent';
  blocked:=false; begin perform private.start_match(room,a,gen_random_uuid(),clues,solution); exception when others then blocked:=true; end;
  assert blocked,'Repeated start created simultaneous matches';
  update public.game_matches set started_at=now()-interval '1 second',ends_at=now()+interval '5 minutes' where id=match;
  perform set_config('request.jwt.claim.sub',a::text,true);
  action:=gen_random_uuid();
  r:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',0,'cell',0,'digit',solution[1]),action);
  r:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',0,'cell',0,'digit',solution[1]),action);
  assert (r->'board'->>'version')::integer=1,'Duplicate move advanced version';
  assert not (r ? 'solution') and not (r->'match' ? 'solution'),'Solution leaked';
  assert not exists(select 1 from jsonb_array_elements(r->'progress') p where p ? 'entries'),'Opponent entries leaked';
  blocked:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',0,'cell',1,'digit',solution[2]),gen_random_uuid()); exception when serialization_failure then blocked:=true; end;
  assert blocked,'Stale move accepted';
  action:=gen_random_uuid();
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',1,'cell',1,'digit',solution[2]%9+1),action);
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',1,'cell',1,'digit',solution[2]%9+1),action);
  assert (select mistakes=1 from public.match_players where match_id=match and user_id=a),'Duplicate wrong move counted twice';
  blocked:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',1,'cell',2,'digit',0),gen_random_uuid()); exception when others then blocked:=true; end;
  assert blocked,'Clue could be edited';
  blocked:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'cell',1,'digit',solution[2]),gen_random_uuid()); exception when serialization_failure then blocked:=true; end;
  assert blocked,'Missing board version accepted';
  -- Run actual grants and RLS as the browser database role.
  execute 'set local role authenticated';
  blocked:=false; begin perform s.solution from private.match_secrets s; exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Browser role could read private solutions';
  blocked:=false; begin update public.player_stats set wins=100 where user_id=a; exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Browser role could edit competitive stats';
  blocked:=false; begin perform public.suduel_start(room,a,gen_random_uuid(),clues,solution); exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Browser role could invoke service-only start';
  update public.profiles set display_name='Unauthorized' where id=b;
  get diagnostics count_before = row_count;
  assert count_before=0,'RLS allowed changing another profile';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  assert (select count(*)=0 from public.game_rooms where id=room),'Room RLS exposed a room to an outsider';
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',b::text,true);
  r:=public.suduel_command('snapshot',jsonb_build_object('code',code));
  assert (r->'board'->'entries'->>0)::integer=0,'Board snapshot returned opponent entries';
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',0,'cell',0,'digit',solution[1]),gen_random_uuid());
  r:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',match,'version',1,'cell',1,'digit',solution[2]),gen_random_uuid());
  assert r->'match'->>'winner_id'=b::text,'Server did not determine winner';
  assert (select wins=1 and total_matches=1 from public.player_stats where user_id=b),'Stats not finalized once';
  perform private.finish(match,a,'solved');
  assert (select wins=1 and total_matches=1 from public.player_stats where user_id=b),'Terminal result or stats changed';
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform public.suduel_command('rematch_request',jsonb_build_object('code',code,'match_id',match),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('rematch_accept',jsonb_build_object('code',code,'match_id',match),gen_random_uuid());
  again:=private.start_match(room,b,gen_random_uuid(),clues,solution);
  assert again<>match,'Rematch did not create a fresh match';
  assert (select count(*)=2 from public.game_matches where room_id=room),'Previous result lost';
  -- Expiration works without any browser clock or caller choosing the winner.
  update public.game_matches set started_at=now()-interval '10 minutes',ends_at=now()-interval '1 second' where id=again;
  perform private.advance(room);
  assert (select status='finished' and outcome='timeout' and winner_id is null from public.game_matches where id=again),'Timeout draw failed';
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform public.suduel_command('rematch_request',jsonb_build_object('code',code,'match_id',again),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('rematch_accept',jsonb_build_object('code',code,'match_id',again),gen_random_uuid());
  again:=private.start_match(room,b,gen_random_uuid(),clues,solution);
  update public.room_players set last_seen=now()-interval '20 seconds' where room_id=room and user_id=a;
  perform private.advance(room);
  assert (select status='active' from public.game_matches where id=again),'Temporary disconnect ended match early';
  update public.room_players set last_seen=now()-interval '46 seconds' where room_id=room and user_id=a;
  perform private.advance(room);
  assert (select winner_id=b and outcome='disconnect' from public.game_matches where id=again),'Disconnect grace was not enforced';
  raise notice 'SUDUEL database contract assertions passed (transaction rolled back).';
end $$;
rollback;
