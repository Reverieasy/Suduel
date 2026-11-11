-- SUDUEL Phase 4: progression, cosmetics, friends, community and notifications.
-- Competitive writes remain server-authoritative; exposed tables are read-only or owner-scoped.

create table public.competitive_seasons (
  id uuid primary key default gen_random_uuid(), name text not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming','active','finalized')),
  created_at timestamptz not null default now(), check (ends_at > starts_at)
);
create unique index competitive_seasons_active on public.competitive_seasons(status) where status='active';

create table public.player_ratings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  rating integer not null default 1000 check (rating >= 0), rank_tier text not null default 'Bronze',
  provisional_games integer not null default 0 check (provisional_games >= 0),
  current_streak integer not null default 0, best_streak integer not null default 0,
  ranked_matches integer not null default 0, updated_at timestamptz not null default now(),
  check (rank_tier in ('Bronze','Silver','Gold','Platinum','Diamond','Master','Legend'))
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  name text not null, description text not null, icon text not null default '✦',
  requirement jsonb not null default '{}'::jsonb, reward_item_id uuid, created_at timestamptz not null default now()
);
create table public.player_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  progress integer not null default 0, unlocked_at timestamptz, equipped boolean not null default false,
  primary key(user_id, achievement_id)
);

create table public.cosmetic_items (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  category text not null check (category in ('board_skin','title','avatar','profile_border','effect')),
  description text not null default '', preview jsonb not null default '{}'::jsonb,
  unlock_requirement jsonb not null default '{}'::jsonb, is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.player_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.cosmetic_items(id) on delete cascade,
  unlocked_at timestamptz not null default now(), source text not null default 'default',
  primary key(user_id,item_id)
);
create table public.player_equipped_cosmetics (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  board_skin_id uuid references public.cosmetic_items(id), title_id uuid references public.cosmetic_items(id),
  avatar_id uuid references public.cosmetic_items(id), profile_border_id uuid references public.cosmetic_items(id),
  effect_id uuid references public.cosmetic_items(id), updated_at timestamptz not null default now()
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(), responded_at timestamptz,
  check(sender_id<>recipient_id)
);
create unique index friend_requests_pending_unique on public.friend_requests(sender_id,recipient_id) where status='pending';
create table public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,friend_id), check(user_id<>friend_id)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check(kind in ('text','match_highlight','achievement','rank_promotion')),
  body text not null check(length(body) between 1 and 500), match_id uuid references public.game_matches(id),
  achievement_id uuid references public.achievements(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create index community_posts_recent on public.community_posts(created_at desc) where deleted_at is null;
create table public.post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table public.post_comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(body) between 1 and 300), created_at timestamptz not null default now(), deleted_at timestamptz
);
create index post_comments_post on public.post_comments(post_id,created_at);
create table public.content_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id),
  post_id uuid references public.community_posts(id) on delete cascade, comment_id uuid references public.post_comments(id) on delete cascade,
  reported_user_id uuid references public.profiles(id), reason text not null check(length(reason) between 1 and 300),
  status text not null default 'pending' check(status in ('pending','reviewed','resolved')), created_at timestamptz not null default now(),
  check(num_nonnulls(post_id,comment_id,reported_user_id)=1)
);
create table public.player_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, title text not null, body text not null, action_url text, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_recent on public.player_notifications(user_id,created_at desc);

create table public.ranked_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  rating integer not null, joined_at timestamptz not null default now(), search_window integer not null default 100,
  status text not null default 'queued' check(status in ('queued','matched','cancelled'))
);
create table public.ranked_matches (
  id uuid primary key default gen_random_uuid(), game_match_id uuid unique references public.game_matches(id),
  season_id uuid references public.competitive_seasons(id), player_one uuid not null references public.profiles(id),
  player_two uuid not null references public.profiles(id), winner_id uuid references public.profiles(id),
  draw boolean not null default false, status text not null default 'active' check(status in ('active','finished','cancelled')),
  player_one_delta integer not null default 0, player_two_delta integer not null default 0,
  created_at timestamptz not null default now(), completed_at timestamptz, check(player_one<>player_two)
);
create index ranked_matches_player_one on public.ranked_matches(player_one,created_at desc);
create index ranked_matches_player_two on public.ranked_matches(player_two,created_at desc);

alter table public.profiles add column if not exists bio text not null default '' check(length(bio)<=160);
alter table public.profiles add column if not exists privacy_mode text not null default 'public' check(privacy_mode in ('public','friends'));

