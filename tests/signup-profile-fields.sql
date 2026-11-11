-- Signup trigger integration; generated fixtures, rolled back completely.
begin;
do $$
declare actor uuid:=gen_random_uuid(); legacy uuid:=gen_random_uuid(); duplicate uuid:=gen_random_uuid(); invalid uuid:=gen_random_uuid(); fixture_handle text:='signup_'||substr(md5(random()::text),1,9);
begin
 insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',jsonb_build_object('display_name',' Signup Player ','username',upper(fixture_handle),'favorite_commander',' The Ur-Dragon ','onboarding_version',1,'onboarding_profile_complete',true));
 if not exists(select 1 from public.profiles where id=actor and display_name='Signup Player' and profiles.handle=fixture_handle and favorite_commander='The Ur-Dragon') then raise exception 'Signup identity not persisted before confirmation';end if;
 if not exists(select 1 from auth.users where id=actor and raw_user_meta_data->>'username'=fixture_handle and (raw_user_meta_data->>'onboarding_profile_complete')::boolean) then raise exception 'Auth username sync or onboarding metadata lost';end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(duplicate,duplicate::text||'@example.invalid',jsonb_build_object('username',fixture_handle));
  raise exception 'Duplicate username accepted';
 exception when unique_violation then null;end;
 if exists(select 1 from auth.users where id=duplicate) then raise exception 'Failed signup left a partial account';end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(invalid,invalid::text||'@example.invalid',jsonb_build_object('username','bad username'));
  raise exception 'Invalid username accepted';
 exception when check_violation then null;end;
 -- Legacy/API-created accounts without these optional metadata keys still work.
 insert into auth.users(id,email,raw_user_meta_data) values(legacy,legacy::text||'@example.invalid','{}');
 if not exists(select 1 from public.profiles where id=legacy and profiles.handle is null and favorite_commander is null) then raise exception 'Legacy signup broken';end if;
 if has_function_privilege('anon','public.handle_new_user()','EXECUTE') or has_function_privilege('authenticated','public.handle_new_user()','EXECUTE') then raise exception 'Signup helper publicly executable';end if;
 raise notice 'PASS signup profile persistence before confirmation, normalized username, Auth mirror, favorite commander, duplicate/invalid rollback, legacy compatibility and helper permissions';
end $$;
rollback;
