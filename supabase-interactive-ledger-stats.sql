-- Deployment migration: do not run until the interactive-stat preview is approved.
-- A private release registry makes backfills one-time even after a user dismisses a notice.
create schema if not exists private;
create table if not exists private.ledger_feature_releases (
 id text primary key,
 released_at timestamptz not null default now()
);
alter table private.ledger_feature_releases enable row level security;
revoke all on table private.ledger_feature_releases from public,anon,authenticated;
do $policy$
begin
 if not exists(select 1 from pg_catalog.pg_policies where schemaname='private'
  and tablename='ledger_feature_releases' and policyname='deny_app_access') then
  create policy deny_app_access on private.ledger_feature_releases
   for all to anon,authenticated using(false) with check(false);
 end if;
end $policy$;

do $release$
declare first_release text;default_expression text;current_defaults jsonb;
begin
 insert into private.ledger_feature_releases(id) values('interactive-ledger-stats')
 on conflict(id) do nothing returning id into first_release;
 if first_release is null then return;end if;

 -- Keep all saved visibility/minimum/color choices and explicit interaction preferences.
 update public.profiles p set
  ledger_settings=case when coalesce(p.ledger_settings,'{}'::jsonb)?'enable_stat_games'
   then p.ledger_settings else coalesce(p.ledger_settings,'{}'::jsonb)||'{"enable_stat_games":false}'::jsonb end,
  ledger_stat_updates=case when 'interactive-ledger-stats'=any(coalesce(p.ledger_stat_updates,'{}'::text[]))
   then p.ledger_stat_updates else array_append(coalesce(p.ledger_stat_updates,'{}'::text[]),'interactive-ledger-stats') end;

 -- Preserve the existing defaults; only future profiles opt into this feature automatically.
 select pg_get_expr(d.adbin,d.adrelid) into default_expression
 from pg_catalog.pg_attrdef d join pg_catalog.pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
 where d.adrelid='public.profiles'::regclass and a.attname='ledger_settings';
 if default_expression is not null then execute 'select ('||default_expression||')::jsonb' into current_defaults;end if;
 execute format('alter table public.profiles alter column ledger_settings set default %L::jsonb',
  (coalesce(current_defaults,'{}'::jsonb)||'{"enable_stat_games":true}'::jsonb)::text);
 -- New profiles keep the existing empty ledger_stat_updates default, with no historical notice.
end $release$;
