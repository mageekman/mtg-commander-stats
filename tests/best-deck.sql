-- Generated fixture accounts/decks only; all writes roll back.
begin;
do $$
declare actor uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();unused uuid:=gen_random_uuid();handle text:='best_'||substr(md5(random()::text),1,9);result jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data)values(actor,actor::text||'@example.invalid',jsonb_build_object('username',handle));
 update public.profiles set share_best_deck=true,share_deck_rotation=true where id=actor;
 insert into public.decks(id,owner_id,name,commander)values(a,actor,'Deck A','Commander A'),(b,actor,'Deck B','Commander B'),(unused,actor,'Unused','Commander C');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.personal_games(owner_id,deck_id,won,played_at)values(actor,a,true,'2026-01-01'),(actor,a,true,'2026-01-20'),(actor,b,true,'2026-02-01');
 if public.get_shared_ledger_stats_v2(handle)->'best_deck'->>'name'<>'Deck A' then raise exception 'Equal rates must prioritize more games before recency';end if;
 insert into public.personal_games(owner_id,deck_id,won,played_at)values(actor,b,true,'2026-01-10');
 if public.get_shared_ledger_stats_v2(handle)->'best_deck'->>'name'<>'Deck B' then raise exception 'Equal rates/counts must prioritize recent play';end if;
 update public.personal_games set played_at='2026-03-01' where deck_id=a and owner_id=actor;
 if public.get_shared_ledger_stats_v2(handle)->'best_deck'->>'name'<>'Deck A' then raise exception 'Recency change not reflected';end if;
 update public.personal_games set played_at='2026-01-25' where deck_id=a and owner_id=actor;
 update public.personal_games set played_at='2026-01-20' where deck_id=b and owner_id=actor;
 insert into public.personal_games(owner_id,deck_id,won,played_at)values(actor,b,true,'2026-03-01');
 if public.get_shared_ledger_stats_v2(handle)->'best_deck'->>'name'<>'Deck B' then raise exception 'All-time game count broken';end if;
 result:=public.get_shared_ledger_stats_v2(handle,'2026-01-01','2026-01-31');
 if result->'best_deck'->>'name'<>'Deck A' then raise exception 'Period ranking used an out-of-period date';end if;
 if not exists(select 1 from jsonb_array_elements(result->'rotation')r where r->>'name'='Deck B' and r->>'last'='2026-03-01') then raise exception 'Existing all-time rotation date changed';end if;
 update public.personal_games set won=false where deck_id=a;
 if public.get_shared_ledger_stats_v2(handle,'2026-01-01','2026-01-31')->'best_deck'->>'name'<>'Deck B' then raise exception 'Win rate must remain primary';end if;
 update public.decks set archived_at=now() where id=b;
 if public.get_shared_ledger_stats_v2(handle)->'best_deck'->>'name'<>'Deck A' then raise exception 'Archived/unused deck won ranking';end if;
 update public.profiles set share_best_deck=false where id=actor;
 if public.get_shared_ledger_stats_v2(handle) ? 'best_deck' then raise exception 'Hidden Best Deck disclosed';end if;
 raise notice 'PASS win rate, game count, recency, selected-period dates, unchanged rotation dates, active/played eligibility and privacy';
end $$;
rollback;
