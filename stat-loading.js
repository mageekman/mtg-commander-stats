// Each render owns its indicator; older requests cannot clear a newer render.
const pending=new WeakMap();
export function startStatLoading(host,label='Loading statistics…'){
 if(!host)return ()=>{};
 pending.get(host)?.remove();
 const indicator=document.createElement('span');
 indicator.className='stat-loading';indicator.setAttribute('role','status');
 indicator.textContent=label;host.setAttribute('aria-busy','true');
 host.prepend(indicator);pending.set(host,indicator);
 return ()=>{if(pending.get(host)!==indicator)return;indicator.remove();host.removeAttribute('aria-busy');pending.delete(host)};
}
