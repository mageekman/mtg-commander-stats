-- Announce shipped Partner Support once to existing accounts. No settings change.
-- Registry insertion makes re-running the migration safe after dismissal.
do $release$
declare release_id text;
begin
 insert into private.ledger_feature_releases(id) values('partner-support')
 on conflict(id) do nothing returning id into release_id;
 if release_id is null then return;end if;
 update public.profiles set ledger_stat_updates=array_append(coalesce(ledger_stat_updates,'{}'::text[]),'partner-support')
 where not('partner-support'=any(coalesce(ledger_stat_updates,'{}'::text[])));
 -- New accounts retain the empty pending-update default and existing preferences.
end $release$;
