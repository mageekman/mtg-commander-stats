-- Explicit, optional sharing. Existing Ledger games stay unassigned.
alter table public.personal_games add column playgroup_id uuid references private.playgroups(id) on delete set null;
alter table public.personal_games add column shared_game_id uuid;
create index personal_games_playgroup_idx on public.personal_games(playgroup_id) where playgroup_id is not null;
create index personal_games_shared_game_idx on public.personal_games(shared_game_id) where shared_game_id is not null;
create index game_invitations_accepted_lookup on public.game_invitations(accepted_game_id) where accepted_game_id is not null;
create table private.playgroup_games(
 group_id uuid not null references private.playgroups(id) on delete cascade,
 event_id uuid not null,
 source_game_id uuid not null,
 recorded_by uuid references public.profiles(id) on delete set null,
 snapshot jsonb not null,
 played_at date not null,
 created_at timestamptz not null default now(),
 primary key(group_id,event_id)
);
create index playgroup_games_recent_idx on private.playgroup_games(group_id,played_at desc,event_id);
create index playgroup_games_recorder_idx on private.playgroup_games(recorded_by);
alter table private.playgroup_games enable row level security;
revoke all on private.playgroup_games from public,anon,authenticated;
-- Resolve the same identity for independent accepted copies, even if an older
-- source Ledger record has been deleted. No backfill touches existing games.
create function private.ledger_game_identity(game_id uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare current_id uuid:=game_id;known uuid;invite uuid;source uuid;seen uuid[]:='{}';
begin
 loop
  if current_id=any(seen) then raise exception 'Invalid shared game lineage.';end if;
  seen:=array_append(seen,current_id);
  select shared_game_id,imported_game_invitation_id into known,invite from public.personal_games where id=current_id;
  if known is not null then return known;end if;
  if invite is null then select id into invite from public.game_invitations where accepted_game_id=current_id order by created_at,id limit 1;end if;
  if invite is null then return current_id;end if;
  select source_game_id into source from public.game_invitations where id=invite;
  if source is null then return current_id;end if;
  current_id:=source;invite:=null;
 end loop;
end $$;
revoke all on function private.ledger_game_identity(uuid) from public,anon,authenticated;
create function private.prepare_playgroup_game() returns trigger language plpgsql security definer set search_path='' as $$
declare source uuid;
begin
 if tg_op='UPDATE' then new.shared_game_id:=coalesce(old.shared_game_id,private.ledger_game_identity(old.id));
 elsif new.imported_game_invitation_id is not null then
  select source_game_id into source from public.game_invitations where id=new.imported_game_invitation_id and recipient_id=new.owner_id;
  if source is null then raise exception 'Invalid shared game invitation.' using errcode='42501';end if;
  new.shared_game_id:=private.ledger_game_identity(source);
 else new.shared_game_id:=new.id;end if;
 if new.playgroup_id is null then return new;end if;
 -- Existing system updates (for example unlinking a former friend) must remain independent.
 if tg_op='UPDATE' and new.playgroup_id is not distinct from old.playgroup_id then return new;end if;
 if not exists(select 1 from private.playgroup_members where group_id=new.playgroup_id and user_id=new.owner_id) then
  if tg_op='UPDATE' and new.playgroup_id is not distinct from old.playgroup_id then return new;end if;
  raise exception 'Join this playgroup before sharing a game with it.' using errcode='42501';
 end if;
 if auth.uid() is distinct from new.owner_id then raise exception 'Only the game owner can share this record.' using errcode='42501';end if;
 if jsonb_typeof(new.players) is distinct from 'array' or jsonb_array_length(new.players) not between 2 and 6 or new.winner_player is null or new.winner_player<0 or new.winner_player>=jsonb_array_length(new.players) then raise exception 'Record the players and winner before sharing this game.';end if;
 return new;
end $$;
revoke all on function private.prepare_playgroup_game() from public,anon,authenticated;
create trigger prepare_playgroup_game before insert or update on public.personal_games for each row execute function private.prepare_playgroup_game();
-- Keep group snapshots independent: other players' edits/deletions never sync.
-- A copy cannot overwrite the first submitted group record for the same event.
create function private.share_playgroup_game() returns trigger language plpgsql security definer set search_path='' as $$
declare players jsonb;recorder text;deck_name text;
begin
 if tg_op='UPDATE' and new.playgroup_id is not distinct from old.playgroup_id then return null;end if;
 if new.playgroup_id is null or auth.uid() is distinct from new.owner_id or not exists(select 1 from private.playgroup_members where group_id=new.playgroup_id and user_id=new.owner_id) then return null;end if;
 select coalesce(nullif(trim(display_name),''),handle,'Player') into recorder from public.profiles where id=new.owner_id;
 select name into deck_name from public.decks where id=new.deck_id and owner_id=new.owner_id;
 select jsonb_agg(jsonb_build_object('name',case when p.ordinality=1 then recorder else coalesce((select coalesce(nullif(trim(person.display_name),''),person.handle) from private.playgroup_members m join public.profiles person on person.id=m.user_id where m.group_id=new.playgroup_id and m.user_id::text=coalesce(p.value->>'friend_id',p.value->>'participant_id')),nullif(trim(p.value->>'name'),''),nullif(trim(p.value->>'commander'),''),'Player') end,'commander',p.value->>'commander')||
  case when p.ordinality=1 then jsonb_build_object('participant_id',new.owner_id) when exists(select 1 from private.playgroup_members m where m.group_id=new.playgroup_id and m.user_id::text=coalesce(p.value->>'friend_id',p.value->>'participant_id')) then jsonb_build_object('participant_id',coalesce(p.value->>'friend_id',p.value->>'participant_id')) else '{}'::jsonb end order by p.ordinality) into players from jsonb_array_elements(new.players) with ordinality p;
 insert into private.playgroup_games(group_id,event_id,source_game_id,recorded_by,played_at,snapshot)
 values(new.playgroup_id,new.shared_game_id,new.id,new.owner_id,new.played_at,jsonb_build_object('played_at',new.played_at,'players',players,'first_player',new.first_player,'winner_player',new.winner_player,'deck_name',deck_name))
 on conflict(group_id,event_id) do nothing;
 return null;
end $$;
revoke all on function private.share_playgroup_game() from public,anon,authenticated;
create trigger share_playgroup_game after insert or update on public.personal_games for each row execute function private.share_playgroup_game();
-- Allow recorded co-members as participants without granting friend-only deck access.
do $patch$
declare definition text;old_fragment text:='friends or exists(select 1 from jsonb_array_elements(trusted)';new_fragment text:='friends or exists(select 1 from private.playgroup_members mine join private.playgroup_members peer on peer.group_id=mine.group_id where mine.user_id=owner and peer.user_id=account) or exists(select 1 from jsonb_array_elements(trusted)';
begin
 definition:=pg_get_functiondef('private.normalize_recorded_game_players(uuid,jsonb,uuid,jsonb)'::regprocedure);
 if position(old_fragment in definition)=0 then raise exception 'Inspect participant normalization before applying playgroup support.';end if;
 execute replace(definition,old_fragment,new_fragment);
end $patch$;
create function private.playgroup_game_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in to choose a playgroup.' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'handle',p.handle,'display_name',p.display_name)),'[]'::jsonb) from private.playgroup_members m join public.profiles p on p.id=m.user_id where m.group_id=g.id)) order by g.name,g.id),'[]'::jsonb) from private.playgroups g join private.playgroup_members mine on mine.group_id=g.id where mine.user_id=actor);
end $$;
create function private.read_playgroup_games(target_group uuid,page_number int default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();page int:=greatest(1,coalesce(page_number,1));
begin
 if actor is null or not exists(select 1 from private.playgroup_members where group_id=target_group and user_id=actor) then raise exception 'Only members can view playgroup games.' using errcode='42501';end if;
 return jsonb_build_object('total',(select count(*) from private.playgroup_games where group_id=target_group),'page',page,'games',(select coalesce(jsonb_agg(to_jsonb(rows) order by rows.played_at desc,rows.event_id),'[]'::jsonb) from (select event_id,played_at,snapshot from private.playgroup_games where group_id=target_group order by played_at desc,event_id limit 5 offset (page-1)::bigint*5) rows));
end $$;
revoke all on function private.playgroup_game_options(),private.read_playgroup_games(uuid,int) from public,anon;
grant execute on function private.playgroup_game_options(),private.read_playgroup_games(uuid,int) to authenticated;
create function public.get_playgroup_game_options() returns jsonb language sql stable security invoker set search_path='' as $$select private.playgroup_game_options()$$;
create function public.get_playgroup_games(target_group uuid,page_number int default 1) returns jsonb language sql stable security invoker set search_path='' as $$select private.read_playgroup_games(target_group,page_number)$$;
revoke all on function public.get_playgroup_game_options(),public.get_playgroup_games(uuid,int) from public,anon;
grant execute on function public.get_playgroup_game_options(),public.get_playgroup_games(uuid,int) to authenticated;
notify pgrst,'reload schema';
