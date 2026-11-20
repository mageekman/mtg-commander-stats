-- Aggregate only explicitly shared snapshots. No private Ledger/profile stats are read.
create function private.read_playgroup_stats(target_group uuid,range_start date default null,range_end date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null or not exists(select 1 from private.playgroup_members where group_id=target_group and user_id=actor) then
  raise exception 'Only members can view playgroup stats.' using errcode='42501';
 end if;
 if range_start is not null and range_end is not null and range_start>range_end then raise exception 'Start date must be before the end date.';end if;
 with games as materialized (
  select event_id,played_at,snapshot from private.playgroup_games
  where group_id=target_group and (range_start is null or played_at>=range_start) and (range_end is null or played_at<=range_end)
 ),seats as materialized (
  select g.event_id,g.played_at,p.value->>'participant_id' as participant_id,
   nullif(trim(p.value->>'commander'),'') as commander,
   (p.ordinality-1)=(g.snapshot->>'winner_player')::int as won
  from games g cross join lateral jsonb_array_elements(g.snapshot->'players') with ordinality p
 ),member_games as (
  select s.event_id,m.user_id,bool_or(s.won) as won from seats s
  join private.playgroup_members m on m.group_id=target_group and m.user_id::text=s.participant_id
  group by s.event_id,m.user_id
 ),records as (
  select p.id,p.handle,p.display_name,count(*) as games,count(*) filter(where mg.won) as wins,
   count(*) filter(where mg.won)::numeric/count(*) as rate
  from member_games mg join public.profiles p on p.id=mg.user_id group by p.id,p.handle,p.display_name
 ),rankings as (
  select id,handle,display_name,games,wins,round(100*rate,1) as win_rate,
   row_number() over(order by rate desc,games desc,lower(coalesce(display_name,handle)),id) as win_rank,
   row_number() over(order by games desc,rate desc,lower(coalesce(display_name,handle)),id) as games_rank
  from records
 ),commanders as (
  select min(commander) as commander,count(*) as appearances,count(*) filter(where won) as wins,
   round(100.0*count(*) filter(where won)/count(*),1) as win_rate
  from seats where commander is not null group by lower(commander)
 ),top_commanders as (
  select * from commanders order by appearances desc,wins desc,commander limit 20
 )
 select jsonb_build_object(
  'games',(select count(*) from games),
  'players_ranked',(select count(*) from records),
  'commanders_played',(select count(*) from commanders),
  'rankings',(select coalesce(jsonb_agg(to_jsonb(r) order by win_rank),'[]'::jsonb) from rankings r),
  'commanders',(select coalesce(jsonb_agg(to_jsonb(c) order by appearances desc,wins desc,commander),'[]'::jsonb) from top_commanders c)
 ) into result;
 return result;
end $$;
revoke all on function private.read_playgroup_stats(uuid,date,date) from public,anon;
grant execute on function private.read_playgroup_stats(uuid,date,date) to authenticated;
create function public.get_playgroup_stats(target_group uuid,range_start date default null,range_end date default null)
returns jsonb language sql stable security invoker set search_path='' as $$select private.read_playgroup_stats(target_group,range_start,range_end)$$;
revoke all on function public.get_playgroup_stats(uuid,date,date) from public,anon;
grant execute on function public.get_playgroup_stats(uuid,date,date) to authenticated;
notify pgrst,'reload schema';
