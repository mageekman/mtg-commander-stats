-- Adds an overload; the original all-time endpoint remains for older clients.
-- Date-filtered comparisons for the caller and accepted friends who share each metric.
create or replace function public.get_friend_rankings(range_start date,range_end date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'Sign in to view friend rankings.' using errcode='42501'; end if;
 if range_start is not null and range_end is not null and range_start>range_end then raise exception 'Start date must be on or before end date.' using errcode='22023'; end if;
 with people as (
  select p.id,p.handle,p.display_name,p.id=actor is_you,
   (p.id=actor or p.public_full_stats or p.share_win_chart) can_rate,
   (p.id=actor or p.public_full_stats or p.share_record) can_games
  from public.profiles p
  where p.id=actor or exists(
   select 1 from public.friend_connections f where f.status='accepted'
   and ((f.requester_id=actor and f.recipient_id=p.id) or (f.recipient_id=actor and f.requester_id=p.id))
  )
 ), totals as (
  select p.id,p.handle,p.display_name,p.is_you,p.can_rate,p.can_games,
   count(g.id)::bigint games,count(g.id) filter(where g.won)::bigint wins
  from people p left join public.personal_games g on g.owner_id=p.id
   and (range_start is null or g.played_at>=range_start)
   and (range_end is null or g.played_at<=range_end)
  where p.can_rate or p.can_games
  group by p.id,p.handle,p.display_name,p.is_you,p.can_rate,p.can_games
 ), rates as (
  select *,rank() over(order by wins::numeric/games desc,games desc) position
  from totals where can_rate and games>0
 ), volumes as (
  select *,rank() over(order by games desc) position from totals where can_games
 )
 select jsonb_build_object(
  'self',(select jsonb_build_object('games',games,'wins',wins,'win_rate',case when games>0 then 100*wins::numeric/games end) from totals where is_you),
  'win_rates',coalesce((select jsonb_agg(jsonb_build_object('rank',position,'handle',handle,'display_name',display_name,'is_you',is_you,'games',games,'wins',wins,'win_rate',100*wins::numeric/games) order by position,lower(coalesce(display_name,handle,'')),id) from rates),'[]'::jsonb),
  'games_logged',coalesce((select jsonb_agg(jsonb_build_object('rank',position,'handle',handle,'display_name',display_name,'is_you',is_you,'games',games) order by position,lower(coalesce(display_name,handle,'')),id) from volumes),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.get_friend_rankings(date,date) from public,anon;
grant execute on function public.get_friend_rankings(date,date) to authenticated;
