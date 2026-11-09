import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
let user=null,decks=[],games=[],playerCount=4,editingGameId=null;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const message=t=>$('message').textContent=t;
const scryfallLink=name=>'https://scryfall.com/search?q='+encodeURIComponent('!"'+name.replace(/"/g,'')+'"');
const suggestionCache=new Map();
const artCache=new Map();
const artPending=new Map();
let artQueue=Promise.resolve();
function getCommanderArtwork(name){
 const key=name.trim().toLowerCase();
 if(artCache.has(key))return Promise.resolve(artCache.get(key));
 if(artPending.has(key))return artPending.get(key);
 const job=artQueue.then(async()=>{
  await new Promise(resolve=>setTimeout(resolve,125));
  const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name.trim()),{headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Scryfall '+response.status);
  const card=await response.json();
  const url=card.image_uris?.art_crop||card.card_faces?.[0]?.image_uris?.art_crop||card.image_uris?.large||card.card_faces?.[0]?.image_uris?.large||null;
  artCache.set(key,url);return url;
 });
 artQueue=job.catch(()=>{});
 artPending.set(key,job);
 job.finally(()=>artPending.delete(key)).catch(()=>{});
 return job;
}

async function showCommanderArt(row,name){
 const art=row.querySelector('.commander-art');if(!art)return;
 const token=String((Number(row.dataset.artToken)||0)+1);row.dataset.artToken=token;
 art.style.backgroundImage='';row.classList.remove('has-commander-art');
 if(!name?.trim())return;
 try{
  const url=await getCommanderArtwork(name);
  if(row.isConnected&&row.dataset.artToken===token&&url){art.style.backgroundImage='url("'+url+'")';row.classList.add('has-commander-art')}
 }catch(e){/* Keep the regular player card if Scryfall artwork is unavailable. */}
}

function attachCommanderSearch(input){
 const wrap=el('div');wrap.className='commander-search';input.parentNode.insertBefore(wrap,input);wrap.append(input);
 const menu=el('div');menu.className='commander-suggestions';menu.setAttribute('role','listbox');menu.hidden=true;wrap.append(menu);
 const link=el('a','View on Scryfall');link.className='commander-link';link.target='_blank';link.rel='noopener noreferrer';link.hidden=true;wrap.append(link);
 let selected=input.value||'',timer=null,controller=null,sequence=0;
 function updateLink(){link.hidden=!selected;link.href=selected?scryfallLink(selected):'#'}
 function close(){menu.hidden=true;menu.replaceChildren()}
 function choose(value){selected=value;input.value=value;input.setCustomValidity('');updateLink();close();showCommanderArt(input.closest('.player-row'),value)}
 input.addEventListener('input',()=>{
  selected='';showCommanderArt(input.closest('.player-row'),'');updateLink();input.setCustomValidity('');clearTimeout(timer);controller?.abort();const current=++sequence;close();
  const query=input.value.trim();if(query.length<2)return;
  timer=setTimeout(async()=>{
   try{
    let names=suggestionCache.get(query.toLowerCase());
    if(!names){controller=new AbortController();const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/autocomplete?q='+encodeURIComponent(query),{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('Scryfall unavailable');const body=await response.json();names=body.data||[];suggestionCache.set(query.toLowerCase(),names)}
    if(current!==sequence||input.value.trim()!==query)return;
    menu.replaceChildren();for(const value of names.slice(0,12)){const option=el('button',value);option.type='button';option.className='commander-option';option.setAttribute('role','option');option.addEventListener('mousedown',e=>e.preventDefault());option.onclick=()=>choose(value);menu.append(option)}
    if(!names.length)menu.append(el('div','No matching cards'));menu.hidden=false;
   }catch(error){if(error.name!=='AbortError'&&current===sequence){menu.replaceChildren(el('div','Search unavailable. Try again.'));menu.hidden=false}}
  },300);
 });
 input.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='ArrowDown'&&!menu.hidden){e.preventDefault();menu.querySelector('button')?.focus()}});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){close();input.focus()}});
 input.addEventListener('blur',()=>setTimeout(close,160));
 updateLink();
 input.getSelectedCommander=()=>selected;
}

async function showHistoryArt(element,name){
 if(!name)return;
 try{
  const url=await getCommanderArtwork(name);
  if(element.isConnected&&url)element.style.backgroundImage='url("'+url+'")';
 }catch(e){/* Keep the card readable without artwork. */}
}

