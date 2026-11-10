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
function artworkClient(reply){
 const calls=[];
 const context={window:{fetch:async url=>{const name=new URL(url).searchParams.get('exact');calls.push(name);return reply(name)}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},Response,Request,Headers,URL,DOMException,setTimeout:fn=>setTimeout(fn,0),location:{href:'https://example.com'}};
 vm.runInNewContext(source,context);
 return {art:context.window.commandLedgerCommanderArtwork,calls};
}
test('artwork preserves ampersands in a single commander name',async()=>{
 const c=artworkClient(()=>new Response(JSON.stringify({image_uris:{art_crop:'minsc.jpg'}})));
 assert.equal(await c.art('Minsc & Boo, Timeless Heroes'),'minsc.jpg');
 assert.deepEqual(c.calls,['Minsc & Boo, Timeless Heroes']);
});
test('partner artwork falls back only after an unmatched full name and supports card faces',async()=>{
 const c=artworkClient(name=>name.includes(' / ')?new Response('{}',{status:404}):new Response(JSON.stringify({card_faces:[{}, {image_uris:{art_crop:'partner.jpg'}}]})));
 assert.equal(await c.art('Tymna the Weaver / Thrasios, Triton Hero'),'partner.jpg');
 assert.deepEqual(c.calls,['Tymna the Weaver / Thrasios, Triton Hero','Tymna the Weaver']);
});
test('temporary artwork failure remains retryable without splitting a card name',async()=>{
 let fail=true;
 const c=artworkClient(()=>fail?new Response('{}',{status:429}):new Response(JSON.stringify({image_uris:{art_crop:'recovered.jpg'}})));
 await assert.rejects(c.art('Minsc & Boo, Timeless Heroes'),/429/);
 assert.equal(c.calls.length,1);fail=false;
 assert.equal(await c.art('Minsc & Boo, Timeless Heroes'),'recovered.jpg');
});
function batchClient({failCollection=false,storageUnavailable=false}={}){
 const calls=[],data=new Map();
 const card=name=>({name,color_identity:['G','R'],image_uris:{art_crop:'https://example.com/'+encodeURIComponent(name)+'.jpg'}});
 const localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 if(storageUnavailable)for(const key of Object.keys(localStorage))localStorage[key]=()=>{throw Error('Storage disabled')};
 const context={window:{fetch:async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/collection')){if(failCollection)return new Response('{}',{status:503});return new Response(JSON.stringify({data:JSON.parse(opts.body).identifiers.map(x=>card(x.name))}))}return new Response(JSON.stringify(card(new URL(url).searchParams.get('exact'))))}},localStorage,Response,Request,Headers,URL,DOMException,setTimeout:fn=>setTimeout(fn,0),location:{href:'https://example.com'}};
 vm.runInNewContext(source,context);
 return {client:context.window,calls};
}
test('30 cold commander lookups share one batch across artwork and stats; repeat reads use cache',async()=>{
 const {client,calls}=batchClient();const names=Array.from({length:30},(_,i)=>'Commander '+i);
 const batch=client.commandLedgerPrefetchCommanders([...names,names[0].toUpperCase()]);
 const art=Promise.all(names.map(client.commandLedgerCommanderArtwork));
 const stats=Promise.all(names.map(async name=>(await client.commandLedgerScryfallFetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name))).json()));
 await batch;assert.equal((await art).filter(Boolean).length,30);assert.equal((await stats).length,30);assert.equal(calls.length,1);
 await client.commandLedgerPrefetchCommanders(names);await Promise.all(names.map(client.commandLedgerCommanderArtwork));assert.equal(calls.length,1);
});
test('collection requests respect the 75-card limit and work without local storage',async()=>{
 const {client,calls}=batchClient({storageUnavailable:true});const names=Array.from({length:76},(_,i)=>'Commander '+i);
 const batch=client.commandLedgerPrefetchCommanders(names);const art=Promise.all(names.map(client.commandLedgerCommanderArtwork));await batch;await art;
 assert.deepEqual(calls.map(call=>JSON.parse(call.opts.body).identifiers.length),[75,1]);
});
test('failed prefetch falls back to the ordinary lookup without deadlock',async()=>{
 const {client,calls}=batchClient({failCollection:true});const name='Minsc & Boo, Timeless Heroes';
 const batch=client.commandLedgerPrefetchCommanders([name]);const art=client.commandLedgerCommanderArtwork(name);await batch;assert.ok(await art);assert.equal(calls.length,2);assert.ok(calls[1].url.includes('/cards/named?exact='));
});
