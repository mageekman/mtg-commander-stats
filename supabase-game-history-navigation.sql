begin;
-- Preserve the recorded deck association separately from live friend/deck access.
create or replace function private.normalize_recorded_game_players(owner uuid,players jsonb,invitation uuid,previous_players jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; result jsonb:='[]'; account uuid; deck uuid; historical_deck uuid; friends boolean; recorded boolean; deck_valid boolean; trusted jsonb:='[]';
begin
 if jsonb_typeof(players) is distinct from 'array' then return players;end if;
 if exists(select 1 from public.game_invitations where id=invitation and recipient_id=owner) then trusted:=private.game_invitation_players(invitation);end if;
 for item in select value from jsonb_array_elements(players) loop
  if jsonb_typeof(item)='object' and (item ? 'friend_id' or item ? 'friend_deck_id' or item ? 'participant_id' or item ? 'participant_deck_id') then
   account:=null;deck:=null;historical_deck:=null;
   begin account:=nullif(coalesce(item->>'friend_id',item->>'participant_id'),'')::uuid;exception when invalid_text_representation then null;end;
   begin deck:=nullif(item->>'friend_deck_id','')::uuid;exception when invalid_text_representation then null;end;
   begin historical_deck:=nullif(coalesce(item->>'friend_deck_id',item->>'participant_deck_id'),'')::uuid;exception when invalid_text_representation then null;end;
   friends:=account is not null and account<>owner and exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=owner and f.recipient_id=account) or (f.recipient_id=owner and f.requester_id=account)));
   recorded:=account is not null and account<>owner and exists(select 1 from public.profiles where id=account) and (
    friends or exists(select 1 from jsonb_array_elements(trusted) p where p->>'participant_id'=account::text)
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(previous_players)='array' then previous_players else '[]'::jsonb end) p where coalesce(p->>'friend_id',p->>'participant_id')=account::text));
   deck_valid:=not(item ? 'friend_deck_id') or (friends and exists(select 1 from public.decks d join public.profiles p on p.id=d.owner_id where d.id=deck and d.owner_id=account and d.archived_at is null and (p.share_deck_stats or p.public_full_stats) and exists(select 1 from public.personal_games g where g.deck_id=d.id and g.owner_id=account)));
   item:=item-'participant_id'-'participant_deck_id';
   if recorded then
    item:=item||jsonb_build_object('participant_id',account::text);
    if historical_deck is not null and (
     (deck=historical_deck and deck_valid and friends)
     or exists(select 1 from jsonb_array_elements(trusted) p where p->>'participant_id'=account::text and p->>'participant_deck_id'=historical_deck::text)
     or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(previous_players)='array' then previous_players else '[]'::jsonb end) p where coalesce(p->>'friend_id',p->>'participant_id')=account::text and coalesce(p->>'friend_deck_id',p->>'participant_deck_id')=historical_deck::text)
    ) then item:=item||jsonb_build_object('participant_deck_id',historical_deck::text);end if;
   end if;
   if not friends or not deck_valid then item:=item-'friend_id'-'friend_deck_id';end if;
  end if;
  result:=result||jsonb_build_array(item);
 end loop;
 return result;
