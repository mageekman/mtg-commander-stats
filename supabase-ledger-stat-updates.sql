-- Existing visibility and minimum-game choices are preserved; only the new key is set false. Only new profile rows opt in by default.
-- The guarded first-time backfill never re-queues an already dismissed release.
do $setup$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='ledger_stat_updates') then
  alter table public.profiles add column ledger_stat_updates text[] not null default '{}'::text[];
  update public.profiles set ledger_stat_updates=array['color-combo-usage'],ledger_settings=ledger_settings||'{"show_color_usage":false}'::jsonb;
  if exists(select 1 from public.profiles where ledger_settings->'show_color_usage' is distinct from 'false'::jsonb) then raise exception 'Existing account must keep the new stat disabled';end if;
 end if;
end $setup$;
alter table public.profiles alter column ledger_settings set default '{"show_color_usage":true}'::jsonb;
comment on column public.profiles.ledger_stat_updates is 'Owner-only pending Ledger stat release IDs. New profile rows start with no announcements.';

create or replace function public.dismiss_ledger_stat_updates(update_ids text[])
returns text[] language plpgsql security invoker set search_path='' as $$
declare remaining text[];
begin
 if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501';end if;
 update public.profiles p set ledger_stat_updates=array(
  select u.item from unnest(p.ledger_stat_updates) with ordinality u(item,n)
  where not exists(select 1 from unnest(coalesce(update_ids,'{}'::text[])) requested(id) where requested.id=u.item) order by u.n
 ) where p.id=(select auth.uid()) returning p.ledger_stat_updates into remaining;
 if not found then raise exception 'Profile not found';end if;
 return remaining;
end $$;
revoke all on function public.dismiss_ledger_stat_updates(text[]) from public,anon;
grant execute on function public.dismiss_ledger_stat_updates(text[]) to authenticated;
