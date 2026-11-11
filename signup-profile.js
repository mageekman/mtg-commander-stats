// Signup identity is saved by the Auth signup trigger, including email-confirmation flows.
export function setupSignupProfile(client,{returnTo}){
 const form=document.getElementById('signup'),status=document.getElementById('status');
 const username=form.elements.username,commander=form.elements.favorite_commander;
 const matches=document.getElementById('signupCommanderMatches'),hint=document.getElementById('signupCommanderHint');
 let timer,controller,version=0,saving=false;
 const close=()=>{matches.hidden=true;matches.replaceChildren();commander.setAttribute('aria-expanded','false')};
 commander.addEventListener('input',()=>{
  clearTimeout(timer);controller?.abort();const current=++version,query=commander.value.trim();close();hint.textContent='Choose the commander you want on your player passport.';
  if(query.length<2)return;
  timer=setTimeout(async()=>{
   controller=new AbortController();
   try{
    const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/autocomplete?q='+encodeURIComponent(query),{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw Error();const data=await response.json();if(current!==version)return;
    for(const name of (data.data||[]).slice(0,8)){
     const choice=document.createElement('button');choice.type='button';choice.textContent=name;choice.setAttribute('role','option');choice.onmousedown=event=>event.preventDefault();choice.onclick=()=>{commander.value=name;close();commander.focus()};matches.append(choice);
    }
    matches.hidden=!matches.children.length;commander.setAttribute('aria-expanded',String(!matches.hidden));
   }catch(error){if(error.name!=='AbortError'&&current===version)hint.textContent='Suggestions are unavailable. You can still enter your commander’s full name.'}
  },300);
 });
 commander.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='ArrowDown'&&!matches.hidden){event.preventDefault();matches.querySelector('button')?.focus()}});
 matches.addEventListener('keydown',event=>{if(event.key==='Escape'){close();commander.focus()}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const choices=[...matches.children],index=choices.indexOf(document.activeElement);choices[(index+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length]?.focus()}});
 form.addEventListener('focusout',()=>setTimeout(()=>{if(!matches.contains(document.activeElement)&&document.activeElement!==commander)close()},0));
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;
  const handle=username.value.trim().toLowerCase();username.value=handle;
  if(!/^[a-z0-9_]{3,20}$/.test(handle)){status.textContent='Choose a username with 3–20 letters, numbers, or underscores.';username.focus();return}
  const favorite=commander.value.trim();if(!favorite){status.textContent='Enter your favorite commander.';commander.focus();return}
  saving=true;const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Creating your account…';close();
  const fields=new FormData(form);
  try{
   const {data,error}=await client.auth.signUp({email:String(fields.get('email')).trim(),password:String(fields.get('password')),options:{data:{display_name:String(fields.get('display')).trim(),username:handle,favorite_commander:favorite,onboarding_version:1,onboarding_profile_complete:true,onboarding_dismissed:false},emailRedirectTo:new URL(returnTo,location.href).href}});
   if(error)throw error;
   if(data.session)location.replace(returnTo);else status.textContent='Check your email to confirm your account.';
  }catch(error){status.textContent=/database error saving new user|duplicate key|profiles_handle_unique/i.test(error.message)?'We couldn’t create your account. That username may already be taken. Try another username, or try again shortly.':error.message}
  finally{saving=false;button.disabled=false}
 };
}
