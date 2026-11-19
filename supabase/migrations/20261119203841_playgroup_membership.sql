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
 group_id uuid primary key references private.playgroups(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null
);
alter table private.playgroups enable row level security;
alter table private.playgroup_members enable row level security;
alter table private.playgroup_invitations enable row level security;
alter table private.playgroup_links enable row level security;
revoke all on private.playgroups,private.playgroup_members,private.playgroup_invitations,private.playgroup_links from public,anon,authenticated;
-- The tables have no client grants/policies. Narrow private functions authorize each
-- read/transition; security invoker public wrappers expose only those operations.
create function private.playgroup_data(target_group uuid default null,invite_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); g private.playgroups; actor_role text;
begin
 if actor is null then raise exception 'Sign in to view playgroups.' using errcode='42501';end if;
 if invite_token is not null then
  if char_length(invite_token)<>64 then raise exception 'This invite link is invalid or expired.';end if;
  select p.* into g from private.playgroups p join private.playgroup_links l on l.group_id=p.id
   where l.token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') and l.expires_at>now();
  if not found then raise exception 'This invite link is invalid or expired.';end if;
  return jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'member_count',(select count(*) from private.playgroup_members where group_id=g.id),
   'is_member',exists(select 1 from private.playgroup_members where group_id=g.id and user_id=actor));
 elsif target_group is not null then
  select p.* into g from private.playgroups p join private.playgroup_members m on m.group_id=p.id where p.id=target_group and m.user_id=actor;
  if not found then raise exception 'This playgroup is unavailable or you are no longer a member.' using errcode='42501';end if;
  select case when actor=g.owner_id then 'owner' else role end into actor_role from private.playgroup_members where group_id=g.id and user_id=actor;
  return jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'role',actor_role,
   'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'handle',p.handle,'display_name',coalesce(nullif(trim(p.display_name),''),p.handle),'role',case when p.id=g.owner_id then 'owner' else m.role end) order by (p.id=g.owner_id) desc,m.role,p.display_name,p.id),'[]'::jsonb) from private.playgroup_members m join public.profiles p on p.id=m.user_id where m.group_id=g.id),
   'invitations',case when actor_role in ('owner','admin') then (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'handle',p.handle,'display_name',coalesce(nullif(trim(p.display_name),''),p.handle)) order by i.created_at,p.id),'[]'::jsonb) from private.playgroup_invitations i join public.profiles p on p.id=i.user_id where i.group_id=g.id) end,
   'link_active',case when actor_role in ('owner','admin') then exists(select 1 from private.playgroup_links where group_id=g.id and expires_at>now()) end);
 end if;
 return jsonb_build_object(
  'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'role',case when p.owner_id=actor then 'owner' else m.role end,'member_count',(select count(*) from private.playgroup_members x where x.group_id=p.id)) order by p.created_at desc,p.id),'[]'::jsonb) from private.playgroups p join private.playgroup_members m on m.group_id=p.id where m.user_id=actor),
  'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'invited_by',coalesce(nullif(trim(sender.display_name),''),sender.handle,'A group administrator')) order by i.created_at desc,p.id),'[]'::jsonb) from private.playgroup_invitations i join private.playgroups p on p.id=i.group_id left join public.profiles sender on sender.id=i.invited_by where i.user_id=actor));
end $$;
create function private.playgroup_action(action text,target_group uuid default null,target_user uuid default null,group_name text default null,group_description text default null,target_handle text default null,invite_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); g private.playgroups; actor_role text; peer_role text; peer uuid; token text;
begin
 if actor is null then raise exception 'Sign in to manage playgroups.' using errcode='42501';end if;
 if action is null or action not in ('create','edit','invite','revoke','accept','decline','leave','remove','promote','demote','transfer','delete','link','accept_link','revoke_link') then raise exception 'Invalid playgroup action.';end if;
 if action in ('create','edit') and (group_name is null or char_length(trim(group_name)) not between 1 and 80 or char_length(coalesce(group_description,''))>500) then raise exception 'Use a group name of 1–80 characters and a description of up to 500 characters.';end if;
 if action='create' then
  if not exists(select 1 from public.profiles where id=actor and nullif(trim(handle),'') is not null) then raise exception 'Choose a username in Account Settings before creating a playgroup.';end if;
  insert into private.playgroups(owner_id,name,description) values(actor,trim(group_name),trim(coalesce(group_description,''))) returning * into g;
  insert into private.playgroup_members(group_id,user_id,role) values(g.id,actor,'admin');return jsonb_build_object('id',g.id);
 end if;
 if action='accept_link' then
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
 elsif action='accept_link' then
  if not exists(select 1 from private.playgroup_links where group_id=g.id and token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') and expires_at>now()) then raise exception 'This invite link is invalid or expired.';end if;
  insert into private.playgroup_members(group_id,user_id) values(g.id,actor) on conflict do nothing;
  delete from private.playgroup_invitations where group_id=g.id and user_id=actor;
 else
  if actor_role is null then raise exception 'You are not a member of this playgroup.' using errcode='42501';end if;
  if action='leave' then
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
   elsif action='link' then
    token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    insert into private.playgroup_links(group_id,token_hash,expires_at) values(g.id,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '30 days')
     on conflict(group_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
    return jsonb_build_object('id',g.id,'token',token,'expires_at',now()+interval '30 days');
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
