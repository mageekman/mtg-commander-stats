import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
const section=$('moxImport');
const status=$('importStatus'), preview=$('importPreview'), saveButton=$('saveImported');
let parsed=null;
const editId=new URLSearchParams(location.search).get('id');
const isEditing=!!editId;
if(isEditing){
 document.title='Edit deck · Command Ledger';
 const heading=document.querySelector('main h1');if(heading)heading.textContent='Edit deck';
 const intro=document.querySelector('main > p');if(intro)intro.textContent='Update your deck name, commander, or card list. Validate the list before saving changes.';
 saveButton.textContent='Save changes to cloud';
}
async function loadExisting(){
 if(!isEditing)return;
 if(!/^[0-9a-f-]{36}$/i.test(editId)){status.textContent='Invalid deck link.';return}
 const {data:{user}}=await sb.auth.getUser();
 if(!user){status.textContent='Sign in on the home page before editing your deck.';return}
 const {data,error}=await sb.from('decks').select('id,name,commander,decklist,bracket_level,theme,notes').eq('id',editId).eq('owner_id',user.id).single();
 if(error||!data){status.textContent='Deck not found or you do not have permission to edit it.';return}
 $('importDeckName').value=data.name;
 $('importCommander').value=data.commander;
 $('importText').value=data.decklist;$('importBracket').value=data.bracket_level==null?'':String(data.bracket_level);$('importTheme').value=data.theme||'';$('importNotes').value=data.notes||'';
 status.textContent='Deck loaded. Preview and validate before saving changes.';
}
loadExisting().catch(e=>status.textContent='Unable to load deck: '+e.message);
const zones={COMMANDER:'commander',COMMANDERS:'commander',MAINBOARD:'main',MAIN:'main',DECK:'main',SIDEBOARD:'side',MAYBEBOARD:'maybe',CONSIDERING:'maybe',COMPANION:'side',TOKENS:'side'};
function parse(text){
 let zone='main',cards=[],invalid=[];
 for(const [index,raw] of text.split(/\r?\n/).entries()){
  let line=raw.trim();if(!line||line.startsWith('#')||line.startsWith('//'))continue;
  const header=line.replace(/:$/,'').toUpperCase();
  if(zones[header]){zone=zones[header];continue}
  const match=line.match(/^(\d+)\s*x?\s+(.+)$/i);
  if(!match){invalid.push('Line '+(index+1)+': '+line);continue}
  let qty=Number(match[1]),rest=match[2].trim();
  rest=rest.replace(/\s+\*(?:F|E|CMDR)\*\s*$/gi,'').replace(/\s+#\S.*$/,'').trim();
  const print=rest.match(/^(.*?)\s+\(([A-Za-z0-9]+)\)\s+([A-Za-z0-9-]+)(?:\s+\*.*)?$/);
  const name=(print?print[1]:rest).trim();
  if(!name||qty<1||qty>100){invalid.push('Line '+(index+1)+': '+line);continue}
  cards.push({qty,name,zone,set:print?.[2],number:print?.[3]});
 }
 return {cards,invalid};
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function resolve(cards){
 const unique=[...new Set(cards.filter(c=>c.zone==='main'||c.zone==='commander').map(c=>c.name.toLowerCase()))];
 const found=new Map(),missing=[];
 for(let i=0;i<unique.length;i+=75){
  const names=unique.slice(i,i+75);
  if(i)await delay(600);
  const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({identifiers:names.map(name=>({name}))})});
  if(!response.ok)throw Error('Scryfall returned '+response.status+'. Please try again later.');
  const body=await response.json();
  for(const card of body.data||[])found.set(card.name.toLowerCase(),card);
  for(const item of body.not_found||[])missing.push(item.name||JSON.stringify(item));
 }
 return {found,missing};
}
function draw(){
 if(!parsed)return;
 const {cards,invalid,found,missing}=parsed;
 const main=cards.filter(c=>c.zone==='main'||c.zone==='commander');
 const total=main.reduce((n,c)=>n+c.qty,0);
 const commander=cards.filter(c=>c.zone==='commander');
 const other=cards.filter(c=>!['main','commander'].includes(c.zone));
 const duplicates=new Map();
 for(const c of main)duplicates.set(c.name.toLowerCase(),(duplicates.get(c.name.toLowerCase())||0)+c.qty);
 const repeat=[...duplicates].filter(([name,n])=>n>1&&!/^(plains|island|swamp|mountain|forest|wastes|snow-covered plains|snow-covered island|snow-covered swamp|snow-covered mountain|snow-covered forest)$/i.test(name)).map(([name,n])=>name+' ×'+n);
 const resolved=main.filter(c=>found.has(c.name.toLowerCase())).reduce((n,c)=>n+c.qty,0);
 const details=document.createElement('div');
 const heading=document.createElement('h3');heading.textContent='Import preview';details.append(heading);
 const p=document.createElement('p');p.textContent=total+' cards in deck (including commander), '+resolved+' matched by Scryfall, '+other.reduce((n,c)=>n+c.qty,0)+' excluded sideboard/maybeboard cards.';details.append(p);
 const commanderName=commander.map(c=>c.name).join(' / ');
 const cp=document.createElement('p');cp.textContent='Commander: '+(commanderName||'Not marked in export; enter it manually below.');details.append(cp);
 if(total!==100){const warn=document.createElement('p');warn.textContent='Deck contains '+total+' cards, not 100. Check your export.';details.append(warn)}
 if(repeat.length){const warn=document.createElement('p');warn.textContent='Repeated nonbasic names (review for exceptions): '+repeat.slice(0,12).join(', ');details.append(warn)}
 if(invalid.length||missing.length){const warn=document.createElement('p');warn.style.color='#fca5a5';warn.textContent='Issues: '+[...invalid,...missing.map(x=>'Unrecognized: '+x)].join(' | ');details.append(warn)}
 const sample=document.createElement('p');sample.textContent='Recognized examples: '+main.filter(c=>found.has(c.name.toLowerCase())).slice(0,8).map(c=>c.name).join(', ');details.append(sample);
 preview.replaceChildren(details);
 $('importCommander').value=commanderName||$('importCommander').value;
 saveButton.disabled=!!(invalid.length||missing.length)||!main.length;
 status.textContent=saveButton.disabled?'Fix unrecognized lines before saving.':'Review the deck and save when ready.';
}
$('parseImported').onclick=async()=>{
 saveButton.disabled=true;parsed=null;preview.replaceChildren();
 const text=$('importText').value;
 const base=parse(text);
 if(!base.cards.length){status.textContent='Paste a text decklist first.';return}
 status.textContent='Checking card names with Scryfall…';
 try{const checked=await resolve(base.cards);parsed={...base,...checked};draw()}
 catch(e){status.textContent='Import check failed: '+e.message}
};
saveButton.onclick=async()=>{
 if(!parsed||parsed.invalid.length||parsed.missing.length)return;
 const name=$('importDeckName').value.trim(),commander=$('importCommander').value.trim();
 if(!name||!commander){status.textContent='Enter a deck name and commander.';return}
 const bracket_level=$('importBracket').value?Number($('importBracket').value):null,theme=$('importTheme').value.trim()||null,notes=$('importNotes').value.trim()||null;
 const list=parsed.cards.filter(c=>['main','commander'].includes(c.zone)).map(c=>c.qty+' '+c.name+(c.set?' ('+c.set.toUpperCase()+') '+c.number:'')).join('\n');
 saveButton.disabled=true;
 try{
 const {data:{user}}=await sb.auth.getUser();
 if(!user){status.textContent='Sign in to your cloud account before saving. Your pasted list is still here.';return}
 const {error}=isEditing
 ?await sb.from('decks').update({name,commander,decklist:list,bracket_level,theme,notes}).eq('id',editId).eq('owner_id',user.id).select('id').single()
 :await sb.from('decks').insert({owner_id:user.id,name,commander,decklist:list,bracket_level,theme,notes});
 if(error)throw Error(error.message);
 status.textContent=isEditing?'Changes saved to your cloud deck.':'Deck saved to your cloud account.';
 window.location.href=isEditing?'./deck.html?id='+encodeURIComponent(editId):'./index.html#profiles';
 }catch(e){status.textContent='Save failed: '+e.message}
 finally{saveButton.disabled=false}
};
