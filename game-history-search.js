const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function gameMatchesSearch(game,deck,query,friendNames){
 const term=normalize(query);
 if(!term)return true;
 const names=[deck?.commander];
 if(Array.isArray(game.players))for(const player of game.players)names.push(player?.name,player?.commander,friendNames?.get(player?.friend_id||player?.participant_id));
 if(Array.isArray(game.opponents))for(const opponent of game.opponents)names.push(typeof opponent==='string'?opponent:opponent?.name,typeof opponent==='object'?opponent?.commander:null);
 return names.some(name=>normalize(name).includes(term));
}
