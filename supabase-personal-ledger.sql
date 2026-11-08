-- Run once in Supabase SQL Editor to enable personal cloud game tracking.
create table if not exists public.personal_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  played_at date not null default current_date,
  won boolean not null default false,
  opponents text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists personal_games_owner_date_idx on public.personal_games(owner_id, played_at desc);
alter table public.personal_games enable row level security;
do $
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_games'
      and policyname = 'Personal games owner access'
  ) then
    create policy "Personal games owner access" on public.personal_games
    for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (
      owner_id = (select auth.uid())
      and exists (
        select 1 from public.decks
        where decks.id = deck_id
          and decks.owner_id = (select auth.uid())
      )
    );
  end if;
end
$;
