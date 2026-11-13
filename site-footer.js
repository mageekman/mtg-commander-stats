/* Shared footer: add future links and sections here for every page. */
if(!document.getElementById('siteFooter')){
 const footer=document.createElement('footer');
 footer.id='siteFooter';
 footer.innerHTML=`<a class="footer-brand" href="./index.html" aria-label="Command Ledger home"><img src="./cl-logo-final-transparent.webp?v=delivery-1" alt="Command Ledger" width="988" height="1072" loading="lazy" decoding="async"></a>
 <nav class="footer-links" aria-label="Footer navigation">
 <a href="https://github.com/mageekman/mtg-commander-stats/issues/new" target="_blank" rel="noopener noreferrer">Provide Feedback</a>
 <a href="#roadmap" id="openSiteRoadmap" aria-haspopup="dialog">Roadmap</a>
 <a href="#changelog" id="openSiteChangelog" aria-haspopup="dialog">Changelog</a>
 <a href="./index.html">My Decks</a><a href="./ledger.html">My Ledger</a><a href="./friends.html" hidden>Friends</a><a href="./sign-in.html" data-profile-link="true">Sign in/Create Account</a><a href="./edit-identity.html">Account Settings</a>
 </nav>`;
 footer.querySelector('#openSiteChangelog').addEventListener('click',async event=>{
  event.preventDefault();const link=event.currentTarget;if(link.getAttribute('aria-busy')==='true')return;link.setAttribute('aria-busy','true');
  try{const {openChangelog}=await import('./site-changelog.js?v=1');footer.querySelector('.changelog-error')?.remove();openChangelog()}
  catch{let status=footer.querySelector('.changelog-error');if(!status){status=document.createElement('p');status.className='changelog-error';status.setAttribute('role','status');footer.append(status)}status.textContent='The changelog could not be loaded. Please try again.'}
  finally{link.removeAttribute('aria-busy')}
 });
 footer.querySelector('#openSiteRoadmap').addEventListener('click',async event=>{
  event.preventDefault();const link=event.currentTarget;if(link.getAttribute('aria-busy')==='true')return;link.setAttribute('aria-busy','true');
  try{const {openRoadmap}=await import('./site-roadmap.js?v=1');footer.querySelector('.roadmap-error')?.remove();openRoadmap()}
  catch{let status=footer.querySelector('.roadmap-error');if(!status){status=document.createElement('p');status.className='roadmap-error changelog-error';status.setAttribute('role','status');footer.append(status)}status.textContent='The roadmap could not be loaded. Please try again.'}
  finally{link.removeAttribute('aria-busy')}
 });
 document.body.append(footer);document.dispatchEvent(new Event('footer-ready'));
}
