begin;
create table public.friend_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 actor_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('request_received','request_accepted')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 check(user_id<>actor_id)
);
create index friend_notifications_unread on public.friend_notifications(user_id,created_at desc) where read_at is null;
create index friend_notifications_actor on public.friend_notifications(actor_id);
alter table public.friend_notifications enable row level security;
revoke all on public.friend_notifications from public,anon,authenticated;
grant select on public.friend_notifications to authenticated;
create policy "Players see their own friend notifications" on public.friend_notifications for select to authenticated using(user_id=(select auth.uid()));
create function public.record_friend_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.friend_notifications(user_id,actor_id,kind) values(new.recipient_id,new.requester_id,'request_received');
 elsif tg_op='UPDATE' and old.status='pending' and new.status='accepted' then
  insert into public.friend_notifications(user_id,actor_id,kind) values(new.requester_id,new.recipient_id,'request_accepted');
 elsif tg_op='DELETE' then
  delete from public.friend_notifications where read_at is null and ((kind='request_received' and user_id=old.recipient_id and actor_id=old.requester_id) or (kind='request_accepted' and user_id=old.requester_id and actor_id=old.recipient_id));
 end if;
 return null;
end $$;
revoke all on function public.record_friend_notification() from public,anon,authenticated;
create trigger friend_connection_notifications after insert or update or delete on public.friend_connections for each row execute function public.record_friend_notification();
-- Existing pending requests should also be visible at rollout.
insert into public.friend_notifications(user_id,actor_id,kind,created_at)
select recipient_id,requester_id,'request_received',created_at from public.friend_connections where status='pending';
create function public.friend_notification_count() returns bigint language sql stable security invoker set search_path='' as $$
 select count(*) from public.friend_notifications where user_id=auth.uid() and read_at is null;
$$;
create function public.list_friend_notifications() returns table(id uuid,kind text,handle text,display_name text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to view notifications.' using errcode='42501'; end if;
 return query select n.id,n.kind,p.handle,p.display_name,n.created_at from public.friend_notifications n join public.profiles p on p.id=n.actor_id where n.user_id=auth.uid() and n.read_at is null order by n.created_at desc,n.id limit 100;
end $$;
create function public.mark_friend_notifications_seen(notification_ids uuid[]) returns bigint language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to update notifications.' using errcode='42501'; end if;
 update public.friend_notifications set read_at=now() where user_id=auth.uid() and id=any(notification_ids) and read_at is null;
 return public.friend_notification_count();
end $$;
revoke all on function public.friend_notification_count(),public.list_friend_notifications(),public.mark_friend_notifications_seen(uuid[]) from public,anon;
grant execute on function public.friend_notification_count(),public.list_friend_notifications(),public.mark_friend_notifications_seen(uuid[]) to authenticated;
commit;
