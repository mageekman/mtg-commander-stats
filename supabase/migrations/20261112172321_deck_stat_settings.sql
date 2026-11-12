-- Per-deck display preferences. Existing owner-only RLS is preserved.
-- {} keeps every existing report visible; game drill-downs require explicit opt-in.
ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS stat_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='decks_stat_settings_object' AND conrelid='public.decks'::regclass) THEN
    ALTER TABLE public.decks ADD CONSTRAINT decks_stat_settings_object
      CHECK (jsonb_typeof(stat_settings) = 'object');
  END IF;
END $$;
COMMENT ON COLUMN public.decks.stat_settings IS
  'Owner-controlled deck report visibility and game drill-down preference; shared snapshot exports honor visibility.';
