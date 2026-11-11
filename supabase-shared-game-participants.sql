begin;
-- Resolve only accounts actually tagged in this immutable invitation snapshot.
-- Legacy invitations can recover co-participants from identical sibling snapshots.
create function private.game_invitation_players(invitation uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with source as (select * from public.game_invitations where id=invitation),
 seats as (
  select p.value,p.ordinality,case when p.ordinality=1 then s.sender_id
   when p.ordinality-1=s.recipient_player_index then s.recipient_id
   else coalesce(
    (select id from public.profiles where id::text=p.value->>'participant_id'),
    (select other.recipient_id from public.game_invitations other
     where other.source_game_id=s.source_game_id and other.recipient_player_index=p.ordinality-1
     and other.snapshot->'players'=s.snapshot->'players' order by other.created_at,other.id limit 1)) end account
  from source s cross join lateral jsonb_array_elements(s.snapshot->'players') with ordinality p
 )
 select coalesce(jsonb_agg(jsonb_build_object('name',coalesce((select nullif(trim(display_name),'') from public.profiles where id=account),value->>'name'),'commander',value->>'commander')
  ||case when exists(select 1 from public.profiles where id=account) then jsonb_build_object('participant_id',account::text) else '{}'::jsonb end order by ordinality),'[]'::jsonb) from seats
$$;
revoke all on function private.game_invitation_players(uuid) from public,anon,authenticated;
create function private.normalize_recorded_game_players(owner uuid,players jsonb,invitation uuid,previous_players jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; result jsonb:='[]'; account uuid; deck uuid; friends boolean; recorded boolean; deck_valid boolean; trusted jsonb:='[]';
begin
 if jsonb_typeof(players) is distinct from 'array' then return players;end if;
 if exists(select 1 from public.game_invitations where id=invitation and recipient_id=owner) then trusted:=private.game_invitation_players(invitation);end if;
 for item in select value from jsonb_array_elements(players) loop
  if jsonb_typeof(item)='object' and (item ? 'friend_id' or item ? 'friend_deck_id' or item ? 'participant_id') then
   account:=null;deck:=null;
   begin account:=nullif(coalesce(item->>'friend_id',item->>'participant_id'),'')::uuid;exception when invalid_text_representation then null;end;
   begin deck:=nullif(item->>'friend_deck_id','')::uuid;exception when invalid_text_representation then null;end;
   friends:=account is not null and account<>owner and exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=owner and f.recipient_id=account) or (f.recipient_id=owner and f.requester_id=account)));
   recorded:=account is not null and account<>owner and exists(select 1 from public.profiles where id=account) and (
    friends or exists(select 1 from jsonb_array_elements(trusted) p where p->>'participant_id'=account::text)
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(previous_players)='array' then previous_players else '[]'::jsonb end) p where coalesce(p->>'friend_id',p->>'participant_id')=account::text));
   deck_valid:=not(item ? 'friend_deck_id') or (friends and exists(select 1 from public.decks d join public.profiles p on p.id=d.owner_id where d.id=deck and d.owner_id=account and d.archived_at is null and (p.share_deck_stats or p.public_full_stats) and exists(select 1 from public.personal_games g where g.deck_id=d.id and g.owner_id=account)));
   item:=item-'participant_id';
   if recorded then item:=item||jsonb_build_object('participant_id',account::text);end if;
   if not friends or not deck_valid then item:=item-'friend_id'-'friend_deck_id';end if;
  end if;
  result:=result||jsonb_build_array(item);
 end loop;
 return result;
