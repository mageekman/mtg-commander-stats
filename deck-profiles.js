import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let decks=[],active=null,cardCache=new Map(),requestTime=0;
const groupOrder=['Commander','Creatures','Planeswalkers','Instants','Sorceries','Artifacts','Enchantments','Battles','Lands','Other'];
function parse(text){
let section='Main',items=[];
for(let line of String(text||'').split(/\r?\n/)){
 line=line.trim();if(!line||line.startsWith('//')||line.startsWith('#'))continue;
 if(/^(COMMANDERS?|MAINBOARD|MAIN|DECK|SIDEBOARD|MAYBEBOARD|CONSIDERING|COMPANION|TOKENS):?$/i.test(line)){section=line.replace(':','').toLowerCase();continue}
 const m=line.match(/^(\d+)\s*x?\s+(.+)$/i);if(!m)continue;
 const rest=m[2].replace(/\s+\*(?:F|E|CMDR)\*\s*$/i,'').trim();
 const print=rest.match(/^(.*?)\s+\(([a-z0-9]+)\)\s+([a-z0-9-]+)$/i);
 const name=(print?print[1]:rest).trim();
 if(/^(sideboard|maybeboard|considering|companion|tokens)$/.test(section))continue;
 items.push({qty:Number(m[1]),name,set:print?.[2],number:print?.[3],commander:/^commanders?$/.test(section)});
}
return items;
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function lookup(names){
const needed=[...new Set(names.map(x=>x.toLowerCase()))].filter(x=>!cardCache.has(x));
for(let i=0;i<needed.length;i+=75){
 const chunk=needed.slice(i,i+75);
 const wait=Math.max(0,150-(Date.now()-requestTime));if(wait)await pause(wait);requestTime=Date.now();
 const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({identifiers:chunk.map(name=>({name}))})});
 if(!response.ok)throw Error('Scryfall error '+response.status);
 const result=await response.json();
 for(const c of result.data||[])cardCache.set(c.name.toLowerCase(),c);
 for(const n of result.not_found||[])cardCache.set(n.name.toLowerCase(),null);
}
}
function group(card){
const type=card?.type_line||'';
if(type.includes('Land'))return 'Lands';
if(type.includes('Creature'))return 'Creatures';
if(type.includes('Planeswalker'))return 'Planeswalkers';
if(type.includes('Instant'))return 'Instants';
if(type.includes('Sorcery'))return 'Sorceries';
if(type.includes('Artifact'))return 'Artifacts';
if(type.includes('Enchantment'))return 'Enchantments';
if(type.includes('Battle'))return 'Battles';
return 'Other';
}
function image(card){return card?.image_uris?.normal||card?.card_faces?.[0]?.image_uris?.normal||''}
function art(card){return card?.image_uris?.art_crop||card?.card_faces?.[0]?.image_uris?.art_crop||image(card)}
function cardTile(item){
const card=cardCache.get(item.name.toLowerCase());
const tile=document.createElement('div');tile.className='ledger-card';
if(image(card)){const img=document.createElement('img');img.src=image(card);img.alt=item.name;img.loading='lazy';tile.append(img)}
const caption=document.createElement('div');caption.textContent=item.qty+'× '+item.name;tile.append(caption);
if(card?.scryfall_uri){tile.title='Open card on Scryfall';tile.tabIndex=0;tile.setAttribute('role','link');tile.onclick=()=>window.open(card.scryfall_uri,'_blank','noopener,noreferrer');tile.onkeydown=e=>{if(e.key==='Enter')tile.click()}}
return tile;
}
async function openDeck(id){
active=decks.find(d=>d.id===id);if(!active)return;
const view=$('deckProfile');view.hidden=false;view.replaceChildren();
const back=document.createElement('button');back.textContent='← All decks';back.onclick=()=>{view.hidden=true;$('deckGallery').hidden=false};view.append(back);$('deckGallery').hidden=true;
const heading=document.createElement('h2');heading.textContent=active.name;view.append(heading);
const status=document.createElement('p');status.textContent='Loading card artwork…';view.append(status);
const items=parse(active.decklist);
const names=[...items.map(x=>x.name),...active.commander.split(/\s+\/\s+|\s+&\s+/).filter(Boolean)];
try{await lookup(names)}catch(e){status.textContent='Card artwork could not load: '+e.message}
const commanderNames=active.commander.split(/\s+\/\s+|\s+&\s+/).map(s=>s.trim()).filter(Boolean);
const hero=document.createElement('div');hero.className='deck-hero';
for(const name of commanderNames){const card=cardCache.get(name.toLowerCase());if(art(card)){const img=document.createElement('img');img.src=art(card);img.alt=name;hero.append(img)}}
const description=document.createElement('div');const title=document.createElement('h3');title.textContent=active.commander;description.append(title);
const color=document.createElement('p');const colors=[...new Set(commanderNames.flatMap(n=>cardCache.get(n.toLowerCase())?.color_identity||[]))];
color.textContent='Color identity: '+(colors.length?colors.map(x=>({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'}[x])).join(' / '):'Colorless or unavailable');description.append(color);
const count=document.createElement('p');count.textContent=items.reduce((sum,x)=>sum+x.qty,0)+' cards listed';description.append(count);
const performance=document.createElement('p');performance.textContent='Game performance will appear here when cloud game tracking is connected.';description.append(performance);
hero.append(description);view.append(hero);
const groups=new Map();
for(const item of items){const isCommander=item.commander||commanderNames.some(n=>n.toLowerCase()===item.name.toLowerCase());const key=isCommander?'Commander':group(cardCache.get(item.name.toLowerCase()));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
for(const category of groupOrder){const cards=groups.get(category);if(!cards?.length)continue;
const h=document.createElement('h3');h.textContent=category+' ('+cards.reduce((sum,x)=>sum+x.qty,0)+')';view.append(h);
const grid=document.createElement('div');grid.className='ledger-grid';cards.forEach(item=>grid.append(cardTile(item)));view.append(grid)}
if(status.textContent==='Loading card artwork…')status.remove();
view.scrollIntoView({behavior:'smooth',block:'start'});
}
async function refresh(){
const {data:{user}}=await sb.auth.getUser();if(!user){$('deckGallery').innerHTML='<p>Sign in to view your cloud deck profiles.</p>';return}
const {data,error}=await sb.from('decks').select('id,name,commander,decklist,created_at').order('created_at',{ascending:false});
if(error){$('deckGallery').textContent=error.message;return}
decks=data||[];
const gallery=$('deckGallery');gallery.replaceChildren();gallery.hidden=false;$('deckProfile').hidden=true;
if(!decks.length){gallery.textContent='No cloud decks yet. Import one from Moxfield to see its profile.';return}
for(const deck of decks){
 const link=document.createElement('a');link.className='deck-entry';link.href='./deck.html?id='+encodeURIComponent(deck.id);
 const image=document.createElement('div');image.className='deck-entry-art';
 const details=document.createElement('div');details.className='deck-entry-details';
 const title=document.createElement('strong');title.textContent=deck.name;
 const subtitle=document.createElement('span');subtitle.textContent=deck.commander;
 details.append(title,subtitle);link.append(image,details);gallery.append(link);
 const commander=deck.commander.split(/\s+\/\s+|\s+&\s+/)[0].trim();
 if(commander){
 const url='https://api.scryfall.com/cards/named?exact='+encodeURIComponent(commander);
 fetch(url,{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(card=>{
 const art=card?.image_uris?.art_crop||card?.card_faces?.[0]?.image_uris?.art_crop;
 if(art){const img=document.createElement('img');img.src=art;img.alt='Artwork for '+commander;img.loading='lazy';image.append(img)}
 }).catch(()=>{});
 }
}
}
const refreshButton=$('refreshProfiles');if(refreshButton)refreshButton.onclick=refresh;
sb.auth.onAuthStateChange(()=>setTimeout(refresh,0));
refresh();
