/* Automatic content-aware framing for commander art; existing saved adjustments win. */
(function(){
 const selector=['.deck-entry-art img','.recent-game-player-art','.commander-art','.history-player-art','.compact-game-art','.best-deck-art','.deck-stats-art','.shared-feature-art','.shared-deck-art','.friend-game-art','.ranking-passport>img','.friend-passport-link>img','.result-art','#commanderArt','.deck-hero-art img','.deck-hero>img'].join(',');
 const states=new WeakMap(),names=new WeakMap(),registered=new WeakSet(),visible=new WeakSet(),queued=new WeakSet();
 const images=new Map(),crops=new Map(),queue=[];let running=false;
 const key=name=>String(name||'').split(' / ')[0].split(' & ')[0].trim().toLowerCase();
 const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
 function saved(name){if(!name)return null;try{const p=JSON.parse(localStorage.getItem('commandLedger.artPosition.'+key(name))||'null');return Array.isArray(p)&&p.length===2?p.map(clamp):null}catch{return null}}
 function position(name){return (saved(name)||[50,24]).join('% ')+'%'}
 function write(element,value){for(const property of ['object-position','background-position'])if(element.style.getPropertyValue(property)!==value||element.style.getPropertyPriority(property)!=='important')element.style.setProperty(property,value,'important')}
 function source(element){if(element.tagName==='IMG')return element.currentSrc||element.src;const match=getComputedStyle(element).backgroundImage.match(/url\(["']?(.*?)["']?\)/);return match?.[1]||''}
 function image(url){if(images.has(url))return images.get(url);const job=new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=url});images.set(url,job);if(images.size>16)images.delete(images.keys().next().value);job.catch(()=>images.delete(url));return job}
 function cropPosition(crop,width,height){const x=width-crop.width,y=height-crop.height;return [x>1?clamp(100*crop.x/x):50,y>1?clamp(100*crop.y/y):50].map(n=>Math.round(n*10)/10).join('% ')+'%'}
 async function frame(element){
  if(!element.isConnected||!visible.has(element))return;
  const override=saved(names.get(element));if(override){write(element,override.join('% ')+'%');return}
  const url=source(element),box=element.getBoundingClientRect();if(!url||box.width<1||box.height<1)return;
  const ratio=Math.round(box.width/box.height*20)/20,cacheKey=url+'|'+ratio;
  if(states.get(element)===cacheKey)return;states.set(element,cacheKey);
  try{
   if(!window.smartcrop)return;
   let job=crops.get(cacheKey);
   if(!job){job=(async()=>{const img=await image(url);const result=await window.smartcrop.crop(img,{width:Math.max(1,ratio*100),height:100,minScale:1,maxScale:1});return cropPosition(result.topCrop,img.naturalWidth,img.naturalHeight)})();crops.set(cacheKey,job);if(crops.size>128)crops.delete(crops.keys().next().value);job.catch(()=>crops.delete(cacheKey))}
   const value=await job;
   if(element.isConnected&&states.get(element)===cacheKey&&source(element)===url&&!saved(names.get(element)))write(element,value);
  }catch{/* CORS, offline images and canvas failures keep the existing readable crop. */}
 }
 function idle(task){if(window.requestIdleCallback)requestIdleCallback(task,{timeout:300});else setTimeout(task,0)}
 function schedule(element){if(queued.has(element))return;queued.add(element);queue.push(element);if(!running){running=true;idle(drain)}}
 async function drain(){const element=queue.shift();if(element){queued.delete(element);await frame(element)}if(queue.length)idle(drain);else running=false}
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{for(const entry of entries)if(visible.has(entry.target))schedule(entry.target)}):null;
 const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){visible.add(entry.target);schedule(entry.target)}else visible.delete(entry.target)}},{rootMargin:'150px'}):null;
 function register(element){if(!registered.has(element)){registered.add(element);resize?.observe(element);if(intersection)intersection.observe(element);else visible.add(element);if(element.tagName==='IMG')element.addEventListener('load',()=>{states.delete(element);schedule(element)})}if(visible.has(element))schedule(element)}
 function scan(root){if(root.nodeType!==1)return;if(root.matches(selector))register(root);for(const element of root.querySelectorAll(selector))register(element)}
 function apply(element,name){if(!element)return;names.set(element,name);write(element,position(name));states.delete(element);register(element)}
 window.commandLedgerArtPosition={position,apply,cropPosition};
 function start(){scan(document.documentElement);new MutationObserver(records=>{for(const record of records){if(record.type==='childList'){for(const added of record.addedNodes)scan(added);for(const removed of record.removedNodes){if(removed.nodeType!==1)continue;for(const element of [removed,...removed.querySelectorAll(selector)])if(registered.has(element)){resize?.unobserve(element);intersection?.unobserve(element);registered.delete(element);visible.delete(element)}}}else if(record.target.matches(selector))register(record.target)}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','style','class']})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
