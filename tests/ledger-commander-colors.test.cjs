const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../ledger-commander-colors.js'),'utf8');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+Math.random());

test('Minsc & Boo is looked up as one card and counted as red-green',async()=>{
 const calls=[];
 global.window={commandLedgerScryfallFetch:async url=>{
  const name=new URL(url).searchParams.get('exact');calls.push(name);
  return {ok:true,json:async()=>({color_identity:['R','G']})};
 }};
 try{
  const {commanderColors}=await load();
  assert.equal(await commanderColors('Minsc & Boo, Timeless Heroes'),'RG');
  assert.deepEqual(calls,['Minsc & Boo, Timeless Heroes']);
 }finally{delete global.window}
});

test('separate partner commanders fall back to combining identities',async()=>{
 const calls=[];
 const identities={'Partner Alpha':['W'],'Partner Beta':['U']};
 global.window={commandLedgerScryfallFetch:async url=>{
  const name=new URL(url).searchParams.get('exact');calls.push(name);
  return identities[name]?{ok:true,json:async()=>({color_identity:identities[name]})}:{ok:false};
 }};
 try{
  const {commanderColors}=await load();
  assert.equal(await commanderColors('Partner Alpha & Partner Beta'),'WU');
  assert.deepEqual(calls,['Partner Alpha & Partner Beta','Partner Alpha','Partner Beta']);
 }finally{delete global.window}
});

test('colorless commander identity remains valid rather than unavailable',async()=>{
 global.window={commandLedgerScryfallFetch:async()=>({ok:true,json:async()=>({color_identity:[]})})};
 try{
  const {commanderColors}=await load();
  assert.equal(await commanderColors('Colorless Commander'),'');
 }finally{delete global.window}
});

test('explicit pairs combine both identities once, preserving ampersands and unknown data',async()=>{
 const calls=[],cards={'Minsc & Boo, Timeless Heroes':['R','G'],'Tymna the Weaver':['W','B'],'Thrasios, Triton Hero':['G','U']};global.window={commandLedgerScryfallFetch:async url=>{const name=new URL(url).searchParams.get('exact');calls.push(name);return cards[name]?{ok:true,json:async()=>({color_identity:cards[name]})}:{ok:false}}};try{const{commanderColors}=await load();assert.equal(await commanderColors('Minsc & Boo, Timeless Heroes / Tymna the Weaver'),'WBRG');assert.equal(await commanderColors('Tymna the Weaver / Thrasios, Triton Hero'),'WUBG');assert.equal(await commanderColors('Tymna the Weaver / Unknown'),null);assert.ok(!calls.some(name=>name.includes(' / ')))}finally{delete global.window}
});