insert into public.competitive_seasons(name,starts_at,ends_at,status)
select 'Season 01',now(),now()+interval '8 weeks','active'
where not exists(select 1 from public.competitive_seasons);
insert into public.cosmetic_items(slug,name,category,description,preview,is_default) values
 ('classic','Classic Blue','board_skin','The default SUDUEL board.', '{"accent":"#149fff","cell":"#0b192a"}', true),
 ('carbon','Carbon','board_skin','Graphite board styling.', '{"accent":"#96aac3","cell":"#111b28"}', false),
 ('mint','Mint','board_skin','Dark green and mint accents.', '{"accent":"#2fcb99","cell":"#0b211f"}', false),
 ('solar','Solar','board_skin','Yellow arcade styling.', '{"accent":"#ffd03b","cell":"#251f0b"}', false),
 ('rookie-solver','Rookie Solver','title','Complete your first match.', '{}', true),
 ('grid-master','Grid Master','title','Reach Diamond rank.', '{"color":"#ffd03b"}', false),
 ('perfect-solver','Perfect Solver','title','Win without an incorrect entry.', '{"color":"#149fff"}', false),
 ('combo-king','Combo King','title','Trigger 20 attack combos.', '{"color":"#ff4658"}', false),
 ('puzzle-veteran','Puzzle Veteran','title','Finish 500 matches.', '{"color":"#b379ff"}', false),
 ('sudoku-legend','Sudoku Legend','title','Reach Legend rank.', '{"color":"#2fcb99"}', false)
on conflict(slug) do nothing;
insert into public.achievements(slug,name,description,icon,requirement) values
 ('first-victory','First Victory','Win your first eligible match.','✦','{"wins":1}'),
 ('perfect-solver','Perfect Solver','Win a match without an incorrect entry.','◆','{"perfect_wins":1}'),
 ('battle-veteran','Battle Veteran','Complete 100 battle matches.','◎','{"battle_matches":100}'),
 ('win-streak','Win Streak','Win five eligible matches consecutively.','★','{"streak":5}'),
 ('diamond-player','Diamond Player','Reach Diamond tier.','◇','{"rank":"Diamond"}')
on conflict(slug) do nothing;

insert into public.player_ratings(user_id)
select id from public.profiles on conflict(user_id) do nothing;
insert into public.player_equipped_cosmetics(user_id,board_skin_id)
select p.id,c.id from public.profiles p cross join public.cosmetic_items c where c.slug='classic'
on conflict(user_id) do nothing;
insert into public.player_inventory(user_id,item_id,source)
select p.id,c.id,'default' from public.profiles p cross join public.cosmetic_items c where c.is_default
on conflict(user_id,item_id) do nothing;

create or replace function private.init_phase4_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare v_classic uuid;
begin
  insert into public.player_ratings(user_id) values(new.id) on conflict do nothing;
  select id into v_classic from public.cosmetic_items where slug='classic';
  insert into public.player_equipped_cosmetics(user_id,board_skin_id) values(new.id,v_classic) on conflict do nothing;
  insert into public.player_inventory(user_id,item_id,source) select new.id,id,'default' from public.cosmetic_items where is_default on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_profile_phase4_created on public.profiles;
create trigger on_profile_phase4_created after insert on public.profiles for each row execute function private.init_phase4_profile();

create or replace function public.equip_cosmetic(p_item uuid) returns public.player_equipped_cosmetics language plpgsql security definer set search_path='' as $$
declare v_item public.cosmetic_items; v_result public.player_equipped_cosmetics; v_user uuid:=auth.uid();
begin
  select * into v_item from public.cosmetic_items where id=p_item;
  if v_item.id is null or not exists(select 1 from public.player_inventory where user_id=v_user and item_id=p_item) then raise exception 'Cosmetic is not unlocked.' using errcode='42501'; end if;
  insert into public.player_equipped_cosmetics(user_id) values(v_user) on conflict do nothing;
  if v_item.category='board_skin' then update public.player_equipped_cosmetics set board_skin_id=p_item,updated_at=now() where user_id=v_user;
  elsif v_item.category='title' then update public.player_equipped_cosmetics set title_id=p_item,updated_at=now() where user_id=v_user;
  elsif v_item.category='avatar' then update public.player_equipped_cosmetics set avatar_id=p_item,updated_at=now() where user_id=v_user;
  elsif v_item.category='profile_border' then update public.player_equipped_cosmetics set profile_border_id=p_item,updated_at=now() where user_id=v_user;
  else update public.player_equipped_cosmetics set effect_id=p_item,updated_at=now() where user_id=v_user; end if;
  select * into v_result from public.player_equipped_cosmetics where user_id=v_user; return v_result;
end $$;