end $$;
revoke all on function private.normalize_recorded_game_players(uuid,jsonb,uuid,jsonb) from public,anon,authenticated;
create or replace function public.normalize_game_friend_links(owner uuid,players jsonb) returns jsonb
language sql security definer set search_path='' as $$ select private.normalize_recorded_game_players(owner,players,null,null) $$;
revoke all on function public.normalize_game_friend_links(uuid,jsonb) from public,anon,authenticated;
create or replace function public.normalize_saved_game_friend_links() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.imported_game_invitation_id is not null and not exists(select 1 from public.game_invitations where id=new.imported_game_invitation_id and recipient_id=new.owner_id) then raise exception 'Game invitation does not belong to this player.' using errcode='42501';end if;
 new.players:=private.normalize_recorded_game_players(new.owner_id,new.players,new.imported_game_invitation_id,case when tg_op='UPDATE' then old.players else null end);
 return new;
end $$;
revoke all on function public.normalize_saved_game_friend_links() from public,anon,authenticated;
create or replace function public.detach_game_friend_links() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='friend_connections' then
  update public.personal_games g set players=g.players where (g.owner_id=old.requester_id and g.players @> jsonb_build_array(jsonb_build_object('friend_id',old.recipient_id::text))) or (g.owner_id=old.recipient_id and g.players @> jsonb_build_array(jsonb_build_object('friend_id',old.requester_id::text)));
 else
  update public.personal_games g set players=g.players where g.players @> jsonb_build_array(jsonb_build_object('friend_deck_id',old.id::text));
 end if;
 return null;
end $$;
revoke all on function public.detach_game_friend_links() from public,anon,authenticated;
create or replace function public.invite_tagged_game_friends() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; old_item jsonb; tagged uuid; ordinal bigint; invitation uuid; clean_players jsonb; sender_name text; suggested uuid;
begin
 if (tg_op='INSERT' and new.imported_game_invitation_id is not null) or jsonb_typeof(new.players) is distinct from 'array' or jsonb_array_length(new.players) not between 2 and 6 or new.winner_player is null or new.winner_player<0 or new.winner_player>=jsonb_array_length(new.players) then return null;end if;
 select coalesce(nullif(display_name,''),'@'||handle,'Player') into sender_name from public.profiles where id=new.owner_id;
 select jsonb_agg(jsonb_build_object('name',case when p.ordinality=1 then sender_name else p.value->>'name' end,'commander',p.value->>'commander')||case when p.ordinality=1 then jsonb_build_object('participant_id',new.owner_id::text) when coalesce(p.value->>'friend_id',p.value->>'participant_id') is not null then jsonb_build_object('participant_id',coalesce(p.value->>'friend_id',p.value->>'participant_id')) else '{}'::jsonb end order by p.ordinality) into clean_players from jsonb_array_elements(new.players) with ordinality p;
 for item,ordinal in select p.value,p.ordinality from jsonb_array_elements(new.players) with ordinality p where p.ordinality>1 loop
  if not (item ? 'friend_id') then continue;end if;
  begin tagged:=(item->>'friend_id')::uuid;suggested:=nullif(item->>'friend_deck_id','')::uuid;exception when invalid_text_representation then continue;end;
  if tagged=new.owner_id or not exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=new.owner_id and f.recipient_id=tagged) or (f.recipient_id=new.owner_id and f.requester_id=tagged))) then continue;end if;
  if tg_op='UPDATE' and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(old.players)='array' then old.players else '[]'::jsonb end) p where coalesce(p->>'friend_id',p->>'participant_id')=tagged::text) then continue;end if;
  if new.imported_game_invitation_id is not null and exists(select 1 from jsonb_array_elements(private.game_invitation_players(new.imported_game_invitation_id)) p where p->>'participant_id'=tagged::text) then continue;end if;
  insert into public.game_invitations(source_game_id,sender_id,recipient_id,recipient_player_index,suggested_deck_id,snapshot)
  values(new.id,new.owner_id,tagged,(ordinal-1)::int,suggested,jsonb_build_object('played_at',new.played_at,'players',clean_players,'first_player',new.first_player,'winner_player',new.winner_player)) on conflict(source_game_id,recipient_id) do nothing returning id into invitation;
  if invitation is not null then insert into public.friend_notifications(user_id,actor_id,kind,game_invitation_id) values(tagged,new.owner_id,'game_tagged',invitation);end if;
 end loop;
 return null;
