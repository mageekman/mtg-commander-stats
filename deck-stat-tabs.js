const groups=[
 ['performance','Performance',[['trend','Win-rate trend'],['recent','Recent form']]],
 ['matchups','Matchups',[['matchups','Commanders'],['rival','Rival'],['friends','Friends']]],
 ['patterns','Play Patterns',[['first','Going first'],['sizes','Table size']]],
 ['activity','Deck Activity',[['activity','Activity']]]
];
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
export function groupDeckStats(grid,selected){
 const cards=new Map([...grid.children].map(card=>[card.dataset.insight,card]));grid.replaceChildren();
 for(const [key,title,views]of groups){
  const group=node('section');group.className='deck-stat-group';group.dataset.group=key;
  const heading=node('header');heading.className='deck-stat-group-heading';const label=node('h3',title);label.id='deck-group-'+key;heading.append(label);group.append(heading);
  const tabs=node('div');tabs.className='deck-stat-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',title+' views');const panels=node('div');panels.className='deck-stat-group-panels';const buttons=[];
  for(const [id,text]of views){const card=cards.get(id);if(!card)continue;const button=node('button',text);button.type='button';button.id='deck-tab-'+id;button.setAttribute('role','tab');button.setAttribute('aria-controls','deck-panel-'+id);button.dataset.view=id;tabs.append(button);buttons.push(button);card.id='deck-panel-'+id;card.classList.add('deck-tab-panel');card.setAttribute('role',views.length>1?'tabpanel':'region');card.setAttribute('aria-labelledby',views.length>1?button.id:label.id);card.tabIndex=0;panels.append(card)}
  function activate(id,focus=false){selected[key]=id;for(const button of buttons){const active=button.dataset.view===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;cards.get(button.dataset.view).hidden=!active;if(active&&focus)button.focus()}}
  buttons.forEach((button,index)=>{button.onclick=()=>activate(button.dataset.view);button.onkeydown=event=>{let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();activate(buttons[next].dataset.view,true)}});
  if(views.length>1)group.append(tabs);group.append(panels);grid.append(group);activate(buttons.some(b=>b.dataset.view===selected[key])?selected[key]:views[0][0]);
 }
}
