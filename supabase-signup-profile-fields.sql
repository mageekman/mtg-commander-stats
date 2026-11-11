-- Persist signup identity before an email-confirmed session exists.
begin;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name,handle,favorite_commander)
 values(new.id,
  coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),split_part(coalesce(new.email,''),'@',1),'Player'),
  nullif(lower(trim(new.raw_user_meta_data->>'username')),''),
  nullif(trim(new.raw_user_meta_data->>'favorite_commander'),''));
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
commit;
