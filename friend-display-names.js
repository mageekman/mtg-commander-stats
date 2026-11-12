export async function loadFriendDisplayNames(client){
 try{const {data,error}=await client.rpc('list_game_friends');if(error)return new Map();const friends=(data||[]).filter(friend=>friend.display_name?.trim()||friend.handle),names=new Map(friends.map(friend=>[friend.id,friend.display_name?.trim()||'@'+friend.handle]));
  // Keep display labels unchanged; aliases are only used by game search.
  Object.defineProperty(names,'searchAliases',{value:new Map(friends.map(friend=>[friend.id,[friend.display_name,friend.handle].filter(Boolean)]))});Object.defineProperty(names,'identities',{value:new Map(friends.map(friend=>[friend.id,{handle:friend.handle||'',display_name:friend.display_name||''}]))});return names}catch{return new Map()}
}
export function gamePlayerDisplayName(player,names,fallback='Player'){
 return names?.get(player?.friend_id||player?.participant_id)||player?.name?.trim()||player?.commander?.trim()||fallback;
}
