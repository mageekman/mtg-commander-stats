-- Generic rival labels are filtered BEFORE selecting the highest loss count.
-- This updates rankings for every user without rewriting game records.
CREATE OR REPLACE FUNCTION public.is_generic_opponent_name(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
WITH normalized AS (
 SELECT trim(regexp_replace(
  regexp_replace(regexp_replace(lower(regexp_replace(coalesce(value,''), '([a-z])([A-Z])', '\1 \2', 'g')),
   '([a-z])([0-9])', '\1 \2', 'g'), '([0-9])([a-z])', '\1 \2', 'g'),
  '[^[:alnum:]]+', ' ', 'g')) AS name
)
SELECT name ~ '^(n a|na|none|tbd|not specified|not provided|no name|you|yourself|self|me|myself|null|undefined|missing|not recorded|not entered|not set|name not provided|name unknown|no opponent recorded)?$'
 OR (name ~ '(^| )(opponents?|opps?|players?|enem(?:y|ies)|rivals?|guests?|strangers?|persons?|participants?|competitors?|challengers?|users?|someone|somebody|humans?|bots?|cpu|computer|ai|seats?|slots?|tables?|pods?|hosts?|winners?|losers?|friends?|foes?|teammates?|unknown|unnamed|anonymous|anon|default|generic|unidentified|unrecorded|placeholder)( |$)' AND name ~ '^(opponents?|opps?|players?|enem(?:y|ies)|rivals?|guests?|strangers?|persons?|participants?|competitors?|challengers?|users?|someone|somebody|humans?|bots?|cpu|computer|ai|seats?|slots?|tables?|pods?|hosts?|winners?|losers?|friends?|foes?|teammates?|unknown|unnamed|anonymous|anon|default|generic|unidentified|unrecorded|placeholder|the|a|an|another|random|other|imported|import|from|csv|name|no|number|you|self|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|i|ii|iii|iv|v|vi|vii|viii|ix|x|[0-9]+|[a-z])( (opponents?|opps?|players?|enem(?:y|ies)|rivals?|guests?|strangers?|persons?|participants?|competitors?|challengers?|users?|someone|somebody|humans?|bots?|cpu|computer|ai|seats?|slots?|tables?|pods?|hosts?|winners?|losers?|friends?|foes?|teammates?|unknown|unnamed|anonymous|anon|default|generic|unidentified|unrecorded|placeholder|the|a|an|another|random|other|imported|import|from|csv|name|no|number|you|self|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|i|ii|iii|iv|v|vi|vii|viii|ix|x|[0-9]+|[a-z]))*$')
FROM normalized;
$function$;
REVOKE ALL ON FUNCTION public.is_generic_opponent_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_generic_opponent_name(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_shared_ledger_stats(target_handle text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with target as (select * from public.profiles where auth.uid() is not null and handle=lower(trim(target_handle)) limit 1),
g as (select x.deck_id,x.won,x.played_at,x.id,x.players,x.winner_player from public.personal_games x join target t on x.owner_id=t.id),
ds as (select d.id,d.name,d.commander,count(g.deck_id)::int games,count(g.deck_id) filter(where g.won)::int wins from public.decks d join target t on d.owner_id=t.id left join g on g.deck_id=d.id group by d.id,d.name,d.commander),
ranked as (select * from ds where games>0),
rivals as (select g.players->g.winner_player->>'name' player,g.players->g.winner_player->>'commander' commander from g where not g.won and jsonb_typeof(g.players)='array' and g.winner_player>=0 and g.winner_player<jsonb_array_length(g.players)),
rp as (select trim(player) player,count(*)::int losses from rivals where not public.is_generic_opponent_name(player) group by trim(player) order by losses desc,player limit 1),
rc as (select commander,count(*)::int losses from rivals where nullif(trim(commander),'') is not null group by commander order by losses desc,commander limit 1)
select jsonb_strip_nulls(jsonb_build_object(
 'record',case when (t.id = auth.uid() or t.share_record) or (t.id = auth.uid() or t.public_full_stats) then jsonb_build_object('games',(select count(*) from g)) end,
 'winrate_history',case when (t.id=auth.uid() or t.share_win_chart or t.public_full_stats) then (select coalesce(jsonb_agg(jsonb_build_object('played_at',played_at,'won',won) order by played_at,id),'[]'::jsonb) from g) end,
 'win_chart',case when (t.id = auth.uid() or t.share_win_chart) or (t.id = auth.uid() or t.public_full_stats) then jsonb_build_object('games',(select count(*) from g),'wins',(select count(*) from g where won)) end,
 'best_deck',case when (t.id = auth.uid() or t.share_best_deck) or (t.id = auth.uid() or t.public_full_stats) then (select to_jsonb(x) from (select name,commander,games,wins from ranked order by wins::numeric/games desc,games desc,wins desc limit 1)x) end,
 'most_played_deck',case when (t.id = auth.uid() or t.share_most_played_deck) or (t.id = auth.uid() or t.public_full_stats) then (select to_jsonb(x) from (select name,commander,games,wins from ranked order by games desc,wins desc limit 1)x) end,
 'color_decks',case when (t.id = auth.uid() or t.share_most_played_color) or (t.id = auth.uid() or t.share_best_color_combo) or (t.id = auth.uid() or t.public_full_stats) then (select jsonb_agg(jsonb_build_object('commander',commander,'games',games,'wins',wins)) from ranked) end,
 'color_permissions',jsonb_build_object('most_played',(t.id = auth.uid() or t.share_most_played_color) or (t.id = auth.uid() or t.public_full_stats),'best_combo',(t.id = auth.uid() or t.share_best_color_combo) or (t.id = auth.uid() or t.public_full_stats)),
 'lost_color_commanders',case when (t.id = auth.uid() or t.share_lost_to_color) or (t.id = auth.uid() or t.public_full_stats) then (select jsonb_agg(commander) from rivals where commander is not null) end,
 'lost_color_enabled',(t.id = auth.uid() or t.share_lost_to_color) or (t.id = auth.uid() or t.public_full_stats),
 'nemesis_player',case when (t.id = auth.uid() or t.share_lost_to_player) or (t.id = auth.uid() or t.public_full_stats) then (select to_jsonb(x) from rp x) end,
 'nemesis_commander',case when (t.id = auth.uid() or t.share_lost_to_commander) or (t.id = auth.uid() or t.public_full_stats) then (select to_jsonb(x) from rc x) end,
 'nemesis_commander_enabled',(t.id = auth.uid() or t.share_lost_to_commander) or (t.id = auth.uid() or t.public_full_stats),
 'decks',case when (t.id = auth.uid() or t.share_deck_stats) or (t.id = auth.uid() or t.public_full_stats) then coalesce((select jsonb_agg(jsonb_build_object('name',name,'commander',commander,'games',games,'wins',wins) order by games desc,name) from ranked),'[]'::jsonb) end,
 'decks_enabled',(t.id = auth.uid() or t.share_deck_stats) or (t.id = auth.uid() or t.public_full_stats)
)) from target t;
$function$;