end $$;
revoke all on function public.invite_tagged_game_friends() from public,anon,authenticated;
create or replace function public.respond_game_invitation(invitation_id uuid,decision text,selected_deck_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invite public.game_invitations; players jsonb; own_player jsonb; first_index int; winner_index int; imported uuid; opponents text[];
begin
 if actor is null then raise exception 'Sign in to respond to game invitations.' using errcode='42501';end if;
 if decision is null or decision not in ('accept','decline') then raise exception 'Invalid game invitation response.';end if;
 select * into invite from public.game_invitations where id=invitation_id and recipient_id=actor for update;
 if not found then raise exception 'Game invitation not found.' using errcode='42501';end if;
 if invite.status='accepted' and decision='accept' then return jsonb_build_object('status','accepted','game_id',invite.accepted_game_id);end if;
 if invite.status<>'pending' then raise exception 'This game invitation is no longer pending.';end if;
 if decision='decline' then
  update public.game_invitations set status='declined',resolved_at=now() where id=invite.id;
  update public.friend_notifications set read_at=coalesce(read_at,now()) where game_invitation_id=invite.id and user_id=actor;
  return jsonb_build_object('status','declined');
 end if;
 if not exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=actor and f.recipient_id=invite.sender_id) or (f.recipient_id=actor and f.requester_id=invite.sender_id))) then raise exception 'You must still be friends to add this game.';end if;
 if not exists(select 1 from public.decks where id=selected_deck_id and owner_id=actor) then raise exception 'Choose a deck from your own account.' using errcode='42501';end if;
 select jsonb_agg((p.value-'friend_id'-'friend_deck_id')||case when p.ordinality-1=invite.recipient_player_index then jsonb_build_object('name','You')
  when exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=actor and f.recipient_id::text=p.value->>'participant_id') or (f.recipient_id=actor and f.requester_id::text=p.value->>'participant_id'))) then jsonb_build_object('friend_id',p.value->>'participant_id') else '{}'::jsonb end
  order by (p.ordinality-1=invite.recipient_player_index) desc,p.ordinality) into players from jsonb_array_elements(private.game_invitation_players(invite.id)) with ordinality p;
 first_index:=(invite.snapshot->>'first_player')::int;winner_index:=(invite.snapshot->>'winner_player')::int;
 first_index:=case when first_index=invite.recipient_player_index then 0 when first_index<invite.recipient_player_index then first_index+1 else first_index end;
 winner_index:=case when winner_index=invite.recipient_player_index then 0 when winner_index<invite.recipient_player_index then winner_index+1 else winner_index end;
 select array_agg(p.value->>'commander' order by p.ordinality) into opponents from jsonb_array_elements(players) with ordinality p where p.ordinality>1;
 insert into public.personal_games(owner_id,deck_id,played_at,won,players,first_player,winner_player,opponents,notes,imported_game_invitation_id)
 values(actor,selected_deck_id,(invite.snapshot->>'played_at')::date,winner_index=0,players,first_index,winner_index,coalesce(opponents,'{}'),'',invite.id) returning id into imported;
 update public.game_invitations set status='accepted',resolved_at=now(),accepted_game_id=imported where id=invite.id;
 update public.friend_notifications set read_at=coalesce(read_at,now()) where game_invitation_id=invite.id and user_id=actor;
 return jsonb_build_object('status','accepted','game_id',imported);
