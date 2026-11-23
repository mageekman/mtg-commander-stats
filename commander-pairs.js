// A spaced single slash separates commanders; ampersands and double-faced // names do not.
export function commanderNames(value){return String(value||'').split(/\s+\/\s+/).map(name=>name.trim()).filter(Boolean)}
export function commanderPair(first,second=''){
 const names=[first,second].map(n=>String(n||'').trim()).filter(Boolean);
 if(names.length===2&&names[0].toLowerCase()===names[1].toLowerCase())throw Error('Choose two different commanders.');
 return names.join(' / ');
}
export function commanderPairKey(value){return commanderNames(value).map(n=>n.replace(/\s+/g,' ').toLowerCase()).sort().join(' / ')}
export function attachSecondCommander(input,{attachSearch,changed=()=>{}}={}){
 const label=input.closest('label');if(!label)throw Error('Commander input needs a label.');
 const root=document.createElement('div');root.className='commander-pair-fields';label.before(root);root.append(label);
 const toggleLabel=document.createElement('label');toggleLabel.className='second-commander-toggle';const toggle=document.createElement('input');toggle.type='checkbox';toggleLabel.append(toggle,document.createTextNode('Second Commander?'));
 const heading=document.createElement('div');heading.className='commander-pair-heading';const text=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());const title=document.createElement('span');title.textContent=text?.textContent.trim()||'Commander';if(text)text.remove();input.setAttribute('aria-label',title.textContent);heading.append(title,toggleLabel);root.prepend(heading);
 const secondLabel=document.createElement('label');secondLabel.className='second-commander-field';secondLabel.append(document.createTextNode('Second commander'));const second=document.createElement('input');second.type='text';second.maxLength=200;second.className='second-commander';second.placeholder='Second commander name';second.autocomplete='off';secondLabel.append(second);root.append(secondLabel);
 attachSearch?.(second);
 function visibility(){secondLabel.hidden=!toggle.checked;second.disabled=!toggle.checked;second.required=toggle.checked;second.setCustomValidity('');changed()}
 const api={input:second,toggle,root,value(){return [input.value,toggle.checked?second.value:''].map(x=>x.trim()).filter(Boolean).join(' / ')},set(value){const names=commanderNames(value);input.value=names[0]||'';input.setSelectedCommander?.(input.value);toggle.checked=names.length>1;second.value=names.slice(1).join(' / ');second.setSelectedCommander?.(second.value);visibility()},editable(value){toggle.disabled=!value;second.readOnly=!value},valid(){if(toggle.checked&&!second.value.trim())return false;try{commanderPair(input.value,toggle.checked?second.value:'')}catch{return false}return !toggle.checked||!second.getSelectedCommander||second.getSelectedCommander()===second.value.trim()}};
 toggle.onchange=()=>{visibility();input.dispatchEvent(new Event('change',{bubbles:true}));if(toggle.checked)second.focus()};second.addEventListener('input',()=>{second.setCustomValidity('');changed()});input.secondCommander=api;api.set(input.value);return api;
}
// Deck editor suggestions use the same throttled Scryfall client as the rest of the site.
export function attachSecondCommanderSearch(input){
 const menu=document.createElement('div');menu.className='second-commander-suggestions';menu.hidden=true;menu.setAttribute('role','listbox');input.after(menu);let timer,version=0;
 input.addEventListener('input',()=>{clearTimeout(timer);const current=++version;menu.replaceChildren();menu.hidden=true;const query=input.value.trim();if(query.length<2)return;timer=setTimeout(async()=>{try{const r=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/autocomplete?q='+encodeURIComponent(query),{headers:{Accept:'application/json'}});if(!r.ok)return;const body=await r.json();if(current!==version||!input.isConnected)return;for(const name of(body.data||[]).slice(0,10)){const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('role','option');b.onmousedown=e=>e.preventDefault();b.onclick=()=>{input.value=name;menu.hidden=true;input.dispatchEvent(new Event('change',{bubbles:true}))};menu.append(b)}menu.hidden=!menu.children.length}catch{}},300)});
 input.onkeydown=e=>{if(e.key==='Escape')menu.hidden=true;if(e.key==='ArrowDown'&&!menu.hidden){e.preventDefault();menu.querySelector('button')?.focus()}};menu.onkeydown=e=>{if(e.key==='Escape'){menu.hidden=true;input.focus()}};input.addEventListener('blur',()=>setTimeout(()=>menu.hidden=true,150));
}
