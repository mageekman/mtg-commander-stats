import {mountPlaygroupGames} from './playgroup-games.js?v=1';
import {clearPlaygroupInvite} from './playgroup-invite-link.js?v=group-invites-1';
import {mountFriendAction} from './friends.js?v=playgroup-popup-1';
import {createPlayerPassportCards} from './player-passport-card.js?v=popup-2';
import {createClient} from './vendor/supabase-js.mjs';
import {readPageUser,showAuthPrompt} from './auth-page-state.js?v=playgroups-1';
const client=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const passportCard=createPlayerPassportCards(client);
const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
let user=null,detail=null,busy=false,loadVersion=0,friendOptions=[],inviteLink=null;
const params=new URLSearchParams(location.search);let token=params.get('invite')?.toLowerCase(),selected=params.get('group');
function button(label,click,danger=false){const b=node('button',label);b.type='button';if(danger)b.className='pg-danger';b.onclick=click;return b}
function actions(...children){const e=node('div');e.className='pg-actions';e.append(...children);return e}
function paragraph(text,className=''){const e=node('p',text);e.className=className;return e}
async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw error;return data}
function message(text){$('playgroupsStatus').textContent=text}
function groupLink(group){const a=node('a');a.className='pg-group-card';a.href='./playgroups.html?group='+encodeURIComponent(group.id);a.append(node('strong',group.name),node('small',group.member_count+' member'+(group.member_count===1?'':'s')+' · '+group.role));if(group.id===selected)a.setAttribute('aria-current','true');a.onclick=e=>{e.preventDefault();selected=group.id;history.replaceState(null,'','./playgroups.html?group='+encodeURIComponent(selected));refresh()};return a}
function playerCopy(person,{passport=false}={}){const copy=node('div');copy.className='pg-player-copy';if(person.handle&&passport){copy.append(passportCard(person))}else if(person.handle){const link=node('a',person.display_name||person.handle);link.href='./player.html?user='+encodeURIComponent(person.handle);copy.append(link,node('small','@'+person.handle))}else if(passport){const card=node('div');card.className='player-passport-card';const text=node('span');text.className='player-passport-copy';text.append(node('strong',person.display_name||'Player'));card.append(text);copy.append(card)}else copy.append(node('strong',person.display_name||'Player'));return copy}
async function mutate(action,args={},after){if(busy||!user)return;const actor=user.id;busy=true;message('Saving…');for(const b of document.querySelectorAll('#playgroupsApp button'))b.disabled=true;try{const result=await rpc('playgroup_action',{action,...args});if(user?.id!==actor)return;const notice=after?await after(result):null;if(user?.id!==actor||notice===false)return;document.dispatchEvent(new Event('playgroup-invitations-changed'));const loaded=await refresh();if(loaded)message(typeof notice==='string'?notice:'Saved.')}catch(error){message(error.message||'This change could not be saved. Please try again.')}finally{busy=false;for(const b of document.querySelectorAll('#playgroupsApp button'))b.disabled=false}}
function confirmAction(title,text,label,act){const d=node('dialog');d.className='pg-dialog';d.setAttribute('aria-labelledby','pgConfirmTitle');const h=node('h2',title);h.id='pgConfirmTitle';const confirm=button(label,()=>{d.close();act()},true);d.append(h,paragraph(text),actions(button('Cancel',()=>d.close()),confirm));d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();d.querySelector('button').focus();return d}
function editGroup(group=null){const actor=user?.id;const d=node('dialog');d.className='pg-dialog';d.setAttribute('aria-labelledby','pgEditTitle');const h=node('h2',group?'Edit playgroup':'Create playgroup');h.id='pgEditTitle';const f=node('form'),nameLabel=node('label','Name'),name=node('input');name.name='groupName';name.required=true;name.maxLength=80;name.value=group?.name||'';nameLabel.append(name);const descLabel=node('label','Description (optional)'),desc=node('textarea');desc.name='description';desc.maxLength=500;desc.value=group?.description||'';descLabel.append(desc);const status=paragraph('');status.setAttribute('role','status');const save=node('button',group?'Save changes':'Create playgroup');save.type='submit';const cancel=button('Cancel',()=>d.close());f.append(nameLabel,descLabel,paragraph('Members and invited players can see the group roster. Joining requires acceptance. Your Ledger games and private stats stay private.','pg-muted'),status,actions(cancel,save));d.append(h,f);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});let saving=false;d.addEventListener('cancel',e=>{if(saving)e.preventDefault()});f.onsubmit=async event=>{event.preventDefault();if(saving)return;saving=true;save.disabled=cancel.disabled=true;status.textContent='Saving…';try{const result=await rpc('playgroup_action',{action:group?'edit':'create',...(group?{target_group:group.id}:{}),group_name:name.value.trim(),group_description:desc.value.trim()});if(user?.id!==actor)return;selected=result.id;history.replaceState(null,'','./playgroups.html?group='+encodeURIComponent(selected));d.close();await refresh()}catch(error){status.textContent=error.message||'Could not save. Please try again.'}finally{saving=false;save.disabled=cancel.disabled=false}};d.showModal();name.focus()}
function renderInvitations(rows){const host=$('playgroupInvitations');host.replaceChildren();host.hidden=!rows.length;if(!rows.length)return;host.append(node('h2','Playgroup invitations'));for(const group of rows){const row=node('div');row.className='pg-invitation';const copy=node('div');copy.append(node('h3',group.name),paragraph(group.invited_by+' invited you to join.','pg-muted'));const view=node('a','View Playgroup');view.className='pg-button';view.href='./playgroups.html?group='+encodeURIComponent(group.id);row.append(copy,actions(view,button('Accept',()=>mutate('accept',{target_group:group.id},result=>{selected=result.id;history.replaceState(null,'','./playgroups.html?group='+encodeURIComponent(selected))})),button('Decline',()=>mutate('decline',{target_group:group.id}))));host.append(row)}}
function renderDetail(group){const host=$('playgroupDetail');host.replaceChildren();host.hidden=!group;detail=group;if(!group)return;const manager=['owner','admin'].includes(group.role),owner=group.role==='owner';const heading=node('div');heading.className='pg-heading';heading.append(node('h2',group.name));host.append(heading);if(group.description)host.append(paragraph(group.description,'pg-description'));host.append(paragraph('Private playgroup · '+group.members.length+' members','pg-muted'));
 if(manager)host.append(actions(button('Edit details',()=>editGroup(group))));host.append(node('h3','Members'));const roster=node('div');roster.className='pg-roster';host.append(roster);
 for(const member of group.members){
  const row=node('div');row.className='pg-member';const copy=playerCopy(member,{passport:true});const card=copy.querySelector('.player-passport-card');addMemberRole(card,member,'pg-member-role-');
  if(card){card.setAttribute('aria-haspopup','dialog');card.onclick=event=>{event.preventDefault();openMember(member,group,card)};if(card.tagName!=='A'){card.tabIndex=0;card.setAttribute('role','button');card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.click()}}}}
  row.append(copy);roster.append(row);
 }

 if(manager){
  const management=node('div');management.className='pg-management';management.append(node('h3','Invite players'));const form=node('form');form.className='pg-inline-form';const label=node('label','Username'),input=node('input');input.name='handle';input.required=true;input.maxLength=21;input.autocomplete='off';input.placeholder='@username';input.setAttribute('list','pgFriendOptions');const options=node('datalist');options.id='pgFriendOptions';for(const friend of friendOptions){const option=node('option');option.value=friend.handle;option.label=friend.display_name||friend.handle;options.append(option)}label.append(input,options);const send=node('button','Send invitation');send.type='submit';form.append(label,send);form.onsubmit=event=>{event.preventDefault();const handle=input.value.trim().replace(/^@/,'');if(!handle){input.setCustomValidity('Enter a username.');input.reportValidity();return}input.setCustomValidity('');mutate('invite',{target_group:group.id,target_handle:handle})};input.oninput=()=>input.setCustomValidity('');management.append(form);
  for(const invited of group.invitations||[]){const row=node('div');row.className='pg-member';row.append(playerCopy(invited),button('Cancel invitation',()=>mutate('revoke',{target_group:group.id,target_user:invited.id})));management.append(row)}
  host.append(management);
 }
 if(group.role==='invited')return;
 const sharedGames=node('section');host.append(sharedGames);mountPlaygroupGames(sharedGames,client,group.id);
 const links=node('div');links.className='pg-management';links.append(node('h3','Invite link'),paragraph('Copy your invite link to share this playgroup. Links expire after 30 days.','pg-muted'));
 links.append(actions(button('Copy Invite Link',async()=>{await mutate('copy_link',{target_group:group.id},async result=>{const url=new URL('./playgroups.html',location.href);url.searchParams.set('invite',result.token);inviteLink={group:group.id,url:url.href,manual:false};try{await navigator.clipboard.writeText(url.href);return 'Invite link copied.'}catch{inviteLink.manual=true;return 'Select and copy your invite link below.'}});if(inviteLink?.manual){const input=$('playgroupManualLink');input?.focus();input?.select()}}),...(manager?[button('Reset Link',()=>confirmAction('Reset invite links?','Existing invite links for this playgroup will stop working. Pending invitations and members are kept.','Reset Link',()=>mutate('reset_link',{target_group:group.id},()=>{inviteLink=null;return 'Invite links reset. Copy your new link to share it.'})),true)]:[])));
 if(inviteLink?.group===group.id&&inviteLink.manual){const label=node('label','Invite link'),input=node('input');input.id='playgroupManualLink';input.readOnly=true;input.value=inviteLink.url;label.append(input);links.append(label)}host.append(links);

 const exit=node('div');exit.className='pg-management';if(owner)exit.append(paragraph('To leave, transfer ownership to another member first.','pg-muted'),button('Delete playgroup',()=>confirmAction('Delete playgroup?','Members and invitations will be removed. Your Ledger games and decks will not be changed.','Delete playgroup',()=>mutate('delete',{target_group:group.id},()=>{selected=null;inviteLink=null;history.replaceState(null,'','./playgroups.html')})),true));else exit.append(button('Leave playgroup',()=>confirmAction('Leave playgroup?','You will lose access to this playgroup. Your Ledger games and decks will not change.','Leave playgroup',()=>mutate('leave',{target_group:group.id},()=>{selected=null;inviteLink=null;history.replaceState(null,'','./playgroups.html')})),true));host.append(exit);
}
function renderInviteBanner(group){
 const host=$('playgroupInvitePreview');host.replaceChildren();host.hidden=group?.role!=='invited';if(host.hidden)return;
 host.classList.add('pg-invite-banner');host.setAttribute('aria-label','Playgroup invitation');const title=node('h2','You were invited to join this play group by '+(group.inviter_handle?'@'+group.inviter_handle:'a playgroup administrator'));
 host.append(title,paragraph('Review the members below, then choose whether to join. Your personal Ledger stays private.','pg-muted'),actions(button('Accept',()=>mutate(token?'accept_link':'accept',token?{invite_token:token}:{target_group:group.id},()=>{selected=group.id;token=null;clearPlaygroupInvite();history.replaceState(null,'','./playgroups.html?group='+encodeURIComponent(group.id));return 'You joined the playgroup.'})),button('Decline',()=>mutate(token?'decline_link':'decline',token?{invite_token:token}:{target_group:group.id},()=>{clearPlaygroupInvite();location.assign('./friends.html');return false}))));
}
async function refresh(){if(!user)return false;const version=++loadVersion;message('Loading playgroups…');try{
 const data=await rpc('get_playgroups');if(version!==loadVersion)return false;$('playgroupsApp').hidden=false;$('playgroupsList').replaceChildren(...(data.groups.length?data.groups.map(groupLink):[paragraph('No playgroups yet. Create one or accept an invitation to get started.','pg-empty')]));renderInvitations(data.invitations||[]);renderDetail(null);renderInviteBanner(null);$('playgroupsListPanel').hidden=false;
 if(selected||token){const group=await rpc('get_playgroups',token?{invite_token:token}:{target_group:selected});if(version!==loadVersion)return false;selected=group.id;if(group.is_member&&token){token=null;clearPlaygroupInvite();history.replaceState(null,'','./playgroups.html?group='+encodeURIComponent(group.id))}renderDetail(group);renderInviteBanner(group);$('playgroupsListPanel').hidden=group.role==='invited';$('playgroupInvitations').hidden=true}
 message('');return true;
 }catch(error){if(version===loadVersion){renderDetail(null);renderInviteBanner(null);message('Playgroups could not be loaded. '+(error.message||'Please try again.'));const retry=button('Try again',()=>refresh());$('playgroupsStatus').append(' ',retry)}return false}}
