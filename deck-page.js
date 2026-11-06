import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
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
 const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({identifiers:unique.slice(i,i+75).map(name=>({name}))})});
 if(!response.ok)throw Error('Scryfall request failed: '+response.status);
 const result=await response.json();
 for(const card of result.data||[])map.set(card.name.toLowerCase(),card);
 }
 return map;
}
const art=c=>c?.image_uris?.art_crop||c?.card_faces?.[0]?.image_uris?.art_crop;
const cardImage=c=>c?.image_uris?.normal||c?.card_faces?.[0]?.image_uris?.normal;
function type(c){
 const t=c?.type_line||'';
 for(const [key,label] of [['Land','Lands'],['Creature','Creatures'],['Planeswalker','Planeswalkers'],['Instant','Instants'],['Sorcery','Sorceries'],['Artifact','Artifacts'],['Enchantment','Enchantments'],['Battle','Battles']])if(t.includes(key))return label;
 return 'Other';
}
function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e}
async function run(){
 if(!id||!/^[0-9a-f-]{36}$/i.test(id)){$('status').textContent='Invalid deck link.';return}
 const {data:{user}}=await sb.auth.getUser();
 if(!user){$('status').textContent='Please sign in on the Command Ledger home page to view this deck.';return}
 const {data:deck,error}=await sb.from('decks').select('id,name,commander,decklist').eq('id',id).single();
 if(error||!deck){$('status').textContent='Deck not found or you do not have permission to view it.';return}
 document.title=deck.name+' · Command Ledger';$('deckTitle').textContent=deck.name;
 const items=parse(deck.decklist),commanderNames=deck.commander.split(/\s+\/\s+|\s+&\s+/).map(s=>s.trim()).filter(Boolean);
 $('status').textContent='Loading card artwork…';
 let cards=new Map();try{cards=await fetchCards([...items.map(i=>i.name),...commanderNames])}catch(e){$('status').textContent=e.message+' — showing card names instead.'}
 const root=$('deckContent'),hero=element('div');hero.className='hero';
 for(const name of commanderNames){const image=art(cards.get(name.toLowerCase()));if(image){const img=document.createElement('img');img.src=image;img.alt=name;hero.append(img)}}
 const meta=element('div');meta.append(element('h2',deck.commander));
 const colors=[...new Set(commanderNames.flatMap(n=>cards.get(n.toLowerCase())?.color_identity||[]))];
 meta.append(element('p','Color identity: '+(colors.length?colors.map(c=>({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'}[c])).join(' / '):'Colorless or unavailable')));
 meta.append(element('p',items.reduce((n,i)=>n+i.qty,0)+' cards listed'));
 meta.append(element('p','Game performance will appear here when cloud games are connected.'));
 hero.append(meta);root.append(hero);
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
 const link=element('a',item.qty+'× '+item.name);link.href=card?.scryfall_uri||'#';link.target='_blank';link.rel='noopener noreferrer';
 if(!card?.scryfall_uri)link.removeAttribute('href');
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
