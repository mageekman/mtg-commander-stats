// Load the existing editor only on demand. The embedded mode skips Ledger reports/history.
export function createGlobalGameRecorder(getUser){
 if(!document.querySelector('link[href*="global-game-recorder.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='./global-game-recorder.css?v=1';document.head.append(css)}
 let dialog=null,frame=null,trigger=null,timer=null,ready=false,openOwner=null;
 const notice=document.createElement('p');notice.id='globalRecordStatus';notice.setAttribute('role','status');notice.hidden=true;document.body.append(notice);
 function close(){clearTimeout(timer);if(dialog?.open)dialog.close();frame?.remove();dialog?.remove();frame=dialog=null;ready=false;trigger?.focus()}
 function open(event){
  event.preventDefault();trigger=event.currentTarget;const user=getUser();
  if(!user){location.assign('./sign-in.html?next='+encodeURIComponent('./ledger.html#gameEditor'));return}
  if(location.pathname.split('/').pop()==='ledger.html'){document.dispatchEvent(new Event('open-global-game-editor'));return}
  if(dialog?.open)return;openOwner=user.id;
  dialog=document.createElement('dialog');dialog.className='global-game-recorder';dialog.setAttribute('aria-label','Record a Game');const loading=document.createElement('div');loading.className='global-recorder-loading';loading.setAttribute('role','status');loading.textContent='Loading game editor…';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=close;loading.append(cancel);
  frame=document.createElement('iframe');frame.title='Record a Game';frame.src='./ledger.html?record_embed=1';frame.hidden=true;dialog.append(loading,frame);document.body.append(dialog);
  dialog.addEventListener('cancel',e=>{e.preventDefault();if(ready)frame.contentWindow.postMessage({type:'recorder-request-close'},location.origin);else close()});
  dialog.showModal();cancel.focus();timer=setTimeout(()=>{if(dialog?.open&&!ready){loading.firstChild.textContent='The game editor could not load. Close this window and try again.'}},20000);
 }
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow||!dialog?.open)return;
  const data=event.data;if(!data||typeof data!=='object')return;
  if(data.type==='recorder-ready'){if(data.ownerId!==getUser()?.id){close();return}clearTimeout(timer);ready=true;frame.hidden=false;dialog.querySelector('.global-recorder-loading').hidden=true;frame.focus()}
  if(data.type==='recorder-error'){clearTimeout(timer);dialog.querySelector('.global-recorder-loading').firstChild.textContent=data.message||'The editor could not load. Please try again.'}
  if(data.type==='recorder-close')close();
  if(data.type==='recorder-saved'&&data.ownerId===getUser()?.id){const ownerId=data.ownerId;close();document.dispatchEvent(new CustomEvent('command-ledger-game-recorded',{detail:{ownerId}}));document.dispatchEvent(new Event('onboarding-progress'));notice.textContent='Game saved.';notice.hidden=false;setTimeout(()=>notice.hidden=true,5000);if(data.goToLedger===true)location.assign('./ledger.html#gameHistorySection')}
 });
 return{update(user){const nav=document.getElementById('siteNavigation');if(nav&&!nav.querySelector('[data-record-game]')){const link=document.createElement('a');link.href='./ledger.html#gameEditor';link.textContent='Record a Game';link.className='site-record-game';link.dataset.recordGame='true';link.addEventListener('click',open);nav.append(link)}if(dialog&&user?.id!==openOwner)close()}};
}
