-- Persist all optional fields already exposed by the deck editor.
-- Existing values and owner-only deck policies are unchanged.
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS bracket_level smallint
  CHECK (bracket_level BETWEEN 1 AND 5);
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS decklist_url text;
NOTIFY pgrst, 'reload schema';
