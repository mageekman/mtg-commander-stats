const PAGE_SIZE=5;
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};

export function createStatGameExplorer({owner,enabled=()=>true,renderGame,hydrate,period,matches=(game,term)=>String(game.id||'').toLowerCase().includes(term.toLowerCase())}){
 let dialog,list,status,pager,heading,search,query,actor,scope,page=0,epoch=0;
 function clear(){epoch++;query=null;list?.replaceChildren();pager?.replaceChildren();list?.removeAttribute('aria-busy');if(search)search.value=''}
 function close(){clear();if(dialog?.open)dialog.close()}
 function mount(){
  if(dialog)return;
  dialog=node('dialog');dialog.className='stat-games-dialog';dialog.id='statGamesDialog';dialog.setAttribute('aria-labelledby','statGamesTitle');
  const header=node('header');heading=node('h2');heading.id='statGamesTitle';const dismiss=node('button','Close');dismiss.type='button';dismiss.className='stat-games-close';dismiss.onclick=close;
  header.append(heading,dismiss);status=node('p');status.className='stat-games-status';status.setAttribute('role','status');
  const searchLabel=node('label','Search these games');searchLabel.className='stat-games-search';search=node('input');search.type='search';search.placeholder='Deck, commander, player, or @username…';search.setAttribute('aria-label','Search matching games');search.autocomplete='off';search.oninput=()=>{page=0;refresh()};searchLabel.append(search);
  list=node('div');list.className='stat-game-history history-compact';pager=node('nav');pager.setAttribute('aria-label','Matching games pages');pager.className='stat-games-pagination';
  dialog.append(header,searchLabel,status,list,pager);document.body.append(dialog);
  dialog.addEventListener('close',()=>{if(!dialog.open)clear()});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 }
 async function refresh(){
  if(!dialog?.open||!query)return;
  if(owner()!==actor||!enabled()){close();return}
  const token=++epoch;list.setAttribute('aria-busy','true');status.textContent='Loading matching games…';
  try{
   const rows=await query();if(token!==epoch||!dialog.open)return;if(owner()!==actor||!enabled()){close();return}
   const term=search.value.trim();const games=rows.filter(game=>!term||matches(game,term)).sort((a,b)=>b.played_at.localeCompare(a.played_at)||String(b.id).localeCompare(String(a.id)));
   const pages=Math.max(1,Math.ceil(games.length/PAGE_SIZE));page=Math.max(0,Math.min(page,pages-1));const visible=games.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
   const focusWasInList=list.contains(document.activeElement);
   status.textContent=(term?games.length+' of '+rows.length+' games match your search':games.length+' matching '+(games.length===1?'game':'games'))+' · '+(scope?.()||period());list.replaceChildren();pager.replaceChildren();pager.hidden=pages<=1;
   if(!visible.length)list.append(node('p',term?'No games in this result match your search. Try another commander, player, or username.':'No games match this result in the selected timeframe.'));
   else for(const game of visible)list.append(renderGame(game));
   if(pages>1){for(const [label,next,disabled]of [['Previous',page-1,page===0],['Next',page+1,page===pages-1]]){const button=node('button',label);button.type='button';button.disabled=disabled;button.onclick=async()=>{page=next;const previous=epoch;await refresh();if(epoch===previous+1&&document.activeElement!==search)pager.querySelector('button:not(:disabled)')?.focus()};pager.append(button)}pager.insertBefore(node('span',(page+1)+' / '+pages),pager.lastChild)}
   hydrate(list,visible);if(focusWasInList)dialog.querySelector('.stat-games-close').focus();
  }catch{if(token===epoch)status.textContent='Could not load matching games. Close this window and try again.'}
  finally{if(token===epoch)list.removeAttribute('aria-busy')}
 }
 function open(title,getGames,timeframe){if(!owner()||!enabled())return;mount();actor=owner();heading.textContent=title;query=getGames;scope=timeframe;page=0;search.value='';if(!dialog.open)dialog.showModal();refresh()}
 function bind(host,title,getGames,timeframe,{buttonOnly=false,label=null}={}){
  if(!host)return;
  host.querySelector(':scope > .stat-games-trigger')?.remove();host.classList.remove('stat-games-interactive');host.onclick=null;
  if(!owner()||!enabled())return;
  if(!buttonOnly)host.classList.add('stat-games-interactive');
  const old=host.querySelector(':scope > .stat-games-trigger');old?.remove();
  const button=node('button');button.title='View games: '+title;button.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5"/></svg>';if(label)button.textContent=label;button.type='button';button.className='stat-games-trigger'+(label?' stat-games-text-trigger':'');button.setAttribute('aria-label','View games: '+title);button.setAttribute('aria-haspopup','dialog');button.onclick=e=>{e.stopPropagation();open(title,getGames,timeframe)};host.append(button);
  if(!buttonOnly)host.onclick=e=>{if(e.target.closest('a,button,input,select,label'))return;open(title,getGames,timeframe)};
 }
 return {open,bind,refresh,error(message){if(dialog?.open)status.textContent=message}};
}
