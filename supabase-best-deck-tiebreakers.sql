begin;
-- Keep the public profile calculation aligned with the Ledger. Preserve the
-- existing all-time "last" field used by rotation; ranking gets a period date.
do $update$
declare definition text;
begin
 definition:=pg_get_functiondef('private.shared_ledger_stats(text,date,date)'::regprocedure);
 if position('count(g.id) filter(where g.won)::int wins,' in definition)=0 or position('best as (select * from ranked order by wins::numeric/games desc,games desc,wins desc,name limit 1)' in definition)=0 then raise exception 'Inspect changed Ledger query before applying best-deck update';end if;
 definition:=replace(definition,'count(g.id) filter(where g.won)::int wins,','count(g.id) filter(where g.won)::int wins,max(g.played_at) as last_in_period,');
 definition:=replace(definition,'best as (select * from ranked order by wins::numeric/games desc,games desc,wins desc,name limit 1)','best as (select * from ranked order by wins::numeric/games desc,games desc,last_in_period desc nulls last,id limit 1)');
 execute definition;
end $update$;
commit;
