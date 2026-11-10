import {renderFriendDashboard} from './friends-dashboard.js?v=2';
import {setFriendNotificationUser,showFriendNotifications} from './friend-notifications.js?v=1';
import {createClient} from './vendor/supabase-js.mjs';
import {mountFriendAction,mountRequestsPanel} from './friends.js?v=2';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el};
const status=document.getElementById('friendsPageStatus'),host=document.getElementById('friendsPageContent');
async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
function createPassportLoader(){
 const cache=new Map();
 return handle=>{
  if(!cache.has(handle))cache.set(handle,rpc('get_player_passport',{target_handle:handle}).then(rows=>rows?.[0]||null).catch(error=>{cache.delete(handle);throw error}));
  return cache.get(handle);
 };
}
async function fillPassport(link,friend,loadPassport){
 try{
  const profile=await loadPassport(friend.handle);
  if(!link.isConnected)return;
  if(!profile)return;
  link.querySelector('h2').textContent=profile.display_name||profile.handle;
  const copy=link.querySelector('.friend-passport-copy');
  if(profile.pronouns)copy.append(node('p',profile.pronouns));
  if(profile.bio)copy.append(node('p',profile.bio));
  if(profile.created_at)copy.append(node('p','Member since '+new Date(profile.created_at).toLocaleDateString(undefined,{month:'long',year:'numeric'})));
  if(profile.favorite_commander){
   const commander=node('span',profile.favorite_commander);commander.className='friend-passport-commander';copy.append(commander);
   const url=await window.commandLedgerCommanderArtwork(profile.favorite_commander);
   if(url&&link.isConnected){const image=node('img');image.src=url;image.alt='';image.loading='lazy';image.decoding='async';link.prepend(image)}
  }
 }catch{if(link.isConnected)link.querySelector('.friend-passport-copy').append(node('p','Open passport to view player details.'))}
}
async function loadRankings(dashboard,loadPassport){
 dashboard.setAttribute('aria-busy','true');dashboard.textContent='Loading friend rankings…';
 try{const data=await rpc('get_friend_rankings');if(dashboard.isConnected)renderFriendDashboard(dashboard,data,{loadPassport,loadArtwork:name=>window.commandLedgerCommanderArtwork(name)})}
 catch(error){if(dashboard.isConnected){dashboard.replaceChildren();dashboard.className='dashboard-error';const text=node('p','Rankings could not load: '+error.message);const retry=node('button','Try again');retry.type='button';retry.className='friends-page-button';retry.onclick=()=>loadRankings(dashboard,loadPassport);dashboard.append(text,retry)}}
 finally{dashboard.removeAttribute('aria-busy')}
}
let version=0;
async function loadFriends(){
 const current=++version;status.textContent='Loading friends…';
 try{
  const connections=await rpc('list_friend_connections');if(current!==version)return;
  const friends=(connections||[]).filter(c=>c.relationship==='friends');host.replaceChildren();
  const heading=node('div');heading.className='friends-list-heading';heading.append(node('p',friends.length+' friend'+(friends.length===1?'':'s')));
  const refresh=node('button','Refresh');refresh.type='button';refresh.className='friends-page-button';refresh.onclick=loadFriends;heading.append(refresh);host.append(heading);
  const loadPassport=createPassportLoader();
  const dashboard=node('section');dashboard.setAttribute('aria-label','Friend rankings dashboard');host.append(dashboard);loadRankings(dashboard,loadPassport);
  host.append(node('h2',"Friends’ Player Passports"));
  if(!friends.length){const empty=node('div');empty.className='friends-list-empty';empty.append(node('h2','Build your circle'),node('p','Find players and send a request. Once a request is accepted, their passport appears here.'));const find=node('a','Find Players');find.href='./find-players.html';find.className='friends-page-button';empty.append(find);host.append(empty)}
  const grid=node('div');grid.className='friends-passport-grid';host.append(grid);const jobs=[];
  for(const friend of friends){
   const card=node('article');card.className='friend-passport';const link=node('a');link.className='friend-passport-link';link.href='./player.html?user='+encodeURIComponent(friend.handle);link.setAttribute('aria-label','View '+(friend.display_name||friend.handle)+' player passport');
   const shade=node('div');shade.className='friend-passport-shade';const copy=node('div');copy.className='friend-passport-copy';const label=node('span','PLAYER PASSPORT');label.className='friends-eyebrow';const handle=node('span','@'+friend.handle);handle.className='friend-passport-handle';copy.append(label,node('h2',friend.display_name||friend.handle),handle);link.append(shade,copy);const actions=node('div');card.append(link,actions);grid.append(card);mountFriendAction(actions,friend.handle,'friends');jobs.push(()=>fillPassport(link,friend,loadPassport));
  }
  status.textContent='';host.hidden=false;
  let next=0;await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(next<jobs.length&&current===version)await jobs[next++]()}));
 }catch(error){status.textContent='Could not load friends: '+error.message;const retry=node('button','Try again');retry.type='button';retry.className='friends-page-button';retry.onclick=loadFriends;host.replaceChildren(retry);host.hidden=false}
}
let activeUser=null;
async function start(){
 try{const {data:{user},error}=await sb.auth.getUser();if(error)throw error;activeUser=user;setFriendNotificationUser(user);document.querySelector('.friends-page-tools').hidden=!user;
  if(!user){showFriendNotifications(document.getElementById('friendUpdates'));host.hidden=true;status.textContent='Sign in to see your friends and requests.';document.getElementById('friendsPageSignIn').hidden=false;return}
  document.getElementById('friendsPageSignIn').hidden=true;updateNotifications();
  if(document.body.dataset.friendsPage==='requests'){host.replaceChildren();host.hidden=false;status.textContent='';mountRequestsPanel(host)}else await loadFriends();
 }catch(error){status.textContent='Unable to load your connections: '+error.message}
}
document.addEventListener('friends-changed',()=>{if(activeUser&&document.body.dataset.friendsPage==='friends')loadFriends()});
window.addEventListener('focus',()=>{if(activeUser&&document.body.dataset.friendsPage==='friends')loadFriends()});
sb.auth.onAuthStateChange((_event,session)=>{if((session?.user?.id||null)!==(activeUser?.id||null)){version++;host.replaceChildren();host.hidden=true;setTimeout(start,0)}});
start();

function updateNotifications(){if(activeUser)showFriendNotifications(document.getElementById('friendUpdates'),{markSeen:document.body.dataset.friendsPage==='requests'})}
document.addEventListener('friend-notifications-updated',updateNotifications);
window.addEventListener('focus',updateNotifications);
