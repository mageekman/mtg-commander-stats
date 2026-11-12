import {createStatGameExplorer,pieSegmentAt} from './ledger-stat-games.js?v=hover-2';
import {rankingRange} from './friend-ranking-period.js?v=1';
import {filterTrendGames} from './ledger-trend-data.js?v=1';
import {startStatLoading} from './stat-loading.js?v=1';
import {renderColorUsage} from './color-combo-usage.js?v=stat-games-4';
import {mountLedgerUpdates} from './ledger-stat-updates.js?v=interactive-2';
import {selectStrongestColor,selectMostPlayedColor} from './strongest-color.js?v=combo-2';
import {normalizeLedgerSettings,readLedgerState,mountLedgerSettings,applyLedgerVisibility} from './ledger-settings.js?v=interactive-6';
import {selectBestDeck} from './best-deck.js?v=2';
import {createGameHistoryLinker,historyDeckTitle,markHistoryPlayer,historyFriendDeckSlot} from './game-history-links.js?v=1';
import {commanderColors} from './ledger-commander-colors.js?v=1';
import {renderAdditionalLedgerStats} from './ledger-additional-stats.js?v=stat-games-4';
import {createLedgerArtController} from './ledger-art-adjustment.js?v=history-2';
import {loadFriendDisplayNames,gamePlayerDisplayName} from './friend-display-names.js?v=search-5';
import {attachGameFriend,createGameFriendService,gamePlayerSnapshot} from './ledger-friends.js?v=history-links-3';
import {confirmGameDeletion} from './game-delete-dialog.js?v=1';
import {demoDecks,demoGames} from './demo-data.js?v=1';
import {gameMatchesSearch} from './game-history-search.js?v=search-4';
import {isGenericOpponentName} from './opponent-names.js?v=1';
import {mountLedgerTrend} from './ledger-trend-controls.js?v=loading-3';
import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const friendService=createGameFriendService(sb);
const historyLinker=createGameHistoryLinker(sb);
const $=id=>document.getElementById(id);
let friendDisplayNames=new Map();
let user=null,decks=[],games=[],playerCount=4,editingGameId=null,savingGame=false;
let ledgerSettings=normalizeLedgerSettings();
let openSettingsFromUrl=new URLSearchParams(location.search).get('settings')==='1';
const updateLedgerNotices=mountLedgerUpdates($('ledgerStatUpdates'),sb,()=>user,()=>$('openLedgerSettings').click());
const updateSettingsForm=mountLedgerSettings(sb,()=>user,value=>{ledgerSettings=value;render()});
const ledgerTrend=mountLedgerTrend(()=>games);
const ledgerArt=createLedgerArtController(sb,()=>user);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const statGames=createStatGameExplorer({owner:()=>user?.id,enabled:()=>ledgerSettings.enable_stat_games,renderGame:renderCompactGame,hydrate:(host,rows)=>historyLinker.hydrate(host,rows),matches:(game,term)=>gameMatchesSearch(game,decks.find(deck=>deck.id===game.deck_id),term,friendDisplayNames),period:()=>document.querySelector('#statsDatePreset option:checked')?.textContent||'Selected timeframe'});
const matchingGames=predicate=>calendarFilteredGames().filter(predicate);
const winnerOf=game=>!game.won&&Array.isArray(game.players)&&Number.isInteger(game.winner_player)&&game.winner_player>0?game.players[game.winner_player]:null;
const colorGames=async(code,rivals=false)=>{const rows=calendarFilteredGames();const colors=await Promise.all(rows.map(game=>commanderColors(rivals?winnerOf(game)?.commander:decks.find(deck=>deck.id===game.deck_id)?.commander)));return rows.filter((game,i)=>colors[i]===code&&(!rivals||winnerOf(game)))};
const message=t=>{$('message').textContent=t;$('gameFormStatus').textContent=t};
const scryfallLink=name=>'https://scryfall.com/search?q='+encodeURIComponent('!"'+name.replace(/"/g,'')+'"');
const suggestionCache=new Map();
const artCache=new Map();
const artPending=new Map();
function getCommanderArtwork(name){
 const key=name.trim().toLowerCase();
 if(artCache.has(key))return Promise.resolve(artCache.get(key));
 if(artPending.has(key))return artPending.get(key);
 const job=(async()=>{
  const url=await window.commandLedgerCommanderArtwork(name);
  if(url)artCache.set(key,url);return url;
 })();
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
 input.setSelectedCommander=value=>{clearTimeout(timer);controller?.abort();sequence++;choose(value)};
}

async function showHistoryArt(element,name){
 if(!name)return;
 try{
  const url=await getCommanderArtwork(name);
  if(element.isConnected&&url)element.style.backgroundImage='url("'+url+'")';
 }catch(e){/* Keep the card readable without artwork. */}
}

const ownDeckPicker=$('deck');
function drawPlayers(prefill=null){
 const container=$('playerRows');const old=prefill||[...container.querySelectorAll('.player-row')].map(gamePlayerSnapshot);container.replaceChildren();
 for(let i=0;i<playerCount;i++){
  const row=el('div');row.className='player-row';const art=el('div');art.className='commander-art';art.setAttribute('aria-hidden','true');row.append(art,el('h4',i===0?'Player 1 · You':'Player '+(i+1)));
  const fields=el('div');fields.className='player-fields';
  const nameLabel=el('label',i===0?'Player name':'Player name (optional)');const name=el('input');name.className='player-name';name.placeholder=i===0?'You':'Player '+(i+1);name.required=false;name.maxLength=80;name.value=old[i]?.name||'';if(i===0){name.value='You';name.readOnly=true}nameLabel.append(name);
  const commanderLabel=el('label',i===0?'Your deck':'Commander');const commander=el('input');commander.className='player-commander';commander.required=true;commander.maxLength=200;commander.placeholder='Commander name';commander.value=old[i]?.commander||'';if(i===0){commander.readOnly=true;commander.type='hidden';commander.required=false;commanderLabel.append(ownDeckPicker)}commanderLabel.append(commander);if(i!==0)attachCommanderSearch(commander);
  fields.append(nameLabel,commanderLabel);row.append(fields);container.append(row);if(i!==0)attachGameFriend({row,name,commander,snapshot:old[i],service:friendService,onCommander:value=>showCommanderArt(row,value)});if(i!==0&&old[i]?.commander)showCommanderArt(row,old[i].commander);
 }
 const table=el('div');table.className='pod-table';table.setAttribute('aria-hidden','true');table.append(el('strong','COMMANDER'),el('span','The Pod'));container.append(table);
 const first=$('firstPlayer'),winner=$('winnerPlayer'),previousFirst=first.value,previousWinner=winner.value;first.replaceChildren();winner.replaceChildren();
 for(let i=0;i<playerCount;i++){const label='Player '+(i+1)+(i===0?' (You)':'');for(const select of [first,winner]){const option=el('option',label);option.value=String(i);select.append(option)}}
 first.value=previousFirst&&Number(previousFirst)<playerCount?previousFirst:'0';winner.value=previousWinner&&Number(previousWinner)<playerCount?previousWinner:'0';$('addPlayer').disabled=playerCount>=6;$('removePlayer').disabled=playerCount<=2;
 syncOwnCommander();
}
function syncOwnCommander(){const deck=decks.find(d=>d.id===$('deck').value);const input=$('playerRows').querySelector('.player-commander');if(input){input.value=deck?.commander||'';showCommanderArt(input.closest('.player-row'),input.value)}updateHistoryArtworkControl()}
$('addPlayer').onclick=()=>{if(playerCount<6){playerCount++;drawPlayers()}};
$('removePlayer').onclick=()=>{if(playerCount>2){playerCount--;drawPlayers()}};
function updateHistoryArtworkControl(){const deck=decks.find(d=>d.id===$('deck').value);$('adjustHistoryArtwork').hidden=!user||!deck?.commander;$('historyArtworkStatus').textContent=''}
$('adjustHistoryArtwork').onclick=async()=>{
 const actor=user?.id,deck=decks.find(d=>d.id===$('deck').value);if(!actor||!deck?.commander)return;
 const button=$('adjustHistoryArtwork'),name=deck.commander.trim();button.disabled=true;$('historyArtworkStatus').textContent='Loading artwork…';
 try{const url=await getCommanderArtwork(name);if(user?.id!==actor||$('deck').value!==deck.id)return;if(!url)throw Error('Artwork is unavailable for this commander.');
  const art=document.querySelector('#history .compact-game-art');
  const aspect=art?.offsetHeight?art.offsetWidth/art.offsetHeight:(innerWidth<=600?Math.max(68,Math.min(110,innerWidth*.24)):Math.max(160,Math.min(300,innerWidth*.24)))/(innerWidth<=600?164:112);
  $('historyArtworkStatus').textContent='';ledgerArt.edit({slot:'compact-history',commander:name,url,title:name,aspect,defaultFrame:{x:50,y:30,zoom:1},note:'Adjust the compact game-history artwork for '+name+'. Saving applies this crop to all your games using this commander, including future games.'});
 }catch(error){$('historyArtworkStatus').textContent=error.message}finally{button.disabled=false}
};
$('deck').addEventListener('change',syncOwnCommander);
drawPlayers();
$('date').value=new Date().toLocaleDateString('en-CA');
async function load(){
 const done=startStatLoading($('statisticsSection'));
 try{return await loadLedger()}finally{done()}
}
async function loadLedger(){
 historyLinker.clear();
 const auth=await sb.auth.getUser();user=auth.data.user;statGames.refresh();await ledgerArt.load(user);friendService.clear();friendDisplayNames=new Map();
 $('openLedgerSettings').hidden=!user;
 if(user){try{const state=await readLedgerState(sb,user);ledgerSettings=state.settings;updateSettingsForm(ledgerSettings);updateLedgerNotices(state.updates);if(openSettingsFromUrl){openSettingsFromUrl=false;$('openLedgerSettings').click()}$('statisticsSection').hidden=false;$('shareLedgerLink').hidden=false}catch(error){$('statisticsSection').hidden=true;message('Unable to load Ledger settings. Reload to try again.');return}}else{updateLedgerNotices([]);ledgerSettings=normalizeLedgerSettings();$('statisticsSection').hidden=false}
 if(!user){decks=demoDecks;games=demoGames;$('save').disabled=true;const filter=$('historyDeckFilter');filter.replaceChildren(el('option','All decks'));filter.firstChild.value='';for(const deck of decks){const option=el('option',deck.name);option.value=deck.id;filter.append(option)}message('');render();return}
 $('save').disabled=false;
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
 const done=startStatLoading($('statisticsSection'));
 try{return await refreshLedger()}finally{done()}
}
async function refreshLedger(){
 const [r,names]=await Promise.all([sb.from('personal_games').select('id,deck_id,played_at,won,opponents,notes,players,first_player,winner_player').eq('owner_id',user.id).order('played_at',{ascending:false}).order('id',{ascending:false}),loadFriendDisplayNames(sb)]);
 friendDisplayNames=names;
 if(r.error){message('Unable to load your games. Please contact the app administrator. '+r.error.message);$('save').disabled=true;return}
 games=r.data||[];message('');render();
}
function setEditorOpen(open){
 const dialog=$('gameEditor');
 if(open&&!dialog.open){dialog.showModal();requestAnimationFrame(()=>$('deck').focus())}
 else if(!open&&dialog.open)dialog.close();
 document.body.classList.toggle('game-editor-open',open);
 $('openGameForm').setAttribute('aria-expanded',String(open));
}
$('openGameForm').onclick=()=>{
 if(!user){location.href='./sign-in.html';return}
 resetEditor();message('');setEditorOpen(true);
};
$('closeGameEditor').onclick=()=>{if(!savingGame)resetEditor()};
$('gameEditor').addEventListener('cancel',event=>{event.preventDefault();if(!savingGame)resetEditor()});
$('gameEditor').addEventListener('close',()=>{if(!$('gameEditor').open){document.body.classList.remove('game-editor-open');$('openGameForm').setAttribute('aria-expanded','false')}});
function resetEditor(){
 editingGameId=null;$('formTitle').textContent='Record a game';$('save').textContent='Save game';$('cancelEdit').hidden=false;
 $('deck').value='';$('notes').value='';$('date').value=new Date().toLocaleDateString('en-CA');
 playerCount=4;drawPlayers([]);$('firstPlayer').value='0';$('winnerPlayer').value='0';setEditorOpen(false);
}
async function deleteGame(game,button){
 if(!user){location.href='./sign-in.html';return}
 button.disabled=true;
 try{
  if(!await confirmGameDeletion())return;
  const {error}=await sb.from('personal_games').delete().eq('id',game.id).eq('owner_id',user.id).select('id').single();
  if(error)throw error;
  if(editingGameId===game.id)resetEditor();
  await refresh();
 }catch(error){message('Delete failed: '+error.message);statGames.error('Delete failed: '+error.message)}finally{button.disabled=false}
}
function editGame(game){
 if(!user){location.href='./sign-in.html';return}
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
 $('deck').focus();
 message('Editing saved game. Save changes when finished.');
}
$('cancelEdit').onclick=()=>{if(!savingGame){resetEditor();message('')}};

let historyPage=1;
for(const id of ['historyDeckFilter','historyPeriodFilter','historyResultFilter','historyDateSort','historyPageSize'])$(id).addEventListener('change',()=>{historyPage=1;render()});
$('historySearch').addEventListener('input',()=>{historyPage=1;render()});
let historyView='compact';
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
$('statsDatePreset').addEventListener('change',()=>{$('statsCustomDates').hidden=$('statsDatePreset').value!=='custom';ledgerTrend.sync();render()});
for(const id of ['statsDateStart','statsDateEnd'])$(id).addEventListener('change',()=>{ledgerTrend.sync();render()});
function filteredGames(){
 const period=$('historyPeriodFilter').value,result=$('historyResultFilter').value,deck=$('historyDeckFilter').value;
 const today=new Date();const localToday=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 const cutoff=new Date(localToday);cutoff.setDate(cutoff.getDate()-29);
 const toDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return null;const [y,m,day]=d.split('-').map(Number);const parsed=new Date(y,m-1,day);return parsed.getFullYear()===y&&parsed.getMonth()===m-1&&parsed.getDate()===day?parsed:null};
 return games.filter(g=>{
  if(deck&&g.deck_id!==deck)return false;
  if(!gameMatchesSearch(g,decks.find(d=>d.id===g.deck_id),$('historySearch').value,friendDisplayNames))return false;
  if(result==='wins'&&!g.won||result==='losses'&&g.won)return false;
  if(period!=='all'){const date=toDate(g.played_at);if(!date||date>localToday)return false;if(period==='30'&&date<cutoff)return false;if(period==='year'&&date.getFullYear()!==today.getFullYear())return false}
  return true;
 });
}
function stat(label,value){const box=el('div');box.className='stat';box.append(el('strong',String(value)),el('span',label));return box}
function renderBestDeck(displayGames){
 const host=$('bestDeck');host.replaceChildren();
 const best=selectBestDeck(decks,displayGames,ledgerSettings.best_deck_min_games);
 if(!best){const empty=el('div','Play at least '+ledgerSettings.best_deck_min_games+' games with an active deck in this timeframe to qualify for Best Deck.');empty.className='best-deck-empty';host.append(empty);return}
 const rate=(100*best.wins/best.games).toFixed(1)+'%';
 const card=el('div');card.className='best-deck-card';
 const artwork=el('div');artwork.className='best-deck-art';artwork.setAttribute('aria-hidden','true');
 const content=el('div');content.className='best-deck-content';
 const label=el('span','★ Best deck');label.className='best-deck-label';
 const name=el('strong',best.deck.name);name.className='best-deck-name';
 const commander=el('span',best.deck.commander);commander.className='best-deck-commander';
 const winrate=el('strong',rate+' win rate');winrate.className='best-deck-rate';
 const record=el('span',best.wins+' wins in '+best.games+' games');record.className='best-deck-record';
 content.append(label,name,commander,winrate,record);card.append(artwork,content);host.append(card);
 statGames.bind(card,best.deck.name,()=>matchingGames(game=>game.deck_id===best.deck.id));
 const commanderName=best.deck.commander.trim();
 if(commanderName)getCommanderArtwork(commanderName).then(url=>{
  if(card.isConnected&&url){artwork.style.backgroundImage='url("'+url+'")';ledgerArt.attach(card,artwork,{slot:'best-deck',commander:commanderName,url,title:best.deck.name})}
 }).catch(()=>{});
}
function mostCommon(values){
 const counts=new Map();for(const value of values){const key=String(value||'').trim();if(key)counts.set(key,(counts.get(key)||0)+1)}
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
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
 statGames.bind(card,deck.name,()=>matchingGames(game=>game.deck_id===deck.id));
 const name=deck.commander;
 if(name)getCommanderArtwork(name).then(url=>{if(card.isConnected&&url){art.style.backgroundImage='url("'+url+'")';ledgerArt.attach(card,art,{slot:'most-played-deck',commander:name,url,title:deck.name})}}).catch(()=>{});
}
function renderExtraStats(visibleGames){
 const host=$('statInsights'),nemesis=$('nemesisCommander');if(!host||!nemesis)return;
 host.replaceChildren();nemesis.replaceChildren();
 const stamp=++colorStatsStamp;
 const usageHost=ledgerSettings.show_color_usage?$('colorUsageChart'):null;
 if(usageHost)usageHost.replaceChildren();
 const usageDone=startStatLoading(usageHost,'Loading color combo usage…');
 const stats=decks.filter(deck=>!deck.archived_at).map(deck=>{const played=visibleGames.filter(g=>g.deck_id===deck.id);return {deck,games:played.length,wins:played.filter(g=>g.won).length}}).filter(x=>x.games);
 const most=stats.slice().sort((a,b)=>b.games-a.games||b.wins-a.wins)[0];
 featuredStat($('mostPlayedDeck'),most?.deck,'★ Most played deck',most?most.games+' games played':'',most?most.wins+' wins · '+(most.games-most.wins)+' losses · '+(100*most.wins/most.games).toFixed(1)+'% win rate':'');
 const losses=visibleGames.filter(g=>!g.won);
 const opponents=losses.map(g=>Array.isArray(g.players)&&Number.isInteger(g.winner_player)&&g.winner_player>0?g.players[g.winner_player]:null).filter(Boolean);
 const topCommander=mostCommon(opponents.map(p=>p.commander));
 const topPlayer=mostCommon(opponents.map(p=>p.name).filter(n=>!isGenericOpponentName(n)));
 const cardData=[
  ['Most played color','Calculating…','Across your played decks'],
  ['Strongest Color','Calculating…','Based on your deck colors'],
  ['Rival Color Combo',opponents.length?'Calculating…':'No recorded losses',''],
  ['Rival Player',topPlayer?.[0]||'No named opponents',topPlayer?topPlayer[1]+' losses':'']
 ];
 const cards=cardData.map(([label,value,detail])=>{const card=el('div');card.className='insight-stat';card.append(el('span',label),el('strong',value));const small=el('small',detail);card.append(small);host.append(card);return card});
 $('rivalPlayerSlot').replaceChildren(cards[3]);$('rivalColorSlot').replaceChildren(cards[2]);
 if(topPlayer)statGames.bind(cards[3],'Losses to '+topPlayer[0],()=>matchingGames(game=>String(winnerOf(game)?.name||'').trim()===topPlayer[0]));
 if(topCommander){
  const card=el('div');card.className='best-deck-card';
  const art=el('div');art.className='best-deck-art';art.setAttribute('aria-hidden','true');
  const content=el('div');content.className='best-deck-content';
  for(const [tag,value,cls] of [['span','★ Rival Commander','best-deck-label'],['strong',topCommander[0],'best-deck-name'],['strong',topCommander[1]+' losses','best-deck-rate'],['span','Against this commander','best-deck-record']]){const node=el(tag,value);node.className=cls;content.append(node)}
  card.append(art,content);nemesis.append(card);
  statGames.bind(card,'Losses to '+topCommander[0],()=>matchingGames(game=>String(winnerOf(game)?.commander||'').trim()===topCommander[0]));
  const name=topCommander[0];
  if(name)getCommanderArtwork(name).then(url=>{if(card.isConnected&&url){art.style.backgroundImage='url("'+url+'")';ledgerArt.attach(card,art,{slot:'rival-commander',commander:name,url,title:name})}}).catch(()=>{});
 }else{const empty=el('div','No recorded losses to named commanders yet.');empty.className='best-deck-empty';nemesis.append(empty)}
 const gameDecks=visibleGames.map(g=>decks.find(d=>d.id===g.deck_id));
 const colorDone=cards.slice(0,2).map(card=>{const value=card.querySelector('strong');value.replaceChildren();return startStatLoading(value,'Loading color stats…')});
 const rivalValue=cards[2].querySelector('strong');rivalValue.replaceChildren();const rivalDone=startStatLoading(rivalValue,'Loading rival colors…');
 Promise.all(gameDecks.map(d=>d?commanderColors(d.commander):Promise.resolve(null))).then(ids=>{
  if(stamp!==colorStatsStamp)return;
  const combo=new Map();let missing=0;
  ids.forEach((code,i)=>{if(code===null){missing++;return}const data=combo.get(code)||{games:0,wins:0};data.games++;if(visibleGames[i].won)data.wins++;combo.set(code,data)});
  if(ledgerSettings.show_color_usage)renderColorUsage($('colorUsageChart'),combo,visibleGames.length,missing,ledgerSettings.color_usage_combos,ledgerSettings.best_deck_min_games);
  for(const item of $('colorUsageChart').querySelectorAll('.color-usage-item'))statGames.bind(item,'Color usage · '+(item.dataset.colorCombo||'Colorless'),()=>colorGames(item.dataset.colorCombo));
  const top=selectMostPlayedColor(combo);
  const colorStrong=cards[0].querySelector('strong'),colorSmall=cards[0].querySelector('small');
  if(top){statGames.bind(cards[0],'Most played color · '+(top[0]||'Colorless'),()=>colorGames(top[0]));manaIdentity(colorStrong,top[0]);colorSmall.textContent=top[1].games+' games'+(missing?' · '+missing+' unavailable':'')}else{colorStrong.textContent=missing?'Color data unavailable':'No games yet';colorSmall.textContent=''}
  const best=selectStrongestColor(combo,ledgerSettings.best_deck_min_games);
  const bestStrong=cards[1].querySelector('strong'),bestSmall=cards[1].querySelector('small');
  if(best){statGames.bind(cards[1],'Strongest Color · '+(best[0]||'Colorless'),()=>colorGames(best[0]));manaIdentity(bestStrong,best[0]);bestSmall.textContent=(100*best[1].wins/best[1].games).toFixed(1)+'% win rate · '+best[1].wins+' wins in '+best[1].games+' games'}else{bestStrong.textContent=missing?'Color data unavailable':'No qualifying color combo';bestSmall.textContent='Minimum '+ledgerSettings.best_deck_min_games+' games in this timeframe'}
 }).catch(()=>{if(stamp===colorStatsStamp){cards[0].querySelector('strong').textContent='Color data unavailable';cards[1].querySelector('strong').textContent='Color data unavailable';if(ledgerSettings.show_color_usage)$('colorUsageChart').textContent='Color usage is unavailable. Please try again.'}}).finally(()=>{colorDone.forEach(done=>done());usageDone()});
 Promise.all(opponents.map(p=>commanderColors(p.commander))).then(ids=>{
  if(stamp!==colorStatsStamp)return;
  const top=mostCommon(ids.filter(x=>x!==null)),strong=cards[2].querySelector('strong'),small=cards[2].querySelector('small');
  if(top){statGames.bind(cards[2],'Losses to '+(top[0]||'Colorless'),()=>colorGames(top[0],true));manaIdentity(strong,top[0]);small.textContent=top[1]+' losses'}
  else{strong.textContent=ids.length?'Color data unavailable':'No recorded losses';small.textContent=''}
 }).catch(()=>{if(stamp===colorStatsStamp)cards[2].querySelector('strong').textContent='Color data unavailable'}).finally(rivalDone);
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

function renderWinrateTrend(){ledgerTrend.render()}

function renderCompactGame(g){
 const deck=decks.find(d=>d.id===g.deck_id);
   const item=el('article');item.className='compact-game '+(g.won?'compact-game-win':'compact-game-loss');
   const row=el('div');row.className='compact-game-row';
   const date=el('span',g.played_at);date.className='compact-game-date';
   const deckArt=el('div');deckArt.className='compact-game-art';deckArt.setAttribute('aria-hidden','true');row.append(deckArt);
   if(deck?.commander){const artName=deck.commander.trim(),image=el('div');image.className='compact-game-art-image';deckArt.append(image);ledgerArt.watch(image,{slot:'compact-history',commander:artName});if(artName)getCommanderArtwork(artName).then(url=>{if(image.isConnected&&url)image.style.backgroundImage='url("'+url+'")'}).catch(()=>{})}
   const deckName=el('strong');deckName.append(historyDeckTitle(deck?.name||'Deleted deck',deck?.id,!!user));deckName.className='compact-game-deck-title';
   const players=el('span');players.className='compact-game-players';
   const playerNames=Array.isArray(g.players)&&g.players.length
    ?g.players.map((p,i)=>gamePlayerDisplayName(p,friendDisplayNames,'Player '+(i+1)))
    :['You',...(Array.isArray(g.opponents)?g.opponents:[])];
   playerNames.forEach((name,index)=>{if(index)players.append(document.createTextNode(' · '));players.append(markHistoryPlayer(el('span',name),g,index));if(index)players.append(historyFriendDeckSlot(g,index,true))});
   players.title=playerNames.join(', ');
   const info=el('div');info.className='compact-game-info';const outcome=el('span',g.won?'Win':'Loss');outcome.className='compact-game-outcome';info.append(date,deckName,players);const edit=el('button',user?'Edit':'Sign in to edit');edit.type='button';edit.className='compact-game-edit';edit.setAttribute('aria-label','Edit game from '+g.played_at+' with '+(deck?.name||'Deleted deck'));edit.onclick=()=>editGame(g);const actions=el('div');actions.className='compact-game-actions';edit.textContent='Edit';actions.append(edit);if(user){const remove=el('button','Delete');remove.type='button';remove.className='compact-game-delete';remove.setAttribute('aria-label','Delete game from '+g.played_at+' with '+(deck?.name||'Deleted deck'));remove.onclick=()=>deleteGame(g,remove);actions.append(remove)}row.append(info,outcome,actions);item.append(row);return item;
}

function render(){
 statGames.refresh();
 const shareLink=$('shareLedgerLink');if(shareLink){const shareParams=new URLSearchParams({period:$('statsDatePreset').value});if($('statsDatePreset').value==='custom'){shareParams.set('start',$('statsDateStart').value);shareParams.set('end',$('statsDateEnd').value)}shareLink.href='./share-my-ledger.html?'+shareParams;}
 const visibleGames=calendarFilteredGames();
 const historyVisibleGames=filteredGames().filter(g=>visibleGames.includes(g));
 const sortedHistoryGames=[...historyVisibleGames].sort((a,b)=>$('historyDateSort').value==='oldest'?a.played_at.localeCompare(b.played_at)||String(a.id).localeCompare(String(b.id)):b.played_at.localeCompare(a.played_at)||String(b.id).localeCompare(String(a.id)));
 const pageSize=Number($('historyPageSize').value)||10;
 const pageCount=Math.max(1,Math.ceil(sortedHistoryGames.length/pageSize));
 historyPage=Math.max(1,Math.min(historyPage,pageCount));
 const historyGames=sortedHistoryGames.slice((historyPage-1)*pageSize,historyPage*pageSize);
 // Visible history and statistics share batched card metadata; off-page players wait.
 window.commandLedgerPrefetchCommanders([
  ...historyGames.map(game=>decks.find(deck=>deck.id===game.deck_id)?.commander),
  ...decks.map(deck=>deck.commander),
  ...(historyView==='cards'?historyGames.flatMap(game=>Array.isArray(game.players)?game.players.map(player=>player.commander):game.opponents||[]):[]),
  ...visibleGames.filter(game=>!game.won).map(game=>Array.isArray(game.players)&&Number.isInteger(game.winner_player)&&game.winner_player>0?game.players[game.winner_player]?.commander:null)
 ]);
 renderWinrateTrend(visibleGames);
 renderBestDeck(visibleGames);
 renderExtraStats(visibleGames);
 renderAdditionalLedgerStats($('ledgerAdditionalStats'),{games:visibleGames,allGames:games,decks,names:friendDisplayNames,onGames:(host,title,predicate)=>statGames.bind(host,title,()=>matchingGames(predicate)),onArtwork:(image,box,url,deck)=>ledgerArt.attach(box,image,{slot:'deck:'+deck.id,commander:deck.commander,url,title:deck.name,defaultFrame:{x:50,y:30,zoom:1}})});
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
  line.append(dot,el('span',label),el('strong',String(value)));legend.append(line);statGames.bind(line,label,()=>matchingGames(game=>kind==='win'?game.won:!game.won));
 }
 const pieMain=el('div');pieMain.className='stats-pie-main';pieMain.append(donut,legend);
 const total=el('div');total.className='stats-games-total';total.append(el('strong',String(visibleGames.length)),el('span','Total games played'));
 legend.prepend(total);pieCard.append(pieMain);summary.append(pieCard);
 statGames.bind(total,'All games',()=>calendarFilteredGames());
 if(user&&ledgerSettings.enable_stat_games){
  donut.setAttribute('role','group');statGames.bind(donut,'All games',()=>calendarFilteredGames());
  const resultAt=event=>{const rect=donut.getBoundingClientRect();return pieSegmentAt(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height,rate)};
  donut.onpointermove=event=>{if(event.pointerType==='touch')return;const result=resultAt(event);if(result==='wins'||result==='losses'){donut.dataset.hoverResult=result;donut.title='View '+result}else{delete donut.dataset.hoverResult;donut.title='View all games'}};
  donut.onpointerleave=()=>{delete donut.dataset.hoverResult;donut.removeAttribute('title')};
  donut.onclick=event=>{if(event.target.closest('button'))return;const result=resultAt(event);if(!result)return;statGames.open(result==='all'?'All games':result==='wins'?'Wins':'Losses',()=>matchingGames(game=>result==='all'||(result==='wins'?game.won:!game.won)))};
  for(const [index,result]of [[1,'wins'],[2,'losses']]){const row=legend.children[index];row.addEventListener('pointerenter',()=>donut.dataset.hoverResult=result);row.addEventListener('pointerleave',()=>delete donut.dataset.hoverResult);row.addEventListener('focusin',()=>donut.dataset.hoverResult=result);row.addEventListener('focusout',()=>delete donut.dataset.hoverResult)}
 }

 statGames.bind(document.querySelector('.winrate-trend .ledger-trend-controls'),'Win rate over time',()=>{const state=ledgerTrend.state();return filterTrendGames(games,rankingRange(state.period,state.start,state.end))},()=>{const state=ledgerTrend.state();return rankingRange(state.period,state.start,state.end).label},{buttonOnly:true,label:'View games'});
 $('statisticsSection').classList.toggle('stat-games-enabled',!!user&&ledgerSettings.enable_stat_games);
 applyLedgerVisibility($('statisticsSection'),ledgerSettings);
 const byDeck=$('deckStats');byDeck.replaceChildren();byDeck.className='deck-stats-carousel';
 const search=($('deckStatsSearch')?.value||'').trim().toLowerCase();
 const deckStats=new Map();
 for(const game of visibleGames){const stats=deckStats.get(game.deck_id)||{games:0,wins:0,last:null};stats.games++;if(game.won)stats.wins++;if(!stats.last||game.played_at>stats.last)stats.last=game.played_at;deckStats.set(game.deck_id,stats)}
 const matchingDecks=sortDecksForDisplay(decks.filter(d=>!d.archived_at&&deckStats.has(d.id)&&(!search||(d.name||'').toLowerCase().includes(search)||(d.commander||'').toLowerCase().includes(search))),deckStats,$('ledgerDeckSort').value,$('ledgerDeckDirection').value);
 $('deckStatsEmpty').hidden=!!matchingDecks.length||!search;
 for(const deck of matchingDecks){
  const played=visibleGames.filter(g=>g.deck_id===deck.id),wins=played.filter(g=>g.won).length;
  const rate=played.length?(wins/played.length*100).toFixed(1)+'%':'—';
  const card=el('div');card.className='deck-stats-card';const deckLink=el('a');deckLink.className='ledger-deck-art-link';deckLink.href='./deck.html?id='+encodeURIComponent(deck.id);card.append(deckLink);
  deckLink.setAttribute('aria-label',deck.name+', '+played.length+' games, '+(played.length?rate+' win rate':'no games')+'. View deck profile');
  const artwork=el('div');artwork.className='deck-stats-art';artwork.setAttribute('aria-hidden','true');
  const content=el('div');content.className='deck-stats-content';
  const name=el('strong',deck.name);name.className='deck-stats-name';
  const commander=el('span',deck.commander);commander.className='deck-stats-commander';
  const bottom=el('div');bottom.className='deck-stats-bottom';
  const percentage=el('div',rate);percentage.className='deck-stats-rate';percentage.append(el('small','Win rate'));
  const record=el('span',played.length?wins+' wins · '+(played.length-wins)+' losses':'No games yet');record.className='deck-stats-record';
  statGames.bind(record,deck.name,()=>matchingGames(game=>game.deck_id===deck.id));statGames.bind(percentage,deck.name,()=>matchingGames(game=>game.deck_id===deck.id));
  bottom.append(percentage,record);content.append(name,commander,bottom);card.append(artwork,content);byDeck.append(card);
  const commanderName=deck.commander.trim();
  if(commanderName)getCommanderArtwork(commanderName).then(url=>{
   if(card.isConnected&&url){artwork.style.backgroundImage='url("'+url+'")';ledgerArt.attach(card,artwork,{slot:'deck:'+deck.id,commander:commanderName,url,title:deck.name})}
  }).catch(()=>{});
 }
 if(!decks.length)byDeck.append(el('p','Import a deck first to start tracking.'));
 const history=$('history');history.replaceChildren();history.classList.toggle('history-compact',historyView==='compact');
 const pagination=$('historyPagination');pagination.replaceChildren();
 $('historyCount').textContent=historyVisibleGames.length+' of '+games.length+' games match your filters';
 if(!historyVisibleGames.length){history.append(el('p',games.length?'No games match these filters.':'No games recorded yet.'));return}

 const goToPage=page=>{historyPage=page;render();$('gameHistorySection').scrollIntoView({block:'start',behavior:'smooth'})};
 if(pageCount>1){
  const pageButton=(label,page,disabled=false,current=false)=>{const b=el('button',label);b.type='button';b.disabled=disabled;if(current)b.setAttribute('aria-current','page');b.onclick=()=>goToPage(page);pagination.append(b)};
  pageButton('‹',historyPage-1,historyPage===1);
  const pageNumbers=new Set([1,pageCount]);for(let p=Math.max(1,historyPage-2);p<=Math.min(pageCount,historyPage+2);p++)pageNumbers.add(p);
  let previous=0;for(const page of [...pageNumbers].sort((a,b)=>a-b)){if(previous&&page>previous+1)pagination.append(el('span','…'));pageButton(String(page),page,false,page===historyPage);previous=page}
  pageButton('›',historyPage+1,historyPage===pageCount);
 }
 for(const g of historyGames){
  const deck=decks.find(d=>d.id===g.deck_id);
  if(historyView==='compact'){history.append(renderCompactGame(g));continue}
  const record=el('article');record.className='game-record';
  const header=el('div');header.className='game-record-header';
  const heading=el('div'),deckHeading=el('strong');deckHeading.append(document.createTextNode((g.won?'Win':'Loss')+' · '),historyDeckTitle(deck?.name||'Deleted deck',deck?.id,!!user));heading.append(deckHeading,el('div',g.played_at));
  const edit=el('button',user?'Edit':'Sign in to edit');edit.type='button';edit.onclick=()=>editGame(g);
  const remove=el('button','Delete');remove.type='button';remove.hidden=!user;
  remove.onclick=()=>deleteGame(g,remove);
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
    info.append(tags,markHistoryPlayer(el('strong',gamePlayerDisplayName(p,friendDisplayNames,'Player '+(i+1))),g,i));
    const commander=el('a',p.commander||'Unknown commander');commander.href=scryfallLink(p.commander||'');commander.target='_blank';commander.rel='noopener noreferrer';info.append(commander);if(i)info.append(historyFriendDeckSlot(g,i));
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
 if(user)historyLinker.hydrate(history,historyGames);
}
$('gameForm').onsubmit=async e=>{
 e.preventDefault();if(!user||savingGame)return;
 const deck_id=$('deck').value;if(!decks.some(d=>d.id===deck_id)){message('Select one of your decks.');return}
 const played_at=$('date').value;
 if([...document.querySelectorAll('.player-row')].some(row=>row.friendLoading)){message('Wait for the friend deck choices to finish loading.');return}
 const players=[...document.querySelectorAll('.player-row')].map((row,i)=>({...gamePlayerSnapshot(row),...(i===0?{name:'You'}:{})}));
 if(!played_at||players.length<2||players.length>6||players.some(p=>!p.commander)){message('Enter a date and select a commander for everyone. Player names are optional.');return}
 const taggedIds=players.map(p=>p.friend_id).filter(Boolean);if(new Set(taggedIds).size!==taggedIds.length){message('Tag each friend only once in a game.');return}
 const opponentInputs=[...document.querySelectorAll('.player-row')].slice(1).map(r=>r.querySelector('.player-commander'));
 if(opponentInputs.some(input=>input.getSelectedCommander?.()!==input.value.trim())){message('Select each opponent commander from the Scryfall suggestions.');return}
 const first_player=Number($('firstPlayer').value),winner_player=Number($('winnerPlayer').value);
 if(!Number.isInteger(first_player)||!Number.isInteger(winner_player)||first_player<0||winner_player<0||first_player>=players.length||winner_player>=players.length){message('Select who went first and who won.');return}
 const button=$('save');button.disabled=true;savingGame=true;message('Saving game…');
 const payload={deck_id,played_at,won:winner_player===0,opponents:players.slice(1).map(p=>p.commander),players,first_player,winner_player,notes:$('notes').value.trim()};
 try{
  const r=editingGameId?await sb.from('personal_games').update(payload).eq('id',editingGameId).eq('owner_id',user.id):await sb.from('personal_games').insert({...payload,owner_id:user.id});
  if(r.error){message('Save failed: '+r.error.message+(r.error.message.includes('column')?' — Please contact the app administrator.':''));return}
  savingGame=false;resetEditor();await refresh();document.dispatchEvent(new Event('onboarding-progress'));
 }catch(error){message('Save failed: '+error.message)}finally{button.disabled=false;savingGame=false}

};

window.commandLedgerLoading.track(load(),'Loading your Ledger…').catch(e=>message('Unable to load Ledger: '+e.message));
if(location.hash==='#gameForm'||location.hash==='#gameEditor'){
 setEditorOpen(true);
 requestAnimationFrame(()=>$('deck').focus());
}
window.addEventListener('hashchange',()=>{
 if(location.hash==='#gameForm'||location.hash==='#gameEditor')setEditorOpen(true);
});



sb.auth.onAuthStateChange((_event,session)=>{if((session?.user?.id||null)!==(user?.id||null))setTimeout(()=>load().catch(e=>message(e.message)),0)});
