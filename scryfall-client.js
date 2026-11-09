/* Shared, conservative Scryfall API client. Loaded before page modules. */
(()=>{'use strict';
const nativeFetch=window.fetch.bind(window),prefix='command-ledger:scryfall:v1:',ttl=7*24*60*60*1000;
const pending=new Map();let queue=Promise.resolve(),nextAt=0,blockedUntil=0;
function keyFor(url,opts){const method=(opts?.method||'GET').toUpperCase();return method+' '+url+(method==='POST'?' '+String(opts?.body||''):'')}
function cached(key){try{const raw=localStorage.getItem(prefix+key);if(!raw)return null;const v=JSON.parse(raw);if(Date.now()>v.until){localStorage.removeItem(prefix+key);return null}return v.body}catch{return null}}
function store(key,body){if(body.length>250000)return;try{localStorage.setItem(prefix+key,JSON.stringify({until:Date.now()+ttl,body}));const keys=Object.keys(localStorage).filter(k=>k.startsWith(prefix));if(keys.length>100){for(const k of keys.slice(0,keys.length-100))localStorage.removeItem(k)}}catch{/* Storage is optional. */}}
function response(body){return new Response(body,{status:200,headers:{'Content-Type':'application/json'}})}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function isScryfall(input){try{const url=new URL(typeof input==='string'?input:input.url,location.href);return url.protocol==='https:'&&url.hostname==='api.scryfall.com'}catch{return false}}
async function request(input,opts){const url=typeof input==='string'?input:input.url,method=(opts?.method||input?.method||'GET').toUpperCase(),key=keyFor(url,opts),signal=opts?.signal;
const canCache=(method==='GET'||method==='POST'&&url.includes('/cards/collection'))&&!signal;
if(canCache){const hit=cached(key);if(hit!==null)return response(hit);if(pending.has(key))return response(await pending.get(key))}
const task=queue.catch(()=>{}).then(async()=>{
await wait(Math.max(0,nextAt-Date.now(),blockedUntil-Date.now()));
if(signal?.aborted)throw new DOMException('Request aborted','AbortError');
nextAt=Date.now()+300;
for(let attempt=0;attempt<3;attempt++){
const result=await nativeFetch(input,opts);
if(result.status!==429){if(canCache&&result.ok){const body=await result.clone().text();store(key,body);return body}return result}
const retry=Number(result.headers.get('Retry-After'));const pause=Number.isFinite(retry)&&retry>0?Math.min(retry*1000,60000):Math.min(2000*2**attempt,15000);
blockedUntil=Math.max(blockedUntil,Date.now()+pause);await wait(pause);
}
throw new Error('Scryfall rate limit reached. Please wait and try again.');
});
queue=task.then(()=>{},()=>{});
if(canCache){const value=task.then(v=>typeof v==='string'?v:v.text());pending.set(key,value);value.finally(()=>pending.delete(key)).catch(()=>{});return response(await value)}
return task;
}
window.commandLedgerScryfallFetch=(input,opts)=>isScryfall(input)?request(input,opts):nativeFetch(input,opts);
})();