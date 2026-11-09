-- Run in Supabase SQL Editor before saving external decklist links.
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS decklist_url text;
-- Allow decks without a pasted card list. Existing records are unaffected.
ALTER TABLE public.decks ALTER COLUMN decklist DROP NOT NULL;
