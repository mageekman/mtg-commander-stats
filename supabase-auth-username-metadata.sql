-- Display-only mirror for Supabase Authentication > Users > user metadata.
-- profiles.handle remains authoritative; never use user metadata for authorization.
begin;
create or replace function private.sync_profile_username_to_auth()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update auth.users
 set raw_user_meta_data=(coalesce(raw_user_meta_data,'{}'::jsonb)-'username')
   ||case when new.handle is null then '{}'::jsonb else jsonb_build_object('username',new.handle) end
 where id=new.id and (raw_user_meta_data->>'username') is distinct from new.handle;
 return new;
end $$;
revoke all on function private.sync_profile_username_to_auth() from public,anon,authenticated;
create trigger sync_profile_username_to_auth
 after insert or update of handle on public.profiles
 for each row execute function private.sync_profile_username_to_auth();
-- Backfill existing accounts without replacing any other Auth metadata.
update auth.users u
set raw_user_meta_data=(coalesce(u.raw_user_meta_data,'{}'::jsonb)-'username')
 ||case when p.handle is null then '{}'::jsonb else jsonb_build_object('username',p.handle) end
from public.profiles p
where p.id=u.id and (u.raw_user_meta_data->>'username') is distinct from p.handle;
commit;
