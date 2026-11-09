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
 let {data,error}=await sb.from('decks').select('id,name,commander,decklist,bracket_level,theme,notes').eq('id',editId).eq('owner_id',user.id).single();
 if(error){const fallback=await sb.from('decks').select('id,name,commander,decklist').eq('id',editId).eq('owner_id',user.id).single();if(!fallback.error){data=fallback.data;error=null}}

 if(error||!data){status.textContent='Deck not found or you do not have permission to edit it.';return}
 $('importDeckName').value=data.name;
 $('importCommander').value=data.commander;
 $('importText').value=data.decklist;$('importBracket').value=data.bracket_level==null?'':String(data.bracket_level);$('importTheme').value=data.theme||'';$('importNotes').value=data.notes||'';
 status.textContent='Deck loaded. Preview and validate before saving changes.';
}
loadExisting().catch(e=>status.textContent='Unable to load deck: '+e.message);
const commanderInput=$('importCommander'),matches=$('commanderMatches'),hint=$('commanderHint');
let searchTimer=null,searchController=null,searchToken=0,commanderManuallyEdited=false;
function closeCommanderMatches(){matches.hidden=true;matches.replaceChildren();commanderInput.setAttribute('aria-expanded','false')}
function selectCommander(name,manual=true){commanderInput.value=name;commanderManuallyEdited=manual;closeCommanderMatches();if(manual)hint.textContent='Commander selected from Scryfall.'}
commanderInput.addEventListener('input',()=>{
 commanderManuallyEdited=true;clearTimeout(searchTimer);searchController?.abort();const token=++searchToken;
 closeCommanderMatches();const q=commanderInput.value.trim();hint.textContent='';
 if(q.length<2)return;
 searchTimer=setTimeout(async()=>{
  try{
   searchController=new AbortController();
   const response=await fetch('https://api.scryfall.com/cards/autocomplete?q='+encodeURIComponent(q),{signal:searchController.signal,headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('Scryfall unavailable');
   const data=await response.json();if(token!==searchToken)return;
   matches.replaceChildren();
   for(const name of (data.data||[]).slice(0,12)){
    const option=document.createElement('button');option.type='button';option.textContent=name;option.setAttribute('role','option');
    option.addEventListener('mousedown',e=>e.preventDefault());option.onclick=()=>selectCommander(name);matches.append(option);
   }
   if(!matches.children.length){const empty=document.createElement('div');empty.textContent='No matching cards';empty.style.padding='12px';matches.append(empty)}
   matches.hidden=false;commanderInput.setAttribute('aria-expanded','true');
  }catch(e){if(e.name!=='AbortError'&&token===searchToken)hint.textContent='Scryfall suggestions are unavailable. You can still type a commander.'}
 },280);
});
commanderInput.addEventListener('keydown',e=>{if(e.key==='Escape')closeCommanderMatches();if(e.key==='ArrowDown'&&!matches.hidden){e.preventDefault();matches.querySelector('button')?.focus()}});
matches.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCommanderMatches();commanderInput.focus()}});
commanderInput.addEventListener('blur',()=>setTimeout(closeCommanderMatches,150));
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
  const markedCommander=/\s+\*(?:CMDR|COMMANDER)\*\s*$/i.test(rest)||/\s+\[(?:CMDR|COMMANDER)\]\s*$/i.test(rest)||/\s+#(?:CMDR|COMMANDER)\b/i.test(rest);
  rest=rest.replace(/\s+\*(?:F|E|CMDR|COMMANDER)\*\s*$/gi,'').replace(/\s+\[(?:CMDR|COMMANDER)\]\s*$/gi,'').replace(/\s+#\S.*$/,'').trim();
  const print=rest.match(/^(.*?)\s+\(([A-Za-z0-9]+)\)\s+([A-Za-z0-9-]+)(?:\s+\*.*)?$/);
  const name=(print?print[1]:rest).trim();
  if(!name||qty<1||qty>100){invalid.push('Line '+(index+1)+': '+line);continue}
  cards.push({qty,name,zone:markedCommander?'commander':zone,set:print?.[2],number:print?.[3]});
 }
 return {cards,invalid};
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function resolve(cards){
 const entries=[...new Map(cards.filter(c=>c.zone==='main'||c.zone==='commander').map(c=>[c.name.toLowerCase(),c])).values()];
 const found=new Map(),unresolved=new Map(entries.map(c=>[c.name.toLowerCase(),c]));
 const request=async url=>{
  await delay(120);
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Scryfall returned '+response.status);
  return response.json();
 };
 const accept=(entry,card)=>{
  if(!card?.name)return false;
  found.set(entry.name.toLowerCase(),card);unresolved.delete(entry.name.toLowerCase());return true;
 };
 // Prefer the precise printing when a deck export includes a set and collector number.
 for(const entry of entries.filter(c=>c.set&&c.number)){
  try{
   const card=await request('https://api.scryfall.com/cards/'+encodeURIComponent(entry.set.toLowerCase())+'/'+encodeURIComponent(entry.number));
   if(card)accept(entry,card);
  }catch(e){/* Fall back to name lookup if a printing is unavailable. */}
 }
 const remaining=[...unresolved.values()];
 for(let i=0;i<remaining.length;i+=75){
  const chunk=remaining.slice(i,i+75);
  if(i)await delay(600);
  const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({identifiers:chunk.map(c=>({name:c.name}))})});
  if(!response.ok)throw Error('Scryfall returned '+response.status+'. Please try again later.');
  const body=await response.json();
  for(const card of body.data||[]){
   const entry=unresolved.get(card.name.toLowerCase());
   if(entry)accept(entry,card);
  }
 }
 // Alternate names printed on Secret Lair / Universes Beyond reskins are
 // exposed by Scryfall as flavor_name rather than the canonical card name.
 for(const entry of [...unresolved.values()]){
  try{
   const exact=await request('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(entry.name));
   if(exact){accept(entry,exact);continue}
   const query='https://api.scryfall.com/cards/search?q='+encodeURIComponent('!"'+entry.name.replace(/"/g,'')+'"')+'&unique=prints';
   const results=await request(query);
   const candidate=(results?.data||[]).find(card=>
    [card.flavor_name,...(card.card_faces||[]).map(face=>face.flavor_name)].some(name=>name?.toLowerCase()===entry.name.toLowerCase()));
   if(candidate)accept(entry,candidate);
  }catch(e){/* Leave ambiguous or unavailable names for manual correction. */}
 }
 return {found,missing:[...unresolved.values()].map(c=>c.name)};
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
 const explicitCommander=commander.map(c=>c.name);
 const possible=main.filter(c=>{
  const card=found.get(c.name.toLowerCase());
  return card?.type_line?.includes('Legendary')&&(card.type_line.includes('Creature')||card.type_line.includes('Planeswalker')&&/can be your commander/i.test(card.oracle_text||''));
 }).map(c=>found.get(c.name.toLowerCase())?.name||c.name);
 const candidates=[...new Set(possible)];
 const commanderName=explicitCommander.map(name=>found.get(name.toLowerCase())?.name||name).join(' / ');
 if(commanderName){if(!commanderManuallyEdited||!commanderInput.value.trim())selectCommander(commanderName,false);hint.textContent='Commander detected from the decklist.'}
 else if(candidates.length===1){if(!commanderManuallyEdited||!commanderInput.value.trim())selectCommander(candidates[0],false);hint.textContent='Suggested commander based on the only legendary creature in the deck. Confirm before saving.'}
 else if(candidates.length>1){hint.textContent='Multiple possible commanders found: '+candidates.slice(0,6).join(', ')+(candidates.length>6?'…':'')+'. Choose one above.'}
 else{hint.textContent='No commander marker found. Search for your commander above.'}
 const cp=document.createElement('p');cp.textContent='Commander: '+(commanderName|| (candidates.length===1?'Suggested: '+candidates[0]:'Not explicitly marked; select a commander above.'));details.append(cp);
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
 const list=parsed.cards.filter(c=>['main','commander'].includes(c.zone)).map(c=>{const resolved=parsed.found.get(c.name.toLowerCase());const canonical=resolved?.name||c.name;const set=c.set&&c.number?' ('+c.set.toUpperCase()+') '+c.number:'';return c.qty+' '+canonical+set}).join('\n');
 saveButton.disabled=true;
 try{
 const {data:{user}}=await sb.auth.getUser();
 if(!user){status.textContent='Sign in to your cloud account before saving. Your pasted list is still here.';return}
 let {error}=isEditing
 ?await sb.from('decks').update({name,commander,decklist:list,bracket_level,theme,notes}).eq('id',editId).eq('owner_id',user.id).select('id').single()
 :await sb.from('decks').insert({owner_id:user.id,name,commander,decklist:list,bracket_level,theme,notes});
 if(error&&/bracket_level|theme|notes|schema cache|column/i.test(error.message)){
  const basic=isEditing?await sb.from('decks').update({name,commander,decklist:list}).eq('id',editId).eq('owner_id',user.id).select('id').single():await sb.from('decks').insert({owner_id:user.id,name,commander,decklist:list});
  if(!basic.error){error=null;status.textContent='Deck saved. Optional details were not saved because the database has not been upgraded.'}else error=basic.error;
 }
 if(error)throw Error(error.message);
 status.textContent=isEditing?'Changes saved to your cloud deck.':'Deck saved to your cloud account.';
 window.location.href=isEditing?'./deck.html?id='+encodeURIComponent(editId):'./index.html#profiles';
 }catch(e){status.textContent='Save failed: '+e.message}
 finally{saveButton.disabled=false}
};
