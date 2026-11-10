-- Restrict the shared profile deck list, without changing historical totals.
do $change$
declare definition text;
begin
 select pg_get_functiondef('public.get_shared_ledger_stats(text)'::regprocedure) into definition;
 if position('order by games desc,name) from ranked)' in definition)>0 then
  definition:=replace(definition,
   'order by games desc,name) from ranked)',
   'order by wins::numeric/games desc,games desc,name) from ranked where id in (select id from public.decks where archived_at is null))');
  execute definition;
 elsif position('from ranked where id in (select id from public.decks where archived_at is null)' in definition)=0 then
  raise exception 'Shared deck query changed; inspect before applying this update';
 end if;
end
$change$;
