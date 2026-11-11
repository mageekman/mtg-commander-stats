-- Generated fixtures only; every record and relationship rolls back.
begin;
create temp table participant_test_users(code text,id uuid,handle text,deck uuid);
insert into participant_test_users select code,gen_random_uuid(),'party_'||code||'_'||substr(md5(random()::text),1,8),gen_random_uuid() from (values('a'),('b'),('c'),('x')) v(code);
insert into auth.users(id,email,raw_user_meta_data) select id,id::text||'@example.invalid',jsonb_build_object('username',handle,'display_name',code) from participant_test_users;
update public.profiles set share_games_together=true,share_friend_results=true,share_deck_stats=true where id in(select id from participant_test_users);
insert into public.decks(id,owner_id,name,commander) select deck,id,code||' deck',code||' commander' from participant_test_users;
insert into public.friend_connections(requester_id,recipient_id,status,accepted_at) select a.id,b.id,'accepted',now() from participant_test_users a cross join participant_test_users b where (a.code='a' and b.code in('b','c')) or (a.code='b' and b.code='c');
do $$
declare a uuid;b uuid;c uuid;x uuid;ad uuid;bd uuid;bh text;ch text;ah text;source uuid;copy uuid;invite uuid;payload jsonb;saved jsonb;second uuid;legacy uuid;
begin
 select id,deck,handle into a,ad,ah from participant_test_users where code='a';select id,deck,handle into b,bd,bh from participant_test_users where code='b';select id,handle into c,ch from participant_test_users where code='c';select id into x from participant_test_users where code='x';
 payload:=jsonb_build_array(jsonb_build_object('name','You','commander','a commander'),jsonb_build_object('name','b','commander','b commander','friend_id',b::text),jsonb_build_object('name','c','commander','c commander','friend_id',c::text));
 perform set_config('request.jwt.claim.sub',a::text,true);
 insert into public.personal_games(owner_id,deck_id,won,players,first_player,winner_player) values(a,ad,false,payload,0,2) returning id into source;
 select id into invite from public.game_invitations where source_game_id=source and recipient_id=b;
 perform set_config('request.jwt.claim.sub',b::text,true);copy:=(public.respond_game_invitation(invite,'accept',bd)->>'game_id')::uuid;
 select players into saved from public.personal_games where id=copy;
 if saved->2->>'friend_id' is distinct from c::text or saved->2->>'participant_id' is distinct from c::text or saved->2->>'commander'<>'c commander' then raise exception 'Shared friend missing from imported game';end if;
 if exists(select 1 from public.get_played_with_players() where player_id=c) then raise exception 'Current friend in nonfriend list';end if;
 if not exists(select 1 from jsonb_array_elements(public.get_shared_ledger_stats_v2(bh)->'games_together') p where p->>'name'='c') then raise exception 'Shared friend missing from public friend stats';end if;
 perform public.friend_action(ch,'remove');select players into saved from public.personal_games where id=copy;
 if saved->2 ? 'friend_id' or saved->2->>'participant_id' is distinct from c::text then raise exception 'Unfriend must detach friendship but retain recorded identity';end if;
 if not exists(select 1 from public.get_played_with_players() where player_id=c and games=1 and relationship='none') then raise exception 'Played-with nonfriend missing';end if;
 if exists(select 1 from jsonb_array_elements(public.get_shared_ledger_stats_v2(bh)->'games_together') p where p->>'name'='c') then raise exception 'Nonfriend leaked into friend stats';end if;
 perform public.friend_action(ah,'remove');
 if public.get_recent_friend_games()<>'[]'::jsonb then raise exception 'Game with no current friends on Friends dashboard';end if;
 -- Becoming friends later includes previously recorded participation, without a save.
 perform public.friend_action(ch,'send');perform set_config('request.jwt.claim.sub',c::text,true);perform public.friend_action(bh,'accept');perform set_config('request.jwt.claim.sub',b::text,true);
 if jsonb_array_length(public.get_recent_friend_games())<>1 then raise exception 'Recorded game missing after new friendship';end if;
 if exists(select 1 from public.get_played_with_players() where player_id=c) then raise exception 'New friend remains in nonfriend list';end if;
 perform public.friend_action(ch,'remove');
 -- Restore sender friendship so a second invitation can be accepted while C is not a friend.
 perform public.friend_action(ah,'send');perform set_config('request.jwt.claim.sub',a::text,true);perform public.friend_action(bh,'accept');
 insert into public.personal_games(owner_id,deck_id,won,players,first_player,winner_player) values(a,ad,false,payload,1,2) returning id into second;
 -- Simulate legacy snapshots that did not store participant IDs; sibling invites prove identity.
 update public.game_invitations i set snapshot=jsonb_set(i.snapshot,'{players}',(select jsonb_agg(p.value-'participant_id' order by p.ordinality) from jsonb_array_elements(i.snapshot->'players') with ordinality p)) where source_game_id=second;
 select id into invite from public.game_invitations where source_game_id=second and recipient_id=b;
 perform set_config('request.jwt.claim.sub',b::text,true);legacy:=(public.respond_game_invitation(invite,'accept',bd)->>'game_id')::uuid;
 select players into saved from public.personal_games where id=legacy;
 if saved->2 ? 'friend_id' or saved->2->>'participant_id' is distinct from c::text or saved->2->>'name'<>'c' then raise exception 'Legacy nonfriend participant was not recovered';end if;
 update public.personal_games set players=players,notes='Independent edit' where id=legacy;
 if exists(select 1 from public.game_invitations where source_game_id in(copy,legacy)) then raise exception 'Imported game sent duplicate invitations to existing participants';end if;
 if not exists(select 1 from public.get_played_with_players() where player_id=c and games=2) then raise exception 'Own-ledger game count wrong';end if;
 -- Only account IDs proven by a friend link, saved history, or an owned invite survive.
 insert into public.personal_games(owner_id,deck_id,won,players) values(b,bd,true,jsonb_build_array(jsonb_build_object('name','You'),jsonb_build_object('name','Spoof','participant_id',x::text))) returning id into source;
 if (select players->1 ? 'participant_id' from public.personal_games where id=source) then raise exception 'Unrelated account identity spoofed';end if;
 perform set_config('request.jwt.claim.sub',x::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.get_played_with_players()) then raise exception 'Another user played-with history leaked';end if;execute 'reset role';
 if has_function_privilege('anon','public.get_played_with_players(int,int)','EXECUTE') or has_function_privilege('authenticated','private.game_invitation_players(uuid)','EXECUTE') then raise exception 'Participant internals exposed';end if;
 begin perform public.get_played_with_players(51,0);raise exception 'Unbounded page accepted';exception when invalid_parameter_value then null;end;
 raise notice 'PASS all shared participants, current-friend stats only, unfriend identity, played-with list, later friendship, legacy snapshots, no invitation loops, no forged accounts, owner scope and pagination';
end $$;
rollback;
