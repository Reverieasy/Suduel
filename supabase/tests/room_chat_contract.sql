-- Database-role contracts only: all synthetic identities and messages roll back.
begin;
set local plpgsql.check_asserts=on;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  action uuid:=gen_random_uuid(); r jsonb; first_message jsonb; room uuid; code text; blocked boolean;
begin
  insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values
    (a,jsonb_build_object('username','qa_'||substr(replace(a::text,'-',''),1,12)),now()),
    (b,jsonb_build_object('username','qa_'||substr(replace(b::text,'-',''),1,12)),now()),
    (outsider,jsonb_build_object('username','qa_'||substr(replace(outsider::text,'-',''),1,12)),now());
  perform set_config('request.jwt.claim.sub',a::text,true);
  r:=public.suduel_command('create','{"difficulty":"easy","time_limit":300}',gen_random_uuid());
  room:=(r->'room'->>'id')::uuid;code:=r->'room'->>'code';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.suduel_command('join',jsonb_build_object('code',code),gen_random_uuid());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',a::text,true);
  first_message:=public.send_room_chat(room,'  Good luck!  ',action);
  assert first_message->>'body'='Good luck!' and first_message->>'user_id'=a::text,'Sender or body was not server-confirmed';
  assert not first_message ? 'client_id','Private retry token leaked';
  assert public.send_room_chat(room,'Good luck!',action)=first_message,'Retry created a duplicate';
  blocked:=false;begin perform public.send_room_chat(room,'Different body',action);exception when invalid_parameter_value then blocked:=true;end;
  assert blocked,'Retry token allowed different content';
  perform public.send_room_chat(room,'Second',gen_random_uuid());
  perform public.send_room_chat(room,'Third',gen_random_uuid());
  blocked:=false;begin perform public.send_room_chat(room,'Fourth',gen_random_uuid());exception when raise_exception then blocked:=position('wait a few seconds' in sqlerrm)>0;end;
  assert blocked,'Server rate limit was bypassed';
  assert public.send_room_chat(room,'Good luck!',action)=first_message,'Rate limit rejected a valid retry';
  blocked:=false;begin perform public.send_room_chat(room,repeat('a',301),gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;
  assert blocked,'Oversize message accepted';
  blocked:=false;begin perform public.send_room_chat(room,E' \t\n ',gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;
  assert blocked,'Whitespace-only message accepted';
  blocked:=false;begin insert into public.room_chat_messages(room_id,user_id,client_id,body) values(room,b,gen_random_uuid(),'Forged');exception when insufficient_privilege then blocked:=true;end;
  assert blocked,'Client could forge a message';
  blocked:=false;begin update public.room_chat_messages set body='Edited' where room_id=room;exception when insufficient_privilege then blocked:=true;end;
  assert blocked,'Client could edit confirmed history';
  perform set_config('request.jwt.claim.sub',b::text,true);
  assert (select count(*)=3 from public.room_chat_messages where room_id=room),'Opponent could not read messages';
  r:=public.send_room_chat(room,'<b>Plain text</b>',gen_random_uuid());
  assert r->>'user_id'=b::text,'Second sender identity incorrect';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  assert (select count(*)=0 from public.room_chat_messages where room_id=room),'Outsider read private chat';
  blocked:=false;begin perform public.send_room_chat(room,'Intruder',gen_random_uuid());exception when insufficient_privilege then blocked:=true;end;
  assert blocked,'Outsider sent a message';
  execute 'reset role';
  delete from public.room_players where room_id=room and user_id=b;
  execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',b::text,true);
  assert (select count(*)=0 from public.room_chat_messages where room_id=room),'Former member kept chat access';
  execute 'reset role';
  assert not has_function_privilege('anon','public.send_room_chat(uuid,text,uuid)','EXECUTE'),'Anonymous chat enabled';
  assert not has_table_privilege('anon','public.room_chat_messages','SELECT'),'Anonymous chat history enabled';
  assert exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='room_chat_messages'),'Authorized realtime not enabled';
  raise notice 'Room chat authority, history, retries and rate-limit contract passed.';
end $$;
rollback;
