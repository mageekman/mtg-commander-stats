-- Personal Ledger presentation preferences. Existing profiles RLS permits only
-- the owner to read/update this row; these are separate from public privacy flags.
alter table public.profiles add column if not exists ledger_settings jsonb not null default '{}'::jsonb;
alter table public.profiles add constraint profiles_ledger_settings_object check (jsonb_typeof(ledger_settings) = 'object');
comment on column public.profiles.ledger_settings is 'Owner-only Ledger and share-image presentation preferences: best_deck_min_games and share_* visibility flags. Missing keys retain the existing display.';
do $update$
declare definition text;old_selection text:='best as (select * from ranked order by wins::numeric/games desc,games desc,last_in_period desc nulls last,id limit 1)';new_selection text:=$replacement$best as (select * from ranked where games >= (select case when coalesce(t.ledger_settings->>'best_deck_min_games','') ~ '^([1-9][0-9]{0,4}|100000)$' then (t.ledger_settings->>'best_deck_min_games')::int else 1 end from target t) order by wins::numeric/games desc,games desc,last_in_period desc nulls last,id limit 1)$replacement$;
begin
 definition:=pg_get_functiondef('private.shared_ledger_stats(text,date,date)'::regprocedure);
 if position(old_selection in definition)=0 then raise exception 'Inspect changed shared Ledger Best Deck query before applying minimum';end if;
 execute replace(definition,old_selection,new_selection);
end $update$;
