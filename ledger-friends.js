const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function distance(a,b){let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=row}return previous[b.length]}
export function matchGameFriends(friends,query){
 const term=normalize(String(query||'').replace(/^@/,''));
 const score=value=>{const name=normalize(value);if(!term)return 0;if(name===term)return 0;if(name.startsWith(term))return 1;if(name.includes(term))return 2;const difference=distance(name,term);return term.length>=3&&difference<=Math.max(1,Math.floor(term.length/4))?3+difference:Infinity};
 return friends.map(friend=>({friend,score:Math.min(score(friend.handle),score(friend.display_name))})).filter(item=>Number.isFinite(item.score)).sort((a,b)=>a.score-b.score||a.friend.handle.localeCompare(b.friend.handle)).slice(0,8).map(item=>item.friend);
}
export function createGameFriendService(sb){
 let pending=null,expires=0;
 async function request(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data||[]}
 return {
  clear(){pending=null;expires=0},
  friends(force=false){if(force||!pending||Date.now()>expires){expires=Date.now()+15000;pending=request('list_game_friends').catch(error=>{pending=null;throw error})}return pending},
  decks(id){return request('get_friend_game_decks',{target_id:id})}
 };
}
export function gamePlayerSnapshot(row){return {name:row.querySelector('.player-name').value.trim(),commander:row.querySelector('.player-commander').value.trim(),...(row.recordedParticipantId?{participant_id:row.recordedParticipantId,...(row.recordedDeckId?{participant_deck_id:row.recordedDeckId}:{})}:{}),...(row.friendSelection||{})}}
let nextMenuId=0;
export function attachGameFriend({row,name,commander,snapshot,service,onCommander}){
 row.recordedParticipantId=snapshot?.participant_id||snapshot?.friend_id||null;row.recordedDeckId=snapshot?.participant_deck_id||snapshot?.friend_deck_id||null;
 commander.addEventListener('input',()=>{row.recordedDeckId=null});
 const label=name.parentElement,wrap=commander.closest('.commander-search');
 const menu=document.createElement('div');menu.className='game-friend-menu';menu.id='game-friend-menu-'+(++nextMenuId);menu.role='listbox';menu.hidden=true;label.append(menu);
 const status=document.createElement('span');status.className='game-friend-status';status.setAttribute('role','status');label.append(status);
 name.autocomplete='off';name.setAttribute('role','combobox');name.setAttribute('aria-autocomplete','list');name.setAttribute('aria-controls',menu.id);name.setAttribute('aria-expanded','false');name.placeholder='Player name or @friend';
 let sequence=0,picker=null;
 const setCommander=value=>{commander.value=value;commander.setSelectedCommander?.(value);onCommander(value)};
 const close=()=>{menu.hidden=true;menu.replaceChildren();name.setAttribute('aria-expanded','false')};
 function manual(){picker?.remove();picker=null;if(wrap)wrap.hidden=false;commander.required=true;commander.disabled=false;row.friendSelection=null;row.friendLoading=false}
 async function choose(friend,restoring=false){
  const current=++sequence;close();manual();if(!restoring){row.recordedParticipantId=null;row.recordedDeckId=null;}if(!restoring)name.value='@'+friend.handle;
  row.friendSelection={friend_id:friend.id};row.friendLoading=true;commander.disabled=true;status.textContent='Loading shared decks…';
  try{
   const decks=await service.decks(friend.id);if(!row.isConnected||current!==sequence)return;
   if(!decks.length){const friends=await service.friends(true);if(current!==sequence||!row.isConnected)return;if(!friends.some(f=>f.id===friend.id)){manual();status.textContent='Friend link unavailable. Saved name and commander kept.';return}}
   if(restoring&&snapshot?.friend_deck_id&&!decks.some(deck=>deck.id===snapshot.friend_deck_id)){manual();setCommander(snapshot.commander||'');status.textContent='Deck unavailable. Saved name and commander kept.';return}
   if(!decks.length){status.textContent='No shared active decks with games. Enter a commander manually.';return}
   if(restoring&&!snapshot.friend_deck_id){status.textContent='Recorded commander kept for @'+friend.handle+'.';return}
   picker=document.createElement('select');picker.className='game-friend-deck';picker.required=true;picker.setAttribute('aria-label','Deck for @'+friend.handle);
   const blank=document.createElement('option');blank.value='';blank.textContent='Choose their deck';picker.append(blank);
   for(const deck of decks){const option=document.createElement('option');option.value=deck.id;option.textContent=deck.name+' — '+deck.commander;picker.append(option)}
   wrap.hidden=true;commander.required=false;wrap.after(picker);
   if(restoring&&snapshot.friend_deck_id){picker.value=snapshot.friend_deck_id;row.friendSelection.friend_deck_id=snapshot.friend_deck_id;setCommander(snapshot.commander||'');const selected=decks.find(deck=>deck.id===snapshot.friend_deck_id);if(selected.commander!==snapshot.commander)picker.selectedOptions[0].textContent+=' (recorded: '+snapshot.commander+')'}
   else setCommander('');
   picker.onchange=()=>{const selected=decks.find(deck=>deck.id===picker.value);row.friendSelection=selected?{friend_id:friend.id,friend_deck_id:selected.id}:{friend_id:friend.id};setCommander(selected?.commander||'')};
   status.textContent='Choose one of @'+friend.handle+'’s publicly shared decks.';
  }catch{if(current===sequence&&row.isConnected){manual();status.textContent='Shared decks could not load. You can enter the commander manually.'}}
  finally{if(current===sequence){row.friendLoading=false;commander.disabled=false}}
 }
 name.addEventListener('input',async()=>{
  const current=++sequence;row.recordedParticipantId=null;row.recordedDeckId=null;close();if(row.friendSelection||row.friendLoading){manual();setCommander(commander.value)}status.textContent='';
  const value=name.value.trim();if(!value.startsWith('@'))return;
  try{const friends=await service.friends();if(current!==sequence||!row.isConnected)return;const matches=matchGameFriends(friends,value);for(const friend of matches){const option=document.createElement('button');option.type='button';option.role='option';option.tabIndex=-1;option.textContent=(friend.display_name||friend.handle)+' · @'+friend.handle;option.onmousedown=event=>event.preventDefault();option.onclick=()=>choose(friend).then(()=>{(picker||commander).focus()});menu.append(option)}if(!matches.length){status.textContent='No matching friends. You can still enter a player manually.';return}menu.hidden=false;name.setAttribute('aria-expanded','true')}
  catch{if(current===sequence)status.textContent='Friends could not load. Enter a name and commander manually.'}
 });
 name.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='ArrowDown'&&!menu.hidden){event.preventDefault();menu.querySelector('button')?.focus()}});
 menu.addEventListener('keydown',event=>{const options=[...menu.querySelectorAll('button')],index=options.indexOf(document.activeElement);if(event.key==='Escape'){close();name.focus()}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();options[(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus()}});
 label.addEventListener('focusout',()=>setTimeout(()=>{if(!label.contains(document.activeElement))close()},100));
 const recordedId=snapshot?.friend_id||snapshot?.participant_id;
 if(recordedId){row.friendSelection={friend_id:recordedId,...(snapshot.friend_deck_id?{friend_deck_id:snapshot.friend_deck_id}:{})};row.friendLoading=true;service.friends().then(friends=>{if(!row.isConnected||sequence)return;const friend=friends.find(f=>f.id===recordedId);if(friend)return choose(friend,true);manual();status.textContent='Recorded player. Not currently on your friends list.'}).catch(()=>{if(!sequence&&row.isConnected)manual()})}
}
