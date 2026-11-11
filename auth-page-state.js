// These helpers only present auth state; access control stays with Auth and RLS.
const returnPages=new Set(['index.html','ledger.html','friends.html','friend-requests.html','find-players.html','profile.html','edit-identity.html','account-settings.html','player.html','deck.html','import.html','csv-import.html','share-my-ledger.html']);
export function safeReturnPath(value,baseHref){
 try{if(!value)return './profile.html';const base=new URL('./',baseHref),target=new URL(value,base);const filename=target.pathname.slice(base.pathname.length);if(target.origin!==base.origin||target.username||target.password||!target.pathname.startsWith(base.pathname)||!returnPages.has(filename))return './profile.html';return './'+filename+target.search+target.hash}catch{return './profile.html'}
}
export function signInHref(returnTo=location.href){return './sign-in.html?next='+encodeURIComponent(safeReturnPath(returnTo,location.href))}
export function missingSession(error){return !!error&&(error.name==='AuthSessionMissingError'||['session_not_found','session_expired','refresh_token_not_found','refresh_token_already_used','bad_jwt'].includes(error.code)||/^auth session missing!?$/i.test(error.message||''))}
export async function readPageUser(client){
 try{const {data,error}=await client.auth.getUser();return {user:error?null:data?.user||null,error:missingSession(error)?null:error||null}}catch(error){return {user:null,error:missingSession(error)?null:error}}
}
export function showAuthPrompt(host,{message='Sign in to continue.',error=null,onRetry=()=>location.reload(),returnTo=location.href}={}){
 if(!host)return;let prompt=host.querySelector(':scope>.auth-page-prompt');if(!prompt){for(const child of host.children)child.hidden=true;prompt=document.createElement('div');prompt.className='auth-page-prompt';host.prepend(prompt)}
 // Clear pre-existing plain-text status messages without removing legacy form nodes.
 for(const child of [...host.childNodes])if(child.nodeType===3)child.remove();
 prompt.replaceChildren();const title=document.createElement('h2');title.textContent=error?"We couldn't check your account":'Sign in to continue';const text=document.createElement('p');text.textContent=error?'Please try again. Your account could not be verified.':message;const actions=document.createElement('div');actions.className='auth-page-prompt-actions';
 if(error){const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.onclick=onRetry;actions.append(retry)}const link=document.createElement('a');link.href=signInHref(returnTo);link.textContent='Sign in/Create Account';actions.append(link);prompt.append(title,text,actions);host.hidden=false;
 if(!document.querySelector('link[data-auth-state-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./auth-page-state.css?v=1',import.meta.url).href;css.dataset.authStateStyle='';document.head.append(css)}
}
