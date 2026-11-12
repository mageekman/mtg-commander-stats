-- Explicit opt-in; neither existing Share everything nor Ledger opt-in grants public access.
alter table public.profiles add column if not exists share_color_usage boolean not null default false;
comment on column public.profiles.share_color_usage is 'Explicit public-profile color usage permission. Not inherited from public_full_stats.';
do $update$
declare definition text;marker text:=$old$'color_permissions',jsonb_build_object($old$;addition text:=$new$'color_usage',case when t.share_color_usage then jsonb_build_object(
 'total',(select count(*) from g),
 'minimum_games',case when coalesce(t.ledger_settings->>'best_deck_min_games','') ~ '^([1-9][0-9]{0,4}|100000)$' then (t.ledger_settings->>'best_deck_min_games')::int else 1 end,
 'combinations',case when jsonb_typeof(t.ledger_settings->'color_usage_combos')='array' then (select coalesce(jsonb_agg(v.value),'[]'::jsonb) from jsonb_array_elements_text(t.ledger_settings->'color_usage_combos') v(value) where v.value ~ '^W?U?B?R?G?$') end,
 'decks',(select coalesce(jsonb_agg(jsonb_build_object('commander',commander,'games',games)),'[]'::jsonb) from ds where games>0)
 ) end,
 'color_permissions',jsonb_build_object($new$;
begin
 definition:=pg_get_functiondef('private.shared_ledger_stats(text,date,date)'::regprocedure);
 if position(marker in definition)=0 or position('''color_usage'',case' in definition)>0 then raise exception 'Inspect public Ledger function before applying color usage permission';end if;
 execute replace(definition,marker,addition);
end $update$;
