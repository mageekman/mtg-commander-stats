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
 const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({identifiers:chunk.map(name=>({name}))})});
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
const cardLink=card?.scryfall_uri||'https://scryfall.com/search?q='+encodeURIComponent('!"'+item.name.replace(/"/g,'')+'"');tile.title='Open card on Scryfall';tile.tabIndex=0;tile.setAttribute('role','link');tile.onclick=()=>window.open(cardLink,'_blank','noopener,noreferrer');tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tile.click()}}
return tile;
}
async function openDeck(id){
active=decks.find(d=>d.id===id);if(!active)return;
const view=$('deckProfile');view.hidden=false;view.replaceChildren();
const back=document.createElement('button');back.textContent='← All decks';back.onclick=()=>{view.hidden=true;$('deckGallery').hidden=false};view.append(back);$('deckGallery').hidden=true;
const heading=document.createElement('h2');heading.textContent=active.name;view.append(heading);
const status=document.createElement('p');status.textContent='Loading card artwork…';view.append(status);
const items=parse(active.decklist||'');
const names=[...items.map(x=>x.name),...active.commander.split(/\s+\/\s+|\s+&\s+/).filter(Boolean)];
try{await lookup(names)}catch(e){status.textContent='Card artwork could not load: '+e.message}
const commanderNames=active.commander.split(/\s+\/\s+|\s+&\s+/).map(s=>s.trim()).filter(Boolean);
const hero=document.createElement('div');hero.className='deck-hero';
for(const name of commanderNames){const card=cardCache.get(name.toLowerCase());if(art(card)){const img=document.createElement('img');img.src=art(card);img.alt=name;hero.append(img)}}
const description=document.createElement('div');const title=document.createElement('h3');title.textContent=active.commander;description.append(title);
const colors=[...new Set(commanderNames.flatMap(n=>cardCache.get(n.toLowerCase())?.color_identity||[]))];
description.append(colorIdentityIcons(colors));
const count=document.createElement('p');count.textContent=items.length?items.reduce((sum,x)=>sum+x.qty,0)+' cards listed':'No card list uploaded';description.append(count);if(active.decklist_url){const a=document.createElement('a');a.textContent='View external decklist';a.href=active.decklist_url;a.target='_blank';a.rel='noopener noreferrer';description.append(a)}if(active.bracket_level){const n=document.createElement('p');n.textContent='Bracket: '+active.bracket_level;description.append(n)}if(active.theme){const n=document.createElement('p');n.textContent='Theme: '+active.theme;description.append(n)}if(active.notes){const n=document.createElement('p');n.textContent=active.notes;n.style.whiteSpace='pre-wrap';description.append(n)}
const performance=document.createElement('p');performance.textContent='Track games with this deck to see its performance in My Ledger.';description.append(performance);
hero.append(description);view.append(hero);
const groups=new Map();
for(const item of items){const isCommander=item.commander||commanderNames.some(n=>n.toLowerCase()===item.name.toLowerCase());const key=isCommander?'Commander':group(cardCache.get(item.name.toLowerCase()));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
for(const category of groupOrder){const cards=groups.get(category);if(!cards?.length)continue;
const h=document.createElement('h3');h.textContent=category+' ('+cards.reduce((sum,x)=>sum+x.qty,0)+')';view.append(h);
const grid=document.createElement('div');grid.className='ledger-grid';cards.forEach(item=>grid.append(cardTile(item)));view.append(grid)}
if(status.textContent==='Loading card artwork…')status.remove();
view.scrollIntoView({behavior:'smooth',block:'start'});
}
const galleryArtCache=new Map();
let rerenderDeckGallery=null;
const recentArtCache=new Map();
const recentArtPending=new Map();
let recentArtQueue=Promise.resolve();
function getRecentArtwork(name){
 const key=name.trim().toLowerCase();
 if(recentArtCache.has(key))return Promise.resolve(recentArtCache.get(key));
 if(recentArtPending.has(key))return recentArtPending.get(key);
 const job=recentArtQueue.then(async()=>{
  await new Promise(resolve=>setTimeout(resolve,125));
  const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name.trim()),{headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Scryfall '+response.status);
  const card=await response.json();
  const url=card.image_uris?.art_crop||card.card_faces?.[0]?.image_uris?.art_crop||card.image_uris?.large||card.card_faces?.[0]?.image_uris?.large||null;
  recentArtCache.set(key,url);return url;
 });
 recentArtQueue=job.catch(()=>{});
 recentArtPending.set(key,job);
 job.finally(()=>recentArtPending.delete(key)).catch(()=>{});
 return job;
}
async function paintRecentCommander(tile,name){
 if(!name?.trim())return;
 try{
  const url=await getRecentArtwork(name);
  if(tile.isConnected&&url)tile.style.backgroundImage='url("'+url+'")';
 }catch(e){/* Keep text visible if Scryfall artwork is unavailable. */}
}
function renderRecentGames(rows,error){
 const container=$('recentGames');if(!container)return;
 container.replaceChildren();
 if(error){const p=document.createElement('p');p.className='recent-games-empty';p.textContent='Recent games could not be loaded.';container.append(p);return}
 const recent=[...(rows||[])].sort((a,b)=>b.played_at.localeCompare(a.played_at)||String(b.id).localeCompare(String(a.id))).slice(0,4);
 if(!recent.length){const p=document.createElement('p');p.className='recent-games-empty';p.textContent='No games recorded yet. Record your first game to see it here.';container.append(p);return}
 for(const game of recent){
  const deck=decks.find(d=>d.id===game.deck_id);
  const card=document.createElement('article');card.className='recent-game';
  const top=document.createElement('div');top.className='recent-game-top';
  const result=document.createElement('span');result.className='recent-game-result'+(game.won?' win':'');result.textContent=game.won?'Win':'Loss';
  const date=document.createElement('time');date.className='recent-game-date';date.dateTime=game.played_at;
  const [year,month,day]=game.played_at.split('-').map(Number);date.textContent=new Date(year,month-1,day).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  top.append(result,date);
  const name=document.createElement('div');name.className='recent-game-deck';name.textContent=deck?.name||'Deleted deck';
  card.append(top,name);
  if(Array.isArray(game.players)&&game.players.length){
   const pod=document.createElement('div');pod.className='recent-game-pod';
   game.players.forEach((player,i)=>{
    const tile=document.createElement('div');tile.className='recent-game-player'+(i===game.winner_player?' recent-game-winner':'');
    const art=document.createElement('div');art.className='recent-game-player-art';art.setAttribute('aria-hidden','true');
    const info=document.createElement('div');info.className='recent-game-player-info';
    const tags=document.createElement('div');tags.className='recent-game-player-tags';
    if(i===game.winner_player){const badge=document.createElement('span');badge.textContent='🏆 Winner';tags.append(badge)}
    if(i===game.first_player){const badge=document.createElement('span');badge.textContent='Went first';tags.append(badge)}
    const playerName=document.createElement('strong');playerName.textContent=player.name||'Player '+(i+1);
    const commander=document.createElement('span');commander.textContent=player.commander||'Unknown commander';
    info.append(tags,playerName,commander);tile.append(art,info);pod.append(tile);
    paintRecentCommander(art,player.commander);
   });
   card.append(pod);
  }else{
   const commander=document.createElement('div');commander.className='recent-game-commander';commander.textContent=deck?.commander||'';
   card.append(commander);
  }
  container.append(card);
 }
}
function elWinRate(deckId,winRates){
 const badge=document.createElement('span');badge.className='deck-winrate';
 const stats=winRates.get(deckId);
 badge.textContent=stats?.games?(stats.wins/stats.games*100).toFixed(1)+'% win rate':'No games yet';
 badge.title=stats?.games?stats.wins+' wins in '+stats.games+' games':'No recorded games for this deck';
 return badge;
}
function sortDecksForDisplay(list,stats,sort,direction){
 const multiplier=direction==='asc'?1:-1;
 return [...list].sort((a,b)=>{
  const sa=stats.get(a.id),sb=stats.get(b.id);
  if(sort==='winrate'||sort==='last'){
   const va=sort==='winrate'?(sa?.games?sa.wins/sa.games:null):(sa?.last||null);
   const vb=sort==='winrate'?(sb?.games?sb.wins/sb.games:null):(sb?.last||null);
   if(va===null&&vb!==null)return 1;
   if(vb===null&&va!==null)return -1;
   if(va!==null&&vb!==null&&va!==vb)return (va>vb?1:-1)*multiplier;
  }else{
   const va=a.created_at||'',vb=b.created_at||'';
   if(va!==vb)return (va>vb?1:-1)*multiplier;
  }
  return (a.name||'').localeCompare(b.name||'');
 });
}
async function refresh(){
const {data:{user}}=await sb.auth.getUser();if(!user){$('deckGallery').innerHTML='<p>Sign in to view your decks.</p>';const recent=$('recentGames');if(recent)recent.textContent='Sign in to see your recent games.';return}
let {data,error}=await sb.from('decks').select('id,name,commander,decklist,decklist_url,created_at,archived_at,bracket_level,theme,notes').order('created_at',{ascending:false});
if(error){const fallback=await sb.from('decks').select('id,name,commander,decklist,created_at,archived_at').order('created_at',{ascending:false});if(!fallback.error){data=fallback.data;error=null}}

if(error){$('deckGallery').textContent=error.message;return}
decks=data||[];
const winRates=new Map();
const {data:gameRows,error:gameError}=await sb.from('personal_games').select('id,deck_id,played_at,won,players,first_player,winner_player').eq('owner_id',user.id).order('played_at',{ascending:false}).order('id',{ascending:false}).limit(1000);
if(!gameError)for(const game of gameRows||[]){
 const stats=winRates.get(game.deck_id)||{games:0,wins:0};
 stats.games++;if(game.won)stats.wins++;if(!stats.last||game.played_at>stats.last)stats.last=game.played_at;winRates.set(game.deck_id,stats);
}
renderRecentGames(gameRows,gameError);
const gallery=$('deckGallery'),archivedGallery=$('archivedDeckGallery'),archivedSection=$('archivedDeckSection');
gallery.replaceChildren();archivedGallery.replaceChildren();gallery.hidden=false;$('deckProfile').hidden=true;
const activeDecks=decks.filter(d=>!d.archived_at),archivedDecks=decks.filter(d=>!!d.archived_at);
archivedSection.hidden=!archivedDecks.length;
$('archivedDeckCount').textContent='('+archivedDecks.length+')';
const sort=$('homeDeckSort').value,direction=$('homeDeckDirection').value;
const renderGroup=(list,host,term,archived)=>{
 const filtered=sortDecksForDisplay(list,winRates,sort,direction).filter(d=>(d.name+' '+d.commander).toLowerCase().includes(term.toLowerCase().trim()));
 if(!filtered.length){const p=document.createElement('p');p.textContent=term?'No matching decks.':archived?'No archived decks.':'No active decks. Create a deck or restore an archived one.';host.append(p);return}
 for(const deck of filtered){
  const wrapper=document.createElement('div');wrapper.className='deck-gallery-card';
  const link=document.createElement('a');link.className='deck-entry';link.href='./deck.html?id='+encodeURIComponent(deck.id);
  const image=document.createElement('div');image.className='deck-entry-art';
  const details=document.createElement('div');details.className='deck-entry-details';
  const title=document.createElement('strong');title.textContent=deck.name;
  const subtitle=document.createElement('span');subtitle.textContent=deck.commander;
  const performance=elWinRate(deck.id,winRates);details.append(title,subtitle);
  if(deck.bracket_level||deck.theme){const n=document.createElement('span');n.textContent=[deck.bracket_level?'Bracket '+deck.bracket_level:'',deck.theme||''].filter(Boolean).join(' · ');details.append(n)}
  link.append(image,details,performance);wrapper.append(link);
  const button=document.createElement('button');button.type='button';button.className='deck-gallery-archive-button';button.textContent=archived?'Restore deck':'Archive deck';
  button.setAttribute('aria-label',(archived?'Restore ':'Archive ')+deck.name);
  button.onclick=async()=>{
   if(!archived&&!confirm('Archive '+deck.name+'? Its games and statistics will be preserved.'))return;
   button.disabled=true;button.textContent=archived?'Restoring…':'Archiving…';
   const {error}=await sb.from('decks').update({archived_at:archived?null:new Date().toISOString()}).eq('id',deck.id).eq('owner_id',user.id);
   if(error){button.disabled=false;button.textContent=archived?'Restore deck':'Archive deck';alert('Could not update deck: '+error.message);return}
   deck.archived_at=archived?null:new Date().toISOString();
   const archiveCount=decks.filter(d=>!!d.archived_at).length;
   archivedSection.hidden=!archiveCount;$('archivedDeckCount').textContent='('+archiveCount+')';
   renderAll();
  };
  wrapper.append(button);host.append(wrapper);
  const commander=deck.commander.split(/\s+\/\s+|\s+&\s+/)[0].trim();
  if(commander){
   const url='https://api.scryfall.com/cards/named?exact='+encodeURIComponent(commander);
   if(galleryArtCache.has(commander)){const cached=galleryArtCache.get(commander);if(cached){const img=document.createElement('img');img.src=cached;img.alt='Artwork for '+commander;img.loading='lazy';image.append(img)}continue}
   window.commandLedgerScryfallFetch(url,{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(card=>{
    const art=card?.image_uris?.art_crop||card?.card_faces?.[0]?.image_uris?.art_crop;
    galleryArtCache.set(commander,art||null);
    if(art&&image.isConnected){const img=document.createElement('img');img.src=art;img.alt='Artwork for '+commander;img.loading='lazy';image.append(img)}
   }).catch(()=>{});
  }
 }
};
function renderAll(){
 gallery.replaceChildren();archivedGallery.replaceChildren();
 renderGroup(decks.filter(d=>!d.archived_at),gallery,$('homeDeckSearch').value,false);
 renderGroup(decks.filter(d=>!!d.archived_at),archivedGallery,$('archivedDeckSearch').value,true);
}
rerenderDeckGallery=renderAll;
renderAll();

}
const refreshButton=$('refreshProfiles');if(refreshButton)refreshButton.onclick=refresh;
for(const id of ['homeDeckSort','homeDeckDirection','homeDeckSearch','archivedDeckSearch'])$(id)?.addEventListener(id.includes('Search')?'input':'change',()=>rerenderDeckGallery?.());
sb.auth.onAuthStateChange(()=>setTimeout(refresh,0));
refresh();
