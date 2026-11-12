-- Database contracts only: ephemeral identities, no emails or persisted test data.
begin;
set local plpgsql.check_asserts=on;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); room uuid; mid uuid; next_mid uuid; code text;
  s jsonb; t jsonb; action uuid; start_action uuid; sol_a integer[]; sol_b integer[]; clues_a integer[]; clues_b integer[]; v integer:=0;
  failed boolean; v_i integer; n integer; before_count integer; before_version integer; v_skill text; v_cost integer; v_map integer[]; pair jsonb; estimate jsonb:='{"method":"solver-work-v1","score":11,"editableCells":11,"nakedSingles":11,"hiddenSingles":0,"searchNodes":0,"guesses":0,"backtracks":0,"maxGuessDepth":0}';
begin
  insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values
    (a,jsonb_build_object('username','qa_'||substr(replace(a::text,'-',''),1,12)),now()),
    (b,jsonb_build_object('username','qa_'||substr(replace(b::text,'-',''),1,12)),now()),
    (outsider,jsonb_build_object('username','qa_'||substr(replace(outsider::text,'-',''),1,12)),now());
  select array_agg(((i/9)*3+(i/9)/3+i%9)%9+1 order by i) into sol_a from generate_series(0,80) i;
  select array_agg(x.n%9+1 order by x.ordinality) into sol_b from unnest(sol_a) with ordinality x(n,ordinality);
  clues_a:=sol_a; clues_b:=sol_b;
  for v_i in 1..9 loop clues_a[v_i]:=0; clues_b[v_i]:=0; end loop;
  clues_a[41]:=0; clues_a[81]:=0; clues_b[41]:=0; clues_b[81]:=0;
  perform set_config('request.jwt.claim.sub',a::text,true);
  s:=public.suduel_command('create','{"mode":"battle","difficulty":"easy","time_limit":300}',gen_random_uuid());
  room:=(s->'room'->>'id')::uuid; code:=s->'room'->>'code';
  perform public.suduel_command('ready',jsonb_build_object('code',code,'ready',true),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('join',jsonb_build_object('code',code),gen_random_uuid());
  perform public.suduel_command('ready',jsonb_build_object('code',code,'ready',true),gen_random_uuid());
  action:=gen_random_uuid(); start_action:=action;
  pair:=jsonb_build_array(jsonb_build_object('clues',clues_a,'solution',sol_a,'estimate',estimate),jsonb_build_object('clues',clues_b,'solution',sol_b,'estimate',estimate));
  failed:=false; begin perform public.suduel_start_battle(room,a,action,jsonb_set(pair,'{1,estimate,score}','999')); exception when others then failed:=true; end;
  assert failed and not exists(select 1 from public.game_matches where room_id=room),'Unmatched solver estimate started a round';
  failed:=false; begin perform public.suduel_start_battle(room,a,action,(pair #- '{0,estimate}')); exception when others then failed:=true; end;
  assert failed,'Missing solver estimate accepted';
  mid:=public.suduel_start_battle(room,a,action,pair);
  update public.game_matches set started_at=now()-interval '1 second',ends_at=now()+interval '5 minutes' where id=mid;
  assert (select count(*)=2 from private.battle_puzzles where match_id=mid),'Two independent puzzles not stored';
  s:=public.suduel_command('snapshot',jsonb_build_object('code',code));
  assert s->'match'->'clues'=to_jsonb(clues_b),'Guest received host clues';
  assert jsonb_array_length(s->'battle'->'boards')=2,'Both participant boards not returned';
  assert (s->'battle'->'boards'->0->'difficulty_estimate')=estimate and (s->'battle'->'boards'->1->'difficulty_estimate')=estimate,'Aggregate solver estimates not restored';
  assert not jsonb_path_exists(s,'$.**.solution'),'Solution leaked into snapshot';
  assert s->'battle'->'series'->'rules'->'mistakePressure'->>'recoveryMs'='500','Pressure rules not stored';
  assert (select sum(mistake_pressure)+sum(pressure_rewards)=0 from public.battle_players where match_id=mid),'Initial pressure state not zero';
  -- Correct digit for host must be rejected against guest's independent puzzle.
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',0,'cell',0,'digit',sol_a[1]),gen_random_uuid());
  assert s->'action'->>'counted'='true' and s->'action'->>'rejected'='true','Own puzzle solution not enforced';
  assert (select entries[1]=0 and version=0 from private.player_boards where match_id=mid and user_id=b),'Rejected value entered confirmed board';
  update public.battle_players set input_recovery_until=now()-interval '1 second' where match_id=mid and user_id=b;
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',0,'cell',0,'digit',sol_b[1]),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',a::text,true);
  s:=public.suduel_command('snapshot',jsonb_build_object('code',code));
  assert exists(select 1 from jsonb_array_elements(s->'battle'->'boards') x where x->>'user_id'=b::text and (x->'entries'->>0)::integer=sol_b[1]),'Confirmed rival digit not visible';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',1,'cell',0,'digit',0),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',a::text,true);
  s:=public.suduel_command('snapshot',jsonb_build_object('code',code));
  assert exists(select 1 from jsonb_array_elements(s->'battle'->'boards') x where x->>'user_id'=b::text and (x->'entries'->>0)::integer=0),'Rival erase not synchronized';
  update public.battle_players set energy=0 where match_id=mid and user_id=b;
  -- First genuine mistake: unchanged board + one receipt + 500ms server lock.
  action:=gen_random_uuid();
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',sol_a[1]%9+1),action);
  assert (select mistake_pressure=1 and genuine_mistakes=1 from public.battle_players where match_id=mid and user_id=a),'First pressure count incorrect';
  assert (select mistakes=1 from public.match_players where match_id=mid and user_id=a),'Match mistakes diverged';
  assert (select entries=clues_a and version=0 from private.player_boards where match_id=mid and user_id=a),'Incorrect placement altered board';
  assert (select input_recovery_until>clock_timestamp() and input_recovery_until<=clock_timestamp()+interval '500 milliseconds' from public.battle_players where match_id=mid and user_id=a),'500ms recovery missing';
  failed:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',1,'digit',sol_a[2]),gen_random_uuid()); exception when others then failed:=true; end;
  assert failed,'Recovery bypassed';
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',sol_a[1]%9+1),action);
  assert (select genuine_mistakes=1 from public.battle_players where match_id=mid and user_id=a),'Network retry counted twice';
  assert (select count(*)=1 from public.match_events where match_id=mid and kind='mistake_pressure' and payload->>'action_id'=action::text),'Duplicate pressure event';
  update public.battle_players set input_recovery_until=now()-interval '1 second' where match_id=mid and user_id=a;
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',(sol_a[1]+1)%9+1),gen_random_uuid());
  assert s->'action'->>'counted'='false','Different guesses against unchanged cell farmed pressure';
  update public.battle_players set input_recovery_until=now()-interval '1 second' where match_id=mid and user_id=a;
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',40,'digit',sol_a[41]),gen_random_uuid()); v:=v+1;
  update private.match_moves set created_at=now()-interval '2 seconds' where actor_id=a;
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',sol_a[1]%9+1),gen_random_uuid());
  assert s->'action'->>'counted'='false','Unrelated board change reset cell farming guard';
  -- Genuine mistakes on other cells produce exactly two bonus opportunities.
  for v_i in 1..8 loop
    update public.battle_players set input_recovery_until=now()-interval '1 second' where match_id=mid and user_id=a;
    update private.match_moves set created_at=now()-interval '2 seconds' where actor_id=a;
    if v_i=5 then update public.battle_players set energy=5 where match_id=mid and user_id=b; end if;
    if v_i=8 then update public.battle_players set energy=0 where match_id=mid and user_id=b; end if;
    s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',v_i,'digit',sol_a[v_i+1]%9+1),gen_random_uuid());
    if v_i=1 then assert (select mistake_pressure=2 from public.battle_players where match_id=mid and user_id=a),'Second pressure state incorrect'; end if;
    if v_i=2 then
      assert (select energy=1 and pressure_energy_received=1 from public.battle_players where match_id=mid and user_id=b),'Third mistake did not transfer one energy';
      assert (select mistake_pressure=0 and pressure_rewards=1 from public.battle_players where match_id=mid and user_id=a),'First break not recorded';
    end if;
    if v_i=5 then
      assert (select energy=5 and pressure_energy_received=1 from public.battle_players where match_id=mid and user_id=b),'Pressure exceeded energy capacity';
      assert exists(select 1 from jsonb_array_elements(s->'events') e where e->>'kind'='mistake_pressure' and e->'payload'->>'genuine_mistakes'='6' and e->'payload'->>'stored'='0'),'Capped bonus incorrectly announced as stored';
    end if;
    if v_i=8 then assert (select energy=0 from public.battle_players where match_id=mid and user_id=b),'Bonus limit bypassed after energy was spent'; end if;
  end loop;
  assert (select genuine_mistakes=9 and pressure_rewards=2 and mistake_pressure=0 from public.battle_players where match_id=mid and user_id=a),'Per-round bonus limit incorrect';
  assert (select count(*)=9 from private.battle_rejections where match_id=mid and user_id=a),'Cell rejection ledger incorrect';
  assert (select count(*)=9 from public.match_events where match_id=mid and kind='mistake_pressure' and payload->>'actor_id'=a::text),'Pressure events did not match genuine mistakes';
  -- Notes, no-ops, fixed clues and erasures are never pressure submissions.
  update public.battle_players set input_recovery_until=now()-interval '1 second' where match_id=mid and user_id=a;
  update private.match_moves set created_at=now()-interval '2 seconds' where actor_id=a;
  before_count:=9;
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',80,'digit',0),gen_random_uuid());
  assert s->'action'->>'ignored'='true','Empty-cell erase was not ignored';
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',10,'digit',2),gen_random_uuid());
  assert s->'action'->>'ignored'='true','Fixed-clue misclick not ignored';
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',40,'digit',0),gen_random_uuid()); v:=v+1;
  assert (select genuine_mistakes=before_count from public.battle_players where match_id=mid and user_id=a),'Erase or misclick increased pressure';
  failed:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',2,'notes',true),gen_random_uuid()); exception when others then failed:=true; end;
  assert failed,'Forged note action accepted';
  failed:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',2,'mistakes',3,'energy',5),gen_random_uuid()); exception when others then failed:=true; end;
  assert failed,'Client-submitted pressure/energy accepted';
  -- A confirmed change to this exact cell permits a future genuine error.
  update private.match_moves set created_at=now()-interval '2 seconds' where actor_id=a;
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',sol_a[1]),gen_random_uuid()); v:=v+1;
  perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',0),gen_random_uuid()); v:=v+1;
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',0,'digit',sol_a[1]%9+1),gen_random_uuid());
  assert s->'action'->>'counted'='true','Genuine error after an actual cell state change ignored';
  assert (select genuine_mistakes=10 from public.battle_players where match_id=mid and user_id=a),'Changed cell error not counted once';
  -- Server action budget applies across new UUIDs and no-op actions.
  update public.battle_players set input_recovery_until=now()-interval '1 second' where match_id=mid and user_id=a;
  update private.match_moves set created_at=now()-interval '2 seconds' where actor_id=a;
  for v_i in 1..8 loop perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',80,'digit',0),gen_random_uuid()); end loop;
  failed:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',v,'cell',80,'digit',sol_a[81]),gen_random_uuid()); exception when others then failed:=position('rate limit' in sqlerrm)>0; end;
  assert failed,'Server action rate limit not enforced';
  -- Fog hides remote values in the authoritative snapshot, not just CSS.
  update public.battle_players set energy=2,cooldown_until=null where match_id=mid and user_id=b;
  perform set_config('request.jwt.claim.sub',b::text,true);
  select version into before_version from public.battle_players where match_id=mid and user_id=b;
  s:=public.suduel_command('cast',jsonb_build_object('code',code,'match_id',mid,'skill','fog','battle_version',before_version),gen_random_uuid());
  assert exists(select 1 from jsonb_array_elements(s->'battle'->'boards') x where x->>'user_id'=a::text and jsonb_array_length(x->'redacted_cells')=81 and (select count(*) from jsonb_array_elements(x->'entries') e where e='null'::jsonb)=81),'Remote Fog entries not redacted';
  perform set_config('request.jwt.claim.sub',a::text,true);
  t:=public.suduel_command('snapshot',jsonb_build_object('code',code));
  assert t->'board'->'entries' is not null and not exists(select 1 from jsonb_array_elements(t->'board'->'entries') e where e='null'::jsonb),'Own confirmed board corrupted by Fog';
  assert not exists(select 1 from jsonb_array_elements(s->'events') e where e->'payload' ? 'digit' or e->'payload' ? 'solution' or e->'payload' ? 'entries'),'Hidden values leaked into shared event feed';
  perform set_config('request.jwt.claim.sub',b::text,true);
  update public.skill_effects set starts_at=clock_timestamp()-interval '6 seconds',expires_at=clock_timestamp()-interval '1 second' where match_id=mid and skill='fog';
  s:=public.suduel_command('snapshot',jsonb_build_object('code',code));
  assert exists(select 1 from jsonb_array_elements(s->'battle'->'boards') x where x->>'user_id'=a::text and jsonb_array_length(x->'redacted_cells')=0 and x->'entries'=(select to_jsonb(entries) from private.player_boards where match_id=mid and user_id=a)),'Fog expiry failed to restore confirmed remote entries';
  perform set_config('request.jwt.claim.sub',a::text,true);
  execute 'set local role authenticated';
  failed:=false; begin update public.battle_players set mistake_pressure=0,pressure_rewards=0,input_recovery_until=null where match_id=mid; exception when insufficient_privilege then failed:=true; end;
  assert failed,'Browser could reset pressure/recovery';
  failed:=false; begin perform count(*) from private.battle_puzzles; exception when insufficient_privilege then failed:=true; end;
  assert failed,'Private independent solutions readable';
  failed:=false; begin perform private.battle_move(mid,a,gen_random_uuid(),'{}'); exception when insufficient_privilege then failed:=true; end;
  assert failed,'Browser could bypass the guarded command';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  failed:=false; begin perform public.suduel_command('snapshot',jsonb_build_object('code',code)); exception when others then failed:=true; end;
  assert failed,'Outsider received board snapshots';
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',a::text,true);
  update private.match_moves set created_at=now()-interval '2 seconds' where actor_id=a;
  -- Start receipt must never overwrite boards on a duplicate request.
  assert private.start_battle(room,a,start_action,jsonb_build_array(jsonb_build_object('clues',clues_a,'solution',sol_a),jsonb_build_object('clues',clues_b,'solution',sol_b))) is not null,'Start retry failed';
  perform private.finish(mid,a,'solved');
  perform public.suduel_command('next_ready',jsonb_build_object('code',code,'match_id',mid),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('next_ready',jsonb_build_object('code',code,'match_id',mid),gen_random_uuid());
  next_mid:=private.start_battle(room,b,gen_random_uuid(),jsonb_build_array(jsonb_build_object('clues',clues_a,'solution',sol_a),jsonb_build_object('clues',clues_b,'solution',sol_b)));
  assert (select sum(genuine_mistakes)+sum(mistake_pressure)+sum(pressure_rewards)+sum(pressure_energy_received)=0 and max(energy)=0 from public.battle_players where match_id=next_mid),'Pressure or energy carried into a fresh round';
  assert (select count(*)=0 from private.battle_rejections where match_id=next_mid),'Rejection ledger carried across rounds';
  assert (select count(*)=2 from private.battle_puzzles where match_id=next_mid),'Next-round independent puzzles missing';
  update public.game_matches set started_at=now()-interval '1 second' where id=next_mid;
  perform set_config('request.jwt.claim.sub',a::text,true);
  s:=public.suduel_command('snapshot',jsonb_build_object('code',code));
  assert s->'battle'->'series'->'rules'->'skills'->'scramble'->>'cost'='4' and s->'battle'->'series'->'rules'->'skills'->'shield'->>'cost'='5','New skill costs not saved to series';
  for v_i in 1..100 loop
    v_map:=private.scramble_digits();
    assert cardinality(v_map)=9 and v_map @> array[1,2,3,4,5,6,7,8,9] and not exists(select 1 from unnest(v_map) with ordinality d(n,i) where d.n=d.i),'Board shuffle left digits unchanged';
  end loop;
  foreach v_skill in array array['fog','freeze','scramble','shield'] loop
    select (battle_rules->'skills'->v_skill->>'cost')::integer into v_cost from public.game_matches where id=next_mid;
    update public.battle_players set energy=v_cost-1,cooldown_until=null where match_id=next_mid and user_id=a;
    select version into before_version from public.battle_players where match_id=next_mid and user_id=a;
    failed:=false; begin perform public.suduel_command('cast',jsonb_build_object('code',code,'match_id',next_mid,'skill',v_skill,'battle_version',before_version),gen_random_uuid()); exception when others then failed:=position('Not enough energy' in sqlerrm)>0; end;
    assert failed,'Underfunded skill accepted';
    update public.battle_players set energy=5,cooldown_until=null where match_id=next_mid and user_id=a;
    select version into before_version from public.battle_players where match_id=next_mid and user_id=a;
    action:=gen_random_uuid();
    s:=public.suduel_command('cast',jsonb_build_object('code',code,'match_id',next_mid,'skill',v_skill,'battle_version',before_version),action);
    assert (select energy=5-v_cost from public.battle_players where match_id=next_mid and user_id=a),'Incorrect skill price charged';
    perform public.suduel_command('cast',jsonb_build_object('code',code,'match_id',next_mid,'skill',v_skill,'battle_version',before_version),action);
    assert (select energy=5-v_cost from public.battle_players where match_id=next_mid and user_id=a),'Skill retry charged twice';
    if v_skill='fog' then
      assert exists(select 1 from public.skill_effects where match_id=next_mid and skill='fog' and region is null),'Full-board Fog was assigned a box';
      assert exists(select 1 from jsonb_array_elements(s->'battle'->'boards') x where x->>'user_id'=b::text and jsonb_array_length(x->'redacted_cells')=81),'Caster could see Fogged rival cells';
    end if;
    if v_skill='freeze' then
      assert exists(select 1 from public.skill_effects e join public.battle_players bp on bp.match_id=e.match_id and bp.user_id=e.target_id where e.match_id=next_mid and e.skill='freeze' and e.expires_at-e.starts_at=interval '3.5 seconds' and bp.freeze_immunity_until-e.expires_at=interval '3 seconds'),'Freeze timing or immunity incorrect';
      perform set_config('request.jwt.claim.sub',b::text,true);
      failed:=false; begin perform public.suduel_command('move',jsonb_build_object('code',code,'match_id',next_mid,'version',0,'cell',0,'digit',sol_b[1]),gen_random_uuid()); exception when others then failed:=position('Frozen' in sqlerrm)>0; end;
      assert failed,'Freeze did not block server-side input';
      perform set_config('request.jwt.claim.sub',a::text,true);
    end if;
    if v_skill='scramble' then
      assert exists(select 1 from jsonb_array_elements(s->'battle'->'effects') e where e->>'skill'='scramble' and jsonb_array_length(e->'keypad')=9),'Digit shuffle mapping missing from snapshot';
      assert (select b.entries=bp.clues from private.player_boards b join private.battle_puzzles bp using(match_id,user_id) where b.match_id=next_mid and b.user_id<>a),'Scramble mutated confirmed rival cells';
    end if;
    assert exists(select 1 from public.skill_effects e join public.game_matches gm on gm.id=e.match_id where e.match_id=next_mid and e.skill=v_skill and extract(epoch from e.expires_at-e.starts_at)*1000=(gm.battle_rules->'skills'->v_skill->>'durationMs')::integer),'Configured effect duration not honored';
  end loop;
  assert s->'battle'->'series'->'rules'->'skills'->'fog'->>'durationMs'='5000'
    and s->'battle'->'series'->'rules'->'skills'->'freeze'->>'durationMs'='3500'
    and s->'battle'->'series'->'rules'->'skills'->'scramble'->>'durationMs'='8000'
    and s->'battle'->'series'->'rules'->'skills'->'shield'->>'durationMs'='20000','Longer timing rules not assigned to new series';
  -- Classic keeps its existing mistake count and never grants pressure energy.
  s:=public.suduel_command('create','{"mode":"classic","difficulty":"easy","time_limit":300}',gen_random_uuid());
  room:=(s->'room'->>'id')::uuid; code:=s->'room'->>'code';
  perform public.suduel_command('ready',jsonb_build_object('code',code,'ready',true),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('join',jsonb_build_object('code',code),gen_random_uuid());
  perform public.suduel_command('ready',jsonb_build_object('code',code,'ready',true),gen_random_uuid());
  mid:=public.suduel_start(room,a,gen_random_uuid(),clues_a,sol_a);
  update public.game_matches set started_at=now()-interval '1 second' where id=mid;
  s:=public.suduel_command('move',jsonb_build_object('code',code,'match_id',mid,'version',0,'cell',0,'digit',sol_a[1]%9+1),gen_random_uuid());
  assert (select mistakes=1 from public.match_players where match_id=mid and user_id=b),'Classic mistake validation regressed';
  assert (select count(*)=0 from public.battle_players where match_id=mid),'Classic created pressure/energy state';
  assert (select count(*)=0 from public.match_events where match_id=mid and kind='mistake_pressure'),'Classic awarded pressure energy';
  raise notice 'V3 pressure and dual-board database contracts passed.';
end $$;
rollback;
