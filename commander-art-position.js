/* Commander artwork framing. Percentages can be overridden per commander. */
(function(){
 const presets=Object.create(null);
 const key=name=>String(name||'').split(' / ')[0].split(' & ')[0].trim().toLowerCase();
 function position(name){const k=key(name);let saved=null;try{saved=JSON.parse(localStorage.getItem('commandLedger.artPosition.'+k)||'null')}catch{}const p=Array.isArray(saved)?saved:presets[k]||[50,24];return p.map(n=>Math.max(0,Math.min(100,Number(n)||0))).join('% ')+'%'}
 function apply(element,name){if(!element)return;element.style.setProperty('object-position',position(name));element.style.setProperty('background-position',position(name));}
 window.commandLedgerArtPosition={position,apply};
})();
