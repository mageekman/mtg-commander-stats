export async function loadFriendDisplayNames(client){
 try{const {data,error}=await client.rpc('list_game_friends');if(error)return new Map();return new Map((data||[]).filter(friend=>friend.display_name?.trim()).map(friend=>[friend.id,friend.display_name.trim()]))}catch{return new Map()}
}
export function gamePlayerDisplayName(player,names,fallback='Player'){
 return (player?.friend_id&&names?.get(player.friend_id))||player?.name?.trim()||fallback;
}
