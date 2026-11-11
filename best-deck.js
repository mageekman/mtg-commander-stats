// Rankings use only the games included in the selected statistics period.
export function selectBestDeck(decks,games,minGames=1){
 const totals=new Map();
 for(const game of games){const stats=totals.get(game.deck_id)||{games:0,wins:0,last:''};stats.games++;if(game.won)stats.wins++;if(game.played_at&&game.played_at>stats.last)stats.last=game.played_at;totals.set(game.deck_id,stats)}
 return decks.filter(deck=>!deck.archived_at&&totals.has(deck.id)&&totals.get(deck.id).games>=minGames).map(deck=>({deck,...totals.get(deck.id)})).sort((a,b)=>b.wins*a.games-a.wins*b.games||b.games-a.games||b.last.localeCompare(a.last)||String(a.deck.id).localeCompare(String(b.deck.id)))[0]||null;
}
