const identityCache=new Map();
async function commanderIdentity(name){
 const key=String(name||'').trim().toLowerCase();
 if(!key)return [];
 if(!identityCache.has(key))identityCache.set(key,(async()=>{
  try{
   const response=await window.commandLedgerScryfallFetch('https://api.scryfall.com/cards/named?exact='+encodeURIComponent(name.trim()),{headers:{Accept:'application/json'}});
   if(!response.ok)return null;
   const card=await response.json();return Array.isArray(card.color_identity)?card.color_identity:null;
  }catch{return null}
 })());
 return identityCache.get(key);
}
function commanderParts(name){return String(name||'').split(/\s+\/\s+|\s+&\s+/).map(x=>x.trim()).filter(Boolean)}
export async function commanderColors(name){
 const full=String(name||'').trim();
 if(!full)return null;
 // Try the complete card name first: an ampersand can be part of a single name (Minsc & Boo).
 const exact=await commanderIdentity(full);
 if(exact!==null)return [...new Set(exact)].sort((a,b)=>'WUBRG'.indexOf(a)-'WUBRG'.indexOf(b)).join('');
 const parts=commanderParts(full);
 if(parts.length<2)return null;
 const ids=await Promise.all(parts.map(commanderIdentity));
 return ids.some(x=>x===null)?null:[...new Set(ids.flat())].sort((a,b)=>'WUBRG'.indexOf(a)-'WUBRG'.indexOf(b)).join('');
}
