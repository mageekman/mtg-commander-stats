-- Synthetic fixtures only; all writes roll back.
begin;
do $$
declare owner_id uuid:=gen_random_uuid();viewer_id uuid:=gen_random_uuid();deck_id uuid:=gen_random_uuid();other_deck uuid:=gen_random_uuid();handle text:='pcu_'||substr(md5(random()::text),1,10);value jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data)values(owner_id,owner_id::text||'@example.invalid',jsonb_build_object('username',handle)),(viewer_id,viewer_id::text||'@example.invalid',jsonb_build_object('username','pcv_'||substr(md5(viewer_id::text),1,10)));
 if (select share_color_usage from public.profiles where id=owner_id) is distinct from false then raise exception 'New public sharing flag must default false';end if;
 insert into public.decks(id,owner_id,name,commander)values(deck_id,owner_id,'Private deck name','Test Commander'),(other_deck,viewer_id,'Other private deck','Other Commander');
 insert into public.personal_games(owner_id,deck_id,played_at,won,notes)values(owner_id,deck_id,'2026-10-31',true,'private note'),(owner_id,deck_id,'2026-11-01',false,'private note'),(owner_id,deck_id,'2026-11-02',true,'private note'),(viewer_id,other_deck,'2026-11-02',true,'other note');
 update public.profiles set public_full_stats=true,ledger_settings='{"show_color_usage":true,"best_deck_min_games":3,"color_usage_combos":["RG","", "private text",{"secret":"no"}]}' where id=owner_id;
 perform set_config('request.jwt.claim.sub',viewer_id::text,true);
 value:=public.get_shared_ledger_stats_v2(handle);
 if value?'color_usage' then raise exception 'Share everything must not grant the new public stat';end if;
 update public.profiles set public_full_stats=false,share_color_usage=true where id=owner_id;
 value:=public.get_shared_ledger_stats_v2(handle);
 if value->'color_usage'->>'total'<>'3' then raise exception 'Color usage includes another player or excludes owner games';end if;
 if value->'color_usage'->>'minimum_games'<>'3' then raise exception 'Minimum does not match Ledger';end if;
 if value->'color_usage'->'combinations'<>'["RG",""]'::jsonb then raise exception 'Invalid/private selection content exposed';end if;
 if (value->'color_usage'->'decks'->0)?|array['wins','name','id','notes','players','owner_id'] then raise exception 'Usage-only response exposed unrelated private data';end if;
 if value->'color_usage'->'decks'->0->>'commander'<>'Test Commander' then raise exception 'Wrong color basis';end if;
 value:=public.get_shared_ledger_stats_v2(handle,'2026-11-01','2026-11-30');if value->'color_usage'->>'total'<>'2' then raise exception 'Usage ignored selected timeframe';end if;
 update public.profiles set share_color_usage=false where id=owner_id;
 if public.get_shared_ledger_stats_v2(handle)?'color_usage' then raise exception 'Revoked sharing still exposed chart';end if;
 perform set_config('request.jwt.claim.sub','',true);if public.get_shared_ledger_stats_v2(handle) is not null then raise exception 'Anonymous profile stats exposed';end if;
end $$;
rollback;
