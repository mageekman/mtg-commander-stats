import {pendingLedgerUpdates} from './ledger-stat-updates.js?v=nav-notices-1';
const noticeKey='command-ledger:site-info-intro:dismissed:';
const read=key=>{try{return localStorage.getItem(key)==='true'}catch{return false}};
export function createSiteAnnouncements(client){
 let user=null,initialized=false,epoch=0,unread=0,dialog=null,saving=false,lastRefresh=0,inflight=false,revision=0;
 const key=()=>noticeKey+(user?.id||'guest');
 function paint(){
  for(const link of document.querySelectorAll('#siteNavigation a[href="./ledger.html"]')){
   link.querySelector('.ledger-notification-badge')?.remove();link.removeAttribute('aria-label');
   if(!user||!unread)continue;
   const badge=document.createElement('span');badge.className='friend-notification-badge ledger-notification-badge';badge.setAttribute('aria-hidden','true');badge.textContent='● '+(unread>99?'99+':unread);badge.title=unread+' unread Ledger update'+(unread===1?'':'s');link.append(badge);link.setAttribute('aria-label','My Ledger, '+unread+' unread update'+(unread===1?'':'s'));
  }
 }
 function removeIntro(){if(dialog){const old=dialog;dialog=null;old.close();old.remove()}}
 function seen(){return user?.user_metadata?.site_info_intro_dismissed===true||read(key())}
 async function dismiss(){
  if(saving||!dialog)return;const token=epoch,actor=user,current=dialog;saving=true;const buttons=[...current.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);const status=current.querySelector('[role=status]');status.textContent='';
  try{
   if(actor){const {error}=await client.auth.updateUser({data:{site_info_intro_dismissed:true}});if(error)throw error}
   if(token!==epoch)return;
   // This cache complements the account preference and synchronizes open tabs.
   try{localStorage.setItem(key(),'true')}catch(error){if(!actor)throw error}if(user)user={...user,user_metadata:{...user.user_metadata,site_info_intro_dismissed:true}};removeIntro();
  }catch{if(token===epoch)status.textContent='Your preference could not be saved. Please try again.'}
  finally{if(token===epoch)saving=false;buttons.forEach(b=>b.disabled=false)}
 }
 function showIntro(){
  if(!initialized||seen()||dialog||document.visibilityState!=='visible'||document.querySelector('dialog[open]')||!document.getElementById('siteFooter'))return;
  // Leave account confirmation and recovery flows focused on their primary task.
  if(['sign-in.html','account-created.html','reset-password.html'].includes(location.pathname.split('/').pop()))return;
  dialog=document.createElement('dialog');dialog.id='siteInfoIntro';dialog.setAttribute('aria-labelledby','siteInfoIntroTitle');
  dialog.innerHTML='<header><h2 id="siteInfoIntroTitle">New in the footer</h2><button type="button" class="changelog-close" aria-label="Dismiss introduction">×</button></header><div class="changelog-body"><p><strong>Changelog</strong><br>Catch up on new features, fixes, and improvements.</p><p><strong>Roadmap</strong><br>See what’s ahead for Playgroups, Store Accounts, and Events.</p><p>You can open both from the footer on any page.</p><p role="status"></p><button type="button" class="site-intro-dismiss">Got it</button></div>';
  dialog.querySelector('.changelog-close').onclick=dismiss;dialog.querySelector('.site-intro-dismiss').onclick=dismiss;
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss()});document.body.append(dialog);dialog.showModal();dialog.querySelector('.site-intro-dismiss').focus();
 }
 async function refresh(force=false){
  if(!user||inflight||(!force&&Date.now()-lastRefresh<30000))return;const token=epoch,id=user.id,version=revision;inflight=true;lastRefresh=Date.now();
  try{const {data,error}=await client.from('profiles').select('ledger_stat_updates').eq('id',id).maybeSingle();if(!error&&token===epoch&&version===revision){unread=pendingLedgerUpdates(data?.ledger_stat_updates).length;paint()}}catch{}finally{if(token===epoch)inflight=false}
 }
 function update(next){
  const changed=!initialized||user?.id!==next?.id;initialized=true;user=next||null;
  if(changed){epoch++;inflight=false;lastRefresh=0;unread=0;saving=false;removeIntro();refresh(true)}
  if(seen())removeIntro();paint();showIntro();
 }
 document.addEventListener('ledger-notifications-updated',event=>{if(user?.id!==event.detail?.ownerId)return;revision++;unread=pendingLedgerUpdates(event.detail.ids).length;paint();try{localStorage.setItem('command-ledger:ledger-notices-changed',JSON.stringify({ownerId:user.id,at:Date.now()}))}catch{}});
 document.addEventListener('footer-ready',()=>{paint();showIntro()});
 document.addEventListener('close',()=>queueMicrotask(showIntro),true);
 window.addEventListener('storage',event=>{if(event.key===key()&&event.newValue==='true')removeIntro();if(event.key==='command-ledger:ledger-notices-changed')refresh(true)});
 window.addEventListener('focus',()=>{refresh();showIntro()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refresh();showIntro()}});
 setInterval(()=>{if(document.visibilityState==='visible')refresh()},45000);
 return {update};
}
