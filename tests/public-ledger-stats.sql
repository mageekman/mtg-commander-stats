-- Every fixture and change is rolled back. No real player's data is edited.
begin;
create temp table shared_test_users(n int,id uuid,handle text);
insert into shared_test_users select n,gen_random_uuid(),'pubtest_'||substr(md5(random()::text),1,9) from generate_series(1,4)n;
insert into auth.users(id,email,raw_user_meta_data) select id,handle||'@example.invalid',jsonb_build_object('display_name',handle) from shared_test_users;
insert into public.profiles(id,handle,display_name) select id,handle,handle from shared_test_users on conflict(id) do update set handle=excluded.handle;
do $test$
declare own_id uuid; viewer uuid; friend uuid; friend2 uuid; own_handle text; active uuid:=gen_random_uuid(); archived uuid:=gen_random_uuid(); unused uuid:=gen_random_uuid(); result jsonb; old_result jsonb; shared_game uuid; a jsonb; p jsonb; flag text; field text;
begin
 select id,handle into own_id,own_handle from shared_test_users where n=1;select id into viewer from shared_test_users where n=2;select id into friend from shared_test_users where n=3;select id into friend2 from shared_test_users where n=4;
 insert into public.decks(id,owner_id,name,commander,archived_at) values(active,own_id,'Active deck','Captain America',null),(archived,own_id,'Archived winner','The Ur-Dragon',now()),(unused,own_id,'Unused deck','Minsc & Boo',null);
 insert into public.friend_connections(requester_id,recipient_id,status,accepted_at) values(own_id,friend,'accepted',now()),(own_id,friend2,'accepted',now());
 p:=jsonb_build_array(jsonb_build_object('name','You','commander','Captain America'),jsonb_build_object('name','Alex','commander','The Ur-Dragon','friend_id',friend::text),jsonb_build_object('name','Sam','commander','Minsc & Boo','friend_id',friend2::text));
 insert into public.personal_games(owner_id,deck_id,played_at,won,first_player,winner_player,players,notes) values(own_id,active,'2026-11-01',true,0,0,p,'PRIVATE NOTE') returning id into shared_game;
 insert into public.personal_games(owner_id,deck_id,played_at,won,first_player,winner_player,players) values(own_id,active,'2026-11-02',false,1,1,p),(own_id,archived,'2026-10-01',true,null,0,p),(own_id,active,'2026-10-02',false,1,2,p);
 insert into public.ledger_art_adjustments(owner_id,slot,commander,x,y,zoom) values(own_id,'best-deck','Captain America',40,60,1.1),(own_id,'compact-history','Captain America',50,80,1.2);
 -- No selected block may leak, even to the owner viewing as public.
 update public.profiles set public_full_stats=false,public_games=false,public_wins=false,public_winrate=false,share_record=false,share_win_chart=false,share_win_trend=false,share_best_deck=false,share_most_played_deck=false,share_most_played_color=false,share_best_color_combo=false,share_lost_to_color=false,share_lost_to_player=false,share_lost_to_commander=false,share_deck_stats=false,share_first_player=false,share_deck_rotation=false,share_games_together=false,share_friend_results=false where id=own_id;
 perform set_config('request.jwt.claim.sub',viewer::text,true);
 result:=public.get_shared_ledger_stats_v2(own_handle);
 if result ?| array['record','win_chart','winrate_history','best_deck','color_decks','lost_color_commanders','nemesis_player','first_player','rotation','games_together','friend_results','decks'] then raise exception 'Private aggregate leaked: %',result;end if;
 perform set_config('request.jwt.claim.sub',own_id::text,true);
 if public.get_shared_ledger_stats_v2(own_handle)<>result then raise exception 'Owner preview bypasses privacy';end if;
 update public.profiles set share_first_player=true where id=own_id;
 result:=public.get_shared_ledger_stats_v2(own_handle);
 if (result#>>'{first_player,first,games}')::int<>1 or (result#>>'{first_player,other,games}')::int<>2 or (result#>>'{first_player,excluded}')::int<>1 or result?'record' then raise exception 'Starting turn counts/isolated permission failed: %',result;end if;
 update public.profiles set share_first_player=false where id=own_id;
 for flag,field in select * from jsonb_each_text('{"share_record":"record","share_win_chart":"win_chart","share_win_trend":"winrate_history","share_first_player":"first_player","share_deck_rotation":"rotation","share_games_together":"games_together","share_friend_results":"friend_results"}'::jsonb) loop
  execute format('update public.profiles set %I=true where id=$1',flag) using own_id;
  result:=public.get_shared_ledger_stats_v2(own_handle);
  if not result?field or (result-field) ?| array['record','win_chart','winrate_history','best_deck','color_decks','lost_color_commanders','nemesis_player','first_player','rotation','games_together','friend_results','decks'] then raise exception 'Independent permission failed for %: %',flag,result;end if;
  execute format('update public.profiles set %I=false where id=$1',flag) using own_id;
 end loop;
 update public.profiles set public_full_stats=true where id=own_id;
 result:=public.get_shared_ledger_stats_v2(own_handle);
 if (result#>>'{record,games}')::int<>4 or (result#>>'{win_chart,wins}')::int<>2 then raise exception 'Record mismatch';end if;
 if result#>>'{best_deck,name}'<>'Active deck' or result#>>'{most_played_deck,name}'<>'Active deck' then raise exception 'Archived deck in featured stats';end if;
 if jsonb_array_length(result->'decks')<>1 or jsonb_array_length(result->'rotation')<>2 then raise exception 'Active deck filtering failed';end if;
 if (result#>>'{friend_results,games}')::int<>4 or (result#>>'{friend_results,wins}')::int<>2 or jsonb_array_length(result->'games_together')<>2 then raise exception 'Friend totals duplicated games';end if;
 if jsonb_array_length(result->'artwork')<>1 or result#>>'{artwork,0,slot}'<>'best-deck' then raise exception 'Artwork scope leaked';end if;
 if result::text like '%PRIVATE NOTE%' or result?'players' or result?'notes' then raise exception 'Raw history leaked';end if;
 result:=public.get_shared_ledger_stats_v2(own_handle,'2026-11-01','2026-11-30');
 if (result#>>'{record,games}')::int<>2 or (result#>>'{first_player,excluded}')::int<>0 or (result#>>'{friend_results,games}')::int<>2 then raise exception 'Period counts wrong';end if;
 -- Data remains live after a saved game changes.
 update public.personal_games set won=false,winner_player=1 where id=shared_game;
 if (public.get_shared_ledger_stats_v2(own_handle)#>>'{win_chart,wins}')::int<>1 then raise exception 'Edited game not reflected';end if;
 delete from public.personal_games where id=shared_game;
 if (public.get_shared_ledger_stats_v2(own_handle)#>>'{record,games}')::int<>3 then raise exception 'Deleted game not reflected';end if;
 delete from public.friend_connections where requester_id=own_id or recipient_id=own_id;
 if (public.get_shared_ledger_stats_v2(own_handle)#>>'{friend_results,games}')::int<>0 then raise exception 'Former friends still counted';end if;
 update public.profiles set public_full_stats=false,share_win_chart=true,share_win_trend=false where id=own_id;
 old_result:=public.get_shared_ledger_stats(own_handle);
 if old_result?'winrate_history' or not old_result?'win_chart' then raise exception 'Old API bypasses trend toggle';end if;
 perform set_config('shared.test_handle',own_handle,true);perform set_config('shared.viewer',viewer::text,true);
 perform set_config('request.jwt.claim.sub','',true);
 if public.get_shared_ledger_stats_v2(own_handle) is not null then raise exception 'Anonymous data leaked';end if;
 if has_function_privilege('anon','public.get_shared_ledger_stats_v2(text,date,date)','execute') then raise exception 'Anonymous API execution allowed';end if;
end
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('shared.viewer'),true);
do $$begin if public.get_shared_ledger_stats_v2(current_setting('shared.test_handle'))#>>'{win_chart,games}'<>'3' then raise exception 'Authenticated API access failed';end if;end$$;
reset role;
rollback;
select 'PASS privacy, owner preview, Ledger parity, periods, friend deduplication, live edits/deletes, art scope, anonymous access, legacy API' as result;
