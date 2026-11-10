const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el};
export async function mountRecentFriendGames(host,{loadGames,loadArtwork}){
 host.className='recent-friend-games';
 const heading=node('div');heading.className='friends-list-heading';heading.append(node('h2','Recent games with friends'));const ledger=node('a','View game history');ledger.href='./ledger.html#gameHistorySection';ledger.className='friends-page-button';heading.append(ledger);
 const status=node('p','Loading recent games…');status.setAttribute('role','status');const list=node('div');list.className='recent-friend-game-list';host.replaceChildren(heading,status,list);
 try{
  const games=await loadGames();if(!host.isConnected)return;
  status.textContent='';const recent=(games||[]).slice(0,5);
  if(!recent.length){status.textContent='No games with tagged friends yet. Use @ in a player name when recording a Ledger game to tag a friend.';return}
  const artwork=new Map();
  for(const game of recent){
   const card=node('article');card.className='friend-recent-game';const top=node('div');top.className='friend-recent-game-heading';const info=node('div');const result=node('span',game.won?'Win':'Loss');result.className='friend-game-result '+(game.won?'win':'loss');info.append(result,node('strong',game.deck_name||'Deleted deck'));const date=node('time',game.played_at);date.dateTime=game.played_at;top.append(info,date);card.append(top);
   const pod=node('div');pod.className='friend-game-pod';
   for(const [index,raw] of (Array.isArray(game.players)?game.players:[]).entries()){
    const player=raw&&typeof raw==='object'?raw:{};
    const tile=node('div');tile.className='friend-game-player';if(index===game.winner_player)tile.classList.add('friend-game-winner');const image=node('div');image.className='friend-game-art';image.setAttribute('aria-hidden','true');const details=node('div');details.className='friend-game-details';const tags=node('div');tags.className='friend-game-tags';if(index===game.winner_player)tags.append(node('span','🏆 Winner'));if(index===game.first_player)tags.append(node('span','Went first'));if(player.friend_id)tags.append(node('span','Friend'));details.append(tags,node('strong',player.name||'Player '+(index+1)));const commander=node('a',player.commander||'Unknown commander');commander.href='https://scryfall.com/search?q='+encodeURIComponent('!"'+String(player.commander||'').replace(/"/g,'')+'"');commander.target='_blank';commander.rel='noopener noreferrer';details.append(commander);tile.append(image,details);pod.append(tile);
    if(player.commander&&loadArtwork){if(!artwork.has(player.commander))artwork.set(player.commander,Promise.resolve().then(()=>loadArtwork(player.commander)));artwork.get(player.commander).then(url=>{if(url&&image.isConnected)image.style.backgroundImage='url("'+url+'")'}).catch(()=>{})}
   }
   card.append(pod);if(game.notes){const note=node('p',game.notes);note.className='friend-game-note';card.append(note)}list.append(card);
  }
 }catch(error){if(!host.isConnected)return;status.textContent='Recent games could not load: '+error.message;const retry=node('button','Try again');retry.type='button';retry.className='friends-page-button';retry.onclick=()=>mountRecentFriendGames(host,{loadGames,loadArtwork});host.append(retry)}
}