async function init(){const result=await readPageUser(client);user=result.user;if(!user){message('');if(token&&!result.error){const next='./playgroups.html?invite='+encodeURIComponent(token);location.replace('./sign-in.html?mode=signup&next='+encodeURIComponent(next));return}showAuthPrompt($('playgroupsAuth'),{message:'Sign in to create or join playgroups.',error:result.error});return}message('');$('createPlaygroup').onclick=()=>editGroup();
 if(token)try{await rpc('playgroup_action',{action:'claim_link',invite_token:token});clearPlaygroupInvite();document.dispatchEvent(new Event('playgroup-invitations-changed'))}catch{}
 const friendLoad=rpc('list_friend_connections').then(rows=>{friendOptions=(rows||[]).filter(friend=>friend.relationship==='friends');const list=$('pgFriendOptions');if(list){list.replaceChildren();for(const friend of friendOptions){const option=node('option');option.value=friend.handle;option.label=friend.display_name||friend.handle;list.append(option)}}}).catch(()=>{});await refresh();await friendLoad;
}
client.auth.onAuthStateChange((event,session)=>{if(user&&session?.user&&session.user.id!==user.id){loadVersion++;user=null;location.reload();return}if(event==='SIGNED_OUT'){loadVersion++;user=null;detail=null;inviteLink=null;for(const id of ['playgroupsList','playgroupDetail','playgroupInvitations','playgroupInvitePreview'])$(id).replaceChildren();for(const d of document.querySelectorAll('.pg-dialog')){d.close();d.remove()}$('playgroupsApp').hidden=true;showAuthPrompt($('playgroupsAuth'))}});
init();

