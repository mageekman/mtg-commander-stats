import {createPlayerPassportCards} from './player-passport-card.js?v=popup-2';
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e};
const button=(text,click)=>{const b=node('button',text);b.type='button';b.onclick=click;return b};
export function playgroupStatsRange(preset,now=new Date()){
 const day=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 if(preset==='all')return{range_start:null,range_end:null};
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 if(preset==='year')start.setMonth(0,1);else start.setDate(start.getDate()-(preset==='90'?89:29));
 return{range_start:day(start),range_end:day(now)};
}
export function mountPlaygroupDashboard(host,client,group,{passport=createPlayerPassportCards(client),loadArtwork=name=>window.commandLedgerCommanderArtwork?.(name)}={}){
 let request=0,data=null,ranking='win',rankPage=1,commanderPage=1;
 host.className='pg-dashboard';host.setAttribute('aria-label','Playgroup stats');
 const heading=node('div',undefined,'pg-heading'),title=node('h3','Table stats'),tools=node('form',undefined,'pg-stats-tools'),label=node('label','View'),preset=node('select');preset.setAttribute('aria-label','Playgroup stats timeframe');
 for(const[value,text]of[['all','All time'],['year','This year'],['90','Last 90 days'],['30','Last 30 days'],['custom','Custom dates']]){const option=node('option',text);option.value=value;preset.append(option)}label.append(preset);
 const custom=node('div',undefined,'pg-stats-custom');custom.hidden=true;
 const startLabel=node('label','From'),endLabel=node('label','To'),start=node('input'),end=node('input');start.type=end.type='date';start.required=end.required=true;start.setAttribute('aria-label','Stats start date');end.setAttribute('aria-label','Stats end date');startLabel.append(start);endLabel.append(end);const apply=node('button','Apply');apply.type='submit';custom.append(startLabel,endLabel,apply);
 const refresh=button('Refresh stats',()=>load());tools.append(label,custom,refresh);heading.append(title,tools);
 const status=node('p',undefined,'pg-muted');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const content=node('div');host.append(heading,node('p','Shared games only. Player rankings include tagged current members; win-rate ties go to more games played.','pg-muted'),status,content);
 function pages(host,total,current,change){const count=Math.ceil(total/5);if(count<2)return;const controls=node('div',undefined,'pg-stats-pages'),prev=button('Previous',()=>change(current-1)),next=button('Next',()=>change(current+1));prev.disabled=current===1;next.disabled=current===count;controls.append(prev,node('span',current+' / '+count),next);host.append(controls)}
 function render(){
  content.replaceChildren();if(!data)return;
  const summary=node('div',undefined,'pg-stats-summary');for(const[label,value]of[['Shared games',data.games],['Players ranked',data.players_ranked],['Commanders played',data.commanders_played]]){const box=node('div');box.append(node('span',label),node('strong',String(value)));summary.append(box)}content.append(summary);
  if(!data.games){content.append(node('p','No shared games in this timeframe. Choose a playgroup when recording a game to start building your table’s stats.','pg-empty'));return}
  const grid=node('div',undefined,'pg-stats-grid'),rankBlock=node('section',undefined,'pg-stats-block'),commanderBlock=node('section',undefined,'pg-stats-block');rankBlock.setAttribute('aria-label','Member rankings');commanderBlock.setAttribute('aria-label','Commander performance');rankBlock.append(node('h3','Member rankings'));
  const tabs=node('div',undefined,'pg-stats-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Ranking type');const tabButtons=[];
  for(const[value,text]of[['win','Win rate'],['games','Games played']]){const tab=button(text,()=>{ranking=value;rankPage=1;render();content.querySelector('[role=tab][aria-selected=true]').focus()});tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(ranking===value));tab.tabIndex=ranking===value?0:-1;tab.id='pg-rank-tab-'+value;tab.setAttribute('aria-controls','pg-ranking-panel');tab.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();tabButtons[e.key==='Home'?0:e.key==='End'?1:value==='win'?1:0].click()};tabs.append(tab);tabButtons.push(tab)}rankBlock.append(tabs);
  const ranks=node('div',undefined,'pg-ranking-list');ranks.id='pg-ranking-panel';ranks.setAttribute('role','tabpanel');ranks.setAttribute('aria-labelledby','pg-rank-tab-'+ranking);
  const ordered=[...data.rankings].sort((a,b)=>a[ranking==='win'?'win_rank':'games_rank']-b[ranking==='win'?'win_rank':'games_rank']);
  for(const person of ordered.slice((rankPage-1)*5,rankPage*5)){const row=node('div',undefined,'pg-ranking-row');row.append(node('strong','#'+person[ranking==='win'?'win_rank':'games_rank'],'pg-rank-number'),passport(person));const score=node('div',undefined,'pg-rank-score');score.append(node('strong',ranking==='win'?Number(person.win_rate).toFixed(1)+'%':String(person.games)),node('small',person.wins+' wins'),node('small',person.games+' games'));score.title=person.wins+' wins in '+person.games+' games';row.append(score);ranks.append(row)}
  if(!ordered.length)ranks.append(node('p','No tagged current members played in this timeframe.','pg-empty'));rankBlock.append(ranks);pages(rankBlock,ordered.length,rankPage,p=>{rankPage=p;render()});
  commanderBlock.append(node('h3','Commander performance'),node('p','Most played · up to 20 commanders. Each seat counts as one appearance.','pg-muted'));
  const commanders=node('div',undefined,'pg-commander-list');
  for(const commander of data.commanders.slice((commanderPage-1)*5,commanderPage*5)){const row=node('article',undefined,'pg-commander-row'),art=node('div',undefined,'pg-commander-art'),copy=node('div',undefined,'pg-commander-copy'),rate=node('div',undefined,'pg-commander-rate');copy.append(node('strong',commander.commander),node('small',commander.appearances+' appearances · '+commander.wins+' wins'));rate.append(node('strong',Number(commander.win_rate).toFixed(1)+'%'));const meter=node('meter');meter.min=0;meter.max=100;meter.value=Number(commander.win_rate);meter.setAttribute('aria-label',commander.commander+' win rate');rate.append(meter);row.append(art,copy,rate);commanders.append(row);
   Promise.resolve().then(()=>loadArtwork(commander.commander)).then(url=>{if(!url||!art.isConnected)return;const image=node('img');image.src=url;image.alt='';image.loading='lazy';image.decoding='async';image.onerror=()=>image.remove();art.append(image)}).catch(()=>{});
  }
  if(!data.commanders.length)commanders.append(node('p','No commander names were recorded in these games.','pg-empty'));commanderBlock.append(commanders);pages(commanderBlock,data.commanders.length,commanderPage,p=>{commanderPage=p;render()});grid.append(rankBlock,commanderBlock);content.append(grid);
 }
 async function load(){
  const current=++request;rankPage=commanderPage=1;data=null;content.replaceChildren();host.setAttribute('aria-busy','true');status.textContent='Loading playgroup stats…';refresh.disabled=true;
  const range=preset.value==='custom'?{range_start:start.value,range_end:end.value}:playgroupStatsRange(preset.value);
  try{const{data:result,error}=await client.rpc('get_playgroup_stats',{target_group:group,...range});if(error)throw error;if(current!==request||!host.isConnected)return;data=result;render();status.textContent='';}
  catch{if(current===request&&host.isConnected)status.textContent='Playgroup stats could not load. Use Refresh stats to try again.'}
  finally{if(current===request){refresh.disabled=false;host.setAttribute('aria-busy','false')}}
 }
 preset.onchange=()=>{custom.hidden=preset.value!=='custom';if(custom.hidden){start.disabled=end.disabled=true;load()}else{request++;refresh.disabled=false;host.setAttribute('aria-busy','false');data=null;content.replaceChildren();status.textContent='Choose dates and select Apply.';start.disabled=end.disabled=false;start.value||=playgroupStatsRange('30').range_start;end.value||=playgroupStatsRange('30').range_end;start.focus()}};
 start.disabled=end.disabled=true;start.oninput=end.oninput=()=>end.setCustomValidity('');tools.onsubmit=e=>{e.preventDefault();if(preset.value!=='custom')return;if(start.value>end.value){end.setCustomValidity('End date must be on or after the start date.');end.reportValidity();return}end.setCustomValidity('');load()};
 refresh.onclick=()=>{if(preset.value==='custom'){tools.requestSubmit();return}load()};document.addEventListener('command-ledger-game-recorded',()=>{if(host.isConnected&&(preset.value!=='custom'||start.value&&end.value&&start.value<=end.value))load()});load();
}
