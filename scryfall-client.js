/* Shared, conservative Scryfall API client. Loaded before page modules. */
(()=>{'use strict';
const nativeFetch=window.fetch.bind(window),prefix='command-ledger:scryfall:v1:',ttl=7*24*60*60*1000;
const memoryCache=new Map(),pending=new Map();let queue=Promise.resolve(),nextAt=0,blockedUntil=0;const spacing=500;
function keyFor(url,opts){const method=(opts?.method||'GET').toUpperCase();return method+' '+url+(method==='POST'?' '+String(opts?.body||''):'')}
function cached(key){
 let entry=memoryCache.get(key);
 if(!entry)try{const raw=localStorage.getItem(prefix+key);if(raw)entry=JSON.parse(raw)}catch{/* Storage is optional. */}
 if(!entry)return null;
 if(Date.now()>entry.until){memoryCache.delete(key);try{localStorage.removeItem(prefix+key)}catch{}return null}
 memoryCache.set(key,entry);return entry.body;
}
function store(key,body){
 if(body.length>250000)return;
 const entry={until:Date.now()+ttl,body};memoryCache.set(key,entry);
 if(memoryCache.size>300)memoryCache.delete(memoryCache.keys().next().value);
 try{localStorage.setItem(prefix+key,JSON.stringify(entry));const keys=Object.keys(localStorage).filter(k=>k.startsWith(prefix));if(keys.length>100){for(const k of keys.slice(0,keys.length-100))localStorage.removeItem(k)}}catch{/* Storage is optional. */}
}
function response(body){return new Response(body,{status:200,headers:{'Content-Type':'application/json'}})}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function isScryfall(input){try{const url=new URL(typeof input==='string'?input:input.url,location.href);return url.protocol==='https:'&&url.hostname==='api.scryfall.com'}catch{return false}}
async function request(input,opts){const url=typeof input==='string'?input:input.url,method=(opts?.method||input?.method||'GET').toUpperCase(),key=keyFor(url,opts),signal=opts?.signal;
const canCache=(method==='GET'||method==='POST'&&url.includes('/cards/collection'))&&!signal;
if(canCache){const hit=cached(key);if(hit!==null)return response(hit);if(pending.has(key))return (await pending.get(key)).clone()}
const task=queue.catch(()=>{}).then(async()=>{
await wait(Math.max(0,nextAt-Date.now(),blockedUntil-Date.now()));
if(signal?.aborted)throw new DOMException('Request aborted','AbortError');
nextAt=Date.now()+spacing;
const headers=new Headers(opts?.headers||((input instanceof Request)?input.headers:undefined));
if(!headers.has('Accept'))headers.set('Accept','application/json;q=0.9,*/*;q=0.8');
const result=await nativeFetch(input,{...opts,headers});
if(result.status===429){
 const retry=Number(result.headers.get('Retry-After'));
 blockedUntil=Math.max(blockedUntil,Date.now()+(Number.isFinite(retry)&&retry>0?Math.min(retry*1000,60000):30000));
 return result; // Never hammer Scryfall with automatic 429 retries.
}
if(canCache&&result.ok){const body=await result.clone().text();store(key,body);return body}
return result;
});
queue=task.then(()=>{},()=>{});
if(canCache){const value=task.then(v=>typeof v==='string'?response(v):v.clone());pending.set(key,value);value.finally(()=>pending.delete(key)).catch(()=>{});return (await value).clone()}
return task;
}
const commanderBatches=new Map();
const namedUrl=name=>'https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name);
// Seed individual named-card cache entries from collection requests (up to 75 cards).
window.commandLedgerPrefetchCommanders=names=>{
 const unique=[...new Map(names.map(name=>String(name||'').trim()).filter(Boolean).map(name=>[name.toLowerCase(),name])).values()];
 const missing=unique.filter(name=>!commanderBatches.has(name.toLowerCase())&&cached(keyFor(namedUrl(name.toLowerCase())))===null);
 const jobs=[];
 for(let i=0;i<missing.length;i+=75){
  const chunk=missing.slice(i,i+75);
  const job=request('https://api.scryfall.com/cards/collection',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({identifiers:chunk.map(name=>({name}))})}).then(async result=>{
   if(!result.ok)return;
   const body=await result.json();
   const cards=new Map((body.data||[]).map(card=>[card.name.toLowerCase(),card]));
   for(const name of chunk){const card=cards.get(name.toLowerCase());if(card)store(keyFor(namedUrl(name.toLowerCase())),JSON.stringify(card))}
  }).catch(()=>{}).finally(()=>{for(const name of chunk)if(commanderBatches.get(name.toLowerCase())===job)commanderBatches.delete(name.toLowerCase())});
  for(const name of chunk)commanderBatches.set(name.toLowerCase(),job);
  jobs.push(job);
 }
 return Promise.all(jobs);
};
window.commandLedgerScryfallFetch=async(input,opts)=>{
 if(!isScryfall(input))return nativeFetch(input,opts);
 const url=new URL(typeof input==='string'?input:input.url);
 if(url.pathname==='/cards/named'&&url.searchParams.has('exact')&&!opts?.signal){
  const name=url.searchParams.get('exact'),batch=commanderBatches.get(name.trim().toLowerCase());
  if(batch)await batch;
  // Different capitalization still shares the canonical prefetched card.
  const hit=cached(keyFor(namedUrl(name.trim().toLowerCase())));if(hit!==null)return response(hit);
 }
 return request(input,opts);
};
// Resolve a whole card name before interpreting separators as partner commanders.
window.commandLedgerCommanderArtwork=async name=>{
 const full=String(name||'').trim();if(!full)return null;
 async function lookup(value){
  const result=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(value),{headers:{Accept:'application/json'}});
  if(result.status===404)return null;
  if(!result.ok)throw Error('Scryfall '+result.status);
  return result.json();
 }
 let card=await lookup(full);
 if(!card){const parts=full.split(/\s+\/\s+|\s+&\s+/).map(x=>x.trim()).filter(Boolean);if(parts.length>1)card=await lookup(parts[0])}
 return card?.image_uris?.art_crop||card?.card_faces?.find(face=>face.image_uris?.art_crop)?.image_uris?.art_crop||card?.image_uris?.large||card?.card_faces?.find(face=>face.image_uris?.large)?.image_uris?.large||null;
};
})();