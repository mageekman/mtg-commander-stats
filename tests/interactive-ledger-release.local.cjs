// Run against an isolated embedded Postgres, never the production project.
// PGLITE_MODULE may point at a user-owned installation of @electric-sql/pglite.
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('fs'),assert=require('assert/strict');
(async()=>{const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table public.profiles(id uuid primary key,ledger_settings jsonb not null default '{"show_color_usage":true}',ledger_stat_updates text[] not null default '{}');
alter table public.profiles enable row level security;grant select,update on public.profiles to authenticated;
create policy owner_rows on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
insert into public.profiles values
('00000000-0000-4000-8000-000000000001','{"best_deck_min_games":5,"share_best_deck":false,"show_color_usage":false}',array['color-combo-usage']),
('00000000-0000-4000-8000-000000000002','{}','{}'),
('00000000-0000-4000-8000-000000000003','{"enable_stat_games":true}',array['future-stat']);`);
const existing=fs.readFileSync('supabase-ledger-stat-updates.sql','utf8');await db.exec(existing.slice(existing.indexOf('create or replace function')));
const migration=fs.readFileSync('supabase-interactive-ledger-stats.sql','utf8');await db.exec(migration);
let {rows}=await db.query('select * from public.profiles order by id');assert.equal(rows[0].ledger_settings.enable_stat_games,false);assert.equal(rows[0].ledger_settings.best_deck_min_games,5);assert.equal(rows[0].ledger_settings.share_best_deck,false);assert.equal(rows[0].ledger_settings.show_color_usage,false);assert.deepEqual(rows[0].ledger_stat_updates,['color-combo-usage','interactive-ledger-stats']);assert.deepEqual(rows[1].ledger_stat_updates,['interactive-ledger-stats']);assert.equal(rows[2].ledger_settings.enable_stat_games,true);assert.deepEqual(rows[2].ledger_stat_updates,['future-stat','interactive-ledger-stats']);
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);`);
assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n,1);
assert.deepEqual((await db.query("select public.dismiss_ledger_stat_updates(array['color-combo-usage','interactive-ledger-stats']) ids")).rows[0].ids,[]);
assert.deepEqual((await db.query("select public.dismiss_ledger_stat_updates(array['interactive-ledger-stats']) ids")).rows[0].ids,[]);
await assert.rejects(db.query('select * from private.ledger_feature_releases'),/permission denied/);
await db.exec(`reset role;update public.profiles set ledger_settings=ledger_settings||'{"enable_stat_games":true,"best_deck_min_games":8}',ledger_stat_updates=array['later-feature'] where id='00000000-0000-4000-8000-000000000001';
insert into public.profiles(id)values('00000000-0000-4000-8000-000000000004');`);
await db.exec(migration);({rows}=await db.query('select * from public.profiles order by id'));
assert.deepEqual(rows[0].ledger_stat_updates,['later-feature']);assert.equal(rows[0].ledger_settings.enable_stat_games,true);assert.equal(rows[0].ledger_settings.best_deck_min_games,8);assert.deepEqual(rows[1].ledger_stat_updates,['interactive-ledger-stats']);assert.deepEqual(rows[3].ledger_stat_updates,[]);assert.equal(rows[3].ledger_settings.enable_stat_games,true);assert.equal(rows[3].ledger_settings.show_color_usage,true);
assert.equal((await db.query('select count(*)::int n from private.ledger_feature_releases')).rows[0].n,1);
assert.equal((await db.query("select prosecdef from pg_proc where oid='public.dismiss_ledger_stat_updates(text[])'::regprocedure")).rows[0].prosecdef,false);
assert.equal((await db.query("select has_function_privilege('anon','public.dismiss_ledger_stat_updates(text[])','EXECUTE') allowed")).rows[0].allowed,false);
console.log('PASS isolated Postgres: old preferences preserved, existing opt-in off, new defaults/no historical notice, combined notices, persistent dismissal, idempotent migration, owner isolation and private registry permissions');
}finally{await db.close()}})().catch(error=>{console.error(error);process.exitCode=1});
