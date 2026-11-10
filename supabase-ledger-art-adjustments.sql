-- Private, account-backed framing for each Ledger statistics surface and commander.
create table public.ledger_art_adjustments (
 owner_id uuid not null references auth.users(id) on delete cascade,
 slot text not null check(length(slot) between 1 and 80),
 commander text not null check(length(commander) between 1 and 200),
 x double precision not null default 50 check(x between 0 and 100),
 y double precision not null default 24 check(y between 0 and 100),
 zoom double precision not null default 1 check(zoom between 1 and 2.5),
 primary key(owner_id,slot,commander)
);
alter table public.ledger_art_adjustments enable row level security;
create policy "Read own Ledger framing" on public.ledger_art_adjustments for select to authenticated using(owner_id=(select auth.uid()));
create policy "Create own Ledger framing" on public.ledger_art_adjustments for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "Update own Ledger framing" on public.ledger_art_adjustments for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
revoke all on public.ledger_art_adjustments from public,anon,authenticated;
grant select,insert,update on public.ledger_art_adjustments to authenticated;
