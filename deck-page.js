import {mountDeckPerformance} from './deck-performance.js?v=reports-4';
function colorIdentityIcons(colors){
 const wrap=document.createElement('p');wrap.style.cssText='display:flex;align-items:center;gap:7px;flex-wrap:wrap';
 const label=document.createElement('span');label.textContent='Color identity:';wrap.append(label);
 const names={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
 const ordered=[...'WUBRG'].filter(c=>colors.includes(c));
 if(!ordered.length){const empty=document.createElement('span');empty.textContent='Colorless or unavailable';wrap.append(empty);return wrap}
 for(const c of ordered){const img=document.createElement('img');img.src='https://svgs.scryfall.io/card-symbols/'+c+'.svg';img.alt=names[c]+' mana';img.title=names[c];img.width=24;img.height=24;img.loading='lazy';img.style.cssText='width:24px;height:24px;object-fit:contain;vertical-align:middle';wrap.append(img)}
 return wrap;
}
import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get('id');
const groups=['Commander','Creatures','Planeswalkers','Instants','Sorceries','Artifacts','Enchantments','Battles','Lands','Other'];
function parse(text){
let section='main',out=[];
for(let raw of String(text||'').split(/\r?\n/)){
 const line=raw.trim();if(!line||line.startsWith('#')||line.startsWith('//'))continue;
 if(/^(COMMANDERS?|MAINBOARD|MAIN|DECK|SIDEBOARD|MAYBEBOARD|CONSIDERING|COMPANION|TOKENS):?$/i.test(line)){section=line.replace(':','').toLowerCase();continue}
 if(/^(sideboard|maybeboard|considering|companion|tokens)$/.test(section))continue;
 const match=line.match(/^(\d+)\s*x?\s+(.+)$/i);if(!match)continue;
 const clean=match[2].replace(/\s+\*(?:F|E|CMDR)\*\s*$/i,'').trim();
 const printing=clean.match(/^(.*?)\s+\(([a-z0-9]+)\)\s+([a-z0-9-]+)$/i);
 out.push({qty:Number(match[1]),name:(printing?printing[1]:clean).trim(),commander:/^commanders?$/.test(section)});
}
return out;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchCards(names){
 const unique=[...new Set(names.map(n=>n.toLowerCase()))],map=new Map();
 for(let i=0;i<unique.length;i+=75){
 if(i)await wait(600);
 const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({identifiers:unique.slice(i,i+75).map(name=>({name}))})});
 if(!response.ok)throw Error('Scryfall request failed: '+response.status);
 const result=await response.json();
 for(const card of result.data||[]){
 map.set(card.name.toLowerCase(),card);
 if(card.card_faces?.length){
  const front=card.card_faces[0].name.toLowerCase();
  if(!map.has(front))map.set(front,card);
 }
 }
 }
 return map;
}
const art=c=>c?.image_uris?.art_crop||c?.card_faces?.[0]?.image_uris?.art_crop;
const cardImage=c=>c?.image_uris?.normal||c?.card_faces?.[0]?.image_uris?.normal;
function type(c){
 // For MDFCs, use the front face rather than the combined type line.
 const t=c?.card_faces?.[0]?.type_line||c?.type_line||'';
 for(const [key,label] of [['Land','Lands'],['Creature','Creatures'],['Planeswalker','Planeswalkers'],['Instant','Instants'],['Sorcery','Sorceries'],['Artifact','Artifacts'],['Enchantment','Enchantments'],['Battle','Battles']])if(t.includes(key))return label;
 return 'Other';
}
function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e}
async function run(){
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){$('status').textContent='Invalid deck link.';return}
 const {data:{user}}=await sb.auth.getUser();
 if(!user){$('status').textContent='Please sign in on the Command Ledger home page to view this deck.';return}
 let {data:deck,error}=await sb.from('decks').select('id,name,commander,decklist,decklist_url,archived_at,owner_id,bracket_level,theme,notes').eq('id',id).single();
 if(error){const fallback=await sb.from('decks').select('id,name,commander,decklist,archived_at,owner_id').eq('id',id).single();if(!fallback.error){deck=fallback.data;error=null}}

 if(error||!deck){$('status').textContent='Deck not found or you do not have permission to view it.';return}
 document.title=deck.name+' · Command Ledger';$('deckTitle').querySelector('.site-heading-title').textContent=deck.name;
 const actions=element('div');actions.className='deck-page-actions';
 const edit=element('a','Edit deck');edit.href='./import.html?id='+encodeURIComponent(deck.id);edit.className='edit-deck-link';edit.setAttribute('aria-label','Edit '+deck.name);actions.append(edit);
 const archiveButton=element('button');archiveButton.type='button';archiveButton.className='deck-archive-toggle';
 const archiveStatus=element('span');archiveStatus.className='deck-archive-status';archiveStatus.setAttribute('role','status');
 const updateArchiveLabel=()=>{const archived=!!deck.archived_at;archiveButton.textContent=archived?'Restore deck':'Archive deck';archiveButton.setAttribute('aria-label',(archived?'Restore ':'Archive ')+deck.name);archiveStatus.textContent=archived?'This deck is archived. Its games and statistics are preserved.':''};
 updateArchiveLabel();
 archiveButton.onclick=async()=>{
  const archive=!deck.archived_at;
  if(archive&&!confirm('Archive '+deck.name+'? It will leave your active deck list, but all game history and statistics will remain.'))return;
  archiveButton.disabled=true;archiveButton.textContent=archive?'Archiving…':'Restoring…';
  const {error}=await sb.from('decks').update({archived_at:archive?new Date().toISOString():null}).eq('id',deck.id).eq('owner_id',user.id);
  archiveButton.disabled=false;
  if(error){updateArchiveLabel();archiveStatus.textContent='Could not update deck: '+error.message;return}
  deck.archived_at=archive?new Date().toISOString():null;
  updateArchiveLabel();
 };
 actions.append(archiveButton,archiveStatus);$('deckTitle').after(actions);
 const items=parse(deck.decklist||''),commanderNames=deck.commander.split(/\s+\/\s+|\s+&\s+/).map(s=>s.trim()).filter(Boolean);
 $('status').textContent='Loading card artwork…';
 let cards=new Map();try{cards=await fetchCards([...items.map(i=>i.name),...commanderNames])}catch(e){$('status').textContent=e.message+' — showing card names instead.'}
 const root=$('deckContent'),hero=element('div');hero.className='hero';
 const artPanel=element('div');artPanel.className='deck-hero-art';
 for(const name of commanderNames){const image=art(cards.get(name.toLowerCase()));if(image){const img=document.createElement('img');img.src=image;img.alt=name;artPanel.append(img)}}
 hero.append(artPanel);
 const meta=element('div');meta.className='deck-hero-details';meta.append(element('h2',deck.commander));
 const colors=[...new Set(commanderNames.flatMap(n=>cards.get(n.toLowerCase())?.color_identity||[]))];
 meta.append(colorIdentityIcons(colors));
 meta.append(element('p',items.length?items.reduce((n,i)=>n+i.qty,0)+' cards listed':'No card list uploaded'));if(deck.decklist_url){const a=element('a','View external decklist');a.href=deck.decklist_url;a.target='_blank';a.rel='noopener noreferrer';meta.append(a)}if(deck.bracket_level)meta.append(element('p','Bracket: '+deck.bracket_level));if(deck.theme)meta.append(element('p','Theme: '+deck.theme));if(deck.notes){const note=element('p',deck.notes);note.style.whiteSpace='pre-wrap';meta.append(element('h3','Deck notes'),note)}
 const summary=element('aside');summary.className='deck-hero-performance';summary.setAttribute('aria-label','Deck record');summary.setAttribute('aria-live','polite');summary.append(element('p','Loading deck record…'));hero.classList.add('deck-hero-with-record');hero.append(meta,summary);root.append(hero);
 await mountDeckPerformance(root,deck,user,sb,summary);
 const buckets=new Map();
 for(const item of items){
 const category=item.commander||commanderNames.some(n=>n.toLowerCase()===item.name.toLowerCase())?'Commander':type(cards.get(item.name.toLowerCase()));
 if(!buckets.has(category))buckets.set(category,[]);buckets.get(category).push(item);
 }
 for(const group of groups){
 const entries=buckets.get(group);if(!entries?.length)continue;
 const section=element('section'),total=entries.reduce((n,i)=>n+i.qty,0);
 section.append(element('h2',group+' ('+total+')'));
 const grid=element('div');grid.className='card-list';
 for(const item of entries){
 const row=element('div');row.className='card-row';
 const card=cards.get(item.name.toLowerCase());
 const link=element('a',item.qty+'× '+item.name);link.href=card?.scryfall_uri||'https://scryfall.com/search?q='+encodeURIComponent('!"'+item.name.replace(/"/g,'')+'"');link.target='_blank';link.rel='noopener noreferrer';
 const url=cardImage(card);
 if(url){
 link.addEventListener('pointerenter',e=>showCardPreview(url,item.name,e));
 link.addEventListener('pointermove',moveCardPreview);
 link.addEventListener('pointerleave',hideCardPreview);
 link.addEventListener('focus',e=>showCardPreview(url,item.name,e));
 link.addEventListener('blur',hideCardPreview);
 }
 row.append(link);grid.append(row);
 }
 section.append(grid);root.append(section);
 }
 if($('status').textContent==='Loading card artwork…')$('status').textContent='';
}
const hover=document.createElement('div');hover.id='cardHoverPreview';hover.setAttribute('aria-hidden','true');hover.style.cssText='position:fixed;display:none;pointer-events:none;z-index:1000;width:260px;max-width:60vw;filter:drop-shadow(0 8px 22px rgba(0,0,0,.75))';const hoverImg=document.createElement('img');hoverImg.style.cssText='width:100%;border-radius:12px;display:block';hover.append(hoverImg);document.body.append(hover);
function moveCardPreview(e){if(hover.style.display==='none')return;const width=hover.getBoundingClientRect().width,height=hover.getBoundingClientRect().height;let x=(e.clientX??window.innerWidth/2)+20,y=(e.clientY??window.innerHeight/2)+12;if(x+width>window.innerWidth-8)x=(e.clientX??window.innerWidth/2)-width-20;if(y+height>window.innerHeight-8)y=window.innerHeight-height-8;hover.style.left=Math.max(8,x)+'px';hover.style.top=Math.max(8,y)+'px'}
function showCardPreview(url,name,e){hoverImg.src=url;hoverImg.alt=name;hover.style.display='block';moveCardPreview(e)}
function hideCardPreview(){hover.style.display='none';hoverImg.removeAttribute('src')}
run().catch(e=>$('status').textContent='Unable to load deck: '+e.message);
