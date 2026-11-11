import {applyPassportArt} from './passport-art.js?v=1';
import {mountFriendAction} from './friends.js?v=3';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const mounted=new WeakMap();
export function mountPlayedWith(host,client){
 mounted.get(host)?.();let epoch=0,offset=0,loading=false;const size=12;
 host.className='played-with-panel';host.setAttribute('aria-label','Players you have played with');
 const heading=node('div');heading.className='played-with-heading';heading.append(node('h2','Played with'));
 const refresh=node('button','Refresh');refresh.type='button';heading.append(refresh);
 const info=node('p','Players from your game history who aren’t on your friends list.'),status=node('p');status.setAttribute('role','status');
 const cards=node('div');cards.className='played-with-grid';const more=node('button','Show more players');more.type='button';more.hidden=true;host.replaceChildren(heading,info,status,cards,more);
 async function load(reset=true){
  if(!host.isConnected)return;if(loading&&!reset)return;const token=++epoch;if(reset){offset=0;cards.replaceChildren()}loading=true;refresh.disabled=more.disabled=true;status.textContent='Loading players…';more.hidden=true;
  try{
   const {data,error}=await client.rpc('get_played_with_players',{page_size:size,page_offset:offset});if(error)throw error;if(token!==epoch||!host.isConnected)return;
   const rows=Array.isArray(data)?data:[];offset+=rows.length;status.textContent=offset?'':'No other players yet. Tagged players from shared games will appear here.';more.hidden=rows.length<size;
   window.commandLedgerPrefetchCommanders?.(rows.map(p=>p.favorite_commander).filter(Boolean));
   for(const player of rows){
    const card=node('article');card.className='played-with-card';const link=node('a');link.className='played-with-passport';link.href='./player.html?user='+encodeURIComponent(player.handle);
    const copy=node('div');copy.append(node('strong',player.display_name||player.handle),node('small','@'+player.handle));link.append(copy);
    const details=node('div');details.className='played-with-details';details.append(node('span',player.games+' '+(Number(player.games)===1?'game':'games')+' together'));if(player.last_played)details.append(node('small','Last played '+player.last_played));
    const actions=node('div');card.append(link,details,actions);cards.append(card);mountFriendAction(actions,player.handle,player.relationship);
    if(player.favorite_commander)Promise.resolve(window.commandLedgerCommanderArtwork?.(player.favorite_commander)).then(url=>{if(!url||!link.isConnected )return;const image=node('img');image.src=url;image.alt='';image.loading='lazy';image.decoding='async';link.prepend(image);applyPassportArt(client,image,player.handle,player.favorite_commander)}).catch(()=>{});
   }
  }catch(error){if(token===epoch&&host.isConnected){status.textContent='Players could not load: '+error.message;more.hidden=reset;}}
  finally{if(token===epoch){loading=false;refresh.disabled=more.disabled=false}}
 }
 const changed=()=>{if(!host.isConnected){cleanup();return}if(!host.closest('[hidden]'))load()};
 const cleanup=()=>{epoch++;document.removeEventListener('friends-changed',changed);document.removeEventListener('game-invitations-changed',changed);window.removeEventListener('focus',changed)};
 mounted.set(host,cleanup);refresh.onclick=()=>load();more.onclick=()=>load(false);document.addEventListener('friends-changed',changed);document.addEventListener('game-invitations-changed',changed);window.addEventListener('focus',changed);load();return cleanup;
}
