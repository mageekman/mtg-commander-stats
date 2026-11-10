const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../scryfall-client.js'),'utf8');
test('concurrent commander lookups return independent readable responses and cache the card',async()=>{
 let calls=0;
 const values=new Map();
 const context={window:{fetch:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,10));return new Response(JSON.stringify({name:'Minsc & Boo, Timeless Heroes',color_identity:['G','R']}))}},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},Response,Request,Headers,URL,DOMException,setTimeout,location:{href:'https://example.com'}};
 vm.runInNewContext(source,context);
 const url='https://api.scryfall.com/cards/named?exact='+encodeURIComponent('Minsc & Boo, Timeless Heroes');
 const responses=await Promise.all(Array.from({length:5},()=>context.window.commandLedgerScryfallFetch(url)));
 for(const response of responses){assert.equal(response.status,200);assert.deepEqual((await response.json()).color_identity,['G','R'])}
 assert.equal(calls,1);
 assert.deepEqual((await (await context.window.commandLedgerScryfallFetch(url)).json()).color_identity,['G','R']);
 assert.equal(calls,1);
});
