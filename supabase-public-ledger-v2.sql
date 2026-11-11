-- Public profile statistics are calculated from the same personal Ledger records.
-- New blocks default private. Preserve the previously shared trend permission.
begin;
alter table public.profiles
 add column share_win_trend boolean not null default false,
 add column share_first_player boolean not null default false,
 add column share_deck_rotation boolean not null default false,
 add column share_games_together boolean not null default false,
 add column share_friend_results boolean not null default false;
update public.profiles set share_win_trend=share_win_chart;
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
-- The privileged implementation is outside the Data API's exposed schema.
-- It returns only explicitly authorized aggregates, even to the owner preview.
create or replace function private.shared_ledger_stats(target_handle text,date_start date default null,date_end date default null)
returns jsonb language sql stable security definer set search_path='' as $function$
with target as materialized (
 select p.* from public.profiles p where (select auth.uid()) is not null and p.handle=lower(trim(target_handle)) limit 1
), all_games as materialized (
 select x.id,x.deck_id,x.won,x.played_at,x.players,x.first_player,x.winner_player from public.personal_games x join target t on x.owner_id=t.id
), g as materialized (
 select * from all_games where (date_start is null or played_at>=date_start) and (date_end is null or played_at<=date_end)
), ds as materialized (
 select d.id,d.name,d.commander,d.archived_at,count(g.id)::int games,count(g.id) filter(where g.won)::int wins,
 (select max(a.played_at) from all_games a where a.deck_id=d.id) as last
 from public.decks d join target t on d.owner_id=t.id left join g on g.deck_id=d.id group by d.id,d.name,d.commander,d.archived_at
), active as (select * from ds where archived_at is null), ranked as (select * from active where games>0),
 best as (select * from ranked order by wins::numeric/games desc,games desc,wins desc,name limit 1),
 most as (select * from ranked order by games desc,wins desc,name limit 1),
 rivals as (
 select trim(g.players->g.winner_player->>'name') player,trim(g.players->g.winner_player->>'commander') commander
 from g where not g.won and jsonb_typeof(g.players)='array' and g.winner_player>0 and g.winner_player<jsonb_array_length(g.players)
), rp as (select player,count(*)::int losses from rivals where not public.is_generic_opponent_name(player) group by player order by losses desc,player limit 1),
 rc as (select commander,count(*)::int losses from rivals where nullif(commander,'') is not null group by commander order by losses desc,commander limit 1),
 first_source as (
 select g.*,case when jsonb_typeof(players)='array' then first_player>=0 and first_player<jsonb_array_length(players) else false end is_known from g
), first_counts as (
 select deck_id,grouping(deck_id) overall,
 count(*) filter(where is_known and first_player=0)::int first_games,
 count(*) filter(where is_known and first_player=0 and won)::int first_wins,
 count(*) filter(where is_known and first_player<>0)::int other_games,
 count(*) filter(where is_known and first_player<>0 and won)::int other_wins,
 count(*) filter(where is_known is not true)::int excluded
 from first_source group by grouping sets ((),(deck_id))
), first_stats as (
 select deck_id,overall,jsonb_build_object('first',jsonb_build_object('games',first_games,'wins',first_wins),
 'other',jsonb_build_object('games',other_games,'wins',other_wins),'excluded',excluded) value from first_counts
), current_friends as (
 select p.id,coalesce(nullif(trim(p.display_name),''),'@'||p.handle) name from public.friend_connections f join target t on (f.requester_id=t.id or f.recipient_id=t.id)
 join public.profiles p on p.id=case when f.requester_id=t.id then f.recipient_id else f.requester_id end where f.status='accepted'
), tagged as materialized (
 select distinct on(g.id,f.id) g.id,g.won,g.played_at,f.id friend_id,f.name,trim(p.value->>'commander') commander
 from g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) with ordinality p(value,position)
 join current_friends f on p.value->>'friend_id'=f.id::text where p.position>1 order by g.id,f.id,p.position
), friend_rows as (
 select f.friend_id,f.name,count(*)::int games,count(*) filter(where won)::int your_wins,
 (select x.commander from (select (array_agg(a.commander order by a.played_at,a.id))[1] commander,count(*) games from tagged a where a.friend_id=f.friend_id and nullif(a.commander,'') is not null group by lower(regexp_replace(a.commander,'\s+',' ','g')))x order by x.games desc,x.commander limit 1) commander
 from tagged f group by f.friend_id,f.name
), permitted_art as (
 select a.slot,a.commander,a.x,a.y,a.zoom from public.ledger_art_adjustments a join target t on a.owner_id=t.id
 where (a.slot='best-deck' and (t.public_full_stats or t.share_best_deck) and exists(select 1 from best b where b.commander=a.commander))
 or (a.slot='most-played-deck' and (t.public_full_stats or t.share_most_played_deck) and exists(select 1 from most m where m.commander=a.commander))
 or (a.slot='rival-commander' and (t.public_full_stats or t.share_lost_to_commander) and exists(select 1 from rc where rc.commander=a.commander))
 or exists(select 1 from active d where a.slot='deck:'||d.id::text and a.commander=trim(d.commander) and (t.public_full_stats or t.share_deck_rotation or (t.share_deck_stats and d.games>0)))
)
select jsonb_strip_nulls(jsonb_build_object(
 'record',case when t.public_full_stats or t.share_record or t.public_games then jsonb_build_object('games',(select count(*) from g)) end,
 'win_chart',case when t.public_full_stats or t.share_win_chart or t.public_wins or t.public_winrate then jsonb_build_object('games',(select count(*) from g),'wins',(select count(*) from g where won)) end,
 'winrate_history',case when t.public_full_stats or t.share_win_trend then (select coalesce(jsonb_agg(jsonb_build_object('played_at',played_at,'won',won) order by played_at,id),'[]'::jsonb) from g) end,
 'best_deck',case when t.public_full_stats or t.share_best_deck then (select jsonb_build_object('name',name,'commander',commander,'games',games,'wins',wins) from best) end,
 'most_played_deck',case when t.public_full_stats or t.share_most_played_deck then (select jsonb_build_object('name',name,'commander',commander,'games',games,'wins',wins) from most) end,
 'color_decks',case when t.public_full_stats or t.share_most_played_color or t.share_best_color_combo then (select coalesce(jsonb_agg(jsonb_build_object('commander',commander,'games',games,'wins',wins)),'[]'::jsonb) from ds where games>0) end,
 'color_permissions',jsonb_build_object('most_played',t.public_full_stats or t.share_most_played_color,'best_combo',t.public_full_stats or t.share_best_color_combo),
 'lost_color_commanders',case when t.public_full_stats or t.share_lost_to_color then (select coalesce(jsonb_agg(commander),'[]'::jsonb) from rivals where commander is not null) end,
 'lost_color_enabled',t.public_full_stats or t.share_lost_to_color,
 'nemesis_player_enabled',t.public_full_stats or t.share_lost_to_player,
 'nemesis_player',case when t.public_full_stats or t.share_lost_to_player then (select to_jsonb(rp) from rp) end,
 'nemesis_commander',case when t.public_full_stats or t.share_lost_to_commander then (select to_jsonb(rc) from rc) end,
 'nemesis_commander_enabled',t.public_full_stats or t.share_lost_to_commander,
 'decks',case when t.public_full_stats or t.share_deck_stats then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'commander',commander,'games',games,'wins',wins,'last',last) order by wins::numeric/games desc,games desc,name),'[]'::jsonb) from ranked) end,
 'decks_enabled',t.public_full_stats or t.share_deck_stats,
 'first_player',case when t.public_full_stats or t.share_first_player then (select value from first_stats where overall=1)||jsonb_build_object('decks',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name)||f.value order by d.name),'[]'::jsonb) from ranked d join first_stats f on f.deck_id=d.id and f.overall=0)) end,
 'rotation',case when t.public_full_stats or t.share_deck_rotation then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'commander',commander,'games',games,'share',case when (select count(*) from g)>0 then 100.0*games/(select count(*) from g) else 0 end,'last',last) order by games desc,last desc nulls last,name),'[]'::jsonb) from active) end,
 'games_together',case when t.public_full_stats or t.share_games_together then (select coalesce(jsonb_agg(jsonb_build_object('name',name,'commander',commander,'games',games,'your_rate',100.0*your_wins/games) order by games desc,name),'[]'::jsonb) from friend_rows) end,
 'friend_results',case when t.public_full_stats or t.share_friend_results then (select jsonb_build_object('games',count(*),'wins',count(*) filter(where won)) from g where exists(select 1 from tagged a where a.id=g.id)) end,
 'artwork',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from permitted_art a)
)) from target t;
$function$;
revoke all on function private.shared_ledger_stats(text,date,date) from public,anon;
grant execute on function private.shared_ledger_stats(text,date,date) to authenticated;
create or replace function public.get_shared_ledger_stats_v2(target_handle text,date_start date default null,date_end date default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.shared_ledger_stats(target_handle,date_start,date_end)
$$;
revoke all on function public.get_shared_ledger_stats_v2(text,date,date) from public,anon;
grant execute on function public.get_shared_ledger_stats_v2(text,date,date) to authenticated;
-- Keep older clients privacy-safe too; they cannot bypass a new sharing toggle.
create or replace function public.get_shared_ledger_stats(target_handle text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.shared_ledger_stats(target_handle,null,null)
$$;
revoke all on function public.get_shared_ledger_stats(text) from public,anon;
grant execute on function public.get_shared_ledger_stats(text) to authenticated;
notify pgrst,'reload schema';
commit;
