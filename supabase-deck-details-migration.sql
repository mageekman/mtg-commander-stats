-- Run in Supabase SQL Editor before using deck details.
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS bracket_level smallint CHECK (bracket_level BETWEEN 1 AND 5);
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS notes text;
