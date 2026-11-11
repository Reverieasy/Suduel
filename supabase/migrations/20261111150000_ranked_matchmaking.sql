-- Ranked matchmaking layers on the existing server-authoritative Battle Mode.
alter table public.game_rooms add column if not exists ranked boolean not null default false;
alter table public.ranked_matches add column if not exists room_id uuid references public.game_rooms(id);
create unique index if not exists ranked_matches_room on public.ranked_matches(room_id) where room_id is not null;

create or replace function private.rank_tier(p_rating integer) returns text language sql immutable set search_path='' as $$
  select case when p_rating >= 1800 then 'Legend' when p_rating >= 1600 then 'Master' when p_rating >= 1400 then 'Diamond'
    when p_rating >= 1200 then 'Platinum' when p_rating >= 1050 then 'Gold' when p_rating >= 900 then 'Silver' else 'Bronze' end
$$;

create or replace function public.enter_ranked_queue() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.verified_actor(); v_rating integer; v_existing public.ranked_queue; v_opponent public.ranked_queue; v_room public.game_rooms; v_match public.ranked_matches; v_code text; v_other_rating integer;
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
  for v_code in select upper(encode(gen_random_bytes(4),'hex')) loop
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
  update public.ranked_queue set status='matched' where user_id in(v_user,v_opponent.user_id);
  return jsonb_build_object('status','matched','room_code',v_room.code,'rating',v_rating,'opponent_rating',v_other_rating);
end $$;

create or replace function public.cancel_ranked_queue() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.verified_actor(); begin update public.ranked_queue set status='cancelled' where user_id=v_user and status='queued'; return jsonb_build_object('status','cancelled'); end $$;
create or replace function public.ranked_queue_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.verified_actor(); v_queue public.ranked_queue; v_room public.game_rooms; v_rating integer;
begin
  select rating into v_rating from public.player_ratings where user_id=v_user; select * into v_queue from public.ranked_queue where user_id=v_user;
  if v_queue.status='matched' then select r.* into v_room from public.game_rooms r join public.ranked_matches m on m.room_id=r.id where (m.player_one=v_user or m.player_two=v_user) and m.status in('queued','active') order by m.created_at desc limit 1; end if;
  return jsonb_build_object('status',coalesce(v_queue.status,'idle'),'rating',v_rating,'room_code',v_room.code);
end $$;

create or replace function private.activate_ranked_match() returns trigger language plpgsql security definer set search_path='' as $$ begin update public.ranked_matches set game_match_id=new.id,status='active' where room_id=new.room_id and status='queued'; return new; end $$;
create or replace function private.process_ranked_result() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.ranked_matches; one_rating integer; two_rating integer; score numeric; expected numeric; delta integer; v_winner uuid;
begin
  if old.status='finished' or new.status<>'finished' then return new; end if;
  if new.series_id is not null and exists(select 1 from public.battle_series where id=new.series_id and status='active') then return new; end if;
  select * into r from public.ranked_matches where game_match_id=new.id or room_id=new.room_id order by created_at desc limit 1 for update; if not found or r.status<>'active' then return new; end if;
  v_winner:=new.winner_id;
  if new.series_id is not null then select winner_id into v_winner from public.battle_series where id=new.series_id and status='finished'; end if;
  select rating into one_rating from public.player_ratings where user_id=r.player_one for update; select rating into two_rating from public.player_ratings where user_id=r.player_two for update;
  score:=case when v_winner is null then .5 when v_winner=r.player_one then 1 else 0 end; expected:=1/(1+power(10,(two_rating-one_rating)/400.0)); delta:=round(32*(score-expected));
  update public.player_ratings set rating=greatest(0,rating+delta),rank_tier=private.rank_tier(greatest(0,rating+delta)),ranked_matches=ranked_matches+1,current_streak=case when v_winner=user_id then current_streak+1 else 0 end,best_streak=greatest(best_streak,case when v_winner=user_id then current_streak+1 else 0 end),updated_at=now() where user_id=r.player_one;
  update public.player_ratings set rating=greatest(0,rating-delta),rank_tier=private.rank_tier(greatest(0,rating-delta)),ranked_matches=ranked_matches+1,current_streak=case when v_winner=user_id then current_streak+1 else 0 end,best_streak=greatest(best_streak,case when v_winner=user_id then current_streak+1 else 0 end),updated_at=now() where user_id=r.player_two;
  update public.ranked_matches set status='finished',winner_id=v_winner,draw=v_winner is null,player_one_delta=delta,player_two_delta=-delta,completed_at=coalesce(new.completed_at,now()) where id=r.id and status='active';
  update public.ranked_queue set status='cancelled' where user_id in(r.player_one,r.player_two) and status<>'queued'; return new;
end $$;
drop trigger if exists on_ranked_match_created on public.game_matches;
create trigger on_ranked_match_created after insert on public.game_matches for each row execute function private.activate_ranked_match();
drop trigger if exists on_ranked_match_finished on public.game_matches;
create trigger on_ranked_match_finished after update of status on public.game_matches for each row when(old.status is distinct from new.status) execute function private.process_ranked_result();
revoke all on function public.enter_ranked_queue(),public.cancel_ranked_queue(),public.ranked_queue_status() from public,anon;
grant execute on function public.enter_ranked_queue(),public.cancel_ranked_queue(),public.ranked_queue_status() to authenticated;
