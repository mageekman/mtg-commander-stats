import {commanderKey} from './share-ledger-stats.js?v=combo-4';
const cards=new Map(),imageCache=new Map();
const timed=(promise,ms,fallback=null)=>new Promise(resolve=>{const timer=setTimeout(()=>resolve(fallback),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},()=>{clearTimeout(timer);resolve(fallback)})});
const art=card=>card?.image_uris?.art_crop||card?.card_faces?.find(f=>f.image_uris?.art_crop)?.image_uris?.art_crop||null;
export function metadataFor(name,lookup){const full=lookup.get(commanderKey(name));if(full)return {colors:Array.isArray(full.color_identity)?[...'WUBRG'].filter(c=>full.color_identity.includes(c)).join(''):null,art:art(full)};const parts=String(name||'').split(/\s+\/\s+|\s+&\s+/).map(commanderKey);if(parts.length<2)return {colors:null,art:null};const found=parts.map(p=>lookup.get(p));return {colors:found.every(c=>Array.isArray(c?.color_identity))?[...'WUBRG'].filter(c=>found.some(p=>p.color_identity.includes(c))).join(''):null,art:art(found[0])}}
export function loadShareImage(url){
 if(!url)return Promise.resolve(null);if(imageCache.has(url))return imageCache.get(url);
 const job=new Promise(resolve=>{const image=new Image(),timer=setTimeout(()=>{image.src='';resolve(null)},8000);image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.onload=()=>{clearTimeout(timer);resolve(image)};image.onerror=()=>{clearTimeout(timer);resolve(null)};image.src=url});imageCache.set(url,job);job.then(image=>{if(!image)imageCache.delete(url)});return job;
}
export async function loadShareAssets(stats,profile,decks=[]){
 const requested=[...new Set([...decks.map(d=>d.commander),profile.favorite_commander,stats.best?.deck.commander,stats.most?.deck.commander,...stats.top.map(d=>d.deck.commander),...stats.winners.map(p=>p.commander)].map(n=>String(n||'').trim()).filter(Boolean))];
 const deadline=Date.now()+16000;
 async function fetchNames(names){const missing=[...new Set(names)].filter(n=>!cards.has(commanderKey(n)));for(let start=0;start<missing.length&&Date.now()<deadline;start+=75){const chunk=missing.slice(start,start+75);const response=await timed(window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers:chunk.map(name=>({name}))})}),Math.max(1,deadline-Date.now()));if(!response?.ok)break;const result=await timed(response.json(),Math.max(1,deadline-Date.now()));for(const card of result?.data||[]){cards.set(commanderKey(card.name),card);for(const face of card.card_faces||[])if(!cards.has(commanderKey(face.name)))cards.set(commanderKey(face.name),card)}}}
 await fetchNames(requested);await fetchNames(requested.filter(n=>!cards.has(commanderKey(n))).flatMap(n=>n.split(/\s+\/\s+|\s+&\s+/).map(p=>p.trim())).filter(Boolean));
 const metadata=new Map(requested.map(name=>[commanderKey(name),metadataFor(name,cards)]));
 const shown=[profile.favorite_commander,stats.best?.deck.commander,stats.rivalCommander?.name,stats.most?.deck.commander,...stats.top.map(d=>d.deck.commander)].filter(Boolean);
 const images=new Map();await Promise.all([...new Set(shown)].map(async name=>images.set(commanderKey(name),await loadShareImage(metadata.get(commanderKey(name))?.art))));
 const [logo,...symbols]=await Promise.all([loadShareImage('./cl-logo-final-transparent.png?v=final-1'),...[...'WUBRGC'].map(c=>loadShareImage('./assets/mana/'+c+'.svg?v=1'))]);
 return {metadata,images,logo,symbols:new Map([...'WUBRGC'].map((c,i)=>[c,symbols[i]])),missingArtwork:shown.some(n=>!images.get(commanderKey(n)))};
}
