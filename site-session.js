import './personal-invites.js?v=1';
import {createPlayerOnboarding} from './player-onboarding.js?v=confirmation-3';
import {setFriendNotificationUser} from './friend-notifications.js?v=invite-3';
import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const onboarding=createPlayerOnboarding(sb);
let guest=true,currentUser=null;
function update(user){
 currentUser=user;onboarding.update(user);guest=!user;setFriendNotificationUser(user);document.body.classList.toggle('guest-preview',guest);
 for(const nav of document.querySelectorAll('#siteNavigation,#siteFooter nav'))for(const link of nav.querySelectorAll('a')){
  const path=new URL(link.href,location.href).pathname.split('/').pop();
  if(path==='find-players.html'||path==='friends.html')link.hidden=guest;
  if(path==='profile.html'||link.dataset.profileLink){link.dataset.profileLink='true';link.textContent=guest?'Sign in/Create Account':'My Profile';link.href=guest?'./sign-in.html':'./profile.html'}
 }
 let intro=document.getElementById('guestIntroduction');
 const header=document.getElementById('mainHeader')||document.querySelector('.archive-header');
 if(guest&&header&&!intro){
  const home=header.id==='mainHeader';intro=document.createElement('section');intro.id='guestIntroduction';intro.innerHTML=`<h2>${home?'Your Commander games':'Example Ledger'}</h2><p>${home?'Record games, track decks, and compare results with friends.':'Explore fictional games, deck stats, and rivalries.'}</p><div class="guest-intro-actions"><a class="guest-signup" href="./sign-in.html">Create your account</a><a class="guest-explore" href="${home?'#profiles':'#statisticsSection'}">${home?'View examples':'Explore example stats'}</a>${home?'':'<a class="guest-explore" href="#gameHistorySection">Game history</a>'}</div><details class="guest-how-to"><summary>How it works</summary><p>Create an account, add a deck, then record a game. Commander names are required; opponent names are optional. Your Ledger updates as you play, and you choose which stats to share on your profile.</p><p>The examples below use fictional decks, players, and results.</p></details>`;header.after(intro)
 }
 if(intro)intro.hidden=!guest;
 for(const id of ['profiles','recentGamesSection','gameHistorySection']){
  const host=document.getElementById(id);if(!host)continue;
  let label=host.querySelector('.guest-label');if(guest&&!label){label=document.createElement('p');label.className='guest-label';label.textContent='EXAMPLE DATA · FICTIONAL GAMES AND DECKS';host.prepend(label)}if(label)label.hidden=!guest;
 }
}
document.addEventListener('click',event=>{
 if(!guest)return;
 const target=event.target.closest('#newDeckButton,#quickRecordGame,.ledger-toolbar a,#openGameForm,.compact-game-edit,a[href*="deck.html?id=demo"]');
 if(target){event.preventDefault();event.stopImmediatePropagation();location.href='./sign-in.html'}
},true);
sb.auth.onAuthStateChange((_event,session)=>update(session?.user));
sb.auth.getUser().then(({data:{user}})=>update(user)).catch(()=>update(null));

document.addEventListener('footer-ready',()=>update(currentUser));
