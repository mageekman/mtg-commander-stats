import {createStatGameExplorer} from './ledger-stat-games.js?v=pie-3';
import {attachLedgerPie} from './ledger-pie-motion.js?v=1';
import {gameMatchesSearch} from './game-history-search.js?v=1';
import {node} from './deck-visuals.js?v=prepared-perf-1';
const key=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
export const hasCommander=(game,name)=>(Array.isArray(game.players)&&game.players.length>1?game.players.slice(1).map(p=>p?.commander):game.opponents||[]).some(value=>key(value)===key(name));
export function createDeckExplorer({deck,user,settings,names,period}){
 return createStatGameExplorer({owner:()=>user.id,enabled:()=>settings().interactive,period,matches:(game,term)=>gameMatchesSearch(game,deck,term,names()),hydrate:()=>{},renderGame:game=>{
  const row=node('article');row.className='deck-game-line';const outcome=node('strong',game.won?'WIN':'LOSS');outcome.className=game.won?'win':'loss';const info=node('div');info.append(node('strong',deck.name));const players=Array.isArray(game.players)?game.players:[];const people=players.map((p,i)=>i===0?'You':names().get(p.friend_id||p.participant_id)||p.display_name||p.name||p.commander).filter(Boolean);info.append(node('small',people.length?people.join(' · '):(game.opponents||[]).join(' · ')));const date=node('time',game.played_at);date.dateTime=game.played_at;const link=node('a','Open in Ledger');link.href='./ledger.html?deck='+encodeURIComponent(deck.id);row.append(date,info,outcome,link);return row;
 }});
}
export function bindDeckReports({grid,summary,explorer,settings,filtered,games,range,form,cleanup}){
 const bind=(host,title,rows,options)=>{if(!host)return;explorer.bind(host,title,()=>rows,()=>range.label,options);if(settings.interactive){const click=host.onclick;if(click)host.onclick=event=>{click(event);event.stopPropagation()}}};
 const pie=(host,title,rows,timeframe=()=>range.label)=>{bind(host,title,rows);if(host?.querySelector(':scope > .stat-games-trigger'))host.querySelector(':scope > .stat-games-trigger').onclick=event=>{event.stopPropagation();explorer.open(title,()=>rows,timeframe)};if(settings.interactive&&rows.length){if(host.classList.contains('deck-donut'))host.classList.add('stats-donut');const rate=100*rows.filter(g=>g.won).length/rows.length;cleanup.push(attachLedgerPie(host,rate,{onSelect:result=>explorer.open(title+' · '+(result==='all'?'All games':result==='wins'?'Wins':'Losses'),()=>rows.filter(g=>result==='all'||g.won===(result==='wins')),timeframe)}))}};
 if(summary){for(const [type,predicate]of [['games',()=>true],['wins',g=>g.won],['losses',g=>!g.won]])bind(summary.querySelector('[data-summary='+type+']'),type[0].toUpperCase()+type.slice(1),filtered.filter(predicate));pie(summary.querySelector('.deck-donut'),'Deck record',filtered)}
 for(const card of grid.querySelectorAll('[data-insight]')){
  const id=card.dataset.insight;if(!settings[id]){card.remove();continue}const body=card.querySelector('.deck-insight-body');
  if(id==='trend')bind(card.querySelector('header'),'Win-rate trend',filtered,{buttonOnly:true,label:'View games'});
  else if(id==='recent')body.querySelectorAll('.deck-ring-metric').forEach((host,i)=>{const dates=i?form.previous:form.current;pie(host.querySelector('.deck-rate-ring'),i?'Previous period':'Recent form',games.filter(g=>g.played_at>=dates.start&&g.played_at<=dates.end),()=>dates.start+' – '+dates.end)});
  else if(id==='first')body.querySelectorAll('.deck-ring-metric').forEach((host,i)=>pie(host.querySelector('.deck-rate-ring'),i?'Someone else went first':'You went first',filtered.filter(g=>Array.isArray(g.players)&&Number.isInteger(g.first_player)&&g.first_player>=0&&g.first_player<g.players.length&&(i?g.first_player!==0:g.first_player===0))));
  else if(id==='matchups')body.querySelectorAll('.deck-commander-matchup').forEach(host=>bind(host,'Against '+host.querySelector('h4').textContent,filtered.filter(g=>hasCommander(g,host.querySelector('h4').textContent))));
  else if(id==='rival'){const name=body.querySelector('h4')?.textContent;if(name)bind(body,'Losses to '+name,filtered.filter(g=>!g.won&&Number.isInteger(g.winner_player)&&g.winner_player>0&&key(g.players?.[g.winner_player]?.commander)===key(name)))}
  else if(id==='sizes')body.querySelectorAll('.deck-rate-row').forEach(host=>{const size=Number(host.querySelector('span').textContent.split(' ')[0]);bind(host,size+'-player games',filtered.filter(g=>g.players?.length===size))});
  else if(id==='activity'){bind(body.querySelector('.deck-usage'),'Deck activity',filtered);const attach=()=>body.querySelectorAll('.deck-month-column').forEach(host=>{const month=host.querySelector('small').textContent;bind(host,'Games in '+month,filtered.filter(g=>g.played_at.startsWith(month)))});attach();body.querySelectorAll('.deck-stat-pagination button').forEach(button=>button.addEventListener('click',attach));}
  else if(id==='friends'){const attach=()=>body.querySelectorAll('.deck-friend-matchup').forEach(host=>{const id=host.dataset.friendId;bind(host,'Games with '+host.querySelector('h4').textContent,filtered.filter(g=>g.players?.slice(1).some(p=>(p.friend_id||p.participant_id)===id)))});attach();body.querySelectorAll('.deck-stat-pagination button').forEach(button=>button.addEventListener('click',attach));}
 }
}
