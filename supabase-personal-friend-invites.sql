begin;
-- Private referral records are administrative history, not a client-editable badge count.
create table private.player_invite_codes(
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 code uuid not null unique default gen_random_uuid(),
 created_at timestamptz not null default now()
);
create table private.player_referrals(
 invitee_id uuid primary key references public.profiles(id) on delete cascade,
 inviter_id uuid references public.profiles(id) on delete set null,
 invite_code uuid not null,
 created_at timestamptz not null default now(),
 confirmed_at timestamptz,
 check(inviter_id<>invitee_id)
);
create index player_referrals_inviter on private.player_referrals(inviter_id,confirmed_at);
alter table private.player_invite_codes enable row level security;
alter table private.player_referrals enable row level security;
revoke all on private.player_invite_codes,private.player_referrals from public,anon,authenticated;
create function private.my_player_invite_code() returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result text;
begin
 if actor is null then raise exception 'Sign in to create your personal invite link.' using errcode='42501';end if;
 insert into private.player_invite_codes(owner_id) values(actor) on conflict(owner_id) do nothing;
 select code::text into result from private.player_invite_codes where owner_id=actor;
 return result;
end $$;
revoke all on function private.my_player_invite_code() from public,anon;
grant execute on function private.my_player_invite_code() to authenticated;
create function public.get_my_invite_code() returns text
language sql security invoker set search_path='' as $$ select private.my_player_invite_code() $$;
revoke all on function public.get_my_invite_code() from public,anon;
grant execute on function public.get_my_invite_code() to authenticated;
alter table public.friend_notifications drop constraint friend_notifications_kind_check;
alter table public.friend_notifications add constraint friend_notifications_kind_check check(kind in('request_received','request_accepted','game_tagged','invite_joined'));
create function private.complete_player_referral(invitee uuid) returns void
language plpgsql security definer set search_path='' as $$
declare referral private.player_referrals;
begin
 -- Only a verified email can finalize the immutable signup referral.
 if not exists(select 1 from auth.users where id=invitee and email_confirmed_at is not null) then return;end if;
 select * into referral from private.player_referrals where invitee_id=invitee for update;
 if not found or referral.confirmed_at is not null then return;end if;
 update private.player_referrals set confirmed_at=now() where invitee_id=invitee;
 if referral.inviter_id is null then return;end if;
 insert into public.friend_connections(requester_id,recipient_id,status,accepted_at)
 values(referral.inviter_id,invitee,'accepted',now()) on conflict do nothing;
 update public.friend_connections set status='accepted',accepted_at=now()
 where status='pending' and ((requester_id=referral.inviter_id and recipient_id=invitee) or (recipient_id=referral.inviter_id and requester_id=invitee));
 -- Replace ordinary request notifications for this pair with the explicit join event.
 delete from public.friend_notifications where read_at is null and kind in('request_received','request_accepted')
 and ((user_id=referral.inviter_id and actor_id=invitee) or (actor_id=referral.inviter_id and user_id=invitee));
 insert into public.friend_notifications(user_id,actor_id,kind) values(referral.inviter_id,invitee,'invite_joined');
end $$;
revoke all on function private.complete_player_referral(uuid) from public,anon,authenticated;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare invite uuid; inviter uuid;
begin
 insert into public.profiles(id,display_name,handle,favorite_commander)
 values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(coalesce(new.email,''),'@',1),'Player'),
 nullif(lower(trim(new.raw_user_meta_data->>'username')),''),nullif(trim(new.raw_user_meta_data->>'favorite_commander'),''));
 begin invite:=nullif(new.raw_user_meta_data->>'invite_code','')::uuid;exception when invalid_text_representation then invite:=null;end;
 select owner_id into inviter from private.player_invite_codes where code=invite;
 if inviter is not null and inviter<>new.id then
  insert into private.player_referrals(invitee_id,inviter_id,invite_code) values(new.id,inviter,invite) on conflict(invitee_id) do nothing;
  perform private.complete_player_referral(new.id);
 end if;
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
create function private.confirm_player_referral() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null then perform private.complete_player_referral(new.id);end if;
 return new;
end $$;
revoke all on function private.confirm_player_referral() from public,anon,authenticated;
create trigger confirm_player_referral after update of email_confirmed_at on auth.users
for each row execute function private.confirm_player_referral();
comment on table private.player_referrals is 'Signup referral attribution. confirmed_at records verified joins for future badges; unfriending never removes this history. Deleted invitees are removed; deleted inviters are anonymized.';
commit;
