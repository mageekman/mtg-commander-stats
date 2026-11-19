-- Private, membership-only foundation. No Ledger games, stats, or sharing preferences change.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create table private.playgroups(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 80),
 description text not null default '' check(char_length(description)<=500),
 created_at timestamptz not null default now()
);
create index playgroups_owner_idx on private.playgroups(owner_id);
create table private.playgroup_members(
 group_id uuid not null references private.playgroups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null default 'member' check(role in ('admin','member')),
 joined_at timestamptz not null default now(),primary key(group_id,user_id)
);
create index playgroup_members_user_idx on private.playgroup_members(user_id,group_id);
create table private.playgroup_invitations(
 group_id uuid not null references private.playgroups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 invited_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),primary key(group_id,user_id)
);
create index playgroup_invites_user_idx on private.playgroup_invitations(user_id,group_id);
create index playgroup_invites_sender_idx on private.playgroup_invitations(invited_by);
create table private.playgroup_links(
 group_id uuid not null references private.playgroups(id) on delete cascade,
 inviter_id uuid not null references public.profiles(id) on delete cascade,
 token text not null unique check(char_length(token)=64),
 token_hash text not null unique,
 expires_at timestamptz not null,
 primary key(group_id,inviter_id)
);
create index playgroup_links_inviter_idx on private.playgroup_links(inviter_id);
create table private.playgroup_link_claims(
 group_id uuid not null references private.playgroups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 token_hash text not null,
 state text not null default 'pending' check(state in ('pending','accepted','declined')),
 primary key(user_id,token_hash)
);
create index playgroup_link_claims_group_idx on private.playgroup_link_claims(group_id,user_id);
alter table private.playgroups enable row level security;
alter table private.playgroup_members enable row level security;
alter table private.playgroup_invitations enable row level security;
alter table private.playgroup_links enable row level security;
alter table private.playgroup_link_claims enable row level security;
revoke all on private.playgroups,private.playgroup_members,private.playgroup_invitations,private.playgroup_links,private.playgroup_link_claims from public,anon,authenticated;
-- Group invitations participate in the existing Friends badge and notice history.
alter table public.friend_notifications drop constraint friend_notifications_kind_check;
alter table public.friend_notifications add constraint friend_notifications_kind_check check(kind in('request_received','request_accepted','game_tagged','invite_joined','playgroup_invited'));
alter table public.friend_notifications add column playgroup_id uuid references private.playgroups(id) on delete cascade;
create unique index friend_notifications_playgroup_invite on public.friend_notifications(playgroup_id,user_id) where kind='playgroup_invited';
create function private.playgroup_invite_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and new.invited_by is not null and new.invited_by<>new.user_id then
  insert into public.friend_notifications(user_id,actor_id,kind,playgroup_id) values(new.user_id,new.invited_by,'playgroup_invited',new.group_id)
  on conflict(playgroup_id,user_id) where kind='playgroup_invited' do update set actor_id=excluded.actor_id,created_at=now(),read_at=null;
 elsif tg_op='DELETE' then delete from public.friend_notifications where playgroup_id=old.group_id and user_id=old.user_id and kind='playgroup_invited';end if;
 return null;
end $$;
revoke all on function private.playgroup_invite_notification() from public,anon,authenticated;
create trigger playgroup_invitation_notifications after insert or delete on private.playgroup_invitations for each row execute function private.playgroup_invite_notification();
-- This receives an untrusted bearer token, validates it against the database, and
-- records only a pending invitation. It never grants membership from metadata.
create function private.capture_playgroup_link(invitee uuid,code text) returns uuid language plpgsql security definer set search_path='' as $$
declare link private.playgroup_links; g private.playgroups;
begin
 if code is null or char_length(code)<>64 then return null;end if;
 select l.* into link from private.playgroup_links l where l.token_hash=encode(sha256(convert_to(code,'UTF8')),'hex') and l.expires_at>now();
 if not found then return null;end if;
 select * into g from private.playgroups where id=link.group_id for update;
 if not found or not exists(select 1 from private.playgroup_links l join private.playgroup_members m on m.group_id=l.group_id and m.user_id=l.inviter_id where l.group_id=g.id and l.token_hash=link.token_hash and l.expires_at>now()) then return null;end if;
 if exists(select 1 from private.playgroup_members where group_id=g.id and user_id=invitee) then return g.id;end if;
 insert into private.playgroup_link_claims(group_id,user_id,token_hash) values(g.id,invitee,link.token_hash) on conflict do nothing;
 if found then insert into private.playgroup_invitations(group_id,user_id,invited_by) values(g.id,invitee,link.inviter_id) on conflict do nothing;end if;
 return g.id;
