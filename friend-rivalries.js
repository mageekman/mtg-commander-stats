import {friendMatchup} from './player-game-stats.js?v=participants-2';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e};
export function mountFriendRivalries(host,{loadGames,loadFriends,initialFriendId='',onSelect=()=>{},loadSelf,loadPassport,loadArtwork,applyArtwork}){
 host.className='friend-rivalries';const heading=node('div');heading.className='friend-rivalries-heading';heading.append(node('h2','Friend Rivalries'));const label=node('label','Matchup '),select=node('select');select.setAttribute('aria-label','Choose a friend rivalry');select.disabled=true;label.append(select);heading.append(label);const description=node('p','Your logged games with tagged friends. Results describe multiplayer games, so another player may have won.');const body=node('div');body.setAttribute('aria-live','polite');host.append(heading,body);
 const identities=new Map();let selfProfile;
 function hydrateFighter(panel,profilePromise){
  Promise.resolve(profilePromise).then(async profile=>{
   if(!panel.isConnected||!profile)return;
   const name=profile.display_name?.trim()||profile.handle||panel.dataset.fallback;
   panel.querySelector('.rivalry-fighter-name').textContent=name;panel.querySelector('.rivalry-fighter-name').title=name;
   panel.querySelector('.rivalry-fighter-handle').textContent=profile.handle?'@'+profile.handle:'';
   const commander=profile.favorite_commander;
   if(!commander)return;
   panel.querySelector('.rivalry-champion-name').textContent=commander;panel.querySelector('.rivalry-champion-name').title=commander;
   if(!loadArtwork)return;
   try{const url=await loadArtwork(commander);if(!panel.isConnected)return;if(!url){panel.querySelector('.rivalry-art-placeholder span').textContent='Artwork unavailable';return}const image=node('img');image.alt=commander;image.decoding='async';image.onload=()=>{if(panel.isConnected)panel.classList.add('has-rivalry-art')};image.onerror=()=>{image.remove();panel.querySelector('.rivalry-art-placeholder span').textContent='Artwork unavailable'};panel.querySelector('.rivalry-fighter-art').append(image);image.src=url;applyArtwork?.(image,profile)}catch{if(panel.isConnected)panel.querySelector('.rivalry-art-placeholder span').textContent='Artwork unavailable'}
  }).catch(()=>{});
 }
 function fighter(side,name,wins,rate,profile){
  const panel=node('article');panel.className='rivalry-fighter rivalry-fighter-'+side;panel.dataset.side=side;panel.dataset.fallback=name;
  const header=node('div');header.className='rivalry-fighter-heading';const tag=node('span',side==='self'?'PLAYER 01 · YOU':'PLAYER 02 · FRIEND');tag.className='rivalry-fighter-tag';const title=node('h3',name);title.className='rivalry-fighter-name';title.title=name;const handle=node('small');handle.className='rivalry-fighter-handle';header.append(tag,title,handle);
  const artwork=node('div');artwork.className='rivalry-fighter-art';const placeholder=node('div');placeholder.className='rivalry-art-placeholder';const emblem=node('img');emblem.src='./cl-logo-final-transparent.webp?v=delivery-1';emblem.alt='';placeholder.append(emblem,node('span','Favorite commander not set'));artwork.append(placeholder);
  const champion=node('div');champion.className='rivalry-champion';const caption=node('small','FAVORITE COMMANDER'),commander=node('strong',side==='self'?'Choose yours in Account Settings':'Awaiting a favorite commander');commander.className='rivalry-champion-name';champion.append(caption,commander);
  const stats=node('div');stats.className='rivalry-fighter-stats';for(const [metric,label,value]of [['wins','Wins',wins],['rate','Win rate',rate===null?'—':rate.toFixed(1)+'%']]){const card=node('div');card.className='rivalry-fighter-score';card.dataset.metric=metric;card.append(node('strong',value),node('span',label));stats.append(card)}
  panel.append(header,artwork,champion,stats);queueMicrotask(()=>hydrateFighter(panel,profile));return panel;
 }
 let games=[],friends=[],loaded=false,failure=null,range={range_start:null,range_end:null,label:'All time'};
 function render(){if(!host.isConnected)return;if(!range){body.replaceChildren(node('p','Choose a valid time period above to view this matchup.'));return}if(failure){body.replaceChildren(node('p','Matchups could not load: '+failure.message));const retry=node('button','Try again');retry.type='button';retry.className='friends-page-button';retry.onclick=load;body.append(retry);return}if(!loaded){body.textContent='Loading friend matchups…';return}body.replaceChildren();if(!friends.length){body.append(node('p','Connect with a friend to see your matchups.'));return}
  const friend=friends.find(f=>f.id===select.value);if(!friend)return;const filtered=games.filter(game=>(!range.range_start||game.played_at>=range.range_start)&&(!range.range_end||game.played_at<=range.range_end)),match=friendMatchup(filtered,friend.id),name=friend.display_name?.trim()||'@'+friend.handle;
  const period=node('p',range.label);period.className='rivalry-period';body.append(period);
  const arena=node('div');arena.className='rivalry-versus-arena';const versus=node('span','VS');versus.className='rivalry-versus-emblem';versus.setAttribute('aria-label','versus');
  if(!selfProfile)selfProfile=Promise.resolve().then(()=>loadSelf?.()).catch(()=>null);
  if(!identities.has(friend.handle))identities.set(friend.handle,Promise.resolve().then(()=>loadPassport?.(friend.handle)).catch(()=>null));
  const divider=document.createElementNS('http://www.w3.org/2000/svg','svg');divider.setAttribute('viewBox','0 0 32 100');divider.setAttribute('preserveAspectRatio','none');divider.setAttribute('aria-hidden','true');divider.classList.add('rivalry-art-divider');const line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [key,value]of Object.entries({x1:'32',y1:'0',x2:'0',y2:'100',stroke:'#c9aa75','stroke-width':'1.5','vector-effect':'non-scaling-stroke'}))line.setAttribute(key,value);divider.append(line);
  arena.append(fighter('self','You',match.your_wins,match.your_rate,selfProfile),versus,fighter('friend',name,match.friend_wins,match.friend_rate,identities.get(friend.handle)),divider);body.append(arena);
  const context=node('div');context.className='rivalry-match-context';for(const [label,value]of [['Games together',match.games],['Other players’ wins',match.other_wins]]){const item=node('div');item.append(node('strong',value),node('span',label));context.append(item)}body.append(context);
  if(!match.games)body.append(node('p','No games with this friend tagged in the selected period. Tag them with @ when adding a game.'));
  if(match.unknown)body.append(node('p',match.unknown+' game'+(match.unknown===1?' has':'s have')+' no recorded winner identity and cannot be assigned to a rival winner.'));
  const details=node('details');details.className='rivalry-match-details';details.append(node('summary','Matchup details'),description);if(match.last)details.append(node('p','Last played together: '+match.last));details.append(node('p','Based only on your Ledger. Your friend’s private game records are not included.'));body.append(details);
 }
 async function load(){loaded=false;failure=null;select.disabled=true;render();try{[games,friends]=await Promise.all([loadGames(),loadFriends()]);games=Array.isArray(games)?games:[];friends=Array.isArray(friends)?friends:[];if(!host.isConnected)return;const selected=select.value||initialFriendId;select.replaceChildren();friends.sort((a,b)=>(a.display_name||a.handle).localeCompare(b.display_name||b.handle));for(const friend of friends){const option=node('option',(friend.display_name?.trim()||friend.handle)+' (@'+friend.handle+')');option.value=friend.id;select.append(option)}if(friends.some(f=>f.id===selected))select.value=selected;select.disabled=!friends.length;loaded=true;render()}catch(error){failure=error;render()}}
 select.onchange=()=>{onSelect(select.value);render()};load();return {setRange(next){range=next;render()}};
}
