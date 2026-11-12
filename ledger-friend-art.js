import {artPanel} from './deck-visuals.js?v=prepared-perf-1';
import {applyArt} from './passport-art.js?v=1';

export function createLedgerFriendArtwork(client){
 const profiles=new Map();
 return friend=>{
  if(!friend.handle)return artPanel(friend.commander);
  const placeholder=artPanel('');
  if(!profiles.has(friend.handle)){
   const read=name=>client.rpc(name,{target_handle:friend.handle}).then(({data,error})=>{if(error)throw error;return data}).catch(()=>{profiles.delete(friend.handle);return null});
   profiles.set(friend.handle,Promise.all([read('get_player_passport'),read('get_passport_art')]));
  }
  profiles.get(friend.handle).then(([rows,frame])=>{
   if(!placeholder.isConnected)return;
   const profile=rows?.[0];
   const commander=profile?.favorite_commander||friend.commander;
   const art=artPanel(commander,'ledger-together-art',{onImage:image=>{
    window.commandLedgerArtPosition?.apply(image,commander);
    if(profile?.favorite_commander)applyArt(image,frame,commander);
   }});
   placeholder.replaceWith(art);
  });
  return placeholder;
 };
}
