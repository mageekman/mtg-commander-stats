/* Shared footer: add future links and sections here for every page. */
if(!document.getElementById('siteFooter')){
 const footer=document.createElement('footer');
 footer.id='siteFooter';
 footer.innerHTML=`<a class="footer-brand" href="./index.html" aria-label="Command Ledger home"><img src="./cl-logo-final-transparent.png?v=final-1" alt="Command Ledger" width="988" height="1072" loading="lazy" decoding="async"></a>
 <nav class="footer-links" aria-label="Footer navigation">
 <a href="https://github.com/mageekman/mtg-commander-stats/issues/new" target="_blank" rel="noopener noreferrer">Provide Feedback</a>
 <a href="./index.html">My Decks</a><a href="./ledger.html">My Ledger</a><a href="./friends.html" hidden>Friends</a><a href="./sign-in.html" data-profile-link="true">Sign in/Create Account</a><a href="./edit-identity.html">Account Settings</a>
 </nav>`;
 document.body.append(footer);document.dispatchEvent(new Event('footer-ready'));
}
