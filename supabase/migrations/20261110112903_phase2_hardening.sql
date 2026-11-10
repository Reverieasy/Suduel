create index receipts_room on private.action_receipts(room_id);
create index boards_user on private.player_boards(user_id);
create index matches_winner on public.game_matches(winner_id);
create index rooms_current_match on public.game_rooms(current_match_id);
create index events_match on public.match_events(match_id);

create function private.touch_profile() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end $$;
revoke all on function private.touch_profile() from public,anon,authenticated;
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_profile();

-- Explicit deny policies document that these are server-only, not forgotten RLS.
create policy server_only on private.match_secrets for all to anon,authenticated using(false) with check(false);
create policy server_only on private.player_boards for all to anon,authenticated using(false) with check(false);
create policy server_only on private.action_receipts for all to anon,authenticated using(false) with check(false);
create policy server_only on private.match_moves for all to anon,authenticated using(false) with check(false);
