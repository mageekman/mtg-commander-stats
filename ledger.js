import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
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
  const response=await fetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name.trim()),{headers:{Accept:'application/json'}});
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
    if(!names){controller=new AbortController();const response=await fetch('https://api.scryfall.com/cards/autocomplete?q='+encodeURIComponent(query),{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('Scryfall unavailable');const body=await response.json();names=body.data||[];suggestionCache.set(query.toLowerCase(),names)}
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
 const d=await sb.from('decks').select('id,name,commander').eq('owner_id',user.id).order('name');
 if(d.error){message('Unable to load decks: '+d.error.message);return}
 decks=d.data||[];const select=$('deck');select.replaceChildren(el('option','Select your deck'));select.firstChild.value='';
 for(const deck of decks){const o=el('option',deck.name+' — '+deck.commander);o.value=deck.id;select.append(o)}
 const filter=$('historyDeckFilter');filter.replaceChildren();const all=el('option','All decks');all.value='';filter.append(all);for(const deck of decks){const option=el('option',deck.name+' — '+deck.commander);option.value=deck.id;filter.append(option)}
 const requestedDeck=new URLSearchParams(location.search).get('deck');if(requestedDeck&&decks.some(d=>d.id===requestedDeck))filter.value=requestedDeck;
 syncOwnCommander();await refresh();
}
async function refresh(){
 const r=await sb.from('personal_games').select('id,deck_id,played_at,won,opponents,notes,players,first_player,winner_player').eq('owner_id',user.id).order('played_at',{ascending:false}).order('id',{ascending:false});
 if(r.error){message('Ledger setup needed: run supabase-personal-ledger.sql in your Supabase SQL Editor. '+r.error.message);$('save').disabled=true;return}
 games=r.data||[];message('Your games are saved privately to your account.');render();
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
 editingGameId=null;$('formTitle').textContent='Record a game';$('save').textContent='Save game to cloud';$('cancelEdit').hidden=true;
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

$('historyDeckFilter').addEventListener('change',render);
function stat(label,value){const box=el('div');box.className='stat';box.append(el('strong',String(value)),el('span',label));return box}
function renderBestDeck(){
 const host=$('bestDeck');host.replaceChildren();
 const ranked=decks.map(deck=>{
  const played=games.filter(g=>g.deck_id===deck.id);
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
function render(){
 renderBestDeck();
 const wins=games.filter(g=>g.won).length;
 const summary=$('summary');summary.replaceChildren();
 const rate=games.length?(wins/games.length*100).toFixed(1):'0.0';
 const main=el('div');main.className='stats-main';
 main.append(stat('Total games',games.length),stat('Overall win rate',rate+'%'));
 const pieCard=el('div');pieCard.className='stats-pie-card';
 const donut=el('div');donut.className='stats-donut';donut.style.setProperty('--win-percent',rate+'%');
 donut.setAttribute('role','img');donut.setAttribute('aria-label',wins+' wins and '+(games.length-wins)+' losses');
 const inner=el('div');inner.className='stats-donut-inner';inner.append(el('strong',rate+'%'),el('span','Win rate'));donut.append(inner);
 const legend=el('div');legend.className='stats-pie-legend';
 for(const [kind,label,value] of [['win','Wins',wins],['loss','Losses',games.length-wins]]){
  const line=el('div');const dot=el('span');dot.className='stats-pie-dot '+kind;
  line.append(dot,el('span',label),el('strong',String(value)));legend.append(line);
 }
 pieCard.append(donut,legend);summary.append(main,pieCard);
 const byDeck=$('deckStats');byDeck.replaceChildren();
 for(const deck of decks){const list=games.filter(g=>g.deck_id===deck.id),w=list.filter(g=>g.won).length;const line=el('div');line.className='entry';line.append(el('span',deck.name),el('span',list.length+' games · '+w+' wins · '+(list.length?(w/list.length*100).toFixed(1):'0')+'%'));byDeck.append(line)}
 if(!decks.length)byDeck.append(el('p','Import a deck first to start tracking.'));
 const history=$('history');history.replaceChildren();
 const selectedDeck=$('historyDeckFilter').value;
 const visibleGames=selectedDeck?games.filter(g=>g.deck_id===selectedDeck):games;
 $('historyCount').textContent=visibleGames.length+' of '+games.length+' games'+(selectedDeck?' · '+(decks.find(d=>d.id===selectedDeck)?.name||'Selected deck'):'');
 if(!visibleGames.length){history.append(el('p',games.length?'No games recorded with this deck yet.':'No games recorded yet.'));return}
 for(const g of visibleGames){
  const deck=decks.find(d=>d.id===g.deck_id);
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
 button.disabled=false;if(r.error){message('Save failed: '+r.error.message+(r.error.message.includes('column')?' — Run supabase-ledger-players-migration.sql first.':''));return}
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
