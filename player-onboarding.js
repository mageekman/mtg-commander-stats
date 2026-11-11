// UI preferences only; these metadata fields never grant access to user data.
export const newPlayerMetadata={onboarding_version:1,onboarding_profile_complete:false,onboarding_dismissed:false};
export const needsOnboarding=user=>user?.user_metadata?.onboarding_version===1&&!user.user_metadata.onboarding_dismissed;
export async function completeOnboardingProfile(client,user){
 if(!needsOnboarding(user))return;
 try{await client.auth.updateUser({data:{onboarding_profile_complete:true}})}catch{/* Profile saving succeeds independently of the welcome checklist. */}
}
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const read=(store,key)=>{try{return store.getItem(key)}catch{return null}};
const write=(store,key,value)=>{try{store.setItem(key,value)}catch{/* Preferences also live in the signed-in account. */}};
export function createPlayerOnboarding(client){
 let current=null,signature='',epoch=0,banner=null,dialog=null,busy=false,ready=null,internalNavigation=false;
 const key=(kind,id)=>'command-ledger:onboarding:'+kind+':'+id;
 const page=()=>location.pathname.split('/').pop();
 const excluded=()=>['sign-in.html','account-created.html','reset-password.html','account-settings.html'].includes(page());
 const clean=()=>{banner?.remove();banner=null;if(dialog?.open)dialog.close();dialog?.remove();dialog=null};
 function checklist(host,state){
  const list=node('ol');list.className='onboarding-steps';
  for(const [title,detail,href,done]of [
   ['Add your first deck','Choose the deck and commander you play.','./import.html',state.deck],
   ['Record your first game','Pick a deck, add opponents and commanders, and record the result.',state.deck?'./ledger.html#gameForm':'./import.html',state.game]
  ]){const item=node('li');item.className=done?'complete':'';const copy=node('div'),link=node('a',title);link.href=href;copy.append(link,node('small',done?'Complete':detail));item.append(node('span',done?'✓':String(list.children.length+1)),copy);list.append(item)}
  host.append(list);
 }
 function showPrompt(){
  if(!ready||busy||!needsOnboarding(current)||excluded()||page()==='edit-identity.html'||read(localStorage,key('dismissed',current.id))==='true'||read(sessionStorage,key('visit',current.id))==='shown')return;
  if(document.querySelector('dialog[open]'))return; // Never interrupt another editor.
  const actor=current.id,d=node('dialog');dialog=d;d.className='onboarding-dialog';d.setAttribute('aria-labelledby','onboardingDialogTitle');
  const heading=node('h2',read(localStorage,key('welcomed',actor))?'Finish setting up your Ledger':'Welcome to Command Ledger');heading.id='onboardingDialogTitle';
  d.append(heading,node('p','Add your first deck, then log your first Commander game.'));
  checklist(d,ready);
  const status=node('p');status.className='onboarding-status';status.setAttribute('role','status');
  const actions=node('div');actions.className='onboarding-actions';
  const settings=node('button',ready.deck?'Record your first game':'Add your first deck'),dismiss=node('button',"Thanks but don't remind me again");settings.type=dismiss.type='button';dismiss.className='onboarding-dismiss';
  settings.onclick=()=>{internalNavigation=true;location.href=ready.deck?'./ledger.html#gameForm':'./import.html'};
  dismiss.onclick=async()=>{
   if(busy)return;busy=true;settings.disabled=dismiss.disabled=true;status.textContent='Saving your preference…';
   try{const {error}=await client.auth.updateUser({data:{onboarding_dismissed:true}});if(error)throw error;if(current?.id!==actor)return;write(localStorage,key('dismissed',actor),'true');clean()}
   catch{status.textContent='Your preference could not be saved. Please try again.'}
   finally{busy=false;settings.disabled=dismiss.disabled=false}
  };
  d.addEventListener('cancel',event=>{if(busy)event.preventDefault()});
  d.addEventListener('close',()=>{if(dialog===d)dialog=null;d.remove()},{once:true});
  actions.append(settings,dismiss);d.append(status,actions);document.body.append(d);d.showModal();
  write(sessionStorage,key('visit',actor),'shown');write(localStorage,key('welcomed',actor),'true');
 }
 async function update(user,force=false){
  const sig=JSON.stringify([user?.id,user?.user_metadata?.onboarding_version,user?.user_metadata?.onboarding_profile_complete,user?.user_metadata?.onboarding_dismissed]);
  if(!force&&sig===signature)return;signature=sig;current=user;const token=++epoch;clean();ready=null;
  if(!needsOnboarding(user)||excluded()||read(localStorage,key('dismissed',user.id))==='true')return;
  if(read(sessionStorage,key('left',user.id))==='true'){write(sessionStorage,key('visit',user.id),'');write(sessionStorage,key('left',user.id),'')}
  try{
   const [decks,games]=await Promise.all(['decks','personal_games'].map(table=>client.from(table).select('id').eq('owner_id',user.id).limit(1)));
   if(token!==epoch||decks.error||games.error)return;
   ready={profile:!!user.user_metadata.onboarding_profile_complete,deck:!!decks.data?.length,game:!!games.data?.length};
   if(ready.deck&&ready.game){ready=null;return}
   if(!document.querySelector('link[data-onboarding-style]')){const css=node('link');css.rel='stylesheet';css.href=new URL('./player-onboarding.css?v=1',import.meta.url).href;css.dataset.onboardingStyle='';document.head.append(css)}
   banner=node('aside');banner.id='playerOnboarding';banner.setAttribute('aria-labelledby','onboardingChecklistTitle');
   const title=node('h2','Your first steps');title.id='onboardingChecklistTitle';banner.append(title);checklist(banner,ready);
   const header=document.getElementById('mainHeader')||document.querySelector('main>header,.archive-header,main>.hero');
   if(header)header.after(banner);else (document.querySelector('main')||document.body).append(banner);
   showPrompt();
  }catch{/* A checklist outage must never block the rest of the site. */}
 }
 // A normal internal page change is still the same visit. A new direct/external
 // arrival or restored page gets a fresh reminder, unless permanently dismissed.
 try{if(document.referrer&&new URL(document.referrer).origin===location.origin){}else for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith('command-ledger:onboarding:visit:'))sessionStorage.removeItem(k)}}catch{}
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&!link.target){try{internalNavigation=new URL(link.href).origin===location.origin}catch{}}},true);
 window.addEventListener('pagehide',()=>{if(current&&!internalNavigation)write(sessionStorage,key('left',current.id),'true')});
 window.addEventListener('pageshow',event=>{if(event.persisted&&current&&read(sessionStorage,key('left',current.id))==='true'){write(sessionStorage,key('visit',current.id),'');write(sessionStorage,key('left',current.id),'');showPrompt()}internalNavigation=false});
 window.addEventListener('storage',event=>{if(current&&event.key===key('dismissed',current.id)&&event.newValue==='true')clean()});
 document.addEventListener('onboarding-progress',()=>update(current,true));
 document.addEventListener('onboarding-internal-navigation',()=>internalNavigation=true);
 document.addEventListener('close',()=>queueMicrotask(showPrompt),true);
 return {update};
}
