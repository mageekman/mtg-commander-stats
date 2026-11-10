-- Existing profile ownership RLS protects writes. Only framing is exposed by this RPC.
alter table public.profiles add column passport_art jsonb;
alter table public.profiles add constraint profiles_passport_art_valid check (
 passport_art is null or coalesce((jsonb_typeof(passport_art)='object'
 and jsonb_typeof(passport_art->'commander')='string'
 and length(passport_art->>'commander') <= 100
 and jsonb_typeof(passport_art->'x')='number'
 and jsonb_typeof(passport_art->'y')='number'
 and jsonb_typeof(passport_art->'zoom')='number'
 and (passport_art->>'x')::numeric between 0 and 100
 and (passport_art->>'y')::numeric between 0 and 100
 and (passport_art->>'zoom')::numeric between 1 and 2.5),false)
);
create or replace function public.get_passport_art(target_handle text)
returns jsonb language sql stable security definer set search_path='' as $$
 select p.passport_art from public.profiles p
 where (select auth.uid()) is not null and p.handle=lower(trim(target_handle)) limit 1
$$;
revoke all on function public.get_passport_art(text) from public,anon;
grant execute on function public.get_passport_art(text) to authenticated;
