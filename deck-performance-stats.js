const commanderKey=name=>String(name||'').trim().replace(/\s+/g,' ').toLowerCase();
export function record(games){const wins=games.filter(game=>game.won).length;return {games:games.length,wins,losses:games.length-wins,rate:games.length?100*wins/games.length:null}}
export function commanderMatchups(games){
 const rows=new Map();let missing=0;
 for(const game of games){const players=Array.isArray(game.players)?game.players:[],opponents=players.length>1?players.slice(1).map(p=>p?.commander):(Array.isArray(game.opponents)?game.opponents:[]),names=new Map();for(const name of opponents){const key=commanderKey(name);if(key&&!names.has(key))names.set(key,String(name).trim())}if(!names.size)missing++;
  const winner=!game.won&&Number.isInteger(game.winner_player)&&game.winner_player>0?commanderKey(players[game.winner_player]?.commander):'';
  for(const [key,name]of names){const row=rows.get(key)||{name,games:0,wins:0,defeats:0};row.games++;if(game.won)row.wins++;if(winner===key)row.defeats++;rows.set(key,row)}
 }
 const all=[...rows.values()].map(row=>({...row,rate:100*row.wins/row.games})).sort((a,b)=>b.games-a.games||a.name.localeCompare(b.name)),eligible=all.filter(row=>row.games>=5);
 const best=eligible.slice().sort((a,b)=>b.rate-a.rate||b.games-a.games||a.name.localeCompare(b.name))[0]||null,worst=eligible.slice().sort((a,b)=>a.rate-b.rate||b.games-a.games||a.name.localeCompare(b.name))[0]||null,rival=all.filter(row=>row.defeats).sort((a,b)=>b.defeats-a.defeats||b.games-a.games||a.name.localeCompare(b.name))[0]||null;
 return {rows:all,best,worst,rival,missing};
}
export function tableSizeStats(games){const rows=[];let excluded=0;for(let size=2;size<=6;size++){const group=games.filter(g=>Array.isArray(g.players)&&g.players.length===size);if(group.length)rows.push({size,...record(group)})}for(const game of games)if(!Array.isArray(game.players)||game.players.length<2||game.players.length>6)excluded++;return {rows,excluded}}
const todayKey=now=>[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
function shift(key,days){const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
export function recentForm(games,range,now=new Date()){
 const end=range.range_end||todayKey(now),start=range.range_start||shift(end,-29),days=Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1,previousEnd=shift(start,-1),previousStart=shift(start,-days);
 const current=record(games.filter(g=>g.played_at>=start&&g.played_at<=end)),previous=record(games.filter(g=>g.played_at>=previousStart&&g.played_at<=previousEnd));
 return {current:{...current,start,end},previous:{...previous,start:previousStart,end:previousEnd},days,difference:current.rate!==null&&previous.rate!==null?current.rate-previous.rate:null};
}
export function deckActivity(games,allOwnGames,range){
 const included=g=>!range||(!range.range_start||g.played_at>=range.range_start)&&(!range.range_end||g.played_at<=range.range_end),filtered=games.filter(included),overall=allOwnGames.filter(included),dates=games.map(g=>g.played_at).filter(Boolean).sort(),months=new Map();for(const game of filtered)if(/^\d{4}-\d{2}-\d{2}$/.test(game.played_at||'')){const key=game.played_at.slice(0,7);months.set(key,(months.get(key)||0)+1)}
 return {first:dates[0]||null,last:dates.at(-1)||null,games:filtered.length,share:overall.length?100*filtered.length/overall.length:null,total:overall.length,months:[...months].sort(([a],[b])=>b.localeCompare(a))};
}
export function dailyWinrate(games){const days=new Map();for(const game of games)if(/^\d{4}-\d{2}-\d{2}$/.test(game.played_at||'')){const row=days.get(game.played_at)||{games:0,wins:0};row.games++;if(game.won)row.wins++;days.set(game.played_at,row)}let total=0,wins=0;return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,day])=>{total+=day.games;wins+=day.wins;return {date,games:total,wins,rate:100*wins/total}})}
export function mostFacedFriendCommander(games,id){const counts=new Map();for(const game of games){const names=new Map();for(const player of Array.isArray(game.players)?game.players.slice(1):[]){if((player?.friend_id||player?.participant_id)!==id)continue;const name=player.commander?.trim(),key=commanderKey(name);if(key)names.set(key,name)}for(const [key,name]of names){const row=counts.get(key)||{name,games:0};row.games++;counts.set(key,row)}}return [...counts.values()].sort((a,b)=>b.games-a.games||a.name.localeCompare(b.name))[0]?.name||null}
