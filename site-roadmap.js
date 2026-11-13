// Planned features; keep these descriptions separate from shipped release history.
export const roadmapItems=[
 {title:'Playgroups',description:'Planeswalkers who play together, play against each other. Compare recorded stats with other players in your group, with leaderboards, events, and more!'},
 {title:'Store Accounts',description:'Your LGS can be on Command Ledger! Add a location to a game, see store attendees and leaderboards, discover which commanders reign supreme, and highlight store Champions.'},
 {title:'Events',description:'More info soon!'}
];
let dialog;
export function openRoadmap(){
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='siteRoadmap';dialog.setAttribute('aria-labelledby','siteRoadmapTitle');
  const header=document.createElement('header'),title=document.createElement('h2');title.id='siteRoadmapTitle';title.textContent='Roadmap';
  const close=document.createElement('button');close.type='button';close.className='changelog-close';close.textContent='×';close.setAttribute('aria-label','Close roadmap');close.onclick=()=>dialog.close();header.append(title,close);
  const body=document.createElement('div');body.className='changelog-body';const intro=document.createElement('p');intro.className='changelog-intro';intro.textContent='What we’re working toward for Command Ledger.';body.append(intro);
  for(const item of roadmapItems){const article=document.createElement('article'),heading=document.createElement('h3'),description=document.createElement('p');heading.textContent=item.title;description.textContent=item.description;article.append(heading,description);body.append(article)}
  dialog.append(header,body);document.body.append(dialog);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
 }
 if(!dialog.open){dialog.showModal();dialog.querySelector('.changelog-close').focus();dialog.querySelector('.changelog-body').scrollTop=0}
}