function drawPlayers(prefill=null){
 const container=$('playerRows');const old=prefill||[...container.querySelectorAll('.player-row')].map(r=>({name:r.querySelector('.player-name').value,commander:r.querySelector('.player-commander').value}));container.replaceChildren();
 for(let i=0;i<playerCount;i++){
  const row=el('div');row.className='player-row';const art=el('div');art.className='commander-art';art.setAttribute('aria-hidden','true');row.append(art,el('h4',i===0?'Player 1 · You':'Player '+(i+1)));
  const fields=el('div');fields.className='player-fields';
  const nameLabel=el('label','Player name');const name=el('input');name.className='player-name';name.placeholder=i===0?'You':'Player '+(i+1);name.required=i!==0;name.maxLength=80;name.value=old[i]?.name||'';if(i===0){name.value='You';name.readOnly=true}nameLabel.append(name);
  const commanderLabel=el('label',i===0?'Your commander (from selected deck)':'Commander');const commander=el('input');commander.className='player-commander';commander.required=true;commander.maxLength=200;commander.placeholder='Commander name';commander.value=old[i]?.commander||'';if(i===0)commander.readOnly=true;commanderLabel.append(commander);if(i!==0)attachCommanderSearch(commander);
  fields.append(nameLabel,commanderLabel);row.append(fields);container.append(row);if(i!==0&&old[i]?.commander)showCommanderArt(row,old[i].commander);
 }
 const table=el('div');table.className='pod-table';table.setAttribute('aria-hidden','true');table.append(el('strong','COMMANDER'),el('span','The Pod'));container.append(table);
 const first=$('firstPlayer'),winner=$('winnerPlayer'),previousFirst=first.value,previousWinner=winner.value;first.replaceChildren();winner.replaceChildren();
 for(let i=0;i<playerCount;i++){const label='Player '+(i+1)+(i===0?' (You)':'');for(const select of [first,winner]){const option=el('option',label);option.value=String(i);select.append(option)}}
 first.value=previousFirst&&Number(previousFirst)<playerCount?previousFirst:'0';winner.value=previousWinner&&Number(previousWinner)<playerCount?previousWinner:'0';$('addPlayer').disabled=playerCount>=6;$('removePlayer').disabled=playerCount<=2;
 syncOwnCommander();
}
function syncOwnCommander(){const deck=decks.find(d=>d.id===$('deck').value);const input=$('playerRows').querySelector('.player-commander');if(input){input.value=deck?.commander||'';showCommanderArt(input.closest('.player-row'),input.value)}}
$('addPlayer').onclick=()=>{if(playerCount<6){playerCount++;drawPlayers()}};
$('removePlayer').onclick=()=>{if(playerCount>2){playerCount--;drawPlayers()}};
$('deck').addEventListener('change',syncOwnCommander);
drawPlayers();
$('date').value=new Date().toLocaleDateString('en-CA');
async function load(){
 const auth=await sb.auth.getUser();user=auth.data.user;
 if(!user){message('Sign in on the home page to use your personal Ledger.');$('save').disabled=true;return}
 const d=await sb.from('decks').select('id,name,commander,created_at,archived_at').eq('owner_id',user.id).order('name');
 if(d.error){message('Unable to load decks: '+d.error.message);return}
 decks=d.data||[];const select=$('deck');select.replaceChildren(el('option','Select your deck'));select.firstChild.value='';
 const alphabetical=(a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true})||a.commander.localeCompare(b.commander,undefined,{sensitivity:'base',numeric:true});
 const activeDecks=decks.filter(d=>!d.archived_at).sort(alphabetical);
 const archivedDecks=decks.filter(d=>!!d.archived_at).sort(alphabetical);
 for(const [label,groupDecks,archived] of [['Active decks',activeDecks,false],['Archived decks',archivedDecks,true]]){
  if(!groupDecks.length)continue;
  const group=document.createElement('optgroup');group.label=label;
  for(const deck of groupDecks){const o=el('option',deck.name+' — '+deck.commander+(archived?' (Archived)':''));o.value=deck.id;group.append(o)}
  select.append(group);
 }
 const filter=$('historyDeckFilter');filter.replaceChildren();const all=el('option','All decks');all.value='';filter.append(all);for(const deck of decks){const option=el('option',deck.name+(deck.archived_at?' (Archived)':'')+' — '+deck.commander);option.value=deck.id;filter.append(option)}
 const requestedDeck=new URLSearchParams(location.search).get('deck');if(requestedDeck&&decks.some(d=>d.id===requestedDeck))filter.value=requestedDeck;
 syncOwnCommander();await refresh();
}
async function refresh(){
 const r=await sb.from('personal_games').select('id,deck_id,played_at,won,opponents,notes,players,first_player,winner_player').eq('owner_id',user.id).order('played_at',{ascending:false}).order('id',{ascending:false});
 if(r.error){message('Unable to load your games. Please contact the app administrator. '+r.error.message);$('save').disabled=true;return}
 games=r.data||[];message('');render();
}
function setEditorOpen(open){
 $('gameEditor').hidden=!open;
 $('openGameForm').setAttribute('aria-expanded',String(open));
 $('openGameForm').textContent=open?'Close game form':'+ Add a game';
}
$('openGameForm').onclick=()=>{
 if(!$('gameEditor').hidden){resetEditor();return}
 resetEditor();setEditorOpen(true);$('formTitle').scrollIntoView({behavior:'smooth',block:'start'});
};
function resetEditor(){
 editingGameId=null;$('formTitle').textContent='Record a game';$('save').textContent='Save game';$('cancelEdit').hidden=true;
 $('deck').value='';$('notes').value='';$('date').value=new Date().toLocaleDateString('en-CA');
 playerCount=4;drawPlayers([]);$('firstPlayer').value='0';$('winnerPlayer').value='0';setEditorOpen(false);
}
function editGame(game){
 setEditorOpen(true);editingGameId=game.id;$('formTitle').textContent='Edit game';$('save').textContent='Save changes';$('cancelEdit').hidden=false;
 $('deck').value=game.deck_id;$('date').value=game.played_at;$('notes').value=game.notes||'';
 const own=decks.find(d=>d.id===game.deck_id);
 const existing=Array.isArray(game.players)&&game.players.length?game.players:[
  {name:'You',commander:own?.commander||''},
  ...(game.opponents||[]).map((commander,i)=>({name:'Opponent '+(i+1),commander}))
 ];
 playerCount=Math.max(2,Math.min(6,existing.length||4));drawPlayers(existing);
 $('firstPlayer').value=String(Number.isInteger(game.first_player)?game.first_player:0);
 $('winnerPlayer').value=String(Number.isInteger(game.winner_player)?game.winner_player:(game.won?0:Math.min(1,playerCount-1)));
 $('formTitle').scrollIntoView({behavior:'smooth',block:'start'});
 message('Editing saved game. Save changes when finished.');
}
$('cancelEdit').onclick=()=>{resetEditor();message('Editing cancelled.')};

