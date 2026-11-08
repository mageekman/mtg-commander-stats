import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
let user=null,decks=[],games=[],playerCount=4;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const message=t=>$('message').textContent=t;
function drawPlayers(){
 const container=$('playerRows');const old=[...container.querySelectorAll('.player-row')].map(r=>({name:r.querySelector('.player-name').value,commander:r.querySelector('.player-commander').value}));container.replaceChildren();
 for(let i=0;i<playerCount;i++){
  const row=el('div');row.className='player-row';row.append(el('h4',i===0?'Player 1 · You':'Player '+(i+1)));
  const fields=el('div');fields.className='player-fields';
  const nameLabel=el('label','Player name');const name=el('input');name.className='player-name';name.placeholder=i===0?'You':'Player '+(i+1);name.required=i!==0;name.maxLength=80;name.value=old[i]?.name||'';if(i===0){name.value='You';name.readOnly=true}nameLabel.append(name);
  const commanderLabel=el('label',i===0?'Your commander (from selected deck)':'Commander');const commander=el('input');commander.className='player-commander';commander.required=true;commander.maxLength=200;commander.placeholder='Commander name';commander.value=old[i]?.commander||'';if(i===0)commander.readOnly=true;commanderLabel.append(commander);
  fields.append(nameLabel,commanderLabel);row.append(fields);container.append(row);
 }
 const first=$('firstPlayer'),winner=$('winnerPlayer'),previousFirst=first.value,previousWinner=winner.value;first.replaceChildren();winner.replaceChildren();
 for(let i=0;i<playerCount;i++){const label='Player '+(i+1)+(i===0?' (You)':'');for(const select of [first,winner]){const option=el('option',label);option.value=String(i);select.append(option)}}
 first.value=previousFirst&&Number(previousFirst)<playerCount?previousFirst:'0';winner.value=previousWinner&&Number(previousWinner)<playerCount?previousWinner:'0';$('addPlayer').disabled=playerCount>=6;$('removePlayer').disabled=playerCount<=2;
 syncOwnCommander();
}
function syncOwnCommander(){const deck=decks.find(d=>d.id===$('deck').value);const input=$('playerRows').querySelector('.player-commander');if(input)input.value=deck?.commander||''}
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
 syncOwnCommander();await refresh();
}
async function refresh(){
 const r=await sb.from('personal_games').select('id,deck_id,played_at,won,opponents,notes,players,first_player,winner_player').eq('owner_id',user.id).order('played_at',{ascending:false}).order('id',{ascending:false});
 if(r.error){message('Ledger setup needed: run supabase-personal-ledger.sql in your Supabase SQL Editor. '+r.error.message);$('save').disabled=true;return}
 games=r.data||[];message('Your games are saved privately to your account.');render();
}
function stat(label,value){const box=el('div');box.className='stat';box.append(el('strong',String(value)),el('span',label));return box}
function render(){
 const wins=games.filter(g=>g.won).length;
 const summary=$('summary');summary.replaceChildren(stat('Games',games.length),stat('Wins',wins),stat('Losses',games.length-wins),stat('Win rate',games.length?(wins/games.length*100).toFixed(1)+'%':'0%'));
 const byDeck=$('deckStats');byDeck.replaceChildren();
 for(const deck of decks){const list=games.filter(g=>g.deck_id===deck.id),w=list.filter(g=>g.won).length;const line=el('div');line.className='entry';line.append(el('span',deck.name),el('span',list.length+' games · '+w+' wins · '+(list.length?(w/list.length*100).toFixed(1):'0')+'%'));byDeck.append(line)}
 if(!decks.length)byDeck.append(el('p','Import a deck first to start tracking.'));
 const history=$('history');history.replaceChildren();
 if(!games.length){history.append(el('p','No games recorded yet.'));return}
 for(const g of games){const deck=decks.find(d=>d.id===g.deck_id);const row=el('div');row.className='entry';const details=el('div');details.append(el('strong',(g.won?'Win':'Loss')+' · '+(deck?.name||'Deleted deck')),el('div',g.played_at));if(Array.isArray(g.players)&&g.players.length){const players=el('div','Table: '+g.players.map((p,i)=>(i+1)+'. '+p.name+' ('+p.commander+')').join(' · '));details.append(players);if(Number.isInteger(g.first_player))details.append(el('div','Went first: '+(g.players[g.first_player]?.name||'Unknown')));if(Number.isInteger(g.winner_player))details.append(el('div','Winner: '+(g.players[g.winner_player]?.name||'Unknown')))}else if(g.opponents?.length)details.append(el('div','Opponents: '+g.opponents.join(', ')));if(g.notes)details.append(el('div',g.notes));const remove=el('button','Delete');remove.type='button';remove.onclick=async()=>{if(!confirm('Delete this game record?'))return;remove.disabled=true;const r=await sb.from('personal_games').delete().eq('id',g.id).eq('owner_id',user.id);if(r.error){message('Delete failed: '+r.error.message);remove.disabled=false;return}await refresh()};row.append(details,remove);history.append(row)}
}
$('gameForm').onsubmit=async e=>{
 e.preventDefault();if(!user)return;
 const deck_id=$('deck').value;if(!decks.some(d=>d.id===deck_id)){message('Select one of your decks.');return}
 const played_at=$('date').value;
 const players=[...document.querySelectorAll('.player-row')].map((row,i)=>({name:i===0?'You':row.querySelector('.player-name').value.trim(),commander:row.querySelector('.player-commander').value.trim()}));
 if(!played_at||players.length<2||players.length>6||players.some(p=>!p.name||!p.commander)){message('Enter a date, player names, and commanders for everyone.');return}
 const first_player=Number($('firstPlayer').value),winner_player=Number($('winnerPlayer').value);
 if(!Number.isInteger(first_player)||!Number.isInteger(winner_player)||first_player<0||winner_player<0||first_player>=players.length||winner_player>=players.length){message('Select who went first and who won.');return}
 const button=$('save');button.disabled=true;message('Saving game…');
 const r=await sb.from('personal_games').insert({owner_id:user.id,deck_id,played_at,won:winner_player===0,opponents:players.slice(1).map(p=>p.commander),players,first_player,winner_player,notes:$('notes').value.trim()});
 button.disabled=false;if(r.error){message('Save failed: '+r.error.message+(r.error.message.includes('column')?' — Run supabase-ledger-players-migration.sql first.':''));return}
 $('notes').value='';playerCount=4;drawPlayers();await refresh();
};
load().catch(e=>message('Unable to load Ledger: '+e.message));
