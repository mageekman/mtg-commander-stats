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

for(const id of ['historyDeckFilter','historyPeriodFilter','historyResultFilter'])$(id).addEventListener('change',render);
let historyView='cards';
function setHistoryView(view){
 historyView=view==='compact'?'compact':'cards';
 $('historyCardsView').setAttribute('aria-pressed',String(historyView==='cards'));
 $('historyCompactView').setAttribute('aria-pressed',String(historyView==='compact'));
 render();
}
$('historyCardsView').onclick=()=>setHistoryView('cards');
$('historyCompactView').onclick=()=>setHistoryView('compact');

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
 const ranked=decks.map(deck=>{
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
   const response=await fetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name.trim()),{headers:{Accept:'application/json'}});
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
function renderExtraStats(visibleGames){
 const deckHost=$('deckInsights'),opponentHost=$('opponentInsights');if(!deckHost||!opponentHost)return;
 deckHost.replaceChildren();opponentHost.replaceChildren();
 const ranked=mostCommon(visibleGames.map(g=>g.deck_id));
 const mostDeck=decks.find(d=>d.id===ranked?.[0]);
 const losses=visibleGames.filter(g=>!g.won);
 const defeatedBy=losses.map(g=>{
  if(!Array.isArray(g.players)||!Number.isInteger(g.winner_player)||g.winner_player<=0)return null;
  return g.players[g.winner_player]||null;
 }).filter(Boolean);
 const commander=mostCommon(defeatedBy.map(p=>p.commander));
 const player=mostCommon(defeatedBy.map(p=>p.name).filter(n=>n&&n.toLowerCase()!=='you'));
 const cards=[
  ['Most played deck',mostDeck?.name||'No games yet',ranked?ranked[1]+' games':''],
  ['Most played color','Calculating…','Counted across your played decks'],
  ['Commander you’ve lost to most',commander?.[0]||'No recorded losses',commander?commander[1]+' losses':''],
  ['Player you’ve lost to most',player?.[0]||'No named opponents',player?player[1]+' losses':''],
  ['Color combo you’ve lost to most',defeatedBy.length?'Calculating…':'No recorded losses','']
 ];
 const renderedCards=[];
 for(const [label,value,detail] of cards){const card=el('div');card.className='insight-stat';card.append(el('span',label),el('strong',value));if(detail)card.append(el('small',detail));renderedCards.push(card);(renderedCards.length<=2?deckHost:opponentHost).append(card)}
 const featured=renderedCards[0];
 if(mostDeck&&ranked){
  const played=visibleGames.filter(g=>g.deck_id===mostDeck.id);
  const wins=played.filter(g=>g.won).length;
  const rate=(100*wins/played.length).toFixed(1)+'%';
  featured.className='best-deck-card most-played-card';
  featured.replaceChildren();
  const artwork=el('div');artwork.className='best-deck-art';artwork.setAttribute('aria-hidden','true');
  const content=el('div');content.className='best-deck-content';
  const label=el('span','★ Most played deck');label.className='best-deck-label';
  const name=el('strong',mostDeck.name);name.className='best-deck-name';
  const commanderName=el('span',mostDeck.commander);commanderName.className='best-deck-commander';
  const count=el('strong',played.length+' games played');count.className='best-deck-rate';
  const record=el('span',wins+' wins · '+(played.length-wins)+' losses · '+rate+' win rate');record.className='best-deck-record';
  content.append(label,name,commanderName,count,record);featured.append(artwork,content);
  const commanderArtName=mostDeck.commander.split(' / ')[0].split(' & ')[0].trim();
  if(commanderArtName)getCommanderArtwork(commanderArtName).then(url=>{
   if(featured.isConnected&&url)artwork.style.backgroundImage='url("'+url+'")';
  }).catch(()=>{});
 }else{
  featured.className='best-deck-empty most-played-empty';
  featured.replaceChildren(el('span','Record a game to see your most played deck.'));
 }
 const comboCard=renderedCards[4];
 const comboStamp=++comboStatsStamp;
 if(defeatedBy.length){
  Promise.all(defeatedBy.map(async p=>{
   const parts=String(p.commander||'').split(/\s+\/\s+|\s+&\s+/).map(x=>x.trim()).filter(Boolean);
   if(!parts.length)return null;
   const identities=await Promise.all(parts.map(commanderIdentity));
   if(identities.some(identity=>identity===null))return null;
   return [...new Set(identities.flat())].sort((a,b)=>'WUBRG'.indexOf(a)-'WUBRG'.indexOf(b)).join('');
  })).then(identities=>{
   if(comboStamp!==comboStatsStamp||!comboCard.isConnected)return;
   const known=identities.filter(x=>x!==null),top=mostCommon(known),missing=identities.length-known.length;
   const strong=comboCard.querySelector('strong');strong.replaceChildren();
   const small=comboCard.querySelector('small')||el('small');
   if(!top){strong.textContent='Color data unavailable';small.textContent=missing+' losses could not be checked'}
   else{
    const code=top[0],colorNames={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
    if(code){for(const c of code){const img=el('img');img.src='https://svgs.scryfall.io/card-symbols/'+c+'.svg';img.alt=colorNames[c]+' mana';img.title=colorNames[c];img.width=26;img.height=26;img.style.cssText='width:26px;height:26px;vertical-align:middle;margin-right:5px';strong.append(img)}
     const name=el('span',code.split('').map(c=>colorNames[c]).join(' / '));name.style.cssText='display:block;font-size:14px;margin-top:5px';strong.append(name)
    }else strong.textContent='Colorless';
    small.textContent=top[1]+' losses'+(missing?' · '+missing+' unavailable':'');
   }
   if(!small.isConnected)comboCard.append(small);
  }).catch(()=>{if(comboStamp===comboStatsStamp&&comboCard.isConnected)comboCard.querySelector('strong').textContent='Color data unavailable'});
 }
 const colorCard=renderedCards[1];const names={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
 const stamp=++colorStatsStamp;
 const counted=visibleGames.filter(g=>decks.some(d=>d.id===g.deck_id));
 if(!counted.length){colorCard.querySelector('strong').textContent='No games yet';colorCard.querySelector('small').textContent='';return}
 Promise.all(counted.map(async g=>{
  const deck=decks.find(d=>d.id===g.deck_id);
  const parts=deck.commander.split(/\s+\/\s+|\s+&\s+/).map(x=>x.trim()).filter(Boolean);
  const identities=await Promise.all(parts.map(commanderIdentity));
  if(identities.some(x=>x===null))return null;
  return [...new Set(identities.flat())];
 })).then(results=>{
  if(stamp!==colorStatsStamp||!colorCard.isConnected)return;
  const tally=new Map();let unavailable=0;
  for(const identity of results){if(identity===null){unavailable++;continue}for(const c of identity)tally.set(c,(tally.get(c)||0)+1)}
  const top=[...tally].sort((a,b)=>b[1]-a[1]||'WUBRG'.indexOf(a[0])-'WUBRG'.indexOf(b[0]))[0];
  const strong=colorCard.querySelector('strong'),small=colorCard.querySelector('small');
  strong.replaceChildren();
  if(top){const img=el('img');img.src='https://svgs.scryfall.io/card-symbols/'+top[0]+'.svg';img.alt=names[top[0]]+' mana';img.width=28;img.height=28;img.style.cssText='width:28px;height:28px;vertical-align:middle;margin-right:8px';strong.append(img,document.createTextNode(names[top[0]]));small.textContent=top[1]+' games'+(unavailable?' · '+unavailable+' unavailable':'')}
  else{strong.textContent=unavailable?'Color data unavailable':'Colorless';small.textContent=unavailable?unavailable+' games could not be checked':'No colored decks played'}
 }).catch(()=>{if(stamp===colorStatsStamp&&colorCard.isConnected)colorCard.querySelector('strong').textContent='Color data unavailable'});
}
let colorStatsStamp=0;
let comboStatsStamp=0;
function render(){
 const visibleGames=filteredGames();
 renderBestDeck(visibleGames);
 renderExtraStats(visibleGames);
 const wins=visibleGames.filter(g=>g.won).length;
 const summary=$('summary');summary.replaceChildren();
 const rate=visibleGames.length?(wins/visibleGames.length*100).toFixed(1):'0.0';
 const main=el('div');main.className='stats-main';
 main.append(stat('Games played',visibleGames.length));
 const pieCard=el('div');pieCard.className='stats-pie-card';
 const donut=el('div');donut.className='stats-donut';donut.style.setProperty('--win-percent',rate+'%');
 donut.setAttribute('role','img');donut.setAttribute('aria-label',wins+' wins and '+(visibleGames.length-wins)+' losses');
 const inner=el('div');inner.className='stats-donut-inner';inner.append(el('strong',rate+'%'),el('span','Win rate'));donut.append(inner);
 const legend=el('div');legend.className='stats-pie-legend';
 for(const [kind,label,value] of [['win','Wins',wins],['loss','Losses',visibleGames.length-wins]]){
  const line=el('div');const dot=el('span');dot.className='stats-pie-dot '+kind;
  line.append(dot,el('span',label),el('strong',String(value)));legend.append(line);
 }
 pieCard.append(donut,legend);summary.append(main,pieCard);
 const byDeck=$('deckStats');byDeck.replaceChildren();byDeck.className='deck-stats-grid';
 for(const deck of decks){
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
 $('historyCount').textContent=visibleGames.length+' of '+games.length+' games match your filters';
 if(!visibleGames.length){history.append(el('p',games.length?'No games match these filters.':'No games recorded yet.'));return}
 for(const g of visibleGames){
  const deck=decks.find(d=>d.id===g.deck_id);
  if(historyView==='compact'){
   const item=el('article');item.className='compact-game';
   const row=el('div');row.className='compact-game-row';
   const date=el('span',g.played_at);date.className='compact-game-date';
   const result=el('span',g.won?'Win':'Loss');result.className='compact-game-result '+(g.won?'win':'loss');
   const deckName=el('span',deck?.name||'Deleted deck');deckName.className='compact-game-deck';
   const winner=Array.isArray(g.players)&&Number.isInteger(g.winner_player)?g.players[g.winner_player]:null;
   const winnerName=g.won?'You':winner?.name&&winner.name!=='You'?winner.name:winner?.commander||'Opponent not recorded';
   const winnerText=el('span','Winner: '+winnerName);winnerText.className='compact-game-winner';
   const actions=el('div');actions.className='compact-game-actions';
   const detailsButton=el('button','Details');detailsButton.type='button';detailsButton.setAttribute('aria-expanded','false');
   const details=el('div');details.className='compact-game-details';details.hidden=true;
   detailsButton.onclick=()=>{details.hidden=!details.hidden;detailsButton.setAttribute('aria-expanded',String(!details.hidden));detailsButton.textContent=details.hidden?'Details':'Hide'};
   const editButton=el('button','Edit');editButton.type='button';editButton.onclick=()=>editGame(g);
   const deleteButton=el('button','Delete');deleteButton.type='button';
   deleteButton.onclick=async()=>{if(!confirm('Delete this game record?'))return;deleteButton.disabled=true;const r=await sb.from('personal_games').delete().eq('id',g.id).eq('owner_id',user.id);if(r.error){message('Delete failed: '+r.error.message);deleteButton.disabled=false;return}await refresh()};
   actions.append(detailsButton,editButton,deleteButton);row.append(date,result,deckName,winnerText,actions);item.append(row);
   if(Array.isArray(g.players)&&g.players.length){
    for(const [i,p] of g.players.entries()){const line=el('p',(i===g.winner_player?'🏆 ':'')+(p.name||'Player '+(i+1))+' · '+(p.commander||'Unknown commander')+(i===g.first_player?' · Went first':''));details.append(line)}
   }else if(g.opponents?.length)details.append(el('p','Opponents: '+g.opponents.join(', ')));
   if(g.notes){const note=el('p',g.notes);note.className='history-note';details.append(note)}
   item.append(details);history.append(item);continue;
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
