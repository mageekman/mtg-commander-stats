import {createClient} from './vendor/supabase-js.mjs';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
let user=null,decks=[],games=[];
async function loadImport(){
 const status=$('csvImportStatus');
 const auth=await Promise.race([sb.auth.getUser(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Account check timed out. Refresh the page and sign in again.')),12000))]);if(auth.error)throw auth.error;user=auth.data.user;
 if(!user){status.textContent='Please sign in on the home page before importing games.';return}
 status.textContent='Signed in. Loading your decks and existing games…';
 const [deckResult,gameResult]=await Promise.race([Promise.all([
  sb.from('decks').select('id,name,commander').eq('owner_id',user.id),
  sb.from('personal_games').select('deck_id,played_at,won').eq('owner_id',user.id)
 ]),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Loading decks and games timed out. Please refresh and try again.')),15000))]);
 if(deckResult.error||gameResult.error)throw Error('Could not load account data: '+(deckResult.error?.message||gameResult.error?.message));
 decks=deckResult.data||[];games=gameResult.data||[];
 status.textContent=decks.length?'Account loaded. Validating your CSV…':'No existing decks. You can create decks from your CSV during import.';
}
let csvReady=[];
const csvList=value=>String(value||'').split(/\s*;\s*|\s*\|\s*/).map(v=>v.trim()).filter(Boolean);
const csvIndex=(value,players)=>{const v=String(value??'').trim();if(!v)return null;if(/^\d+$/.test(v)){const n=Number(v);return n>=1&&n<=players.length?n-1:null}const i=players.findIndex(p=>csvKey(p.name)===csvKey(v)||csvKey(p.commander)===csvKey(v));return i<0?null:i};
function parseCsv(text){
 const rows=[],row=[];let cell='',quoted=false;
 text=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(ch===','&&!quoted){row.push(cell);cell=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row.slice());row.length=0;cell=''}
  else cell+=ch;
 }
 if(quoted)throw Error('Unclosed quoted field in CSV.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
function csvDate(value){
 const s=String(value||'').trim();
 let y,m,d;
 if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){[y,m,d]=s.split('-').map(Number)}
 else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){[m,d,y]=s.split('/').map(Number)}
 else return null;
 const dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):null;
}
const csvKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function csvField(headers,aliases){const keys=aliases.map(csvKey);return headers.findIndex(h=>keys.includes(csvKey(h)))}
function csvResult(s){
 const v=String(s||'').trim().toLowerCase();
 if(['win','won','w','yes','true','1','victory'].includes(v))return true;
 if(['loss','lost','lose','l','no','false','0','defeat'].includes(v))return false;
 return null;
}
function editDistance(a,b){
 const prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let diagonal=prev[0];prev[0]=i;
  for(let j=1;j<=b.length;j++){
   const above=prev[j];
   prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));
   diagonal=above;
  }
 }
 return prev[b.length];
}
function csvSimilarity(a,b){
 a=csvKey(a);b=csvKey(b);
 if(!a||!b)return 0;
 if(a===b)return 1;
 const distance=editDistance(a,b);
 let score=1-distance/Math.max(a.length,b.length);
 if(Math.min(a.length,b.length)>=5&&(a.includes(b)||b.includes(a)))score=Math.max(score,.83);
 return score;
}
function csvDeckCandidates(name){
 return decks.map(deck=>{
  const aliases=[deck.name,deck.commander,...String(deck.commander||'').split(/\s*\/\s*|\s*&\s*/)];
  return {deck,score:Math.max(...aliases.map(alias=>csvSimilarity(name,alias)))};
 }).sort((a,b)=>b.score-a.score);
}
function csvMatchDeck(name){
 const ranked=csvDeckCandidates(name),top=ranked[0],second=ranked[1];
 if(!top)return {deck:null,needsReview:true};
 const exact=top.score===1&&(!second||second.score<1);
 const confident=top.score>=.92&&(!second||top.score-second.score>=.12);
 return {deck:top.score>=.55?top.deck:null,needsReview:!exact&&!confident};
}
async function validateSelectedCsv(){
 const chosen=$('csvFile').files?.[0];
 if(chosen)$('csvImportStatus').textContent='Selected '+chosen.name+'. Reading and validating CSV…';
 csvReady=[];$('confirmCsvImport').hidden=true;
 const preview=$('csvImportPreview');preview.replaceChildren();
 const file=$('csvFile').files?.[0];if(!file)return;
 const status=$('csvImportStatus');
 if(!user){status.textContent='Your account is still loading or you are signed out. Wait for the Ready message above, then select the CSV again.';return}
 try{
  if(file.size>3_000_000)throw Error('CSV file is too large (3 MB maximum).');
  const rows=parseCsv(await file.text());
  if(rows.length<2)throw Error('CSV must have a header row and at least one game.');
  if(rows.length>2001)throw Error('Please import up to 2,000 games at a time.');
  const headers=rows.shift();
  const dateCol=csvField(headers,['date','played at','game date','date played','match date']);
  const deckCol=csvField(headers,['deck','deck name','my deck','your deck','commander','my commander','my commander name']);
  const commanderCol=csvField(headers,['commander','my commander','commander name','my commander name']);
  const playerCol=csvField(headers,['player','my name','your name','player name','pilot']);
  const firstCol=csvField(headers,['first player','who went first','went first','first','starting player','first turn','turn order']);
  const winnerCol=csvField(headers,['winner','winning player','who won','winning commander']);
  const opponentNamesCol=csvField(headers,['opponent names','opponent players','players','player names']);
  const resultCol=csvField(headers,['result','outcome','win/loss','win loss','won','win','victory']);
  const notesCol=csvField(headers,['notes','note','comments']);
  const opponentsCol=csvField(headers,['opponents','opponent commanders','other commanders','opponent decks','enemy commanders']);
  if(dateCol<0||deckCol<0||(resultCol<0&&winnerCol<0))throw Error('Required columns: Date, Deck or Commander, and Result or Winner. Download the template for an example.');
  const existing=new Set(games.map(g=>[g.played_at,g.deck_id,g.won?'win':'loss'].join('|')));
  const results=rows.map((row,i)=>{
   const rawDeck=String(row[deckCol]||'').trim(),commander=String(commanderCol>=0?row[commanderCol]||'':'').trim()||rawDeck;
   const date=csvDate(row[dateCol]),match=csvMatchDeck(rawDeck),opponents=opponentsCol>=0?csvList(row[opponentsCol]):[];
   const opponentNames=opponentNamesCol>=0?csvList(row[opponentNamesCol]):[];
   const players=[{name:String(playerCol>=0?row[playerCol]||'':'').trim()||'You',commander},...opponents.map((c,j)=>({name:opponentNames[j]||'Opponent '+(j+1),commander:c}))];
   const firstPlayer=firstCol>=0?csvIndex(row[firstCol],players):null;
   const winnerPlayer=winnerCol>=0?csvIndex(row[winnerCol],players):null;
   const explicitResult=resultCol>=0?csvResult(row[resultCol]):null;
   const won=explicitResult!==null?explicitResult:winnerPlayer!==null?winnerPlayer===0:null;
   return {line:i+2,date,deck:match.deck,needsReview:match.needsReview,won,error:'',opponents,players,firstPlayer,winnerPlayer:winnerPlayer!==null?winnerPlayer:won===true?0:null,notes:notesCol>=0?String(row[notesCol]||'').trim():'',rawDeck,commander,createDeck:!match.deck,deckName:rawDeck};
  });
  const table=el('table');table.className='csv-import-table';
  const head=el('tr');for(const title of ['Row','Date','CSV deck','Matched deck / Create','Result','First / Winner','Opponents','Status'])head.append(el('th',title));table.append(head);
  const statuses=[];
  const update=()=>{
   const seen=new Set();
   for(let i=0;i<results.length;i++){
    const r=results[i],key=r.date&&(r.deck||r.createDeck)&&r.won!==null?[r.date,r.deck?.id||csvKey(r.deckName),r.won?'win':'loss'].join('|'):null;
    r.error=!r.date?'Invalid date':r.won===null?'Result must be Win or Loss':!r.deck&&!r.createDeck?'Choose or create a deck':r.createDeck&&!r.commander?'Commander required':r.needsReview&&!r.createDeck?'Confirm suggested deck':existing.has(key)||seen.has(key)?'Possible duplicate':'';
    if(key)seen.add(key);
    statuses[i].textContent=r.error||'Ready';
    statuses[i].className=r.error?'csv-import-error':'csv-import-ok';
   }
   csvReady=results.filter(r=>!r.error);
   status.textContent=csvReady.length+' ready · '+results.filter(r=>r.needsReview).length+' need deck confirmation · '+(results.length-csvReady.length-results.filter(r=>r.needsReview).length)+' other skipped. Review suggested matches before importing.';
   $('confirmCsvImport').hidden=!csvReady.length;
  };
  for(let i=0;i<results.length;i++){
   const r=results[i],tr=el('tr');
   tr.append(el('td',String(r.line)),el('td',r.date||'—'),el('td',r.rawDeck||'—'));
   const cell=el('td'),select=el('select');select.className='csv-deck-select';select.setAttribute('aria-label','Match deck for CSV row '+r.line);
   const placeholder=el('option','Select deck');placeholder.value='';select.append(placeholder);
   const create=el('option','+ Create new deck: '+r.rawDeck);create.value='__create__';select.append(create);
   const candidates=csvDeckCandidates(r.rawDeck);
   for(const item of candidates){
    const option=el('option',item.deck.name+' — '+item.deck.commander);
    option.value=item.deck.id;select.append(option);
   }
   select.value=r.createDeck?'__create__':r.deck?.id||'';
   select.onchange=()=>{r.createDeck=select.value==='__create__';r.deck=r.createDeck?null:decks.find(d=>d.id===select.value)||null;r.needsReview=false;update()};
   cell.append(select);
   if(r.needsReview&&r.deck){const hint=el('div','Closest match suggested — please confirm using the dropdown.');hint.className='csv-import-error';cell.append(hint)}
   tr.append(cell,el('td',r.won===null?'—':r.won?'Win':'Loss'));
   tr.append(el('td',(r.firstPlayer===null?'First: unknown':'First: '+r.players[r.firstPlayer].name)+' · '+(r.winnerPlayer===null?'Winner: unknown':'Winner: '+r.players[r.winnerPlayer].name)));
   tr.append(el('td',r.opponents.join('; ')||'—'));
   const state=el('td');tr.append(state);statuses.push(state);table.append(tr);
  }
  const wrap=el('div');wrap.className='csv-import-table-wrap';wrap.append(table);preview.append(wrap);
  update();
 }catch(err){status.textContent='Could not read CSV: '+err.message}
}
$('confirmCsvImport').onclick=async()=>{
 if(!user||!csvReady.length)return;
 const button=$('confirmCsvImport');button.disabled=true;
 const status=$('csvImportStatus');let added=0;const createdDecks=new Map();
 try{
  for(let i=0;i<csvReady.length;i+=100){
   const batch=[];
   for(const r of csvReady.slice(i,i+100)){
    let deckId=r.deck?.id;
    if(r.createDeck){
     const key=csvKey(r.deckName)+'|'+csvKey(r.commander);
     if(!createdDecks.has(key)){
      const found=decks.find(d=>csvKey(d.name)===csvKey(r.deckName)&&csvKey(d.commander)===csvKey(r.commander));
      if(found)createdDecks.set(key,found.id);
      else{
       const result=await sb.from('decks').insert({owner_id:user.id,name:r.deckName,commander:r.commander,decklist:''}).select('id').single();
       if(result.error)throw Error('Could not create deck '+r.deckName+': '+result.error.message);
       createdDecks.set(key,result.data.id);
      }
     }
     deckId=createdDecks.get(key);
    }
    batch.push({owner_id:user.id,deck_id:deckId,played_at:r.date,won:r.won,opponents:r.opponents,notes:r.notes,players:r.players,first_player:r.firstPlayer,winner_player:r.winnerPlayer});
   }
   const response=await sb.from('personal_games').insert(batch);
   if(response.error)throw Error(response.error.message);
   added+=batch.length;status.textContent='Imported '+added+' of '+csvReady.length+' games…';
  }
  csvReady=[];button.hidden=true;$('csvFile').value='';
  status.textContent='Successfully imported '+added+' games. Your statistics have been updated.';
  $('csvImportPreview').replaceChildren();
 }catch(err){
  csvReady=csvReady.slice(added);
  status.textContent='Imported '+added+' games before an error: '+err.message+'. You can retry the remaining games.';
  button.hidden=!csvReady.length;
 }finally{button.disabled=false}
};


export async function runCsvValidation(){
 const status=$('csvImportStatus');
 status.classList.remove('csv-import-error');
 status.textContent='Checking your account and loading your decks…';
 user=null;decks=[];games=[];
 try{
  await loadImport();
  if(!user)return;
  await validateSelectedCsv();
 }catch(e){status.textContent='Could not prepare CSV import: '+e.message;status.classList.add('csv-import-error')}
}
