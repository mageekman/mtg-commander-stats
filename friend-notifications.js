import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
let userId=null,unread=0,epoch=0;
const panels=new WeakMap();
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('command-ledger-friend-notifications'):null;
function paint(){
 for(const link of document.querySelectorAll('#siteNavigation a[href="./friends.html"]')){
  link.querySelector('.friend-notification-badge')?.remove();link.removeAttribute('aria-label');
  if(!userId||!unread)continue;
  const badge=document.createElement('span');badge.className='friend-notification-badge';badge.setAttribute('aria-hidden','true');badge.textContent='● '+(unread>99?'99+':unread);link.append(badge);
  link.setAttribute('aria-label','Friends, '+unread+' unread update'+(unread===1?'':'s'));badge.title=unread+' unread friend update'+(unread===1?'':'s');
 }
}
function setCount(count){const changed=unread!==Number(count||0);unread=Number(count||0);paint();if(changed)document.dispatchEvent(new Event('friend-notifications-updated'))}
export function setFriendNotificationUser(user){const id=user?.id||null;if(userId===id){paint();return}userId=id;epoch++;setCount(0);if(userId)refreshFriendNotifications()}
export async function refreshFriendNotifications(){
 if(!userId)return;
 const current=epoch;
 try{const {data,error}=await sb.rpc('friend_notification_count');if(!error&&current===epoch)setCount(data)}catch{}
}
function announceRead(){channel?.postMessage('read');try{localStorage.setItem('command-ledger-friend-notifications-read',String(Date.now()))}catch{}}
channel?.addEventListener('message',refreshFriendNotifications);
window.addEventListener('storage',event=>{if(event.key==='command-ledger-friend-notifications-read')refreshFriendNotifications()});
window.addEventListener('focus',refreshFriendNotifications);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshFriendNotifications()});
document.addEventListener('friends-changed',refreshFriendNotifications);
document.addEventListener('game-invitations-changed',refreshFriendNotifications);
setInterval(()=>{if(document.visibilityState==='visible')refreshFriendNotifications()},45000);
export async function showFriendNotifications(host,{markSeen=false}={}){
 const id=userId,current=epoch;
 panels.get(host)?.();
 let disposed=false,observer=null;
 const cleanup=()=>{disposed=true;observer?.disconnect();document.removeEventListener('visibilitychange',checkSeen)};
 panels.set(host,cleanup);
 let notifications=[],visible=false,marking=false;
 async function checkSeen(){
  if(disposed||marking||!markSeen||!visible||document.visibilityState!=='visible'||id!==userId||!host.isConnected)return;
  marking=true;
  try{
   const {data,error}=await sb.rpc('mark_friend_notifications_seen',{notification_ids:notifications.map(n=>n.id)});
   if(error)throw error;
   if(current===epoch){host.dataset.seen='true';setCount(data);announceRead()}
   cleanup();
  }catch{if(disposed||current!==epoch)return;marking=false;const retry=document.createElement('button');retry.type='button';retry.className='notification-retry';retry.textContent='Mark updates as seen';retry.onclick=()=>{retry.remove();checkSeen()};if(!host.querySelector('.notification-retry'))host.append(retry)}
 }
 if(!id){host.hidden=true;host.replaceChildren();delete host.dataset.viewer;return}
 try{
  const {data,error}=await sb.rpc('list_friend_notifications');if(error)throw error;
  if(disposed||current!==epoch)return;
  notifications=data||[];
  if(!notifications.length){if(host.dataset.viewer!==id||host.dataset.seen!=='true'){host.hidden=true;host.replaceChildren()}return}
  host.dataset.viewer=id;delete host.dataset.seen;host.replaceChildren();
  const title=document.createElement('h2');title.id='friendUpdatesTitle';title.textContent='Friend updates';const list=document.createElement('ul');
  for(const update of notifications){const item=document.createElement('li');const link=document.createElement('a');link.textContent=update.display_name||update.handle||'A player';link.href='./player.html?user='+encodeURIComponent(update.handle||'');item.append(link,document.createTextNode(update.kind==='invite_joined'?' joined Command Ledger through your invite. You are now friends.':update.kind==='game_tagged'?' tagged you in a game. You can choose to add it to your Ledger.':update.kind==='request_accepted'?' accepted your friend request.':' sent you a friend request.'));list.append(item)}
  host.append(title,list);
  if(!markSeen){const manage=document.createElement('a');manage.className='friends-page-button';manage.href='./friend-requests.html';manage.textContent='View updates and manage requests';host.append(manage)}
  host.hidden=false;
  if(markSeen){observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);checkSeen()},{threshold:0.1});observer.observe(host);document.addEventListener('visibilitychange',checkSeen)}
 }catch{if(!disposed&&current===epoch){host.hidden=false;host.replaceChildren();const message=document.createElement('p');message.textContent='Friend updates could not load. ';const retry=document.createElement('button');retry.type='button';retry.className='notification-retry';retry.textContent='Try again';retry.onclick=()=>showFriendNotifications(host,{markSeen});host.append(message,retry)}}
}
