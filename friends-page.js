import {mountFriendRivalries} from './friend-rivalries.js?v=1';
import {rankingPeriods,rankingRange,dateString} from './friend-ranking-period.js?v=1';
import {applyPassportArt} from './passport-art.js?v=1';
import {mountGameInvitations} from './game-invitations.js?v=1';
import {mountRecentFriendGames} from './recent-friend-games.js?v=2';
import {renderFriendDashboard} from './friends-dashboard.js?v=period-4';
import {setFriendNotificationUser,showFriendNotifications} from './friend-notifications.js?v=2';
import {createClient} from './vendor/supabase-js.mjs';
import {mountRequestsPanel} from './friends.js?v=3';
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
  if(profile.favorite_commander){
   const url=await window.commandLedgerCommanderArtwork(profile.favorite_commander);
   if(url&&link.isConnected){const image=node('img');image.src=url;image.alt='';image.loading='lazy';image.decoding='async';link.prepend(image);applyPassportArt(sb,image,profile.handle,profile.favorite_commander)}
  }
 }catch{/* Keep the compact name and handle when profile artwork is unavailable. */}
}
const rankingPeriod={mode:'all',start:'',end:''};let selectedRivalFriend='';
function mountRankings(section,loadPassport,onPeriodChange=()=>{}){
 const top=node('div');top.className='friend-ranking-heading';top.append(node('h2','Friend Rankings'));
 const label=node('label','View '),select=node('select');select.id='friendStatsDatePreset';select.setAttribute('aria-label','Friend statistics time period');
 for(const [value,text]of rankingPeriods){const option=node('option',text);option.value=value;select.append(option)}select.value=rankingPeriod.mode;label.append(select);top.append(label);
 const dates=node('div');dates.className='friend-ranking-dates';dates.hidden=rankingPeriod.mode!=='custom';
 const now=new Date();if(!rankingPeriod.start)rankingPeriod.start=dateString(new Date(now.getFullYear(),now.getMonth(),1));if(!rankingPeriod.end)rankingPeriod.end=dateString(now);
 const inputs=['start','end'].map((key,index)=>{const label=node('label',index?'Through ':'From '),input=node('input');input.type='date';input.id=index?'friendStatsDateEnd':'friendStatsDateStart';input.value=rankingPeriod[key];label.append(input);dates.append(label);return input});
 const dashboard=node('div');dashboard.setAttribute('aria-live','polite');section.append(top,dates,dashboard);let request=0;
 async function load(){
  const current=++request;let range;
  try{range=rankingRange(rankingPeriod.mode,rankingPeriod.start,rankingPeriod.end)}catch(error){onPeriodChange(null);dashboard.removeAttribute('aria-busy');dashboard.className='dashboard-error';dashboard.textContent=error.message;return}
  onPeriodChange(range);dashboard.setAttribute('aria-busy','true');dashboard.className='';dashboard.textContent='Loading friend rankings…';
  try{const data=await rpc('get_friend_rankings',{range_start:range.range_start,range_end:range.range_end});if(current!==request||!section.isConnected)return;renderFriendDashboard(dashboard,data,{periodLabel:range.label,showTitle:false,loadPassport,applyArtwork:(image,profile)=>applyPassportArt(sb,image,profile.handle,profile.favorite_commander),loadArtwork:name=>window.commandLedgerCommanderArtwork(name)})}
  catch(error){if(current!==request||!section.isConnected)return;dashboard.replaceChildren();dashboard.className='dashboard-error';const text=node('p','Rankings could not load: '+error.message),retry=node('button','Try again');retry.type='button';retry.className='friends-page-button';retry.onclick=load;dashboard.append(text,retry)}
  finally{if(current===request)dashboard.removeAttribute('aria-busy')}
 }
 select.onchange=()=>{rankingPeriod.mode=select.value;dates.hidden=select.value!=='custom';load()};
 inputs.forEach((input,index)=>input.onchange=()=>{rankingPeriod[index?'end':'start']=input.value;load()});load();
}
async function loadRivalryGames(){
 const actor=activeUser?.id;if(!actor)return [];const games=[];
 for(let offset=0;;offset+=1000){const {data,error}=await sb.from('personal_games').select('id,played_at,won,players,winner_player').eq('owner_id',actor).order('id').range(offset,offset+999);if(error)throw error;if(activeUser?.id!==actor)return [];games.push(...(data||[]));if(!data||data.length<1000)break}
 return games;
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
  const dashboard=node('section');dashboard.setAttribute('aria-label','Friend rankings dashboard');const rivalry=node('section');rivalry.setAttribute('aria-label','Friend rivalries');host.append(dashboard,rivalry);const rivalryView=mountFriendRivalries(rivalry,{initialFriendId:selectedRivalFriend,onSelect:id=>selectedRivalFriend=id,loadGames:loadRivalryGames,loadFriends:()=>rpc('list_game_friends')});mountRankings(dashboard,loadPassport,range=>rivalryView.setRange(range));
  const recentGames=node('section');recentGames.setAttribute('aria-label','Recent games with friends');host.append(recentGames);mountRecentFriendGames(recentGames,{loadGames:()=>rpc('get_recent_friend_games'),loadFriendNames:()=>rpc('list_game_friends'),loadArtwork:name=>window.commandLedgerCommanderArtwork(name)});
  host.append(node('h2',"Friends’ Player Passports"));
  if(!friends.length){const empty=node('div');empty.className='friends-list-empty';empty.append(node('h2','Build your circle'),node('p','Find players and send a request. Once a request is accepted, their passport appears here.'));const find=node('a','Find Players');find.href='./find-players.html';find.className='friends-page-button';empty.append(find);host.append(empty)}
  const grid=node('div');grid.className='friends-passport-grid';host.append(grid);const jobs=[];
  for(const friend of friends){
   const card=node('article');card.className='friend-passport';const link=node('a');link.className='friend-passport-link';link.href='./player.html?user='+encodeURIComponent(friend.handle);link.setAttribute('aria-label','View '+(friend.display_name||friend.handle)+' player passport');
   const shade=node('div');shade.className='friend-passport-shade';const copy=node('div');copy.className='friend-passport-copy';const handle=node('span','@'+friend.handle);handle.className='friend-passport-handle';copy.append(node('h2',friend.display_name||friend.handle),handle);link.append(shade,copy);card.append(link);grid.append(card);jobs.push(()=>fillPassport(link,friend,loadPassport));
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
  if(document.body.dataset.friendsPage==='requests'){host.replaceChildren();host.hidden=false;status.textContent='';const games=node('section'),friends=node('section');host.append(games,friends);mountGameInvitations(games,{loadInvitations:()=>rpc('list_game_invitations'),loadDecks:async()=>{const {data,error}=await sb.from('decks').select('id,name,commander,archived_at').eq('owner_id',user.id).order('name');if(error)throw error;return data||[]},respond:(id,decision,deck)=>rpc('respond_game_invitation',{invitation_id:id,decision,selected_deck_id:deck})});mountRequestsPanel(friends)}else await loadFriends();
 }catch(error){status.textContent='Unable to load your connections: '+error.message}
}
document.addEventListener('friends-changed',()=>{if(activeUser&&document.body.dataset.friendsPage==='friends')loadFriends()});
window.addEventListener('focus',()=>{if(activeUser&&document.body.dataset.friendsPage==='friends')loadFriends()});
sb.auth.onAuthStateChange((_event,session)=>{if((session?.user?.id||null)!==(activeUser?.id||null)){version++;host.replaceChildren();host.hidden=true;setTimeout(start,0)}});
start();

function updateNotifications(){if(activeUser)showFriendNotifications(document.getElementById('friendUpdates'),{markSeen:document.body.dataset.friendsPage==='requests'})}
document.addEventListener('friend-notifications-updated',updateNotifications);
window.addEventListener('focus',updateNotifications);
