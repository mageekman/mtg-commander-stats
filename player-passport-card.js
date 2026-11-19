import {applyPassportArt} from './passport-art.js?v=1';
// Compact public identity only; membership never grants access to private stats.
export function createPlayerPassportCards(client,{loadArtwork=name=>window.commandLedgerCommanderArtwork?.(name)}={}){
 const profiles=new Map(),jobs=[];let active=0;
 const run=()=>{while(active<4&&jobs.length){active++;Promise.resolve().then(jobs.shift()).catch(()=>{}).finally(()=>{active--;run()})}};
 const profileFor=handle=>{if(!profiles.has(handle))profiles.set(handle,client.rpc('get_player_passport',{target_handle:handle}).then(({data,error})=>{if(error)throw error;return data?.[0]||null}).catch(error=>{profiles.delete(handle);throw error}));return profiles.get(handle)};
 return person=>{
  const card=document.createElement('a');card.className='player-passport-card';card.href='./player.html?user='+encodeURIComponent(person.handle);
  const shade=document.createElement('span');shade.className='player-passport-shade';shade.setAttribute('aria-hidden','true');
  const copy=document.createElement('span');copy.className='player-passport-copy';const name=document.createElement('strong'),handle=document.createElement('small');name.textContent=person.display_name||person.handle;name.title=name.textContent;handle.textContent='@'+person.handle;copy.append(name,handle);card.append(shade,copy);card.setAttribute('aria-label','View '+name.textContent+' player passport');
  jobs.push(async()=>{
   if(!card.isConnected)return;const profile=await profileFor(person.handle);if(!card.isConnected||!profile)return;
   if(profile.display_name){name.textContent=profile.display_name;name.title=name.textContent;card.setAttribute('aria-label','View '+name.textContent+' player passport')}
   if(!profile.favorite_commander)return;const url=await loadArtwork(profile.favorite_commander);if(!url||!card.isConnected)return;
   const image=document.createElement('img');image.src=url;image.alt='';image.loading='lazy';image.decoding='async';card.prepend(image);await applyPassportArt(client,image,profile.handle||person.handle,profile.favorite_commander);
  });queueMicrotask(run);return card;
 };
}
