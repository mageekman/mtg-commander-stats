-- Synthetic accounts only; every write is rolled back.
begin;
do $$
declare actor uuid:=gen_random_uuid();other uuid:=gen_random_uuid();
begin
 perform set_config('test.ledger_actor',actor::text,true);
 perform set_config('test.ledger_other',other::text,true);
 insert into auth.users(id,email,raw_user_meta_data)values
 (actor,actor::text||'@example.invalid',jsonb_build_object('username','ls_'||substr(md5(actor::text),1,10))),
 (other,other::text||'@example.invalid',jsonb_build_object('username','ls_'||substr(md5(other::text),1,10)));
end $$;
do $$
declare actor uuid:=current_setting('test.ledger_actor')::uuid;a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();
begin
 update public.profiles set share_best_deck=true where id=actor;
 insert into public.decks(id,owner_id,name,commander)values(a,actor,'Small sample','Commander A'),(b,actor,'Qualified','Commander B');
 insert into public.personal_games(owner_id,deck_id,played_at,won)values(actor,a,'2026-01-01',true),(actor,b,'2026-01-02',true),(actor,b,'2026-01-03',false),(actor,b,'2026-01-04',false),(actor,b,'2026-01-05',false),(actor,b,'2026-01-06',false);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.ledger_actor'),true);
do $$
declare affected int;value jsonb;
begin
 select ledger_settings into value from public.profiles where id=current_setting('test.ledger_actor')::uuid;
 if value<>'{}'::jsonb then raise exception 'Existing display defaults changed';end if;
 update public.profiles set ledger_settings='{"best_deck_min_games":5,"share_lost_to_player":false,"share_win_chart":false}' where id=current_setting('test.ledger_actor')::uuid;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Owner could not save preferences';end if;
 select ledger_settings into value from public.profiles where id=current_setting('test.ledger_actor')::uuid;
 if public.get_shared_ledger_stats_v2((select handle from public.profiles where id=current_setting('test.ledger_actor')::uuid))->'best_deck'->>'name'<>'Qualified' then raise exception 'Public Best Deck ignored saved minimum';end if;
 if public.get_shared_ledger_stats_v2((select handle from public.profiles where id=current_setting('test.ledger_actor')::uuid),'2026-01-01','2026-01-03')->'best_deck' is not null then raise exception 'Minimum used all-time games instead of timeframe';end if;
 if value->>'best_deck_min_games'<>'5' or value->>'share_lost_to_player'<>'false' then raise exception 'Preferences did not persist';end if;
 if exists(select 1 from public.profiles where id=current_setting('test.ledger_other')::uuid) then raise exception 'Other player settings exposed';end if;
 update public.profiles set ledger_settings='{"best_deck_min_games":99}' where id=current_setting('test.ledger_other')::uuid;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Other player preferences could be changed';end if;
 begin
  update public.profiles set ledger_settings='[]' where id=current_setting('test.ledger_actor')::uuid;
  raise exception 'Non-object settings accepted';
 exception when check_violation then null;end;
end $$;
rollback;
