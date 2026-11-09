import {createClient} from './vendor/supabase-js.mjs';
window.__csvImporterStarted?.();
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
let user=null,decks=[],games=[];
async function loadImport(){
 const status=$('csvImportStatus');
 const auth=await Promise.race([sb.auth.getUser(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Account check timed out. Refresh the page and sign in again.')),12000))]);if(auth.error)throw auth.error;user=auth.data.user;
 if(!user){status.textContent='Please sign in on the home page before importing games.';$('csvFile').disabled=true;return}
 status.textContent='Signed in. Loading your decks and existing games…';
 const [deckResult,gameResult]=await Promise.race([Promise.all([
  sb.from('decks').select('id,name,commander').eq('owner_id',user.id),
  sb.from('personal_games').select('deck_id,played_at,won').eq('owner_id',user.id)
 ]),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Loading decks and games timed out. Please refresh and try again.')),15000))]);
 if(deckResult.error||gameResult.error){status.textContent='Could not load your account data: '+(deckResult.error?.message||gameResult.error?.message);$('csvFile').disabled=true;return}
 decks=deckResult.data||[];games=gameResult.data||[];
 status.textContent=decks.length?'Ready. Upload a CSV to validate your games before saving.':'Import a deck to your account first, then return here to match games to it.';
 if(!decks.length)$('csvFile').disabled=true;
}
let csvReady=[];
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
  const deckCol=csvField(headers,['deck','deck name','my deck','your deck','commander','my commander']);
  const resultCol=csvField(headers,['result','outcome','win/loss','win loss','won','win','victory']);
  const notesCol=csvField(headers,['notes','note','comments']);
  const opponentsCol=csvField(headers,['opponents','opponent commanders','other commanders']);
  if([dateCol,deckCol,resultCol].some(n=>n<0))throw Error('Missing required columns. Use Date, Deck, and Result (Win or Loss). Download the template for an example.');
  const existing=new Set(games.map(g=>[g.played_at,g.deck_id,g.won?'win':'loss'].join('|')));
  const results=rows.map((row,i)=>{
   const date=csvDate(row[dateCol]),match=csvMatchDeck(row[deckCol]),won=csvResult(row[resultCol]);
   const opponents=opponentsCol>=0?String(row[opponentsCol]||'').split(';').map(s=>s.trim()).filter(Boolean):[];
   return {line:i+2,date,deck:match.deck,needsReview:match.needsReview,won,error:'',opponents,notes:notesCol>=0?String(row[notesCol]||'').trim():'',rawDeck:row[deckCol]};
  });
  const table=el('table');table.className='csv-import-table';
  const head=el('tr');for(const title of ['Row','Date','CSV deck','Matched deck','Result','Status'])head.append(el('th',title));table.append(head);
  const statuses=[];
  const update=()=>{
   const seen=new Set();
   for(let i=0;i<results.length;i++){
    const r=results[i],key=r.date&&r.deck&&r.won!==null?[r.date,r.deck.id,r.won?'win':'loss'].join('|'):null;
    r.error=!r.date?'Invalid date':r.won===null?'Result must be Win or Loss':!r.deck?'Choose a deck':r.needsReview?'Confirm suggested deck':existing.has(key)||seen.has(key)?'Possible duplicate':'';
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
   const candidates=csvDeckCandidates(r.rawDeck);
   for(const item of candidates){
    const option=el('option',item.deck.name+' — '+item.deck.commander);
    option.value=item.deck.id;select.append(option);
   }
   select.value=r.deck?.id||'';
   select.onchange=()=>{r.deck=decks.find(d=>d.id===select.value)||null;r.needsReview=false;update()};
   cell.append(select);
   if(r.needsReview&&r.deck){const hint=el('div','Closest match suggested — please confirm using the dropdown.');hint.className='csv-import-error';cell.append(hint)}
   tr.append(cell,el('td',r.won===null?'—':r.won?'Win':'Loss'));
   const state=el('td');tr.append(state);statuses.push(state);table.append(tr);
  }
  const wrap=el('div');wrap.className='csv-import-table-wrap';wrap.append(table);preview.append(wrap);
  update();
 }catch(err){status.textContent='Could not read CSV: '+err.message}
}
$('confirmCsvImport').onclick=async()=>{
 if(!user||!csvReady.length)return;
 const button=$('confirmCsvImport');button.disabled=true;
 const status=$('csvImportStatus');let added=0;
 try{
  for(let i=0;i<csvReady.length;i+=100){
   const batch=csvReady.slice(i,i+100).map(r=>({
    owner_id:user.id,deck_id:r.deck.id,played_at:r.date,won:r.won,
    opponents:r.opponents,notes:r.notes,players:[],first_player:null,winner_player:null
   }));
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
  if(!user||!decks.length)return;
  await validateSelectedCsv();
 }catch(e){status.textContent='Could not prepare CSV import: '+e.message;status.classList.add('csv-import-error')}
}
