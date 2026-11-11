-- Battle writes the final round before closing its series. Process ranked results on series closure.
create or replace function private.finalize_ranked_result(p_room uuid,p_winner uuid,p_completed timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare r public.ranked_matches; one_rating integer; two_rating integer; score numeric; expected numeric; delta integer;
begin
  select * into r from public.ranked_matches where room_id=p_room and status='active' for update;
  if not found then return; end if;
  select rating into one_rating from public.player_ratings where user_id=r.player_one for update;
  select rating into two_rating from public.player_ratings where user_id=r.player_two for update;
  score:=case when p_winner is null then .5 when p_winner=r.player_one then 1 else 0 end;
  expected:=1/(1+power(10,(two_rating-one_rating)/400.0)); delta:=round(32*(score-expected));
  update public.player_ratings set rating=greatest(0,rating+delta),rank_tier=private.rank_tier(greatest(0,rating+delta)),ranked_matches=ranked_matches+1,current_streak=case when p_winner=user_id then current_streak+1 else 0 end,best_streak=greatest(best_streak,case when p_winner=user_id then current_streak+1 else 0 end),updated_at=now() where user_id=r.player_one;
  update public.player_ratings set rating=greatest(0,rating-delta),rank_tier=private.rank_tier(greatest(0,rating-delta)),ranked_matches=ranked_matches+1,current_streak=case when p_winner=user_id then current_streak+1 else 0 end,best_streak=greatest(best_streak,case when p_winner=user_id then current_streak+1 else 0 end),updated_at=now() where user_id=r.player_two;
  update public.ranked_matches set status='finished',winner_id=p_winner,draw=p_winner is null,player_one_delta=delta,player_two_delta=-delta,completed_at=coalesce(p_completed,now()) where id=r.id and status='active';
  update public.ranked_queue set status='cancelled' where user_id in(r.player_one,r.player_two) and status<>'queued';
end $$;

create or replace function private.process_ranked_result() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status='finished' or new.status<>'finished' then return new; end if;
  if new.series_id is not null then return new; end if;
  perform private.finalize_ranked_result(new.room_id,new.winner_id,new.completed_at);
  return new;
end $$;

create or replace function private.process_ranked_series_result() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status='finished' or new.status<>'finished' then return new; end if;
  perform private.finalize_ranked_result(new.room_id,new.winner_id,new.completed_at);
  return new;
end $$;
drop trigger if exists on_ranked_series_finished on public.battle_series;
create trigger on_ranked_series_finished after update of status on public.battle_series for each row when(old.status is distinct from new.status) execute function private.process_ranked_series_result();
