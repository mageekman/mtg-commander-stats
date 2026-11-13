import {commanderKey} from './share-ledger-stats.js?v=nav-notices-1';
const cards=new Map(),imageCache=new Map();
const timed=(promise,ms,fallback=null)=>new Promise(resolve=>{const timer=setTimeout(()=>resolve(fallback),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},()=>{clearTimeout(timer);resolve(fallback)})});
const art=card=>card?.image_uris?.art_crop||card?.card_faces?.find(f=>f.image_uris?.art_crop)?.image_uris?.art_crop||card?.image_uris?.large||card?.card_faces?.find(f=>f.image_uris?.large)?.image_uris?.large||null;
export function metadataFor(name,lookup){const full=lookup.get(commanderKey(name));if(full)return {colors:Array.isArray(full.color_identity)?[...'WUBRG'].filter(c=>full.color_identity.includes(c)).join(''):null,art:art(full)};const parts=String(name||'').split(/\s+\/\s+|\s+&\s+/).map(commanderKey);if(parts.length<2)return {colors:null,art:null};const found=parts.map(p=>lookup.get(p));return {colors:found.every(c=>Array.isArray(c?.color_identity))?[...'WUBRG'].filter(c=>found.some(p=>p.color_identity.includes(c))).join(''):null,art:art(found[0])}}
function decodeImage(url){return new Promise(resolve=>{const image=new Image(),timer=setTimeout(()=>{image.src='';resolve(null)},8000);image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.onload=()=>{clearTimeout(timer);resolve(image)};image.onerror=()=>{clearTimeout(timer);resolve(null)};image.src=url})}
export function loadShareImage(url){
 if(!url)return Promise.resolve(null);if(imageCache.has(url))return imageCache.get(url);
 const job=(async()=>{const image=await decodeImage(url);if(image)return image;try{const retry=new URL(url,location.href);if(retry.origin==='https://cards.scryfall.io'){return await decodeImage(url+(url.includes('?')?'&':'?')+'command-ledger-share='+Date.now())}}catch{}return null})();
 imageCache.set(url,job);job.then(image=>{if(!image)imageCache.delete(url)});return job;
}
export async function loadShareAssets(stats,profile,decks=[]){
 const shown=[...new Set([profile.favorite_commander,stats.best?.deck.commander,stats.rivalCommander?.name,stats.most?.deck.commander,...stats.top.map(d=>d.deck.commander)].map(n=>String(n||'').trim()).filter(Boolean))];
 const requested=[...new Set([...shown,...decks.map(d=>d.commander),...stats.winners.map(p=>p.commander)].map(n=>String(n||'').trim()).filter(Boolean))];
 const deadline=Date.now()+24000;
 function remember(card,alias){if(!card?.name)return;if(alias)cards.set(commanderKey(alias),card);cards.set(commanderKey(card.name),card);for(const face of card.card_faces||[])if(!cards.has(commanderKey(face.name)))cards.set(commanderKey(face.name),card)}
 async function named(name){
  if(cards.has(commanderKey(name)))return cards.get(commanderKey(name));if(Date.now()>=deadline)return null;
  const url='https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name);
  let response=await timed(window.commandLedgerScryfallFetch(url,{headers:{Accept:'application/json'}}),Math.max(1,deadline-Date.now()));
  if((!response||response.status>=500)&&Date.now()<deadline)response=await timed(window.commandLedgerScryfallFetch(url+'&command-ledger-share='+Date.now(),{headers:{Accept:'application/json'}}),Math.max(1,deadline-Date.now()));
  if(!response?.ok)return null;const card=await timed(response.json(),Math.max(1,deadline-Date.now()));remember(card,name);return card;
 }
 async function resolveName(name){if(await named(name))return;const parts=name.split(/\s+\/\s+|\s+&\s+/).map(p=>p.trim()).filter(Boolean);if(parts.length>1)for(const part of parts)await named(part)}
 // Artwork uses simple GETs and the shared named-card cache. It never depends
 // on a collection POST/preflight succeeding, and visible commanders go first.
 for(const name of shown){if(Date.now()>=deadline)break;await resolveName(name)}
 const initialArt=new Map(shown.map(name=>[name,metadataFor(name,cards).art])),images=new Map();
 const artwork=Promise.all(shown.map(async name=>images.set(commanderKey(name),await loadShareImage(initialArt.get(name)))));
 const missing=requested.filter(name=>!cards.has(commanderKey(name)));
 // Bulk metadata is optional for the remaining color statistics.
 for(let start=0;start<missing.length&&Date.now()<deadline;start+=75){
  const chunk=missing.slice(start,start+75),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(4000,Math.max(1,deadline-Date.now())));
  try{const response=await timed(window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers:chunk.map(name=>({name}))}),signal:controller.signal}),Math.min(4000,Math.max(1,deadline-Date.now())));if(!response?.ok)break;const result=await timed(response.json(),Math.max(1,deadline-Date.now()));for(const card of result?.data||[])remember(card)}finally{clearTimeout(timer);controller.abort()}
 }
 for(const name of requested){if(Date.now()>=deadline)break;if(!cards.has(commanderKey(name)))await resolveName(name)}
 const metadata=new Map(requested.map(name=>[commanderKey(name),metadataFor(name,cards)]));
 await artwork;await Promise.all(shown.filter(name=>!images.get(commanderKey(name))&&metadata.get(commanderKey(name))?.art!==initialArt.get(name)).map(async name=>images.set(commanderKey(name),await loadShareImage(metadata.get(commanderKey(name))?.art))));
 const [logo,...symbols]=await Promise.all([loadShareImage('./cl-logo-final-transparent.webp?v=delivery-1'),...[...'WUBRGC'].map(c=>loadShareImage('./assets/mana/'+c+'.svg?v=1'))]);
 return {metadata,images,logo,symbols:new Map([...'WUBRGC'].map((c,i)=>[c,symbols[i]])),missingArtwork:shown.some(n=>!images.get(commanderKey(n)))};
}
