import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el};
const mounts=new Set();
async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
export async function mountFriendAction(host,handle,initial,{allowRemove=false}={}){
 if(!handle)return;
 const state={host,handle,relationship:initial,busy:false};mounts.add(state);
 async function draw(){
  if(!host.isConnected){mounts.delete(state);return}
  host.replaceChildren();host.classList.add('friend-actions');
  if(!state.relationship){const loading=node('span','Checking connection…');host.append(loading);try{state.relationship=await rpc('friend_connection_status',{target_handle:handle})}catch(error){loading.textContent='Could not load friend status. ';const retry=node('button','Retry');retry.type='button';retry.onclick=draw;host.append(retry);return}}
  if(state.relationship==='self')return;
  const status=node('span',({none:'',outgoing:'Request sent',incoming:'Friend request received',friends:'Friends'})[state.relationship]);status.className='friend-relationship';
  const feedback=node('span');feedback.className='friend-feedback';feedback.setAttribute('role','status');host.append(status);
  const choices={none:[['send','Send friend request']],incoming:[['accept','Accept'],['decline','Decline']],outgoing:[['cancel','Cancel request']],friends:allowRemove?[['remove','Remove friend']]:[]};
  for(const [action,label] of choices[state.relationship]||[]){
   const button=node('button',label);button.type='button';button.disabled=state.busy;
   button.onclick=async()=>{
    if(state.busy)return;
    if(action==='remove'&&!confirm('Remove this friend connection?'))return;
    state.busy=true;for(const b of host.querySelectorAll('button'))b.disabled=true;feedback.textContent='Updating…';
    try{state.relationship=await rpc('friend_action',{target_handle:handle,action});document.dispatchEvent(new CustomEvent('friends-changed',{detail:{handle,relationship:state.relationship}}))}
    catch(error){feedback.textContent='Could not update: '+error.message;state.busy=false;for(const b of host.querySelectorAll('button'))b.disabled=false;return}
    state.busy=false;await draw();
   };host.append(button);
  }
  host.append(feedback);
 }
 state.draw=draw;await draw();
}
document.addEventListener('friends-changed',event=>{for(const state of mounts){if(!state.host.isConnected){mounts.delete(state);continue}if(state.handle===event.detail.handle&&!state.busy){state.relationship=event.detail.relationship;state.draw()}}});
export function mountRequestsPanel(host){
 const epoch=(Number(host.dataset.requestEpoch)||0)+1;host.dataset.requestEpoch=String(epoch);
 const alive=()=>Number(host.dataset.requestEpoch)===epoch;
 host.classList.add('friends-panel');
 const heading=node('div');heading.className='friends-heading';heading.append(node('h2','Requests'));
 const refresh=node('button','Refresh');refresh.type='button';heading.append(refresh);
 const intro=node('p','Accept or decline incoming requests, or cancel a request you sent.');
 const find=node('a','Find players');find.href='./find-players.html';intro.append(document.createTextNode(' '),find);
 const status=node('p');status.setAttribute('role','status');
 const lists=node('div');host.append(heading,intro,status,lists);
 let generation=0;
 async function load(){if(!alive())return;const current=++generation;refresh.disabled=true;status.textContent='Loading friends…';
  try{const connections=await rpc('list_friend_connections');if(current!==generation||!alive())return;lists.replaceChildren();
   for(const [type,title,empty]of [['incoming','Incoming requests','No incoming requests.'],['outgoing','Sent requests','No sent requests.']]){
    const section=node('section');const rows=(connections||[]).filter(c=>c.relationship===type);section.append(node('h3',title+' ('+rows.length+')'));
    if(!rows.length)section.append(node('p',empty));lists.append(section);
    for(const connection of rows){const row=node('div');row.className='friend-row';const link=node('a',connection.display_name?connection.display_name+' · @'+connection.handle:'@'+connection.handle);link.href='./player.html?user='+encodeURIComponent(connection.handle);const actions=node('div');row.append(link,actions);section.append(row);mountFriendAction(actions,connection.handle,connection.relationship)}

   }status.textContent='';
  }catch(error){status.textContent='Could not load friends: '+error.message}finally{if(current===generation)refresh.disabled=false}
 }
 refresh.onclick=load;document.addEventListener('friends-changed',()=>{if(host.isConnected&&!host.closest('[hidden]'))load()});
 window.addEventListener('focus',()=>{if(host.isConnected&&!host.closest('[hidden]'))load()});
 load();return load;
}
