export function filterTrendGames(games,range){return games.filter(game=>(!range.range_start||game.played_at>=range.range_start)&&(!range.range_end||game.played_at<=range.range_end))}
function bucket(date,group){if(!date)return '';if(group==='month')return date.slice(0,7);if(group==='week'){const day=new Date(date+'T12:00:00Z');if(!Number.isFinite(day.getTime()))return date;day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);return day.toISOString().slice(0,10)}return date}
export function buildTrendSeries(games,{includeUndated=false,groupBy='game',maxPoints=70}={}){
 maxPoints=Math.max(2,Math.floor(Number(maxPoints)||70));
 const ordered=games.filter(g=>g.played_at||includeUndated).slice().sort((a,b)=>a.played_at&&b.played_at?(String(a.played_at).localeCompare(String(b.played_at))||String(a.id).localeCompare(String(b.id))):0);
 let wins=0;const raw=ordered.map((game,i)=>{if(game.won)wins++;return {date:game.played_at,value:100*wins/(i+1),game:i+1}});
 function grouped(group){if(group==='game')return raw;const points=new Map();for(const point of raw)points.set(bucket(point.date,group),point);return [...points.values()]}
 let grouping=['day','week','month'].includes(groupBy)?groupBy:'game',points=raw;
 if(groupBy==='auto'&&raw.length>maxPoints){for(const group of ['day','week','month']){grouping=group;points=grouped(group);if(points.length<=maxPoints)break}}
 else points=grouped(grouping);
 // Auto keeps a bounded set of period-end snapshots for unusually long histories.
 if(groupBy==='auto'&&points.length>maxPoints){const source=points;points=Array.from({length:maxPoints},(_,i)=>source[Math.round(i*(source.length-1)/(maxPoints-1))])}
 return {points,total:ordered.length,grouping};
}
