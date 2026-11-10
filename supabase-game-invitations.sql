begin;
create table public.game_invitations (
 id uuid primary key default gen_random_uuid(),
 source_game_id uuid not null, -- Snapshot identity only: deliberately no cascading source-game FK.
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 recipient_player_index int not null,
 suggested_deck_id uuid,
 snapshot jsonb not null,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 accepted_game_id uuid, -- Independent record; deleting it must not allow another import.
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 unique(source_game_id,recipient_id),
 check(sender_id<>recipient_id),
 check(recipient_player_index between 1 and 5)
);
create index game_invitations_recipient on public.game_invitations(recipient_id,status,created_at desc);
create index game_invitations_sender on public.game_invitations(sender_id);
alter table public.game_invitations enable row level security;
revoke all on public.game_invitations from public,anon,authenticated;
grant select on public.game_invitations to authenticated;
create policy "Recipients see their own game invitations" on public.game_invitations for select to authenticated using(recipient_id=(select auth.uid()));
alter table public.personal_games add column imported_game_invitation_id uuid unique;
comment on column public.personal_games.imported_game_invitation_id is 'Import marker, not a live relationship. No cascading FK; accepted copies are independent.';
alter table public.friend_notifications drop constraint friend_notifications_kind_check;
alter table public.friend_notifications add constraint friend_notifications_kind_check check(kind in ('request_received','request_accepted','game_tagged'));
alter table public.friend_notifications add column game_invitation_id uuid references public.game_invitations(id) on delete cascade;
create unique index friend_notifications_game_invite on public.friend_notifications(game_invitation_id) where game_invitation_id is not null;
create function public.invite_tagged_game_friends() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; old_item jsonb; tagged uuid; ordinal bigint; invitation uuid; clean_players jsonb; sender_name text; suggested uuid;
begin
 if (tg_op='INSERT' and new.imported_game_invitation_id is not null) or jsonb_typeof(new.players) is distinct from 'array' or jsonb_array_length(new.players) not between 2 and 6 or new.winner_player is null or new.winner_player<0 or new.winner_player>=jsonb_array_length(new.players) then return null;end if;
 select coalesce(nullif(display_name,''),'@'||handle,'Player') into sender_name from public.profiles where id=new.owner_id;
 select jsonb_agg(jsonb_build_object('name',case when p.ordinality=1 then sender_name else p.value->>'name' end,'commander',p.value->>'commander') order by p.ordinality) into clean_players from jsonb_array_elements(new.players) with ordinality p;
 for item,ordinal in select p.value,p.ordinality from jsonb_array_elements(new.players) with ordinality p where p.ordinality>1 loop
  if not (item ? 'friend_id') then continue;end if;
  begin tagged:=(item->>'friend_id')::uuid;suggested:=nullif(item->>'friend_deck_id','')::uuid;exception when invalid_text_representation then continue;end;
  if tagged=new.owner_id or not exists(select 1 from public.friend_connections f where f.status='accepted' and ((f.requester_id=new.owner_id and f.recipient_id=tagged) or (f.recipient_id=new.owner_id and f.requester_id=tagged))) then continue;end if;
  if tg_op='UPDATE' and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(old.players)='array' then old.players else '[]'::jsonb end) p where p->>'friend_id'=tagged::text) then continue;end if;
  insert into public.game_invitations(source_game_id,sender_id,recipient_id,recipient_player_index,suggested_deck_id,snapshot)
  values(new.id,new.owner_id,tagged,(ordinal-1)::int,suggested,jsonb_build_object('played_at',new.played_at,'players',clean_players,'first_player',new.first_player,'winner_player',new.winner_player)) on conflict(source_game_id,recipient_id) do nothing returning id into invitation;
  if invitation is not null then insert into public.friend_notifications(user_id,actor_id,kind,game_invitation_id) values(tagged,new.owner_id,'game_tagged',invitation);end if;
 end loop;
 return null;
end $$;
create trigger invite_tagged_game_friends after insert or update of players on public.personal_games for each row execute function public.invite_tagged_game_friends();
revoke all on function public.invite_tagged_game_friends() from public,anon,authenticated;
create function public.list_game_invitations() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to view game invitations.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'sender_handle',p.handle,'sender_name',p.display_name,'created_at',i.created_at,'snapshot',i.snapshot,'recipient_player_index',i.recipient_player_index,'suggested_deck_id',i.suggested_deck_id) order by i.created_at desc,i.id),'[]'::jsonb) into result
 from public.game_invitations i join public.profiles p on p.id=i.sender_id where i.recipient_id=auth.uid() and i.status='pending';
 return result;
end $$;
create function public.respond_game_invitation(invitation_id uuid,decision text,selected_deck_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select jsonb_agg((p.value-'friend_id'-'friend_deck_id')||case when p.ordinality-1=invite.recipient_player_index then jsonb_build_object('name','You') when p.ordinality=1 then jsonb_build_object('friend_id',invite.sender_id::text) else '{}'::jsonb end order by (p.ordinality-1=invite.recipient_player_index) desc,p.ordinality) into players from jsonb_array_elements(invite.snapshot->'players') with ordinality p;
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
create function public.cancel_unfriended_game_invitations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.game_invitations set status='cancelled',resolved_at=now() where status='pending' and ((sender_id=old.requester_id and recipient_id=old.recipient_id) or (sender_id=old.recipient_id and recipient_id=old.requester_id));
 update public.friend_notifications n set read_at=coalesce(n.read_at,now()) from public.game_invitations i where n.game_invitation_id=i.id and i.status='cancelled' and ((i.sender_id=old.requester_id and i.recipient_id=old.recipient_id) or (i.sender_id=old.recipient_id and i.recipient_id=old.requester_id));
 return null;
end $$;
create trigger cancel_unfriended_game_invitations after delete on public.friend_connections for each row execute function public.cancel_unfriended_game_invitations();
revoke all on function public.cancel_unfriended_game_invitations() from public,anon,authenticated;
revoke all on function public.list_game_invitations(),public.respond_game_invitation(uuid,text,uuid) from public,anon;
grant execute on function public.list_game_invitations(),public.respond_game_invitation(uuid,text,uuid) to authenticated;
commit;