end $$;
revoke all on function private.capture_playgroup_link(uuid,text) from public,anon,authenticated;
create function private.capture_playgroup_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare code text;
begin
 select raw_user_meta_data->>'playgroup_invite_token' into code from auth.users where id=new.id;
 perform private.capture_playgroup_link(new.id,code);return new;
end $$;
revoke all on function private.capture_playgroup_signup() from public,anon,authenticated;
create trigger capture_playgroup_signup_invitation after insert on public.profiles for each row execute function private.capture_playgroup_signup();
-- The tables have no client grants/policies. Narrow private functions authorize each
-- read/transition; security invoker public wrappers expose only those operations.
create function private.playgroup_data(target_group uuid default null,invite_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();g private.playgroups;actor_role text;inviter uuid;inviter_handle text;
begin
 if actor is null then raise exception 'Sign in to view playgroups.' using errcode='42501';end if;
 if invite_token is not null then
  if char_length(invite_token)<>64 then raise exception 'This invite link is invalid or expired.';end if;
  select l.group_id,l.inviter_id into target_group,inviter from private.playgroup_links l
   join private.playgroup_members m on m.group_id=l.group_id and m.user_id=l.inviter_id
   where l.token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') and l.expires_at>now();
  if not found then raise exception 'This invite link is invalid or expired.';end if;
  select * into g from private.playgroups where id=target_group;
 elsif target_group is not null then
  select * into g from private.playgroups where id=target_group;
  select invited_by into inviter from private.playgroup_invitations where group_id=target_group and user_id=actor;
  if g.id is null or (not exists(select 1 from private.playgroup_invitations where group_id=g.id and user_id=actor) and not exists(select 1 from private.playgroup_members where group_id=g.id and user_id=actor)) then raise exception 'This playgroup is unavailable or you are no longer invited.' using errcode='42501';end if;
 end if;
 if g.id is not null then
  select case when actor=g.owner_id then 'owner' else role end into actor_role from private.playgroup_members where group_id=g.id and user_id=actor;
  select handle into inviter_handle from public.profiles where id=inviter;
  return jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'role',coalesce(actor_role,'invited'),'is_member',actor_role is not null,'inviter_handle',inviter_handle,
   'member_count',(select count(*) from private.playgroup_members where group_id=g.id),
   'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'handle',p.handle,'display_name',coalesce(nullif(trim(p.display_name),''),p.handle),'role',case when p.id=g.owner_id then 'owner' else m.role end) order by (p.id=g.owner_id) desc,m.role,p.display_name,p.id),'[]'::jsonb) from private.playgroup_members m join public.profiles p on p.id=m.user_id where m.group_id=g.id),
   'invitations',case when actor_role in ('owner','admin') then (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'handle',p.handle,'display_name',coalesce(nullif(trim(p.display_name),''),p.handle)) order by i.created_at,p.id),'[]'::jsonb) from private.playgroup_invitations i join public.profiles p on p.id=i.user_id where i.group_id=g.id) end);
 end if;
 return jsonb_build_object(
  'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'role',case when p.owner_id=actor then 'owner' else m.role end,'member_count',(select count(*) from private.playgroup_members x where x.group_id=p.id)) order by p.created_at desc,p.id),'[]'::jsonb) from private.playgroups p join private.playgroup_members m on m.group_id=p.id where m.user_id=actor),
  'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'inviter_handle',sender.handle,'invited_by',coalesce(nullif(trim(sender.display_name),''),sender.handle,'A group administrator')) order by i.created_at desc,p.id),'[]'::jsonb) from private.playgroup_invitations i join private.playgroups p on p.id=i.group_id left join public.profiles sender on sender.id=i.invited_by where i.user_id=actor));
end $$;
create function private.playgroup_action(action text,target_group uuid default null,target_user uuid default null,group_name text default null,group_description text default null,target_handle text default null,invite_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); g private.playgroups; actor_role text; peer_role text; peer uuid; token text;
begin
 if actor is null then raise exception 'Sign in to manage playgroups.' using errcode='42501';end if;
 if action is null or action not in ('create','edit','invite','revoke','accept','decline','leave','remove','promote','demote','transfer','delete','link','copy_link','reset_link','claim_link','decline_link','accept_link','revoke_link') then raise exception 'Invalid playgroup action.';end if;
 if action in ('create','edit') and (group_name is null or char_length(trim(group_name)) not between 1 and 80 or char_length(coalesce(group_description,''))>500) then raise exception 'Use a group name of 1–80 characters and a description of up to 500 characters.';end if;
 if action='create' then
  if not exists(select 1 from public.profiles where id=actor and nullif(trim(handle),'') is not null) then raise exception 'Choose a username in Account Settings before creating a playgroup.';end if;
  insert into private.playgroups(owner_id,name,description) values(actor,trim(group_name),trim(coalesce(group_description,''))) returning * into g;
  insert into private.playgroup_members(group_id,user_id,role) values(g.id,actor,'admin');return jsonb_build_object('id',g.id);
 end if;
 if action='claim_link' then
  peer:=private.capture_playgroup_link(actor,invite_token);if peer is null then raise exception 'This invite link is invalid or expired.';end if;return jsonb_build_object('id',peer);
 end if;
 if action in ('accept_link','decline_link') then
  if invite_token is null or char_length(invite_token)<>64 then raise exception 'This invite link is invalid or expired.';end if;
  select group_id into target_group from private.playgroup_links where token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') and expires_at>now();
 end if;
 -- Every mutation of an existing group takes the same lock before authorization.
 -- This serializes joins, removals, role changes, link revocation, and transfer.
 select * into g from private.playgroups where id=target_group for update;
 if not found then raise exception 'This playgroup or invitation is unavailable.' using errcode='42501';end if;
 select case when actor=g.owner_id then 'owner' else role end into actor_role from private.playgroup_members where group_id=g.id and user_id=actor;
 if action in ('accept','decline') then
  if not exists(select 1 from private.playgroup_invitations where group_id=g.id and user_id=actor) then raise exception 'This invitation is no longer available.' using errcode='42501';end if;
  if action='accept' then insert into private.playgroup_members(group_id,user_id) values(g.id,actor) on conflict do nothing;end if;
  delete from private.playgroup_invitations where group_id=g.id and user_id=actor;
  update private.playgroup_link_claims set state=case when action='accept' then 'accepted' else 'declined' end where group_id=g.id and user_id=actor;
 elsif action in ('accept_link','decline_link') then
  if not exists(select 1 from private.playgroup_links l join private.playgroup_members m on m.group_id=l.group_id and m.user_id=l.inviter_id where l.group_id=g.id and l.token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') and l.expires_at>now()) then raise exception 'This invite link is invalid or expired.';end if;
  if action='accept_link' then insert into private.playgroup_members(group_id,user_id) values(g.id,actor) on conflict do nothing;end if;
  insert into private.playgroup_link_claims(group_id,user_id,token_hash,state) values(g.id,actor,encode(sha256(convert_to(invite_token,'UTF8')),'hex'),case when action='accept_link' then 'accepted' else 'declined' end) on conflict(user_id,token_hash) do update set state=excluded.state;
  delete from private.playgroup_invitations where group_id=g.id and user_id=actor;
 else
  if actor_role is null then raise exception 'You are not a member of this playgroup.' using errcode='42501';end if;
  if action='copy_link' then
   select l.token into token from private.playgroup_links l where l.group_id=g.id and l.inviter_id=actor and l.expires_at>now();
   if token is null then
    token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    insert into private.playgroup_links(group_id,inviter_id,token,token_hash,expires_at) values(g.id,actor,token,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '30 days') on conflict(group_id,inviter_id) do update set token=excluded.token,token_hash=excluded.token_hash,expires_at=excluded.expires_at;
   end if;
   return jsonb_build_object('id',g.id,'token',token);
  elsif action='leave' then
   if actor_role='owner' then raise exception 'Transfer ownership or delete the playgroup before leaving.';end if;
   delete from private.playgroup_members where group_id=g.id and user_id=actor;
  else
   if actor_role not in ('owner','admin') then raise exception 'Only group administrators can do that.' using errcode='42501';end if;
   if action='edit' then
    update private.playgroups set name=trim(group_name),description=trim(coalesce(group_description,'')) where id=g.id;
   elsif action='invite' then
    select id into peer from public.profiles where handle=lower(trim(target_handle));
    if peer is null then raise exception 'Player not found. Enter their username.';end if;
    if exists(select 1 from private.playgroup_members where group_id=g.id and user_id=peer) then raise exception 'That player is already a member.';end if;
    insert into private.playgroup_invitations(group_id,user_id,invited_by) values(g.id,peer,actor) on conflict do nothing;
   elsif action='revoke' then
    delete from private.playgroup_invitations where group_id=g.id and user_id=target_user;
   elsif action in ('link','reset_link') then
    delete from private.playgroup_links where group_id=g.id;
    token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    insert into private.playgroup_links(group_id,inviter_id,token,token_hash,expires_at) values(g.id,actor,token,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '30 days');
    return jsonb_build_object('id',g.id,'token',token);
   elsif action='revoke_link' then delete from private.playgroup_links where group_id=g.id;
   elsif action in ('remove','promote','demote','transfer') then
    select role into peer_role from private.playgroup_members where group_id=g.id and user_id=target_user;
    if peer_role is null then raise exception 'That player is no longer a member.';end if;
    if target_user=g.owner_id or target_user=actor then raise exception 'Use the ownership or leave controls for your own membership.';end if;
    if action='remove' then
     if actor_role<>'owner' and peer_role<>'member' then raise exception 'Only the owner can remove an administrator.' using errcode='42501';end if;
     delete from private.playgroup_members where group_id=g.id and user_id=target_user;
    else
     if actor_role<>'owner' then raise exception 'Only the owner can change roles or transfer ownership.' using errcode='42501';end if;
     if action='transfer' then
      update private.playgroups set owner_id=target_user where id=g.id;
      update private.playgroup_members set role='admin' where group_id=g.id and user_id=target_user;
     else update private.playgroup_members set role=case when action='promote' then 'admin' else 'member' end where group_id=g.id and user_id=target_user;end if;
    end if;
   elsif action='delete' then
    if actor_role<>'owner' then raise exception 'Only the owner can delete a playgroup.' using errcode='42501';end if;
    delete from private.playgroups where id=g.id;
   end if;
  end if;
 end if;
 return jsonb_build_object('id',g.id);
end $$;
revoke all on function private.playgroup_data(uuid,text),private.playgroup_action(text,uuid,uuid,text,text,text,text) from public,anon;
grant execute on function private.playgroup_data(uuid,text),private.playgroup_action(text,uuid,uuid,text,text,text,text) to authenticated;
create function public.get_playgroups(target_group uuid default null,invite_token text default null)
returns jsonb language sql stable security invoker set search_path='' as $$select private.playgroup_data(target_group,invite_token)$$;
create function public.playgroup_action(action text,target_group uuid default null,target_user uuid default null,group_name text default null,group_description text default null,target_handle text default null,invite_token text default null)
returns jsonb language sql security invoker set search_path='' as $$select private.playgroup_action(action,target_group,target_user,group_name,group_description,target_handle,invite_token)$$;
revoke all on function public.get_playgroups(uuid,text),public.playgroup_action(text,uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.get_playgroups(uuid,text),public.playgroup_action(text,uuid,uuid,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
