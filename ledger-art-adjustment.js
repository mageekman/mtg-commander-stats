const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
export function normalizeFrame(value){const n=(v,f,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;return {x:n(value?.x,50,0,100),y:n(value?.y,24,0,100),zoom:n(value?.zoom,1,1,2.5)}}
export function applyFrame(element,value){const f=normalizeFrame(value),p=`${f.x}% ${f.y}%`;element.style.setProperty('background-position',p,'important');element.style.transformOrigin=p;element.style.transform=`scale(${f.zoom})`}
export function adjustLedgerArtwork({url,title,frame,aspect,onSave,note,defaultFrame}){
 const dialog=node('dialog');dialog.className='ledger-art-dialog';dialog.setAttribute('aria-labelledby','ledgerArtTitle');
 dialog.innerHTML='<h2 id="ledgerArtTitle">Adjust artwork</h2><p class="ledger-art-instructions">Drag the artwork or use the sliders to position your commander.</p><div class="ledger-art-preview"><div class="ledger-art-preview-image"></div><span></span></div><label>Horizontal position<input type="range" min="0" max="100" step="0.1" data-frame="x"></label><label>Vertical position<input type="range" min="0" max="100" step="0.1" data-frame="y"></label><label>Zoom<input type="range" min="1" max="2.5" step="0.01" data-frame="zoom"></label><p class="ledger-art-status" role="status"></p><div class="ledger-art-actions"><button type="button" data-action="reset">Reset</button><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="save">Save artwork</button></div>';
 const preview=dialog.querySelector('.ledger-art-preview'),image=dialog.querySelector('.ledger-art-preview-image'),status=dialog.querySelector('.ledger-art-status'),inputs=[...dialog.querySelectorAll('input')],buttons=[...dialog.querySelectorAll('button')];
 image.style.backgroundImage=`url("${url}")`;preview.style.aspectRatio=String(aspect||3);preview.querySelector('span').textContent=title;
 if(note)dialog.querySelector('.ledger-art-instructions').textContent=note;
 let current=normalizeFrame(frame||defaultFrame),drag=null,saving=false;const natural=new Image();natural.src=url;
 function render(){applyFrame(image,current);for(const input of inputs)input.value=current[input.dataset.frame]}
 for(const input of inputs)input.oninput=()=>{current[input.dataset.frame]=Number(input.value);render()};
 preview.onpointerdown=e=>{if(e.button!==0||saving)return;drag={x:e.clientX,y:e.clientY,frame:{...current}};preview.setPointerCapture(e.pointerId)};
 preview.onpointermove=e=>{if(!drag||!natural.naturalWidth)return;const box=preview.getBoundingClientRect(),scale=Math.max(box.width/natural.naturalWidth,box.height/natural.naturalHeight)*current.zoom,dx=natural.naturalWidth*scale-box.width,dy=natural.naturalHeight*scale-box.height;current=normalizeFrame({...current,x:drag.frame.x-(dx>.5?(e.clientX-drag.x)/dx*100:0),y:drag.frame.y-(dy>.5?(e.clientY-drag.y)/dy*100:0)});render()};
 preview.onpointerup=preview.onpointercancel=()=>drag=null;
 dialog.querySelector('[data-action=reset]').onclick=()=>{current=normalizeFrame(defaultFrame);render()};dialog.querySelector('[data-action=cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-action=save]').onclick=async()=>{saving=true;drag=null;buttons.forEach(b=>b.disabled=true);inputs.forEach(i=>i.disabled=true);status.textContent='Saving…';try{await onSave({...current});dialog.close()}catch(error){status.textContent='Could not save artwork: '+error.message}finally{saving=false;buttons.forEach(b=>b.disabled=false);inputs.forEach(i=>i.disabled=false)}};
 dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault()});dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);render();dialog.showModal();dialog.querySelector('[data-action=cancel]').focus();
}
export const historyCommanderKey=name=>String(name||'').trim().replace(/\s+/g,' ').toLowerCase();
export function createLedgerArtController(sb,getUser){
 let owner=null,settings=new Map(),targets=new Set();const key=(slot,name)=>JSON.stringify([slot,slot==='compact-history'?historyCommanderKey(name):name]);
 async function edit({slot,commander,url,title,aspect,note,defaultFrame}){
  const actor=getUser()?.id;if(!actor||actor!==owner||!url)return;
  const id=key(slot,commander),storedCommander=slot==='compact-history'?historyCommanderKey(commander):commander;
  adjustLedgerArtwork({url,title,aspect,note,defaultFrame,frame:settings.get(id),onSave:async frame=>{
   if(getUser()?.id!==actor)throw Error('Sign in again to save your artwork.');
   const {error}=await sb.from('ledger_art_adjustments').upsert({owner_id:actor,slot,commander:storedCommander,...frame},{onConflict:'owner_id,slot,commander'});if(error)throw error;
   if(getUser()?.id!==actor)return;settings.set(id,frame);targets=new Set([...targets].filter(t=>t.art.isConnected));for(const target of targets)if(target.id===id)applyFrame(target.art,frame);
  }});
 }
 function watch(art,{slot,commander}){if(!getUser()?.id||getUser().id!==owner)return;const id=key(slot,commander);targets=new Set([...targets].filter(t=>t.art.isConnected));targets.add({id,art});if(settings.has(id))applyFrame(art,settings.get(id))}
 return {edit,watch,
 async load(user){owner=user?.id||null;settings=new Map();targets=new Set();const requested=owner;if(!requested)return;try{const {data,error}=await sb.from('ledger_art_adjustments').select('slot,commander,x,y,zoom').eq('owner_id',requested);if(error)throw error;if(owner!==requested)return;settings=new Map((data||[]).map(row=>[key(row.slot,row.commander),normalizeFrame(row)]))}catch{/* The existing default remains available when settings cannot load. */}},
 attach(card,art,{slot,commander,url,title}){
  const actor=getUser()?.id;if(!actor||actor!==owner||!url||!card.isConnected)return;
  const id=key(slot,commander);targets=new Set([...targets].filter(t=>t.art.isConnected));targets.add({id,art});if(settings.has(id))applyFrame(art,settings.get(id));
  const button=node('button');button.type='button';button.className='ledger-adjust-art';button.title='Adjust artwork';button.setAttribute('aria-label','Adjust artwork for '+title);button.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  button.onclick=e=>{e.preventDefault();e.stopPropagation();if(getUser()?.id!==actor)return;const base=card.getBoundingClientRect();edit({slot,commander,url,title,aspect:base.width/base.height})};
  card.append(button);
 }
 };
}
