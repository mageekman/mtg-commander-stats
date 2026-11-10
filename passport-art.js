// Profile-owned framing, separate from per-commander defaults and local preferences.
export function normalizeArt(value,commander){
 const number=(n,f,min,max)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):f;
 if(!value||value.commander!==commander)return {commander,x:50,y:30,zoom:1};
 return {commander,x:number(value.x,50,0,100),y:number(value.y,30,0,100),zoom:number(value.zoom,1,1,2.5)};
}
export function applyArt(image,value,commander){
 const art=normalizeArt(value,commander),position=`${art.x}% ${art.y}%`;
 image.style.setProperty('object-position',position,'important');
 image.style.transformOrigin=position;image.style.transform=`scale(${art.zoom})`;
}
const pending=new Map();
export async function applyPassportArt(sb,image,handle,commander){
 if(!handle)return;
 if(!pending.has(handle))pending.set(handle,sb.rpc('get_passport_art',{target_handle:handle}).then(({data,error})=>{if(error)throw error;return data}).catch(()=>null));
 const art=await pending.get(handle);applyArt(image,art,commander);
}