create or replace function public.send_friend_request(p_recipient uuid) returns public.friend_requests language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_request public.friend_requests;
begin
  if v_user is null or v_user=p_recipient then raise exception 'You cannot send a request to yourself.'; end if;
  if exists(select 1 from public.friendships where user_id=v_user and friend_id=p_recipient) then raise exception 'You are already friends.'; end if;
  if exists(select 1 from public.friendships where user_id=p_recipient and friend_id=v_user) then raise exception 'You are already friends.'; end if;
  if exists(select 1 from public.friend_requests where sender_id=p_recipient and recipient_id=v_user and status='pending') then raise exception 'This player already sent you a request.'; end if;
  insert into public.friend_requests(sender_id,recipient_id) values(v_user,p_recipient) returning * into v_request; return v_request;
end $$;

create or replace function public.create_community_post(p_kind text,p_body text,p_match uuid default null,p_achievement uuid default null) returns public.community_posts language plpgsql security definer set search_path='' as $$
declare v_post public.community_posts; v_user uuid:=auth.uid();
begin
  if p_kind not in ('text','match_highlight','achievement','rank_promotion') or length(trim(p_body)) not between 1 and 500 then raise exception 'Invalid post.'; end if;
  if p_match is not null and not exists(select 1 from public.match_players where match_id=p_match and user_id=v_user) then raise exception 'You can only share your own completed match.' using errcode='42501'; end if;
  insert into public.community_posts(author_id,kind,body,match_id,achievement_id) values(v_user,p_kind,trim(p_body),p_match,p_achievement) returning * into v_post; return v_post;
end $$;

alter table public.profiles enable row level security; alter table public.player_stats enable row level security;
alter table public.competitive_seasons enable row level security; alter table public.player_ratings enable row level security;
alter table public.achievements enable row level security; alter table public.player_achievements enable row level security;
alter table public.cosmetic_items enable row level security; alter table public.player_inventory enable row level security; alter table public.player_equipped_cosmetics enable row level security;
alter table public.friend_requests enable row level security; alter table public.friendships enable row level security;
alter table public.community_posts enable row level security; alter table public.post_reactions enable row level security; alter table public.post_comments enable row level security; alter table public.content_reports enable row level security; alter table public.player_notifications enable row level security;
alter table public.ranked_queue enable row level security; alter table public.ranked_matches enable row level security;

create policy profiles_public_read on public.profiles for select to authenticated using(true);
create policy stats_public_read on public.player_stats for select to authenticated using(true);
create policy seasons_public_read on public.competitive_seasons for select to authenticated using(true);
create policy ratings_public_read on public.player_ratings for select to authenticated using(true);
create policy achievements_public_read on public.achievements for select to authenticated using(true);
create policy player_achievements_public_read on public.player_achievements for select to authenticated using(true);
create policy cosmetics_public_read on public.cosmetic_items for select to authenticated using(true);
create policy inventory_owner_read on public.player_inventory for select to authenticated using(user_id=(select auth.uid()));
create policy equipped_public_read on public.player_equipped_cosmetics for select to authenticated using(true);
create policy friend_requests_participant_read on public.friend_requests for select to authenticated using(sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy friendships_participant_read on public.friendships for select to authenticated using(user_id=(select auth.uid()) or friend_id=(select auth.uid()));
create policy posts_public_read on public.community_posts for select to authenticated using(deleted_at is null);
create policy posts_owner_update on public.community_posts for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));
create policy posts_owner_delete on public.community_posts for delete to authenticated using(author_id=(select auth.uid()));
create policy reactions_public_read on public.post_reactions for select to authenticated using(true);
create policy reactions_owner_write on public.post_reactions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy comments_public_read on public.post_comments for select to authenticated using(deleted_at is null);
create policy comments_owner_write on public.post_comments for all to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));
create policy reports_owner_insert on public.content_reports for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy notifications_owner_read on public.player_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_owner_update on public.player_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy ranked_matches_public_read on public.ranked_matches for select to authenticated using(player_one=(select auth.uid()) or player_two=(select auth.uid()));

revoke all on public.player_ratings,public.ranked_queue,public.ranked_matches,public.player_achievements,public.player_equipped_cosmetics from anon,authenticated;
grant select on public.player_ratings,public.ranked_matches,public.player_achievements,public.player_equipped_cosmetics to authenticated;
grant select on public.competitive_seasons,public.achievements,public.cosmetic_items,public.player_inventory,public.friend_requests,public.friendships,public.community_posts,public.post_reactions,public.post_comments,public.player_notifications to authenticated;
grant update(bio,privacy_mode) on public.profiles to authenticated;
grant execute on function public.equip_cosmetic(uuid),public.send_friend_request(uuid),public.create_community_post(text,text,uuid,uuid) to authenticated;
create index player_inventory_user on public.player_inventory(user_id);
create index player_achievements_user on public.player_achievements(user_id);