end $$;
revoke all on function private.normalize_recorded_game_players(uuid,jsonb,uuid,jsonb) from public,anon,authenticated;
create or replace function private.game_invitation_players(invitation uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with source as (select * from public.game_invitations where id=invitation),
 seats as (
  select p.value,p.ordinality,case when p.ordinality=1 then s.sender_id
   when p.ordinality-1=s.recipient_player_index then s.recipient_id
   else coalesce((select id from public.profiles where id::text=p.value->>'participant_id'),
    (select other.recipient_id from public.game_invitations other where other.source_game_id=s.source_game_id and other.recipient_player_index=p.ordinality-1 and other.snapshot->'players'=s.snapshot->'players' order by other.created_at,other.id limit 1)) end account,
   coalesce(p.value->>'participant_deck_id',case when p.ordinality-1=s.recipient_player_index then s.suggested_deck_id::text else
    (select other.suggested_deck_id::text from public.game_invitations other where other.source_game_id=s.source_game_id and other.recipient_player_index=p.ordinality-1 and other.snapshot->'players'=s.snapshot->'players' order by other.created_at,other.id limit 1) end) deck
  from source s cross join lateral jsonb_array_elements(s.snapshot->'players') with ordinality p
 )
 select coalesce(jsonb_agg(jsonb_build_object('name',coalesce((select nullif(trim(display_name),'') from public.profiles where id=account),value->>'name'),'commander',value->>'commander')
 ||case when exists(select 1 from public.profiles where id=account) then jsonb_build_object('participant_id',account::text)||case when deck is not null then jsonb_build_object('participant_deck_id',deck) else '{}'::jsonb end else '{}'::jsonb end order by ordinality),'[]'::jsonb) from seats
$$;
revoke all on function private.game_invitation_players(uuid) from public,anon,authenticated;
-- Existing snapshot names/commanders stay immutable. Only future invitations carry
-- the sender's exact deck ID; older recipient deck links can use their saved hints.
do $update$
declare definition text;
begin
 definition:=pg_get_functiondef('public.invite_tagged_game_friends()'::regprocedure);
 if position('jsonb_build_object(''participant_id'',new.owner_id::text)' in definition)=0 then raise exception 'Game snapshot query changed';end if;
 definition:=replace(definition,'jsonb_build_object(''participant_id'',new.owner_id::text)','jsonb_build_object(''participant_id'',new.owner_id::text,''participant_deck_id'',new.deck_id::text)');
 definition:=replace(definition,'jsonb_build_object(''participant_id'',coalesce(p.value->>''friend_id'',p.value->>''participant_id''))','jsonb_build_object(''participant_id'',coalesce(p.value->>''friend_id'',p.value->>''participant_id''))||case when coalesce(p.value->>''friend_deck_id'',p.value->>''participant_deck_id'') is not null then jsonb_build_object(''participant_deck_id'',coalesce(p.value->>''friend_deck_id'',p.value->>''participant_deck_id'')) else ''{}''::jsonb end');
 execute definition;
end $update$;
-- Recover exact saved deck references on accepted copies without guessing decks
-- from commander names, and without changing independent game details.
with repairs as (
 select g.id,jsonb_agg(p.value||case when not(p.value ? 'friend_deck_id') and not(p.value ? 'participant_deck_id') and p.value->>'commander'=matched.value->>'commander' and coalesce(p.value->>'friend_id',p.value->>'participant_id')=matched.value->>'participant_id' and matched.value->>'participant_deck_id' is not null
 then jsonb_build_object('participant_deck_id',matched.value->>'participant_deck_id') else '{}'::jsonb end order by p.ordinality) players
 from public.personal_games g join public.game_invitations i on i.accepted_game_id=g.id and i.recipient_id=g.owner_id
 cross join lateral jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) with ordinality p
 cross join lateral (select case when p.ordinality=1 then i.recipient_player_index when p.ordinality-1<=i.recipient_player_index then p.ordinality-2 else p.ordinality-1 end position) seat
 cross join lateral (select private.game_invitation_players(i.id)->seat.position::int value) matched
 group by g.id
)
update public.personal_games g set players=r.players from repairs r where g.id=r.id and r.players is distinct from g.players;
update public.personal_games g set players=g.players where exists(select 1 from jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) p where p ? 'friend_deck_id');
create function private.game_history_links(game_ids uuid[])
returns table(game_id uuid,player_index int,handle text,display_name text,is_friend boolean,deck_id uuid,deck_name text)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in to view game links.' using errcode='42501';end if;
 if game_ids is null or cardinality(game_ids)>100 then raise exception 'Request at most 100 games.' using errcode='22023';end if;
 return query select g.id,(p.ordinality-1)::int,peer.handle,peer.display_name,coalesce(f.status='accepted',false),d.id,d.name
 from public.personal_games g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) with ordinality p
 join public.profiles peer on peer.id::text=coalesce(p.value->>'friend_id',p.value->>'participant_id')
 left join public.friend_connections f on f.status='accepted' and ((f.requester_id=actor and f.recipient_id=peer.id) or (f.recipient_id=actor and f.requester_id=peer.id))
 left join public.decks d on d.id::text=coalesce(p.value->>'friend_deck_id',p.value->>'participant_deck_id') and d.owner_id=peer.id and d.archived_at is null and f.status='accepted' and (peer.share_deck_stats or peer.public_full_stats)
  and exists(select 1 from public.personal_games played where played.owner_id=peer.id and played.deck_id=d.id)
 where g.owner_id=actor and g.id=any(game_ids) and p.ordinality>1 and peer.handle is not null;
end $$;
revoke all on function private.game_history_links(uuid[]) from public,anon;
grant execute on function private.game_history_links(uuid[]) to authenticated;
create function public.get_game_history_links(game_ids uuid[])
returns table(game_id uuid,player_index int,handle text,display_name text,is_friend boolean,deck_id uuid,deck_name text)
language sql stable security invoker set search_path='' as $$ select * from private.game_history_links(game_ids) $$;
revoke all on function public.get_game_history_links(uuid[]) from public,anon;
grant execute on function public.get_game_history_links(uuid[]) to authenticated;
create function private.connected_friend_deck(target_deck uuid,source_game uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null then raise exception 'Sign in to view a shared deck.' using errcode='42501';end if;
 select jsonb_build_object('id',d.id,'name',d.name,'commander',d.commander,'owner_handle',peer.handle,'owner_name',peer.display_name,'record',jsonb_build_object('games',count(played.id),'wins',count(played.id) filter(where played.won))) into result
 from public.decks d join public.profiles peer on peer.id=d.owner_id
 join public.personal_games played on played.owner_id=peer.id and played.deck_id=d.id
 where d.id=target_deck and d.archived_at is null and peer.id<>actor and (peer.share_deck_stats or peer.public_full_stats)
 and exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=actor and f.recipient_id=peer.id) or (f.recipient_id=actor and f.requester_id=peer.id)))
 and exists(select 1 from public.personal_games g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) with ordinality p
  where g.owner_id=actor and (source_game is null or g.id=source_game) and p.ordinality>1
  and coalesce(p.value->>'friend_id',p.value->>'participant_id')=peer.id::text and coalesce(p.value->>'friend_deck_id',p.value->>'participant_deck_id')=d.id::text)
 group by d.id,peer.handle,peer.display_name;
 return result;
end $$;
revoke all on function private.connected_friend_deck(uuid,uuid) from public,anon;
grant execute on function private.connected_friend_deck(uuid,uuid) to authenticated;
create function public.get_connected_friend_deck(target_deck uuid,source_game uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.connected_friend_deck(target_deck,source_game) $$;
revoke all on function public.get_connected_friend_deck(uuid,uuid) from public,anon;
grant execute on function public.get_connected_friend_deck(uuid,uuid) to authenticated;
commit;
