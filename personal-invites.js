const storageKey='command-ledger:signup-invite',lifetime=30*24*60*60*1000;
const valid=code=>typeof code==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
let captured=null;
export function captureSignupInvite(){
 const code=new URLSearchParams(location.search).get('invite');
 if(valid(code)){captured={code:code.toLowerCase(),expires:Date.now()+lifetime};try{localStorage.setItem(storageKey,JSON.stringify(captured))}catch{}}
}
export function signupInviteCode(){
 if(!captured)try{captured=JSON.parse(localStorage.getItem(storageKey))}catch{}
 if(captured&&valid(captured.code)&&captured.expires>Date.now())return captured.code;
 clearSignupInvite();return null;
}
export function clearSignupInvite(){captured=null;try{localStorage.removeItem(storageKey)}catch{}}
export async function personalInviteUrl(client){
 const {data,error}=await client.rpc('get_my_invite_code');if(error)throw error;
 if(!valid(data))throw Error('Your personal invite link could not be created. Please try again.');
 const url=new URL('./sign-in.html',location.href);url.searchParams.set('mode','signup');url.searchParams.set('invite',data);return url.href;
}
captureSignupInvite();
export function setupInviteButtons(client,{copy,share=null,status,fallback=null,input=null}){
 if(!copy||!status)return;
 status.style.overflowWrap='anywhere';
 const manual=url=>{if(input&&fallback){input.value=url;fallback.hidden=false;input.focus();input.select();status.textContent='Copy your personal invite link below.'}else status.textContent='Copy your personal invite link: '+url};
 const run=async sharing=>{
  if(copy.disabled)return;copy.disabled=true;if(share)share.disabled=true;if(fallback)fallback.hidden=true;status.textContent='Creating your invite link…';
  try{
   const url=await personalInviteUrl(client);
   if(sharing&&navigator.share){try{await navigator.share({title:'Join me on Command Ledger',text:'Join Command Ledger and connect with me as a friend.',url});status.textContent='Your personal invite link is ready to share.'}catch(error){if(error.name==='AbortError')status.textContent='Sharing cancelled. You can still copy your invite link.';else manual(url)}}
   else try{await navigator.clipboard.writeText(url);status.textContent='Personal invite link copied. You’ll become friends when they confirm their account.'}catch{manual(url)}
  }catch(error){status.textContent='Could not create your invite link: '+error.message}
  finally{copy.disabled=false;if(share)share.disabled=false}
 };
 copy.onclick=()=>run(false);if(share)share.onclick=()=>run(true);
}