for(const id of ['historyDeckFilter','historyPeriodFilter','historyResultFilter','historyDateSort'])$(id).addEventListener('change',render);
let historyView='cards';
function setHistoryView(view){
 historyView=view==='compact'?'compact':'cards';
 $('historyCardsView').setAttribute('aria-pressed',String(historyView==='cards'));
 $('historyCompactView').setAttribute('aria-pressed',String(historyView==='compact'));
 render();
}
$('historyCardsView').onclick=()=>setHistoryView('cards');
$('historyCompactView').onclick=()=>setHistoryView('compact');
$('deckStatsSearch').addEventListener('input',()=>render());
for(const id of ['ledgerDeckSort','ledgerDeckDirection'])$(id).addEventListener('change',()=>{$('deckStats').scrollLeft=0;render()});
$('deckCarouselPrev').onclick=()=>{$('deckStats').scrollBy({left:-$('deckStats').clientWidth*.85,behavior:'smooth'})};
$('deckCarouselNext').onclick=()=>{$('deckStats').scrollBy({left:$('deckStats').clientWidth*.85,behavior:'smooth'})};

function calendarFilteredGames(){
 const mode=$('statsDatePreset').value;
 if(mode==='all')return games;
 const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const localDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const [y,m,d]=value.split('-').map(Number);const date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null};
 let start=null,end=today;
 if(mode==='month')start=new Date(today.getFullYear(),today.getMonth(),1);
 else if(mode==='lastMonth'){start=new Date(today.getFullYear(),today.getMonth()-1,1);end=new Date(today.getFullYear(),today.getMonth(),0)}
 else if(mode==='year')start=new Date(today.getFullYear(),0,1);
 else if(mode==='lastYear'){start=new Date(today.getFullYear()-1,0,1);end=new Date(today.getFullYear()-1,11,31)}
 else if(mode==='30'){start=new Date(today);start.setDate(start.getDate()-29)}
 else if(mode==='90'){start=new Date(today);start.setDate(start.getDate()-89)}
 else if(mode==='custom'){start=localDate($('statsDateStart').value);end=localDate($('statsDateEnd').value);if(!start||!end||start>end)return []}
 return games.filter(g=>{const date=localDate(g.played_at);return !!date&&(!start||date>=start)&&date<=end});
}
$('statsDatePreset').addEventListener('change',()=>{$('statsCustomDates').hidden=$('statsDatePreset').value!=='custom';render()});
for(const id of ['statsDateStart','statsDateEnd'])$(id).addEventListener('change',render);
function filteredGames(){
 const period=$('historyPeriodFilter').value,result=$('historyResultFilter').value,deck=$('historyDeckFilter').value;
 const today=new Date();const localToday=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 const cutoff=new Date(localToday);cutoff.setDate(cutoff.getDate()-29);
 const toDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return null;const [y,m,day]=d.split('-').map(Number);const parsed=new Date(y,m-1,day);return parsed.getFullYear()===y&&parsed.getMonth()===m-1&&parsed.getDate()===day?parsed:null};
 return games.filter(g=>{
  if(deck&&g.deck_id!==deck)return false;
  if(result==='wins'&&!g.won||result==='losses'&&g.won)return false;
  if(period!=='all'){const date=toDate(g.played_at);if(!date||date>localToday)return false;if(period==='30'&&date<cutoff)return false;if(period==='year'&&date.getFullYear()!==today.getFullYear())return false}
  return true;
 });
}
function stat(label,value){const box=el('div');box.className='stat';box.append(el('strong',String(value)),el('span',label));return box}
function renderBestDeck(displayGames){
 const host=$('bestDeck');host.replaceChildren();
 const ranked=decks.filter(deck=>!deck.archived_at).map(deck=>{
  const played=displayGames.filter(g=>g.deck_id===deck.id);
  return {deck,games:played.length,wins:played.filter(g=>g.won).length};
 }).filter(d=>d.games>0).sort((a,b)=>(b.wins/b.games)-(a.wins/a.games)||b.games-a.games||b.wins-a.wins);
 if(!ranked.length){const empty=el('div','Record a game to see your best-performing deck.');empty.className='best-deck-empty';host.append(empty);return}
 const best=ranked[0],rate=(100*best.wins/best.games).toFixed(1)+'%';
 const card=el('div');card.className='best-deck-card';
 const artwork=el('div');artwork.className='best-deck-art';artwork.setAttribute('aria-hidden','true');
 const content=el('div');content.className='best-deck-content';
 const label=el('span','★ Best deck');label.className='best-deck-label';
 const name=el('strong',best.deck.name);name.className='best-deck-name';
 const commander=el('span',best.deck.commander);commander.className='best-deck-commander';
 const winrate=el('strong',rate+' win rate');winrate.className='best-deck-rate';
 const record=el('span',best.wins+' wins in '+best.games+' games');record.className='best-deck-record';
 content.append(label,name,commander,winrate,record);card.append(artwork,content);host.append(card);
 const commanderName=best.deck.commander.split(' / ')[0].split(' & ')[0].trim();
 if(commanderName)getCommanderArtwork(commanderName).then(url=>{
  if(card.isConnected&&url)artwork.style.backgroundImage='url("'+url+'")';
 }).catch(()=>{});
}
const identityCache=new Map();
async function commanderIdentity(name){
 const key=String(name||'').trim().toLowerCase();
 if(!key)return [];
 if(!identityCache.has(key))identityCache.set(key,(async()=>{
  try{
   const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name.trim()),{headers:{Accept:'application/json'}});
   if(!response.ok)return null;
   const card=await response.json();return Array.isArray(card.color_identity)?card.color_identity:null;
  }catch{return null}
 })());
 return identityCache.get(key);
}
function mostCommon(values){
 const counts=new Map();for(const value of values){const key=String(value||'').trim();if(key)counts.set(key,(counts.get(key)||0)+1)}
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
}
function isGenericOpponentName(value){
 const name=String(value||'').trim().toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ');
 if(!name)return true;
 if(/^(?:unknown|unnamed|anonymous|anon|n\/?a|none|tbd|not specified|not provided|no name|you|yourself|self|me)$/i.test(name))return true;
 // Generic placeholders with optional numbers, letters, or seat labels.
 if(/^(?:(?:the|another|random|other)\s+)?(?:opponent|opp|player|enemy|rival|guest|stranger|person|participant|competitor|challenger|user|someone|somebody|human|bot|cpu|computer|ai)(?:\s*(?:#|no\.?|number|seat|slot)?\s*(?:\d+|[a-z]))?$/i.test(name))return true;
 if(/^(?:player|opponent|enemy|guest|rival|seat|slot)\s*(?:one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(name))return true;
 return false;
}
function commanderParts(name){return String(name||'').split(/\s+\/\s+|\s+&\s+/).map(x=>x.trim()).filter(Boolean)}
async function commanderColors(name){
 const parts=commanderParts(name);
 if(!parts.length)return null;
 const ids=await Promise.all(parts.map(commanderIdentity));
 return ids.some(x=>x===null)?null:[...new Set(ids.flat())].sort((a,b)=>'WUBRG'.indexOf(a)-'WUBRG'.indexOf(b)).join('');
}
function manaIdentity(target,code){
 const colors={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
 target.replaceChildren();
 if(!code){target.textContent='Colorless';return}
 for(const c of code){const img=el('img');img.src='https://svgs.scryfall.io/card-symbols/'+c+'.svg';img.alt=colors[c]+' mana';img.title=colors[c];img.width=26;img.height=26;img.style.cssText='width:26px;height:26px;vertical-align:middle;margin-right:5px';target.append(img)}
}
function featuredStat(host,deck,label,primary,secondary){
 host.replaceChildren();
 if(!deck){const empty=el('div','Record a game to see '+label.toLowerCase()+'.');empty.className='best-deck-empty';host.append(empty);return}
 const card=el('div');card.className='best-deck-card';
 const art=el('div');art.className='best-deck-art';art.setAttribute('aria-hidden','true');
 const content=el('div');content.className='best-deck-content';
 for(const [tag,value,cls] of [['span',label,'best-deck-label'],['strong',deck.name,'best-deck-name'],['span',deck.commander,'best-deck-commander'],['strong',primary,'best-deck-rate'],['span',secondary,'best-deck-record']]){const node=el(tag,value);node.className=cls;content.append(node)}
 card.append(art,content);host.append(card);
 const name=commanderParts(deck.commander)[0];
 if(name)getCommanderArtwork(name).then(url=>{if(card.isConnected&&url)art.style.backgroundImage='url("'+url+'")'}).catch(()=>{});
}
function renderExtraStats(visibleGames){
 const host=$('statInsights'),nemesis=$('nemesisCommander');if(!host||!nemesis)return;
 host.replaceChildren();nemesis.replaceChildren();
 const stamp=++colorStatsStamp;
 const stats=decks.filter(deck=>!deck.archived_at).map(deck=>{const played=visibleGames.filter(g=>g.deck_id===deck.id);return {deck,games:played.length,wins:played.filter(g=>g.won).length}}).filter(x=>x.games);
 const most=stats.slice().sort((a,b)=>b.games-a.games||b.wins-a.wins)[0];
 featuredStat($('mostPlayedDeck'),most?.deck,'★ Most played deck',most?most.games+' games played':'',most?most.wins+' wins · '+(most.games-most.wins)+' losses · '+(100*most.wins/most.games).toFixed(1)+'% win rate':'');
 const losses=visibleGames.filter(g=>!g.won);
 const opponents=losses.map(g=>Array.isArray(g.players)&&Number.isInteger(g.winner_player)&&g.winner_player>0?g.players[g.winner_player]:null).filter(Boolean);
 const topCommander=mostCommon(opponents.map(p=>p.commander));
 const topPlayer=mostCommon(opponents.map(p=>p.name).filter(n=>!isGenericOpponentName(n)));
 const cardData=[
  ['Most played color','Calculating…','Across your played decks'],
  ['Highest color combo win rate','Calculating…','Based on your deck colors'],
  ['Color combo you’ve lost to most',opponents.length?'Calculating…':'No recorded losses',''],
  ['Player you’ve lost to most',topPlayer?.[0]||'No named opponents',topPlayer?topPlayer[1]+' losses':'']
 ];
 const cards=cardData.map(([label,value,detail])=>{const card=el('div');card.className='insight-stat';card.append(el('span',label),el('strong',value));const small=el('small',detail);card.append(small);host.append(card);return card});
 if(topCommander){
  const card=el('div');card.className='best-deck-card';
  const art=el('div');art.className='best-deck-art';art.setAttribute('aria-hidden','true');
  const content=el('div');content.className='best-deck-content';
  for(const [tag,value,cls] of [['span','★ Commander you’ve lost to most','best-deck-label'],['strong',topCommander[0],'best-deck-name'],['strong',topCommander[1]+' losses','best-deck-rate'],['span','Against this commander','best-deck-record']]){const node=el(tag,value);node.className=cls;content.append(node)}
  card.append(art,content);nemesis.append(card);
  const name=commanderParts(topCommander[0])[0];
  if(name)getCommanderArtwork(name).then(url=>{if(card.isConnected&&url)art.style.backgroundImage='url("'+url+'")'}).catch(()=>{});
 }else{const empty=el('div','No recorded losses to named commanders yet.');empty.className='best-deck-empty';nemesis.append(empty)}
 const gameDecks=visibleGames.map(g=>decks.find(d=>d.id===g.deck_id));
 Promise.all(gameDecks.map(d=>d?commanderColors(d.commander):Promise.resolve(null))).then(ids=>{
  if(stamp!==colorStatsStamp)return;
  const count=new Map(),combo=new Map();let missing=0;
  ids.forEach((code,i)=>{if(code===null){missing++;return}for(const c of code)count.set(c,(count.get(c)||0)+1);const data=combo.get(code)||{games:0,wins:0};data.games++;if(visibleGames[i].won)data.wins++;combo.set(code,data)});
  const top=[...count].sort((a,b)=>b[1]-a[1]||'WUBRG'.indexOf(a[0])-'WUBRG'.indexOf(b[0]))[0];
  const colorStrong=cards[0].querySelector('strong'),colorSmall=cards[0].querySelector('small');
  if(top){manaIdentity(colorStrong,top[0]);colorSmall.textContent=top[1]+' games'+(missing?' · '+missing+' unavailable':'')}else{colorStrong.textContent=missing?'Color data unavailable':'No colored decks played';colorSmall.textContent=''}
  const best=[...combo].sort((a,b)=>b[1].wins/b[1].games-a[1].wins/a[1].games||b[1].games-a[1].games||a[0].localeCompare(b[0]))[0];
  const bestStrong=cards[1].querySelector('strong'),bestSmall=cards[1].querySelector('small');
  if(best){manaIdentity(bestStrong,best[0]);bestSmall.textContent=(100*best[1].wins/best[1].games).toFixed(1)+'% win rate · '+best[1].wins+' wins in '+best[1].games+' games'}else{bestStrong.textContent=missing?'Color data unavailable':'No games yet';bestSmall.textContent=''}
 }).catch(()=>{if(stamp===colorStatsStamp){cards[0].querySelector('strong').textContent='Color data unavailable';cards[1].querySelector('strong').textContent='Color data unavailable'}});
 Promise.all(opponents.map(p=>commanderColors(p.commander))).then(ids=>{
  if(stamp!==colorStatsStamp)return;
  const top=mostCommon(ids.filter(x=>x!==null)),strong=cards[2].querySelector('strong'),small=cards[2].querySelector('small');
  if(top){manaIdentity(strong,top[0]);small.textContent=top[1]+' losses'+(ids.filter(x=>x===null).length?' · '+ids.filter(x=>x===null).length+' unavailable':'')}
  else{strong.textContent=ids.length?'Color data unavailable':'No recorded losses';small.textContent=''}
 }).catch(()=>{if(stamp===colorStatsStamp)cards[2].querySelector('strong').textContent='Color data unavailable'});
}
let colorStatsStamp=0;
let comboStatsStamp=0;
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

function renderWinrateTrend(visibleGames){
 const host=$('winrateTrendChart'),empty=$('winrateTrendEmpty');
 host.replaceChildren();
 const ordered=visibleGames.filter(g=>g.played_at).slice().sort((a,b)=>String(a.played_at).localeCompare(String(b.played_at))||String(a.id).localeCompare(String(b.id)));
 empty.hidden=ordered.length>0;if(!ordered.length)return;
 let wins=0;const points=ordered.map((g,i)=>{if(g.won)wins++;const value=wins/(i+1)*100;return {date:g.played_at,value,game:i+1}});
 const svgNS='http://www.w3.org/2000/svg',make=(tag,attrs={})=>{const n=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n};
 const width=900,height=260,left=48,right=18,top=20,bottom=44,plotW=width-left-right,plotH=height-top-bottom;
 const x=i=>left+(points.length===1?plotW/2:i*plotW/(points.length-1)),y=v=>top+(100-v)*plotH/100;
 const svg=make('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':'Cumulative win rate trend from '+points.length+' recorded games'});
 for(const v of [0,25,50,75,100]){const yy=y(v);svg.append(make('line',{x1:left,y1:yy,x2:width-right,y2:yy,class:'trend-grid'}));const label=make('text',{x:left-10,y:yy+4,'text-anchor':'end',class:'trend-axis'});label.textContent=v+'%';svg.append(label)}
 const coords=points.map((p,i)=>[x(i),y(p.value)]);
 const path=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
 const area=path+' L '+x(points.length-1)+' '+y(0)+' L '+x(0)+' '+y(0)+' Z';
 svg.append(make('path',{d:area,class:'trend-area'}),make('path',{d:path,class:'trend-line'}));
 const selected=new Set([0,points.length-1]);for(let i=0;i<points.length;i+=Math.max(1,Math.ceil(points.length/6)))selected.add(i);
 for(const i of selected){const p=points[i],date=new Date(String(p.date).slice(0,10)+'T12:00:00');const label=make('text',{x:x(i),y:height-13,'text-anchor':i===0?'start':i===points.length-1?'end':'middle',class:'trend-axis'});label.textContent=Number.isNaN(date.getTime())?'Game '+p.game:date.toLocaleDateString(undefined,{month:'short',day:'numeric'});svg.append(label)}
 for(const i of selected){const p=points[i],dot=make('circle',{cx:x(i),cy:y(p.value),r:4,class:'trend-point'}),tip=make('title');tip.textContent='Game '+p.game+' · '+p.value.toFixed(1)+'% · '+p.date;dot.append(tip);svg.append(dot)}
 host.append(svg);
}

function render(){
 const visibleGames=calendarFilteredGames();
 const historyVisibleGames=filteredGames().filter(g=>visibleGames.includes(g));
 renderWinrateTrend(visibleGames);
 renderBestDeck(visibleGames);
 renderExtraStats(visibleGames);
 const wins=visibleGames.filter(g=>g.won).length;
 const summary=$('summary');summary.replaceChildren();
 const rate=visibleGames.length?(wins/visibleGames.length*100).toFixed(1):'0.0';
 const pieCard=el('div');pieCard.className='stats-pie-card';
 const donut=el('div');donut.className='stats-donut';donut.style.setProperty('--win-percent',rate+'%');
 donut.setAttribute('role','img');donut.setAttribute('aria-label',wins+' wins and '+(visibleGames.length-wins)+' losses');
 const inner=el('div');inner.className='stats-donut-inner';inner.append(el('strong',rate+'%'),el('span','Win rate'));donut.append(inner);
 const legend=el('div');legend.className='stats-pie-legend';
 for(const [kind,label,value] of [['win','Wins',wins],['loss','Losses',visibleGames.length-wins]]){
  const line=el('div');const dot=el('span');dot.className='stats-pie-dot '+kind;
  line.append(dot,el('span',label),el('strong',String(value)));legend.append(line);
 }
 const pieMain=el('div');pieMain.className='stats-pie-main';pieMain.append(donut,legend);
 const total=el('div');total.className='stats-games-total';total.append(el('strong',String(visibleGames.length)),el('span','Total games played'));
 pieCard.append(pieMain,total);summary.append(pieCard);
 const byDeck=$('deckStats');byDeck.replaceChildren();byDeck.className='deck-stats-carousel';
 const search=($('deckStatsSearch')?.value||'').trim().toLowerCase();
 const deckStats=new Map();
 for(const game of visibleGames){const stats=deckStats.get(game.deck_id)||{games:0,wins:0,last:null};stats.games++;if(game.won)stats.wins++;if(!stats.last||game.played_at>stats.last)stats.last=game.played_at;deckStats.set(game.deck_id,stats)}
 const matchingDecks=sortDecksForDisplay(decks.filter(d=>!d.archived_at&&deckStats.has(d.id)&&(!search||(d.name||'').toLowerCase().includes(search)||(d.commander||'').toLowerCase().includes(search))),deckStats,$('ledgerDeckSort').value,$('ledgerDeckDirection').value);
 $('deckStatsEmpty').hidden=!!matchingDecks.length||!search;
 for(const deck of matchingDecks){
  const played=visibleGames.filter(g=>g.deck_id===deck.id),wins=played.filter(g=>g.won).length;
  const rate=played.length?(wins/played.length*100).toFixed(1)+'%':'—';
  const card=el('a');card.className='deck-stats-card';card.href='./deck.html?id='+encodeURIComponent(deck.id);
  card.setAttribute('aria-label',deck.name+', '+played.length+' games, '+(played.length?rate+' win rate':'no games')+'. View deck profile');
  const artwork=el('div');artwork.className='deck-stats-art';artwork.setAttribute('aria-hidden','true');
  const content=el('div');content.className='deck-stats-content';
  const name=el('strong',deck.name);name.className='deck-stats-name';
  const commander=el('span',deck.commander);commander.className='deck-stats-commander';
  const bottom=el('div');bottom.className='deck-stats-bottom';
  const percentage=el('div',rate);percentage.className='deck-stats-rate';percentage.append(el('small','Win rate'));
  const record=el('span',played.length?wins+' wins · '+(played.length-wins)+' losses':'No games yet');record.className='deck-stats-record';
  bottom.append(percentage,record);content.append(name,commander,bottom);card.append(artwork,content);byDeck.append(card);
  const commanderName=deck.commander.split(' / ')[0].split(' & ')[0].trim();
  if(commanderName)getCommanderArtwork(commanderName).then(url=>{
   if(card.isConnected&&url)artwork.style.backgroundImage='url("'+url+'")';
  }).catch(()=>{});
 }
 if(!decks.length)byDeck.append(el('p','Import a deck first to start tracking.'));
 const history=$('history');history.replaceChildren();history.classList.toggle('history-compact',historyView==='compact');
 $('historyCount').textContent=historyVisibleGames.length+' of '+games.length+' games match your filters';
 if(!historyVisibleGames.length){history.append(el('p',games.length?'No games match these filters.':'No games recorded yet.'));return}
 const historyGames=[...historyVisibleGames].sort((a,b)=>$('historyDateSort').value==='oldest'?a.played_at.localeCompare(b.played_at)||String(a.id).localeCompare(String(b.id)):b.played_at.localeCompare(a.played_at)||String(b.id).localeCompare(String(a.id)));
 for(const g of historyGames){
  const deck=decks.find(d=>d.id===g.deck_id);
  if(historyView==='compact'){
   const item=el('article');item.className='compact-game '+(g.won?'compact-game-win':'compact-game-loss');
   const row=el('div');row.className='compact-game-row';
   const date=el('span',g.played_at);date.className='compact-game-date';
   const deckArt=el('div');deckArt.className='compact-game-art';deckArt.setAttribute('aria-hidden','true');row.append(deckArt);
   if(deck?.commander){const artName=deck.commander.split(' / ')[0].split(' & ')[0].trim();if(artName)getCommanderArtwork(artName).then(url=>{if(deckArt.isConnected&&url)deckArt.style.backgroundImage='url("'+url+'")'}).catch(()=>{})}
   const deckName=el('strong',deck?.name||'Deleted deck');deckName.className='compact-game-deck-title';
   const players=el('span');players.className='compact-game-players';
   const playerNames=Array.isArray(g.players)&&g.players.length
    ?g.players.map((p,i)=>p.name?.trim()||('Player '+(i+1)))
    :['You',...(Array.isArray(g.opponents)?g.opponents:[])];
   players.textContent=playerNames.join(' · ');
   players.title=playerNames.join(', ');
   const info=el('div');info.className='compact-game-info';const outcome=el('span',g.won?'Win':'Loss');outcome.className='compact-game-outcome';info.append(deckName,players);row.append(date,info,outcome);item.append(row);history.append(item);continue;
  }
  const record=el('article');record.className='game-record';
  const header=el('div');header.className='game-record-header';
  const heading=el('div');heading.append(el('strong',(g.won?'Win':'Loss')+' · '+(deck?.name||'Deleted deck')),el('div',g.played_at));
  const edit=el('button','Edit');edit.type='button';edit.onclick=()=>editGame(g);
  const remove=el('button','Delete');remove.type='button';
  remove.onclick=async()=>{if(!confirm('Delete this game record?'))return;remove.disabled=true;const r=await sb.from('personal_games').delete().eq('id',g.id).eq('owner_id',user.id);if(r.error){message('Delete failed: '+r.error.message);remove.disabled=false;return}await refresh()};
  const actions=el('div');actions.className='game-record-actions';actions.append(edit,remove);header.append(heading,actions);record.append(header);
  if(Array.isArray(g.players)&&g.players.length){
   const pod=el('div');pod.className='history-pod';
   g.players.forEach((p,i)=>{
    const tile=el('div');tile.className='history-player';
    if(i===g.winner_player)tile.classList.add('history-winner');
    const art=el('div');art.className='history-player-art';art.setAttribute('aria-hidden','true');tile.append(art);
    const info=el('div');info.className='history-player-info';
    const tags=el('div');tags.className='history-player-tags';
    if(i===g.winner_player)tags.append(el('span','🏆 Winner'));
    if(i===g.first_player)tags.append(el('span','Went first'));
    info.append(tags,el('strong',p.name||'Player '+(i+1)));
    const commander=el('a',p.commander||'Unknown commander');commander.href=scryfallLink(p.commander||'');commander.target='_blank';commander.rel='noopener noreferrer';info.append(commander);
    tile.append(info);pod.append(tile);
    showHistoryArt(art,p.commander);
   });
   record.append(pod);
  }else{
   const old=el('div');old.className='history-legacy';
   if(g.opponents?.length)old.append(el('div','Opponents: '+g.opponents.join(', ')));
   record.append(old);
  }
  if(g.notes){const note=el('p',g.notes);note.className='history-note';record.append(note)}
  history.append(record);
 }
}
$('gameForm').onsubmit=async e=>{
 e.preventDefault();if(!user)return;
 const deck_id=$('deck').value;if(!decks.some(d=>d.id===deck_id)){message('Select one of your decks.');return}
 const played_at=$('date').value;
 const players=[...document.querySelectorAll('.player-row')].map((row,i)=>({name:i===0?'You':row.querySelector('.player-name').value.trim(),commander:row.querySelector('.player-commander').value.trim()}));
 if(!played_at||players.length<2||players.length>6||players.some(p=>!p.name||!p.commander)){message('Enter a date, player names, and commanders for everyone.');return}
 const opponentInputs=[...document.querySelectorAll('.player-row')].slice(1).map(r=>r.querySelector('.player-commander'));
 if(opponentInputs.some(input=>input.getSelectedCommander?.()!==input.value.trim())){message('Select each opponent commander from the Scryfall suggestions.');return}
 const first_player=Number($('firstPlayer').value),winner_player=Number($('winnerPlayer').value);
 if(!Number.isInteger(first_player)||!Number.isInteger(winner_player)||first_player<0||winner_player<0||first_player>=players.length||winner_player>=players.length){message('Select who went first and who won.');return}
 const button=$('save');button.disabled=true;message('Saving game…');
 const payload={deck_id,played_at,won:winner_player===0,opponents:players.slice(1).map(p=>p.commander),players,first_player,winner_player,notes:$('notes').value.trim()};
 const r=editingGameId?await sb.from('personal_games').update(payload).eq('id',editingGameId).eq('owner_id',user.id):await sb.from('personal_games').insert({...payload,owner_id:user.id});
 button.disabled=false;if(r.error){message('Save failed: '+r.error.message+(r.error.message.includes('column')?' — Please contact the app administrator.':''));return}
 resetEditor();await refresh();
};

load().catch(e=>message('Unable to load Ledger: '+e.message));
if(location.hash==='#gameForm'||location.hash==='#gameEditor'){
 setEditorOpen(true);
 requestAnimationFrame(()=>$('formTitle').scrollIntoView({block:'start'}));
}
window.addEventListener('hashchange',()=>{
 if(location.hash==='#gameForm'||location.hash==='#gameEditor')setEditorOpen(true);
});


