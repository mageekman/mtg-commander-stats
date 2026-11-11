const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const funnel='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const orderIcon='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4v16m-4-4 4 4 4-4M14 5h7m-7 5h5m-5 5h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function mount({id,title,row,filters,order,asc='asc',desc='desc',before=null}){
 if(!row||!order||document.getElementById(id+'Filters'))return;
 row.classList.add('search-filter-row');
 const wrapper=node('div');wrapper.className='search-filter-menu';const button=node('button');button.id=id+'Filters';button.type='button';button.className='search-filter-button';button.innerHTML=funnel+'<span class="search-filter-caption">Filters</span><span class="search-filter-count" hidden></span>';
 const panel=node('div');panel.id=id+'FilterPanel';panel.className='search-filter-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title+' filters');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 const native=typeof panel.showPopover==='function';if(native)panel.setAttribute('popover','auto');else panel.hidden=true;
 const heading=node('strong',title+' filters');heading.className='search-filter-title';panel.append(heading);
 const defaults=new Map();for(const select of filters.filter(Boolean)){defaults.set(select,select.querySelector('option[selected]')?.value??select.options[0]?.value??'');const label=select.closest('label');if(label)panel.append(label)}
 const reset=node('button','Reset filters');reset.type='button';reset.className='search-filter-reset';panel.append(reset);wrapper.append(button,panel);
 // Retain the existing select and change event for the established sort logic.
 const orderLabel=order.closest('label');if(orderLabel){orderLabel.hidden=true;row.append(orderLabel)}else order.hidden=true;
 const toggle=node('button');toggle.id=id+'Order';toggle.type='button';toggle.className='search-order-button';toggle.innerHTML=orderIcon;
 if(before){before.before(wrapper,toggle)}else row.append(wrapper,toggle);
 const isOpen=()=>native?panel.matches(':popover-open'):!panel.hidden;
 function place(){if(!isOpen())return;const anchor=button.getBoundingClientRect();if(anchor.bottom<0||anchor.top>innerHeight){close();return}const box=panel.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(innerWidth-box.width-12,anchor.right-box.width))+'px';panel.style.top=Math.max(12,Math.min(innerHeight-box.height-12,anchor.bottom+box.height+8<innerHeight?anchor.bottom+8:anchor.top-box.height-8))+'px'}
 function close(){if(!isOpen())return;if(native)panel.hidePopover();else{panel.hidden=true;button.setAttribute('aria-expanded','false')}}
 function paint(){const ascending=order.value===asc;toggle.dataset.direction=ascending?'asc':'desc';toggle.setAttribute('aria-pressed',String(ascending));toggle.setAttribute('aria-label','Sort '+(ascending?'descending':'ascending')+' in '+title);toggle.title=(ascending?'Ascending':'Descending')+' order — click to reverse';const active=[...defaults].filter(([select,value])=>select.value!==value).length,count=button.querySelector('.search-filter-count');count.hidden=!active;count.textContent=String(active);button.setAttribute('aria-label',title+' filters'+(active?', '+active+' active':''));reset.disabled=!active}
 toggle.onclick=()=>{order.value=order.value===asc?desc:asc;order.dispatchEvent(new Event('change',{bubbles:true}));paint()};order.addEventListener('change',paint);
 for(const select of defaults.keys())select.addEventListener('change',paint);
 reset.onclick=()=>{for(const [select,value]of defaults){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}))}paint()};
 button.onclick=()=>{if(isOpen()){close();return}if(native)panel.showPopover();else panel.hidden=false;button.setAttribute('aria-expanded','true');place();panel.querySelector('select')?.focus()};
 if(native)panel.addEventListener('toggle',()=>{button.setAttribute('aria-expanded',String(isOpen()));if(isOpen())place();else if(panel.contains(document.activeElement))button.focus()});
 else{document.addEventListener('click',event=>{if(!wrapper.contains(event.target))close()});panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();button.focus()}})}
 window.addEventListener('resize',place);document.addEventListener('scroll',event=>{if(!panel.contains(event.target))place()},true);paint();return {close};
}
const get=id=>document.getElementById(id);
if(get('homeDeckSearch')){
 const row=document.querySelector('.home-deck-controls');mount({id:'homeDeck',title:'My Decks',row,filters:[get('homeDeckSort')],order:get('homeDeckDirection'),before:row?.querySelector('.home-deck-view-toggle')});document.querySelector('.home-deck-sort')?.remove();
}
if(get('deckStatsSearch')){
 const row=document.querySelector('.ledger-by-deck .deck-carousel-controls');mount({id:'ledgerDeck',title:'Ledger decks',row,filters:[get('ledgerDeckSort')],order:get('ledgerDeckDirection'),before:get('deckCarouselPrev')});
}
if(get('historySearch')){
 const search=get('historySearch').closest('label'),row=node('div');search.before(row);row.append(search);mount({id:'history',title:'Game history',row,filters:[get('historyPeriodFilter'),get('historyResultFilter'),get('historyDeckFilter'),get('historyPageSize')],order:get('historyDateSort'),asc:'oldest',desc:'newest'});document.querySelector('#gameHistorySection .history-heading')?.remove();
}
