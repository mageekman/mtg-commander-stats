-- Generated fixtures only; all users, games, requests and notifications roll back.
begin;
create temp table retag_users(code text,id uuid,handle text,deck uuid);
insert into retag_users select code,gen_random_uuid(),'retag_'||code||'_'||substr(md5(random()::text),1,8),gen_random_uuid() from (values('a'),('b'),('c')) x(code);
insert into auth.users(id,email,raw_user_meta_data) select id,handle||'@example.invalid',jsonb_build_object('display_name',code) from retag_users;
insert into public.profiles(id,handle,display_name) select id,handle,code from retag_users on conflict(id) do update set handle=excluded.handle;
insert into public.decks(id,owner_id,name,commander) select deck,id,'Retag test','Sol Ring' from retag_users;
insert into public.friend_connections(requester_id,recipient_id,status,accepted_at) select a.id,b.id,'accepted',now() from retag_users a cross join retag_users b where a.code='a' and b.code in ('b','c');
do $$
declare actor uuid; friend uuid; third uuid; own_deck uuid; friend_deck uuid; source uuid; invitation uuid; notice_id uuid; imported uuid; original_snapshot jsonb; manual jsonb; tagged jsonb; state text;
begin
 select id,deck into actor,own_deck from retag_users where code='a';select id,deck into friend,friend_deck from retag_users where code='b';select id into third from retag_users where code='c';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 manual:=jsonb_build_array(jsonb_build_object('name','You','commander','Sol Ring'),jsonb_build_object('name','Opponent','commander','Sol Ring'));
 tagged:=jsonb_set(manual,'{1,friend_id}',to_jsonb(friend::text));
 insert into public.personal_games(owner_id,deck_id,played_at,won,players,first_player,winner_player) values(actor,own_deck,'2026-11-11',true,manual,0,0) returning id into source;
 if exists(select 1 from public.game_invitations where source_game_id=source) then raise exception 'Untagged game created a request';end if;
 -- First tag on an existing game must send one request and one notification.
 update public.personal_games set players=tagged where id=source;
 select id,snapshot into invitation,original_snapshot from public.game_invitations where source_game_id=source and recipient_id=friend;
 if invitation is null then raise exception 'Tagging during edit did not create a request';end if;
 select id into notice_id from public.friend_notifications where game_invitation_id=invitation;
 if notice_id is null then raise exception 'Edit request did not notify recipient';end if;
 -- Pending, declined, accepted and cancelled invitations all retain their identity.
 foreach state in array array['pending','declined','accepted','cancelled'] loop
  if state='declined' then
   perform set_config('request.jwt.claim.sub',friend::text,true);perform public.respond_game_invitation(invitation,'decline');
  elsif state='accepted' then
   -- A fresh pending state simulates another lifecycle without extra fixtures.
   update public.game_invitations set status='pending',resolved_at=null where id=invitation;
   perform set_config('request.jwt.claim.sub',friend::text,true);
   imported:=(public.respond_game_invitation(invitation,'accept',friend_deck)->>'game_id')::uuid;
  elsif state='cancelled' then
   update public.game_invitations set status='cancelled',resolved_at=now() where id=invitation;
  end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if state<>'pending' then update public.friend_notifications set read_at=coalesce(read_at,now()) where id=notice_id;end if;
  update public.personal_games set players=manual where id=source;
  update public.personal_games set players=tagged where id=source;
  update public.personal_games set players=tagged,notes='Ordinary repeated save' where id=source;
  if (select count(*) from public.game_invitations where source_game_id=source and recipient_id=friend)<>1 then raise exception 'Duplicate request after % retag',state;end if;
  if not exists(select 1 from public.game_invitations i where i.id=invitation and i.status=state and i.snapshot=original_snapshot) then raise exception 'Existing % request was changed',state;end if;
  if (select count(*) from public.friend_notifications where game_invitation_id=invitation)<>1 or not exists(select 1 from public.friend_notifications where id=notice_id) then raise exception 'Duplicate/replaced notification after % retag',state;end if;
  if state<>'pending' and exists(select 1 from public.friend_notifications where id=notice_id and read_at is null) then raise exception 'Retag made an old notification unread';end if;
 end loop;
 if not exists(select 1 from public.personal_games where id=imported and owner_id=friend) then raise exception 'Retag changed accepted copy';end if;
 -- A different friend tagged in the same edit still gets their first request.
 update public.personal_games set players=tagged||jsonb_build_array(jsonb_build_object('name','Third','commander','Sol Ring','friend_id',third::text)) where id=source;
 if (select count(*) from public.game_invitations where source_game_id=source)<>2 then raise exception 'Another friend did not receive exactly one first request';end if;
 if (select count(*) from public.friend_notifications n join public.game_invitations i on i.id=n.game_invitation_id where i.source_game_id=source)<>2 then raise exception 'Another friend notification missing or duplicated';end if;
 raise notice 'PASS edit tagging sends one request; repeated saves and pending/declined/accepted/cancelled retags never resend; notifications and accepted copy preserved; another friend gets their own request';
end $$;
rollback;
