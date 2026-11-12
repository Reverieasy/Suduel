-- Matchmaking creates a queued ranked match before the Battle start trigger activates it.
alter table public.ranked_matches drop constraint ranked_matches_status_check;
alter table public.ranked_matches add constraint ranked_matches_status_check
  check(status in ('queued','active','finished','cancelled'));

-- Keep the empty search_path; explicitly resolve pgcrypto in its installed schema.
-- Persist both queue rows so the arriving player can recover/retry the same room.
create or replace function public.enter_ranked_queue() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.verified_actor(); v_rating integer; v_existing public.ranked_queue; v_opponent public.ranked_queue; v_room public.game_rooms; v_match public.ranked_matches; v_code text; v_other_rating integer; v_attempt integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('suduel-ranked-queue',0));
  select rating into v_rating from public.player_ratings where user_id=v_user for update;
  if v_rating is null then raise exception 'Ranked rating is not initialized.'; end if;
  if exists(select 1 from public.ranked_matches where (player_one=v_user or player_two=v_user) and status='active') then raise exception 'Finish your current ranked match before queuing again.'; end if;
  select * into v_existing from public.ranked_queue where user_id=v_user for update;
  if found and v_existing.status='matched' then
    select r.* into v_room from public.game_rooms r join public.ranked_matches m on m.room_id=r.id where (m.player_one=v_user or m.player_two=v_user) and m.status in ('queued','active') order by m.created_at desc limit 1;
    if v_room.id is not null then return jsonb_build_object('status','matched','room_code',v_room.code,'rating',v_rating); end if;
  elsif found and v_existing.status='queued' then
    update public.ranked_queue set rating=v_rating,search_window=100 where user_id=v_user;
    return jsonb_build_object('status','queued','rating',v_rating);
  end if;
  select q.* into v_opponent from public.ranked_queue q where q.status='queued' and q.user_id<>v_user and abs(q.rating-v_rating)<=greatest(q.search_window,100)
    and not exists(select 1 from public.ranked_matches m where (m.player_one=q.user_id or m.player_two=q.user_id) and m.status='active')
    order by abs(q.rating-v_rating),q.joined_at for update skip locked limit 1;
  if not found then
    insert into public.ranked_queue(user_id,rating,search_window,status) values(v_user,v_rating,100,'queued') on conflict(user_id) do update set rating=excluded.rating,joined_at=now(),search_window=100,status='queued';
    return jsonb_build_object('status','queued','rating',v_rating);
  end if;
  select rating into v_other_rating from public.player_ratings where user_id=v_opponent.user_id;
  for v_attempt in 1..8 loop
    v_code:=upper(encode(extensions.gen_random_bytes(4),'hex'));
    begin
      insert into public.game_rooms(code,host_id,difficulty,time_limit,mode,ranked) values(v_code,v_user,'medium',300,'battle',true) returning * into v_room;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  if v_room.id is null then raise exception 'Could not create a ranked room. Please retry.'; end if;
  insert into public.room_players(room_id,user_id,seat,ready) values(v_room.id,v_user,1,true),(v_room.id,v_opponent.user_id,2,true);
  insert into public.ranked_matches(room_id,season_id,player_one,player_two,status) select v_room.id,id,v_user,v_opponent.user_id,'queued' from public.competitive_seasons where status='active' order by starts_at desc limit 1 returning * into v_match;
  if v_match.id is null then raise exception 'No active competitive season.'; end if;
  insert into public.ranked_queue(user_id,rating,search_window,status) values(v_user,v_rating,100,'matched')
    on conflict(user_id) do update set rating=excluded.rating,joined_at=now(),search_window=100,status='matched';
  update public.ranked_queue set status='matched' where user_id=v_opponent.user_id;
  return jsonb_build_object('status','matched','room_code',v_room.code,'rating',v_rating,'opponent_rating',v_other_rating);
end $$;
