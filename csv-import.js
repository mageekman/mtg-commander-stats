import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT');
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
let user=null,decks=[],games=[];
async function loadImport(){
 const status=$('csvImportStatus');
 const auth=await sb.auth.getUser();user=auth.data.user;
 if(!user){status.textContent='Please sign in on the home page before importing games.';$('csvFile').disabled=true;return}
 const [deckResult,gameResult]=await Promise.all([
  sb.from('decks').select('id,name,commander').eq('owner_id',user.id),
  sb.from('personal_games').select('deck_id,played_at,won').eq('owner_id',user.id)
 ]);
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
function csvMatchDeck(name){
 const key=csvKey(name);
 const matches=decks.filter(d=>csvKey(d.name)===key||csvKey(d.commander)===key);
 return matches.length===1?matches[0]:null;
}
$('downloadCsvTemplate').onclick=()=>{
 const csv='Date,Deck,Result,Opponents,Notes\n2026-11-01,My Commander Deck,Win,"Krenko; Atraxa; Muldrotha",Fun game\n';
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='command-ledger-games-template.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('csvFile').addEventListener('change',async e=>{
 csvReady=[];$('confirmCsvImport').hidden=true;
 const preview=$('csvImportPreview');preview.replaceChildren();
 const file=e.target.files?.[0];if(!file)return;
 const status=$('csvImportStatus');
 if(!user){status.textContent='Sign in before importing games.';return}
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
  const seen=new Set();
  const results=rows.map((row,i)=>{
   const date=csvDate(row[dateCol]),deck=csvMatchDeck(row[deckCol]),won=csvResult(row[resultCol]);
   const key=date&&deck&&won!==null?[date,deck.id,won?'win':'loss'].join('|'):null;
   let error=!date?'Invalid date':!deck?'Deck not found or ambiguous':won===null?'Result must be Win or Loss':existing.has(key)||seen.has(key)?'Possible duplicate':'';
   if(key)seen.add(key);
   const opponents=opponentsCol>=0?String(row[opponentsCol]||'').split(';').map(s=>s.trim()).filter(Boolean):[];
   return {line:i+2,date,deck,won,error,opponents,notes:notesCol>=0?String(row[notesCol]||'').trim():'',rawDeck:row[deckCol]};
  });
  csvReady=results.filter(r=>!r.error);
  const table=el('table');table.className='csv-import-table';
  const head=el('tr');for(const title of ['Row','Date','Deck','Result','Status'])head.append(el('th',title));table.append(head);
  for(const r of results){
   const tr=el('tr');for(const value of [r.line,r.date||'—',r.deck?.name||r.rawDeck||'—',r.won===null?'—':r.won?'Win':'Loss',r.error||'Ready'])tr.append(el('td',String(value)));
   tr.lastChild.className=r.error?'csv-import-error':'csv-import-ok';table.append(tr);
  }
  const wrap=el('div');wrap.className='csv-import-table-wrap';wrap.append(table);preview.append(wrap);
  status.textContent=csvReady.length+' ready to import · '+(results.length-csvReady.length)+' skipped. Rows with the same date, deck, and result as an existing game are flagged as possible duplicates.';
  $('confirmCsvImport').hidden=!csvReady.length;
 }catch(err){status.textContent='Could not read CSV: '+err.message}
});
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


loadImport().catch(e=>$('csvImportStatus').textContent='Unable to prepare import: '+e.message);
