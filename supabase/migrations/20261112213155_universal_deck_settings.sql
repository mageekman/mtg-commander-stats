-- Account-wide deck preferences. Existing private/public profile permissions stay unchanged.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deck_settings jsonb;
-- Preserve any hidden report; preserve interactive opt-in from any of the owner's decks.
WITH visibility AS (
 SELECT p.id,k.key, bool_and(CASE WHEN jsonb_typeof(d.stat_settings->k.key)='boolean'
  THEN (d.stat_settings->>k.key)::boolean ELSE true END) AS enabled
 FROM public.profiles p CROSS JOIN (VALUES ('record'),('trend'),('recent'),('matchups'),('rival'),('friends'),('first'),('sizes'),('activity')) k(key)
 LEFT JOIN public.decks d ON d.owner_id=p.id WHERE p.deck_settings IS NULL GROUP BY p.id,k.key
), choices AS (SELECT id,jsonb_object_agg(key,enabled) AS settings FROM visibility GROUP BY id), interactions AS (
 SELECT p.id,(count(d.id)=0 OR coalesce(bool_or(d.stat_settings->'interactive'='true'::jsonb),false)) AS enabled
 FROM public.profiles p LEFT JOIN public.decks d ON d.owner_id=p.id WHERE p.deck_settings IS NULL GROUP BY p.id
)
UPDATE public.profiles p SET deck_settings=c.settings||jsonb_build_object('interactive',i.enabled)
FROM choices c JOIN interactions i ON i.id=c.id WHERE p.id=c.id AND p.deck_settings IS NULL;
ALTER TABLE public.profiles ALTER COLUMN deck_settings SET DEFAULT '{"record":true,"trend":true,"recent":true,"matchups":true,"rival":true,"friends":true,"first":true,"sizes":true,"activity":true,"interactive":true}'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN deck_settings SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_deck_settings_object' AND conrelid='public.profiles'::regclass) THEN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_deck_settings_object CHECK (jsonb_typeof(deck_settings)='object');
 END IF;
END $$;
COMMENT ON COLUMN public.profiles.deck_settings IS 'Owner-only universal deck display preferences; apply to every current/future deck and its share snapshots.';
-- Compatibility defaults for newly created decks; current clients use the profile settings above.
ALTER TABLE public.decks ALTER COLUMN stat_settings SET DEFAULT '{"record":true,"trend":true,"recent":true,"matchups":true,"rival":true,"friends":true,"first":true,"sizes":true,"activity":true,"interactive":true}'::jsonb;
-- Only new profiles receive these defaults. Existing Ledger settings and public privacy flags are untouched.
DO $$ DECLARE defaults jsonb; expression text; BEGIN
 SELECT pg_get_expr(d.adbin,d.adrelid) INTO expression FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
 WHERE d.adrelid='public.profiles'::regclass AND a.attname='ledger_settings';
 IF expression IS NOT NULL THEN EXECUTE 'SELECT ('||expression||')::jsonb' INTO defaults; END IF;
 EXECUTE format('ALTER TABLE public.profiles ALTER COLUMN ledger_settings SET DEFAULT %L::jsonb',
  (coalesce(defaults,'{}'::jsonb)||'{"enable_stat_games":true,"share_record":true,"share_win_chart":true,"share_win_trend":true,"share_best_deck":true,"share_most_played_deck":true,"share_most_played_color":true,"share_best_color_combo":true,"share_lost_to_commander":true,"share_lost_to_player":true,"share_lost_to_color":true,"share_first_player":true,"share_deck_rotation":true,"share_games_together":true,"share_friend_results":true,"share_deck_stats":true,"show_color_usage":true}'::jsonb)::text);
END $$;
NOTIFY pgrst,'reload schema';