function addMemberRole(card,member,prefix){
 if(!card)return;card.classList.add('pg-member-passport');const role=node('span',member.role.charAt(0).toUpperCase()+member.role.slice(1));role.className='pg-role';role.id=prefix+member.id;card.append(role);card.setAttribute('aria-describedby',role.id);
}
function openMember(member,group,trigger){
 if(!user||document.querySelector('.pg-dialog[open]'))return;
 const actor=user.id,d=node('dialog');d.className='pg-dialog pg-player-dialog';d.setAttribute('aria-labelledby','pgMemberTitle');
 const header=node('div');header.className='pg-heading';const title=node('h2','Player card');title.id='pgMemberTitle';const close=button('×',()=>d.close());close.setAttribute('aria-label','Close player card');header.append(title,close);d.append(header);
 const card=member.handle?passportCard(member,{interactive:false}):playerCopy(member,{passport:true}).firstElementChild;addMemberRole(card,member,'pg-popup-role-');d.append(card);
 const toolbar=actions();if(member.handle){const profile=node('a','View Profile');profile.className='pg-button';profile.href='./player.html?user='+encodeURIComponent(member.handle);toolbar.append(profile)}d.append(toolbar);
 let disposeFriends=null;
 if(member.handle&&member.id!==actor){const friends=actions();friends.classList.add('pg-player-friends');toolbar.append(friends);Promise.resolve().then(()=>d.isConnected?mountFriendAction(friends,member.handle,null,{allowRemove:true,addLabel:'Add Friend',removeLabel:'Remove Friend'}):null).then(dispose=>{if(!d.isConnected)dispose?.();else disposeFriends=dispose}).catch(()=>{});}
 const owner=group.role==='owner',manager=owner||group.role==='admin';
 if(member.id!==actor&&member.role!=='owner'&&manager){
  const options=button('Options',()=>openMemberOptions(member,group,d,options));d.append(options);options.classList.add('pg-player-options-trigger');
 }

 d.addEventListener('close',()=>{disposeFriends?.();d.remove();if(trigger.isConnected)trigger.focus()},{once:true});document.body.append(d);d.showModal();close.focus();
}