end $$;
revoke all on function public.respond_game_invitation(uuid,text,uuid) from public,anon;
grant execute on function public.respond_game_invitation(uuid,text,uuid) to authenticated;
-- Repair identities on accepted copies when the old saved seat still matches
-- the invitation, preserving independent names/commanders that users edited.
with repairs as (
 select g.id,jsonb_agg(p.value||case when matched.value->>'participant_id' is not null
  and (p.value->>'friend_id'=matched.value->>'participant_id' or (
   p.value->>'commander'=original.value->>'commander' and p.value->>'name'=original.value->>'name'))
  then jsonb_build_object('participant_id',matched.value->>'participant_id') else '{}'::jsonb end order by p.ordinality) players
 from public.personal_games g join public.game_invitations i on i.accepted_game_id=g.id and i.recipient_id=g.owner_id
 cross join lateral jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) with ordinality p
 left join lateral (select case when p.ordinality=1 then i.recipient_player_index when p.ordinality-1<=i.recipient_player_index then p.ordinality-2 else p.ordinality-1 end position) seat on true
 left join lateral (select private.game_invitation_players(i.id)->seat.position::int value) matched on true
 left join lateral (select i.snapshot->'players'->seat.position::int value) original on true
 group by g.id
)
update public.personal_games g set players=r.players from repairs r where g.id=r.id and r.players is distinct from g.players;
-- Existing friend tags are trusted saved participation, not guessed name matches.
update public.personal_games g set players=g.players where exists(select 1 from jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) p where p ? 'friend_id');
-- Every Friends-only API still joins the caller's *current* accepted connections.
do $update$
declare definition text;
begin
 definition:=pg_get_functiondef('public.get_recent_friend_games()'::regprocedure);
 if position('player->>''friend_id''=' in definition)=0 then raise exception 'Recent friend games query changed';end if;
 definition:=replace(definition,'player->>''friend_id''=','coalesce(player->>''friend_id'',player->>''participant_id'')=');execute definition;
 definition:=pg_get_functiondef('private.shared_ledger_stats(text,date,date)'::regprocedure);
 if position('p.value->>''friend_id''=f.id::text' in definition)=0 then raise exception 'Shared Ledger friend query changed';end if;
 definition:=replace(definition,'p.value->>''friend_id''=f.id::text','coalesce(p.value->>''friend_id'',p.value->>''participant_id'')=f.id::text');execute definition;
end $update$;
create function private.played_with_players(page_size int,page_offset int)
returns table(player_id uuid,handle text,display_name text,favorite_commander text,games bigint,last_played date,relationship text)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in to see players from your games.' using errcode='42501';end if;
 if page_size not between 1 and 50 or page_size is null or page_offset<0 or page_offset is null then raise exception 'Invalid player page.' using errcode='22023';end if;
 return query with played as (
  select distinct g.id,g.played_at,coalesce(p.value->>'friend_id',p.value->>'participant_id') account
  from public.personal_games g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.players)='array' then g.players else '[]'::jsonb end) with ordinality p
  where g.owner_id=actor and p.ordinality>1
 ), totals as (select account,count(*) games,max(played_at) last from played group by account)
 select p.id,p.handle,p.display_name,p.favorite_commander,t.games,t.last,
 coalesce((select case when f.requester_id=actor then 'outgoing' else 'incoming' end from public.friend_connections f where (f.requester_id=actor and f.recipient_id=p.id) or (f.recipient_id=actor and f.requester_id=p.id)),'none')
 from totals t join public.profiles p on p.id::text=t.account
 where p.id<>actor and p.handle is not null and not exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=actor and f.recipient_id=p.id) or (f.recipient_id=actor and f.requester_id=p.id)))
 order by t.games desc,t.last desc nulls last,lower(coalesce(p.display_name,p.handle)),p.id limit page_size offset page_offset;
end $$;
revoke all on function private.played_with_players(int,int) from public,anon;
grant execute on function private.played_with_players(int,int) to authenticated;
create function public.get_played_with_players(page_size int default 12,page_offset int default 0)
returns table(player_id uuid,handle text,display_name text,favorite_commander text,games bigint,last_played date,relationship text)
language sql stable security invoker set search_path='' as $$ select * from private.played_with_players(page_size,page_offset) $$;
revoke all on function public.get_played_with_players(int,int) from public,anon;
grant execute on function public.get_played_with_players(int,int) to authenticated;
commit;
