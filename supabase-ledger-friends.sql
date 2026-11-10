begin;
create function public.list_game_friends() returns table(id uuid,handle text,display_name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to select friends.' using errcode='42501';end if;
 return query select p.id,p.handle,p.display_name from public.friend_connections f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end where f.status='accepted' and (f.requester_id=auth.uid() or f.recipient_id=auth.uid()) and p.handle is not null order by lower(coalesce(p.display_name,p.handle)),p.handle;
end $$;
create function public.get_friend_game_decks(target_id uuid) returns table(id uuid,name text,commander text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to select friend decks.' using errcode='42501';end if;
 return query select d.id,d.name,d.commander from public.decks d join public.profiles p on p.id=d.owner_id join public.personal_games g on g.deck_id=d.id and g.owner_id=p.id
 where p.id=target_id and (p.share_deck_stats or p.public_full_stats) and d.archived_at is null and exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=auth.uid() and f.recipient_id=p.id) or (f.recipient_id=auth.uid() and f.requester_id=p.id)))
 group by d.id,d.name,d.commander order by count(g.id) filter(where g.won)::numeric/count(g.id) desc,count(g.id) desc,d.name;
end $$;
revoke all on function public.list_game_friends(),public.get_friend_game_decks(uuid) from public,anon;
grant execute on function public.list_game_friends(),public.get_friend_game_decks(uuid) to authenticated;
-- Friend/deck IDs are optional annotations. Historical name and commander strings are authoritative.
create function public.normalize_game_friend_links(owner uuid,players jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; result jsonb:='[]'; friend uuid; deck uuid; valid boolean;
begin
 if jsonb_typeof(players) is distinct from 'array' then return players;end if;
 for item in select value from jsonb_array_elements(players) loop
  if jsonb_typeof(item)='object' and (item ? 'friend_id' or item ? 'friend_deck_id') then
   friend:=null;deck:=null;
   begin friend:=(item->>'friend_id')::uuid;deck:=nullif(item->>'friend_deck_id','')::uuid;exception when invalid_text_representation then friend:=null;end;
   valid:=friend is not null and friend<>owner and exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=owner and f.recipient_id=friend) or (f.recipient_id=owner and f.requester_id=friend)));
   if valid and item ? 'friend_deck_id' then
    valid:=exists(select 1 from public.decks d join public.profiles p on p.id=d.owner_id where d.id=deck and d.owner_id=friend and d.archived_at is null and (p.share_deck_stats or p.public_full_stats) and exists(select 1 from public.personal_games g where g.deck_id=d.id and g.owner_id=friend));
   end if;
   if not valid then item:=item-'friend_id'-'friend_deck_id';end if;
  end if;
  result:=result||jsonb_build_array(item);
 end loop;
 return result;
end $$;
create function public.normalize_saved_game_friend_links() returns trigger language plpgsql security definer set search_path='' as $$
begin new.players:=public.normalize_game_friend_links(new.owner_id,new.players);return new;end $$;
create trigger normalize_saved_game_friend_links before insert or update of players on public.personal_games for each row execute function public.normalize_saved_game_friend_links();
create function public.detach_game_friend_links() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='friend_connections' then
  update public.personal_games g set players=public.normalize_game_friend_links(g.owner_id,g.players) where (g.owner_id=old.requester_id and g.players @> jsonb_build_array(jsonb_build_object('friend_id',old.recipient_id::text))) or (g.owner_id=old.recipient_id and g.players @> jsonb_build_array(jsonb_build_object('friend_id',old.requester_id::text)));
 else
  update public.personal_games g set players=public.normalize_game_friend_links(g.owner_id,g.players) where g.players @> jsonb_build_array(jsonb_build_object('friend_deck_id',old.id::text));
 end if;
 return null;
end $$;
create trigger detach_unfriended_game_players after delete on public.friend_connections for each row execute function public.detach_game_friend_links();
create trigger detach_deleted_friend_decks after delete on public.decks for each row execute function public.detach_game_friend_links();
revoke all on function public.normalize_game_friend_links(uuid,jsonb),public.normalize_saved_game_friend_links(),public.detach_game_friend_links() from public,anon,authenticated;
commit;
