begin;
create temp table recent_friend_test_users(code text,id uuid,handle text);
insert into recent_friend_test_users select code,gen_random_uuid(),'recent_'||code||'_'||substr(md5(random()::text),1,8) from (values('a'),('b'),('c')) x(code);
insert into auth.users(id,email,raw_user_meta_data) select id,handle||'@example.invalid',jsonb_build_object('display_name',code) from recent_friend_test_users;
insert into public.profiles(id,handle,display_name) select id,handle,code from recent_friend_test_users on conflict(id) do update set handle=excluded.handle;
insert into public.friend_connections(requester_id,recipient_id,status,accepted_at) select a.id,b.id,'accepted',now() from recent_friend_test_users a cross join recent_friend_test_users b where a.code='a' and b.code='b';
create temp table recent_friend_test_decks(id uuid,owner_id uuid);
insert into recent_friend_test_decks select gen_random_uuid(),id from recent_friend_test_users;
insert into public.decks(id,owner_id,name,commander,decklist) select id,owner_id,'Recent fixture','Commander','' from recent_friend_test_decks;
insert into public.personal_games(owner_id,deck_id,played_at,won,players,notes) select a.id,d.id,current_date-i,true,jsonb_build_array(jsonb_build_object('name','You','commander','Mine'),jsonb_build_object('name','Friend','commander','Theirs','friend_id',b.id::text)),'own tagged '||i from recent_friend_test_users a join recent_friend_test_decks d on d.owner_id=a.id cross join recent_friend_test_users b cross join generate_series(1,7) i where a.code='a' and b.code='b';
-- A newer untagged game must not displace tagged records.
insert into public.personal_games(owner_id,deck_id,played_at,won,players,notes) select a.id,d.id,current_date,true,'[{"name":"Friend","commander":"Manual name only"}]','own untagged' from recent_friend_test_users a join recent_friend_test_decks d on d.owner_id=a.id where a.code='a';
-- A friend's private Ledger entry must never appear in the caller's dashboard.
insert into public.personal_games(owner_id,deck_id,played_at,won,players,notes) select b.id,d.id,current_date,true,jsonb_build_array(jsonb_build_object('name','Friend','commander','Private','friend_id',a.id::text)),'private friend record' from recent_friend_test_users b join recent_friend_test_decks d on d.owner_id=b.id cross join recent_friend_test_users a where b.code='b' and a.code='a';
do $$
declare own uuid; other_id uuid; handle text; result jsonb;
begin
 select id into own from recent_friend_test_users where code='a';select id,recent_friend_test_users.handle into other_id,handle from recent_friend_test_users where code='b';
 perform set_config('request.jwt.claim.sub',own::text,true);
 execute 'set local role authenticated';
 result:=public.get_recent_friend_games();
 if jsonb_array_length(result)<>5 then raise exception 'Expected five filtered games';end if;
 if result->0->>'notes'<>'own tagged 1' or result->4->>'notes'<>'own tagged 5' then raise exception 'Incorrect recent ordering or filtering';end if;
 if exists(select 1 from jsonb_array_elements(result) x where x->>'notes'='private friend record' or x->>'notes'='own untagged') then raise exception 'Private or untagged game included';end if;
 execute 'reset role';
 perform public.friend_action(handle,'remove');
 if public.get_recent_friend_games()<>'[]'::jsonb then raise exception 'Removed friend still included';end if;
 if (select count(*) from public.personal_games where owner_id=own)<>8 then raise exception 'Historical games lost';end if;
 perform set_config('request.jwt.claim.sub',(select id::text from recent_friend_test_users where code='c'),true);
 if public.get_recent_friend_games()<>'[]'::jsonb then raise exception 'Empty account leaked records';end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.get_recent_friend_games();raise exception 'Anonymous access allowed';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.get_recent_friend_games()','EXECUTE') then raise exception 'Anonymous API grant';end if;
 raise notice 'PASS five newest tagged games, own RLS, manual-name exclusion, unfriend fallback, empty state and anonymous denial';
end $$;
rollback;
