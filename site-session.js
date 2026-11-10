import {setFriendNotificationUser} from './friend-notifications.js?v=1';
import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
let guest=true,currentUser=null;
function update(user){
 currentUser=user;guest=!user;setFriendNotificationUser(user);document.body.classList.toggle('guest-preview',guest);
 for(const nav of document.querySelectorAll('#siteNavigation,#siteFooter nav'))for(const link of nav.querySelectorAll('a')){
  const path=new URL(link.href,location.href).pathname.split('/').pop();
  if(path==='find-players.html'||path==='friends.html')link.hidden=guest;
  if(path==='profile.html'||link.dataset.profileLink){link.dataset.profileLink='true';link.textContent=guest?'Sign in/Create Account':'My Profile';link.href=guest?'./sign-in.html':'./profile.html'}
 }
 let intro=document.getElementById('guestIntroduction');
 const header=document.getElementById('mainHeader')||document.querySelector('.archive-header');
 if(guest&&header&&!intro){intro=document.createElement('section');intro.id='guestIntroduction';intro.innerHTML=`<h2>Your Commander story starts here.</h2><p>Command Ledger helps you organize your Commander decks, record games, and discover your play patterns. Track wins, favorite decks, rival players, and the commanders you face.</p><p>Start by creating an account and adding a deck with its name and commander. Add a decklist if you like. After each match, record the players, commanders, and winner in My Ledger. Your statistics update as you play, and you choose what to share on your profile.</p><p>The decks, players, and games below are fictional examples. Try the search, sorting, and view controls to explore the site. Create an account to start your own collection.</p><a class="guest-signup" href="./sign-in.html">Sign in/Create Account</a>`;header.after(intro)}
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
