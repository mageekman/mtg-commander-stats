// Counts come only from the caller's game records; friends are matched by saved IDs.
export function firstPlayerStats(games){
 const first={games:0,wins:0},other={games:0,wins:0};let excluded=0;
 for(const game of games){if(!Array.isArray(game.players)||!Number.isInteger(game.first_player)||game.first_player<0||game.first_player>=game.players.length){excluded++;continue}const group=game.first_player===0?first:other;group.games++;if(game.won)group.wins++}
 const rate=group=>group.games?100*group.wins/group.games:null;
 return {first:{...first,rate:rate(first)},other:{...other,rate:rate(other)},difference:first.games&&other.games?rate(first)-rate(other):null,excluded};
}
export function deckRotation(decks,games,allGames=games){
 return decks.filter(deck=>!deck.archived_at).map(deck=>{const played=games.filter(game=>game.deck_id===deck.id),dates=allGames.filter(game=>game.deck_id===deck.id&&game.played_at).map(game=>game.played_at).sort();return {id:deck.id,name:deck.name,commander:deck.commander,games:played.length,share:games.length?100*played.length/games.length:0,last:dates.at(-1)||null}}).sort((a,b)=>b.games-a.games||(b.last||'').localeCompare(a.last||'')||a.name.localeCompare(b.name));
}
export function friendMatchup(games,friendId){
 const result={games:0,your_wins:0,friend_wins:0,other_wins:0,unknown:0,last:null};
 for(const game of games){const players=Array.isArray(game.players)?game.players:[];if(!players.some((p,index)=>index>0&&(p.friend_id||p.participant_id)===friendId))continue;result.games++;if(game.played_at&&(!result.last||game.played_at>result.last))result.last=game.played_at;
  if(game.won){result.your_wins++;continue}
  const winner=Number.isInteger(game.winner_player)&&game.winner_player>0?players[game.winner_player]:null;
  if(!winner)result.unknown++;else if((winner.friend_id||winner.participant_id)===friendId)result.friend_wins++;else result.other_wins++;
 }
 return {...result,your_rate:result.games?100*result.your_wins/result.games:null,friend_rate:result.games&&!result.unknown?100*result.friend_wins/result.games:null};
}
export function gamesTogether(games,names){
 return [...names].map(([id,name])=>({id,name,...friendMatchup(games,id)})).filter(row=>row.games).sort((a,b)=>b.games-a.games||a.name.localeCompare(b.name));
}
