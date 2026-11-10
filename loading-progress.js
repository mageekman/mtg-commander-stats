(function(){
 if(window.commandLedgerLoading)return;
 const style=document.createElement('style');
 style.textContent='#cl-loading{position:fixed;top:0;left:0;right:0;z-index:99999;pointer-events:none;opacity:0;transition:opacity .2s}#cl-loading.is-loading{opacity:1}#cl-loading-track{height:5px;background:#243e36}#cl-loading-bar{height:100%;width:0;background:linear-gradient(90deg,#65baa3,#e0c27c);box-shadow:0 0 12px #65baa377;transition:width .4s ease}#cl-loading-label{position:absolute;top:11px;right:14px;padding:7px 12px;border:1px solid #557869;border-radius:7px;background:#122824;color:#f4e9cc;font:600 12px system-ui,sans-serif;box-shadow:0 5px 18px #0007}';
 document.head.append(style);
 const root=document.createElement('div');root.id='cl-loading';root.setAttribute('role','status');root.setAttribute('aria-live','polite');
 root.innerHTML='<div id="cl-loading-track"><div id="cl-loading-bar"></div></div><span id="cl-loading-label">Loading…</span>';
 document.body.append(root);
 const bar=root.querySelector('#cl-loading-bar'),label=root.querySelector('#cl-loading-label');
 let active=0,progress=0,timer=null,finishTimer=null;
 function start(message){
  active++;clearTimeout(finishTimer);if(active>1)return;
  progress=8;bar.style.width='8%';label.textContent=message||'Loading…';root.classList.add('is-loading');
  clearInterval(timer);timer=setInterval(()=>{progress=Math.min(92,progress+(92-progress)*.11);bar.style.width=progress+'%'},350);
 }
 function finish(){
  active=Math.max(0,active-1);if(active)return;
  clearInterval(timer);bar.style.width='100%';label.textContent='Ready';
  finishTimer=setTimeout(()=>{root.classList.remove('is-loading');bar.style.width='0%'},450);
 }
 function track(promise,message){start(message);return Promise.resolve(promise).finally(finish)}
 window.commandLedgerLoading={start,finish,track};
})();