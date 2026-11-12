const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
export function sortTogetherFriends(rows){
 const rate=row=>Number.isFinite(row.your_rate)?row.your_rate:row.games>0&&Number.isFinite(row.your_wins)?100*row.your_wins/row.games:-1;
 return [...rows].sort((a,b)=>rate(b)-rate(a)||b.games-a.games||String(a.name||'').localeCompare(String(b.name||''))||String(a.id||'').localeCompare(String(b.id||'')));
}

// Four reserved rows and one control row fit the existing 260px report panel.
export function renderGamesTogether(host,rows,{artwork,onGames}={}){
 host.classList.add('ledger-together');host.replaceChildren();
 const sorted=sortTogetherFriends(rows),note=node('p','Your win rate · selected period');note.className='ledger-together-note';host.append(note);
 if(!sorted.length){host.append(node('p','No tagged games with current friends in this period.'));return}
 const list=node('div');list.className='ledger-friend-list ledger-together-list';
 const pages=node('nav');pages.className='ledger-together-pages';pages.setAttribute('aria-label','Friends played with pages');
 const back=node('button','Previous'),next=node('button','Next'),count=node('span');back.type=next.type='button';back.setAttribute('aria-label','Previous friends played with');next.setAttribute('aria-label','Next friends played with');count.setAttribute('aria-live','polite');pages.append(back,count,next);
 const paginated=sorted.length>=5;pages.style.visibility=paginated?'visible':'hidden';pages.inert=!paginated;pages.setAttribute('aria-hidden',String(!paginated));host.append(list,pages);
 let page=0;
 function draw(){
  list.replaceChildren();const chunk=sorted.slice(page*4,page*4+4);
  for(const friend of chunk){
   const card=node('article');card.className='ledger-friend-passport';
   const identity=node(friend.handle?'a':'div');identity.className='ledger-together-passport';identity.title=friend.name+(friend.handle?' · @'+friend.handle:'');
   if(friend.handle){identity.href='./player.html?user='+encodeURIComponent(friend.handle);identity.setAttribute('aria-label','View '+friend.name+' player passport')}
   const art=artwork?.(friend.commander,friend);if(art){art.classList.add('ledger-together-art');identity.append(art)}
   const shade=node('span');shade.className='ledger-together-shade';const copy=node('span');copy.className='ledger-together-copy';const name=node('strong',friend.name);name.className='ledger-friend-name';copy.append(name);
   if(friend.handle){const handle=node('small','@'+friend.handle);handle.className='ledger-together-handle';copy.append(handle)}identity.append(shade,copy);card.append(identity);
   for(const [value,label]of [[String(friend.games),'Games'],[Number.isFinite(friend.your_rate)?friend.your_rate.toFixed(1)+'%':'—','Your win rate']]){const metric=node('div');metric.className='ledger-friend-metric';metric.append(node('strong',value),node('small',label));card.append(metric)}
   onGames?.(card,friend);list.append(card);
  }
  back.disabled=page===0;next.disabled=(page+1)*4>=sorted.length;count.textContent=(page*4+1)+'–'+Math.min((page+1)*4,sorted.length)+' of '+sorted.length;
 }
 back.onclick=()=>{page--;draw()};next.onclick=()=>{page++;draw()};draw();
}
