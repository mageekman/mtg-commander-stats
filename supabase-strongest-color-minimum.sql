-- Send only the qualification minimum required to render public color stats.
-- Existing public privacy flags continue to control whether stats are returned.
do $update$
declare definition text;old_value text:=$old$'color_permissions',jsonb_build_object('most_played',t.public_full_stats or t.share_most_played_color,'best_combo',t.public_full_stats or t.share_best_color_combo)$old$;new_value text:=$new$'color_permissions',jsonb_build_object('most_played',t.public_full_stats or t.share_most_played_color,'best_combo',t.public_full_stats or t.share_best_color_combo,'minimum_games',case when coalesce(t.ledger_settings->>'best_deck_min_games','') ~ '^([1-9][0-9]{0,4}|100000)$' then (t.ledger_settings->>'best_deck_min_games')::int else 1 end)$new$;
begin
 definition:=pg_get_functiondef('private.shared_ledger_stats(text,date,date)'::regprocedure);
 if position(old_value in definition)=0 then raise exception 'Inspect changed color permissions before applying minimum';end if;
 execute replace(definition,old_value,new_value);
end $update$;
