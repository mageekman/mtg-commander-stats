-- Fixtures only; no real account data is changed and all writes roll back.
begin;
do $$
declare actor uuid:=gen_random_uuid(); username text:='meta_'||substr(md5(random()::text),1,10); metadata jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data)
 values(actor,actor::text||'@example.invalid',jsonb_build_object('display_name','Metadata test','onboarding_dismissed',true,'custom_key','preserve'));
 -- The normal signup trigger creates the profile with no username.
 update public.profiles set handle=username where id=actor;
 select raw_user_meta_data into metadata from auth.users where id=actor;
 if metadata->>'username' is distinct from username then raise exception 'Username did not sync';end if;
 if metadata->>'custom_key'<>'preserve' or metadata->>'display_name'<>'Metadata test' or metadata->>'onboarding_dismissed'<>'true' then raise exception 'Unrelated metadata changed';end if;
 update public.profiles set handle=username||'_new' where id=actor;
 if (select raw_user_meta_data->>'username' from auth.users where id=actor) is distinct from username||'_new' then raise exception 'Rename did not sync';end if;
 update public.profiles set handle=null where id=actor;
 if (select raw_user_meta_data ? 'username' from auth.users where id=actor) then raise exception 'Cleared username stayed in metadata';end if;
 -- Existing application users may update only their own profile; sync must work
 -- through that route while the privileged helper remains inaccessible directly.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 update public.profiles set handle=username where id=actor;
 execute 'reset role';
 if (select raw_user_meta_data->>'username' from auth.users where id=actor) is distinct from username then raise exception 'Owner update did not sync';end if;
 if has_function_privilege('anon','private.sync_profile_username_to_auth()','EXECUTE') or has_function_privilege('authenticated','private.sync_profile_username_to_auth()','EXECUTE') then raise exception 'Sync helper exposed';end if;
 if (select raw_user_meta_data->>'custom_key' from auth.users where id=actor)<>'preserve' then raise exception 'Metadata lost after clearing and renaming';end if;
 raise notice 'PASS username mirror, rename, clearing, owner update, metadata preservation and restricted helper';
end $$;
rollback;
