const key=(game,index)=>String(game)+':'+index;
export function historyDeckTitle(name,id,enabled=true){const node=document.createElement(id&&enabled?'a':'span');node.textContent=name;if(id&&enabled){node.href='./deck.html?id='+encodeURIComponent(id);node.className='game-history-deck-title'}return node}
export function markHistoryPlayer(node,game,index){if(index>0)node.dataset.historyPlayer=key(game.id,index);return node}
export function historyFriendDeckSlot(game,index,compact=false){const node=document.createElement('span');node.className='game-history-friend-deck';node.hidden=true;if(index>0)node.dataset.historyDeck=key(game.id,index);node.dataset.compact=String(compact);return node}
// Batch only the games rendered on screen. Cache lasts for this data load, and
// opening a shared deck always rechecks friendship, archive state and privacy.
export function createGameHistoryLinker(client){
 const cache=new Map(),pending=new Map();let epoch=0;
 return {clear(){epoch++;cache.clear();pending.clear()},async hydrate(root,games){
  const token=epoch,players=[...root.querySelectorAll('[data-history-player]')],decks=[...root.querySelectorAll('[data-history-deck]')];if(!players.length&&!decks.length)return;
  const ids=[...new Set(games.map(g=>g.id).filter(Boolean))],missing=ids.filter(id=>!cache.has(id)&&!pending.has(id));
  for(let start=0;start<missing.length;start+=100){const chunk=missing.slice(start,start+100);const job=Promise.resolve().then(()=>client.rpc('get_game_history_links',{game_ids:chunk})).then(({data,error})=>{if(error)throw error;if(epoch!==token)return;for(const id of chunk)cache.set(id,(Array.isArray(data)?data:[]).filter(row=>row.game_id===id))}).catch(()=>{}).finally(()=>{for(const id of chunk)if(pending.get(id)===job)pending.delete(id)});for(const id of chunk)pending.set(id,job)}
  await Promise.all([...new Set(ids.map(id=>pending.get(id)).filter(Boolean))]);if(epoch!==token)return;
  const links=new Map(ids.flatMap(id=>(cache.get(id)||[]).map(row=>[key(id,row.player_index),row])));
  for(const node of players){if(!node.isConnected)continue;const row=links.get(node.dataset.historyPlayer);if(!row?.handle){node.textContent=node.textContent;continue;}const a=document.createElement('a');a.className='game-history-profile-link';a.href='./player.html?user='+encodeURIComponent(row.handle);a.textContent=row.display_name?.trim()||'@'+row.handle;node.replaceChildren(a)}
  for(const node of decks){if(!node.isConnected)continue;const row=links.get(node.dataset.historyDeck);node.hidden=true;node.replaceChildren();if(!row?.deck_id||!row.is_friend)continue;const a=document.createElement('a');a.className='game-history-friend-deck-link';a.href='./deck.html?id='+encodeURIComponent(row.deck_id)+'&game='+encodeURIComponent(row.game_id);a.textContent=node.dataset.compact==='true'?'Deck':row.deck_name||'View deck';a.title='View '+(row.deck_name||'deck');node.replaceChildren(a);node.hidden=false}
 }};
}
