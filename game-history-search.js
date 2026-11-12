const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function gameMatchesSearch(game,deck,query,friendNames){
 const term=normalize(query);
 if(!term)return true;
 const names=[deck?.name,deck?.commander,game.played_at,typeof game.won==='boolean'?(game.won?'win wins':'loss losses'):''];
 if(Array.isArray(game.players))for(const player of game.players){const id=player?.friend_id||player?.participant_id;names.push(player?.name,player?.commander,player?.display_name,player?.username,player?.handle,friendNames?.get(id),...(friendNames?.searchAliases?.get(id)||[]))}
 if(Array.isArray(game.opponents))for(const opponent of game.opponents)names.push(typeof opponent==='string'?opponent:opponent?.name,typeof opponent==='object'?opponent?.commander:null);
 const fields=names.map(normalize),compact=value=>value.replace(/[\s@._'’,-]+/g,'');
 const tokens=term.split(' ').map(token=>token.replace(/^@/, '')).filter(Boolean);
 return tokens.every(token=>fields.some(field=>field.includes(token)||(compact(token)&&compact(field).includes(compact(token)))));
}
