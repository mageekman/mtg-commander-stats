-- Synthetic accounts only. All fixtures and preference writes roll back.
begin;
do $$
declare actor uuid:=gen_random_uuid();other uuid:=gen_random_uuid();
begin
 perform set_config('test.stat_actor',actor::text,true);perform set_config('test.stat_other',other::text,true);
 insert into auth.users(id,email,raw_user_meta_data)values(actor,actor::text||'@example.invalid',jsonb_build_object('username','lu_'||substr(md5(actor::text),1,10))),(other,other::text||'@example.invalid',jsonb_build_object('username','lu_'||substr(md5(other::text),1,10)));
 if (select ledger_settings->>'show_color_usage' from public.profiles where id=actor)<>'true' then raise exception 'New accounts must use the new-stat default';end if;
 if (select cardinality(ledger_stat_updates) from public.profiles where id=actor)<>0 then raise exception 'New accounts received historical notices';end if;
 update public.profiles set ledger_settings='{"best_deck_min_games":5,"share_best_deck":false,"show_color_usage":false}',ledger_stat_updates=array['color-combo-usage','future-stat'] where id=actor;
 update public.profiles set ledger_stat_updates=array['other-player-update'] where id=other;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.stat_actor'),true);
do $$
declare remaining text[];
begin
 if exists(select 1 from public.profiles where id=current_setting('test.stat_other')::uuid) then raise exception 'Other player notices exposed';end if;
 remaining:=public.dismiss_ledger_stat_updates(array['color-combo-usage',null]);
 if remaining<>array['future-stat'] then raise exception 'Dismissing current notice removed a newer update';end if;
 if public.dismiss_ledger_stat_updates(array['color-combo-usage'])<>array['future-stat'] then raise exception 'Repeated dismissal is not idempotent';end if;
 if (select ledger_settings->>'show_color_usage' from public.profiles where id=current_setting('test.stat_actor')::uuid)<>'false' then raise exception 'Dismissal enabled the new stat';end if;
 if (select ledger_settings->>'best_deck_min_games' from public.profiles where id=current_setting('test.stat_actor')::uuid)<>'5' then raise exception 'Existing minimum changed';end if;
 if (select ledger_settings->>'share_best_deck' from public.profiles where id=current_setting('test.stat_actor')::uuid)<>'false' then raise exception 'Existing visibility changed';end if;
 remaining:=public.dismiss_ledger_stat_updates(array['future-stat']);if cardinality(remaining)<>0 then raise exception 'Dismissal not persisted';end if;
 if (select cardinality(ledger_stat_updates) from public.profiles where id=current_setting('test.stat_actor')::uuid)<>0 then raise exception 'Reload would show dismissed updates';end if;
end $$;
reset role;
do $$
begin
 if (select ledger_stat_updates from public.profiles where id=current_setting('test.stat_other')::uuid)<>array['other-player-update'] then raise exception 'Other account modified';end if;
 if has_function_privilege('anon','public.dismiss_ledger_stat_updates(text[])','EXECUTE') then raise exception 'Anonymous dismissal allowed';end if;
 if (select prosecdef from pg_proc where oid='public.dismiss_ledger_stat_updates(text[])'::regprocedure) then raise exception 'Dismissal must not bypass owner RLS';end if;
end $$;
rollback;
