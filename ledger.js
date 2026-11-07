import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
let user=null,decks=[],games=[];
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const message=t=>$('message').textContent=t;
$('date').value=new Date().toLocaleDateString('en-CA');
async function load(){
 const auth=await sb.auth.getUser();user=auth.data.user;
 if(!user){message('Sign in on the home page to use your personal Ledger.');$('save').disabled=true;return}
 const d=await sb.from('decks').select('id,name,commander').eq('owner_id',user.id).order('name');
 if(d.error){message('Unable to load decks: '+d.error.message);return}
 decks=d.data||[];const select=$('deck');select.replaceChildren(el('option','Select your deck'));select.firstChild.value='';
 for(const deck of decks){const o=el('option',deck.name+' — '+deck.commander);o.value=deck.id;select.append(o)}
 await refresh();
}
async function refresh(){
 const r=await sb.from('personal_games').select('id,deck_id,played_at,won,opponents,notes').eq('owner_id',user.id).order('played_at',{ascending:false}).order('id',{ascending:false});
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
 for(const g of games){const deck=decks.find(d=>d.id===g.deck_id);const row=el('div');row.className='entry';const details=el('div');details.append(el('strong',(g.won?'Win':'Loss')+' · '+(deck?.name||'Deleted deck')),el('div',g.played_at));if(g.opponents?.length)details.append(el('div','Opponents: '+g.opponents.join(', ')));if(g.notes)details.append(el('div',g.notes));const remove=el('button','Delete');remove.type='button';remove.onclick=async()=>{if(!confirm('Delete this game record?'))return;remove.disabled=true;const r=await sb.from('personal_games').delete().eq('id',g.id).eq('owner_id',user.id);if(r.error){message('Delete failed: '+r.error.message);remove.disabled=false;return}await refresh()};row.append(details,remove);history.append(row)}
}
$('gameForm').onsubmit=async e=>{
 e.preventDefault();if(!user)return;
 const deck_id=$('deck').value;if(!decks.some(d=>d.id===deck_id)){message('Select one of your decks.');return}
 const played_at=$('date').value,opponents=$('opponents').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,20);
 if(!played_at){message('Choose a game date.');return}
 const button=$('save');button.disabled=true;message('Saving game…');
 const r=await sb.from('personal_games').insert({owner_id:user.id,deck_id,played_at,won:$('result').value==='win',opponents,notes:$('notes').value.trim()});
 button.disabled=false;if(r.error){message('Save failed: '+r.error.message);return}
 $('opponents').value='';$('notes').value='';await refresh();
};
load().catch(e=>message('Unable to load Ledger: '+e.message));
