import {record,deckActivity,commanderMatchups} from './deck-performance-stats.js?v=participants-3';
// Every result belongs to the selected snapshot; no player names are exported.
export function deckShareInsights(snapshot){
 const ordered=snapshot.games.slice().sort((a,b)=>String(a.played_at).localeCompare(String(b.played_at))||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
 let longest=0,run=0;for(const game of ordered){run=game.won?run+1:0;longest=Math.max(longest,run)}
 const latest=ordered.at(-1);let current=0;for(let i=ordered.length-1;i>=0&&ordered[i].won===latest.won;i--)current++;
 const recent=ordered.slice(-10);const ids=new Set(snapshot.friendIds||[]),together=snapshot.games.filter(game=>game.players?.slice(1).some(player=>ids.has(player.friend_id||player.participant_id)));
 const faced=new Set(together.flatMap(game=>game.players.slice(1).map(player=>player.friend_id||player.participant_id).filter(id=>ids.has(id))));
 const friendWins=together.filter(game=>!game.won&&Number.isInteger(game.winner_player)&&game.winner_player>0&&ids.has(game.players?.[game.winner_player]?.friend_id||game.players?.[game.winner_player]?.participant_id)).length;
 return {longest,current,currentResult:latest?(latest.won?'win':'loss'):null,recent,recentRecord:record(recent),friends:{...record(together),count:faced.size,friendWins},activity:deckActivity(snapshot.allDeckGames||snapshot.games,snapshot.allGames,snapshot.range),matchups:commanderMatchups(snapshot.games)};
}
