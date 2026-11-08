-- Run once in Supabase SQL Editor. Adds multiplayer details without removing existing games.
alter table public.personal_games
  add column if not exists players jsonb,
  add column if not exists first_player integer,
  add column if not exists winner_player integer;
-- Older game records keep their existing win/loss results.
