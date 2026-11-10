begin;
create table public.friend_connections (
 requester_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 accepted_at timestamptz,
 check(requester_id<>recipient_id),
 check((status='accepted')=(accepted_at is not null))
);
create unique index friend_connections_pair on public.friend_connections(least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index friend_connections_requester on public.friend_connections(requester_id);
create index friend_connections_recipient on public.friend_connections(recipient_id);
alter table public.friend_connections enable row level security;
revoke all on public.friend_connections from public,anon,authenticated;
grant select on public.friend_connections to authenticated;
create policy "Players see only their own connections" on public.friend_connections for select to authenticated using ((select auth.uid())=requester_id or (select auth.uid())=recipient_id);
-- Narrow, authenticated APIs enforce transitions; clients cannot mutate the table directly.
create function public.friend_connection_status(target_handle text) returns text
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; connection public.friend_connections;
begin
 if actor is null then raise exception 'Sign in to manage friends.' using errcode='42501'; end if;
 select id into target from public.profiles where handle=lower(trim(target_handle));
 if target is null then raise exception 'Player not found.'; end if;
 if target=actor then return 'self'; end if;
 select * into connection from public.friend_connections where least(requester_id,recipient_id)=least(actor,target) and greatest(requester_id,recipient_id)=greatest(actor,target);
 if not found then return 'none'; end if;
 if connection.status='accepted' then return 'friends'; end if;
 return case when connection.requester_id=actor then 'outgoing' else 'incoming' end;
end $$;
create function public.friend_action(target_handle text, action text) returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; connection public.friend_connections;
begin
 if actor is null then raise exception 'Sign in to manage friends.' using errcode='42501'; end if;
 if action not in ('send','accept','decline','cancel','remove') or action is null then raise exception 'Invalid friend action.'; end if;
 select id into target from public.profiles where handle=lower(trim(target_handle));
 if target is null then raise exception 'Player not found.'; end if;
 if target=actor then raise exception 'You cannot send yourself a friend request.'; end if;
 if action='send' and not exists(select 1 from public.profiles where id=actor and handle is not null) then raise exception 'Choose a username in Account Settings before sending friend requests.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(actor,target)::text||greatest(actor,target)::text,0));
 select * into connection from public.friend_connections where least(requester_id,recipient_id)=least(actor,target) and greatest(requester_id,recipient_id)=greatest(actor,target) for update;
 if action='send' then
  if not found then
   insert into public.friend_connections(requester_id,recipient_id) values(actor,target);
  end if;
 elsif action='accept' then
  if not found or connection.status<>'pending' or connection.recipient_id<>actor then raise exception 'Only the recipient can accept a pending request.'; end if;
  update public.friend_connections set status='accepted',accepted_at=now() where requester_id=connection.requester_id and recipient_id=connection.recipient_id;
 elsif action='decline' then
  if not found or connection.status<>'pending' or connection.recipient_id<>actor then raise exception 'Only the recipient can decline a pending request.'; end if;
  delete from public.friend_connections where requester_id=connection.requester_id and recipient_id=connection.recipient_id;
 elsif action='cancel' then
  if not found or connection.status<>'pending' or connection.requester_id<>actor then raise exception 'Only the sender can cancel a pending request.'; end if;
  delete from public.friend_connections where requester_id=actor and recipient_id=target;
 elsif action='remove' then
  if not found or connection.status<>'accepted' then raise exception 'This friend connection no longer exists.'; end if;
  delete from public.friend_connections where requester_id=connection.requester_id and recipient_id=connection.recipient_id;
 end if;
 return public.friend_connection_status(target_handle);
end $$;
create function public.list_friend_connections() returns table(handle text,display_name text,relationship text,since timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to see your friends.' using errcode='42501'; end if;
 return query select p.handle,p.display_name,
 case when f.status='accepted' then 'friends' when f.requester_id=auth.uid() then 'outgoing' else 'incoming' end,
 coalesce(f.accepted_at,f.created_at)
 from public.friend_connections f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end
 where (f.requester_id=auth.uid() or f.recipient_id=auth.uid()) and p.handle is not null
 order by coalesce(p.display_name,p.handle),p.handle;
end $$;
revoke all on function public.friend_connection_status(text),public.friend_action(text,text),public.list_friend_connections() from public,anon;
grant execute on function public.friend_connection_status(text),public.friend_action(text,text),public.list_friend_connections() to authenticated;
commit;