function closePlaygroupPopups(){
 // Close the topmost dialog first so native modal focus/inert state is unwound.
 for(const dialog of [...document.querySelectorAll('.pg-dialog[open]')].reverse())dialog.close();
}
function openMemberOptions(member,group,parent,trigger){
 if(!user||!parent.open||document.querySelector('.pg-player-options-dialog[open]'))return;
 const actor=user.id,d=node('dialog');d.className='pg-dialog pg-player-options-dialog';d.setAttribute('aria-labelledby','pgMemberOptionsTitle');
 const header=node('div');header.className='pg-heading';const title=node('h2','Player options');title.id='pgMemberOptionsTitle';const close=button('×',()=>d.close());close.setAttribute('aria-label','Close player options');header.append(title,close);d.append(header,paragraph('Options for '+(member.display_name||member.handle||'this player'),'pg-muted'));
 const choices=actions();let confirmation=null;
 const ask=(text,label,action)=>{
  if(confirmation?.open||user?.id!==actor)return;
  confirmation=confirmAction('Are you sure?',text,label,()=>{if(user?.id!==actor)return;closePlaygroupPopups();mutate(action,{target_group:group.id,target_user:member.id})});
  confirmation.classList.add('pg-stacked-confirm');
 };
 if(group.role==='owner'){
  if(member.role==='admin')choices.append(button('Remove admin role',()=>ask('This player will become a regular member and will no longer be able to manage the playgroup.','Confirm','demote')));
  else choices.append(button('Make admin',()=>ask('This player will be able to edit details, invite players, and remove ordinary members.','Confirm','promote')));
  choices.append(button('Transfer ownership',()=>ask('You will become an admin. '+(member.display_name||member.handle)+' will become the owner of this playgroup.','Transfer ownership','transfer')));
 }
 if(group.role==='owner'||(group.role==='admin'&&member.role==='member'))choices.append(button('Remove from Playgroup',()=>ask('This player will lose access to the playgroup. Their Ledger games, decks, and friend connections will not change.','Remove from Playgroup','remove'),true));
 d.append(choices);const closeWithParent=()=>{if(d.open)d.close()};parent.addEventListener('close',closeWithParent);
 d.addEventListener('close',()=>{if(confirmation?.open)confirmation.close();parent.removeEventListener('close',closeWithParent);d.remove();if(parent.open&&trigger.isConnected)trigger.focus()},{once:true});
 document.body.append(d);d.showModal();close.focus();
}
