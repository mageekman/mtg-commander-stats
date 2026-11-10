create function public.get_recent_friend_games() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to view your games with friends.' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(recent) order by recent.played_at desc,recent.created_at desc,recent.id desc),'[]'::jsonb) into result from (
  select g.id,g.deck_id,d.name deck_name,g.played_at,g.created_at,g.won,g.players,g.first_player,g.winner_player,g.notes
  from public.personal_games g left join public.decks d on d.id=g.deck_id and d.owner_id=auth.uid()
  where g.owner_id=auth.uid() and exists(
   select 1 from jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) player
   join public.friend_connections f on player->>'friend_id'=case when f.requester_id=auth.uid() then f.recipient_id::text else f.requester_id::text end
   where f.status='accepted' and (f.requester_id=auth.uid() or f.recipient_id=auth.uid())
  ) order by g.played_at desc,g.created_at desc,g.id desc limit 5
 ) recent;
 return result;
end $$;
revoke all on function public.get_recent_friend_games() from public,anon;
grant execute on function public.get_recent_friend_games() to authenticated;
