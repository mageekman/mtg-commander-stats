CREATE INDEX IF NOT EXISTS decks_owner_id_idx ON public.decks(owner_id);
CREATE INDEX IF NOT EXISTS personal_games_owner_deck_record_idx ON public.personal_games(owner_id,deck_id) INCLUDE (won,played_at);

-- All-time owner totals. Invoker RLS and explicit owner predicates both apply.
CREATE OR REPLACE FUNCTION public.get_my_deck_records()
RETURNS TABLE(deck_id uuid,games bigint,wins bigint,last_played date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT d.id,count(g.deck_id),count(g.deck_id) FILTER (WHERE g.won),max(g.played_at)
 FROM public.decks d
 LEFT JOIN public.personal_games g ON g.deck_id=d.id AND g.owner_id=(SELECT auth.uid())
 WHERE d.owner_id=(SELECT auth.uid())
 GROUP BY d.id;
$$;
REVOKE ALL ON FUNCTION public.get_my_deck_records() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_deck_records() TO authenticated;
NOTIFY pgrst,'reload schema';
