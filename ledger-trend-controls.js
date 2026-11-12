import {rankingPeriods,rankingRange} from './friend-ranking-period.js?v=1';
import {filterTrendGames} from './ledger-trend-data.js?v=1';
import {renderWinrateTrendChart} from './ledger-chart.js?v=timeline-2';
export function mountLedgerTrend(getGames,options={}){
 const scope=options.root||document,$=id=>scope.querySelector('#'+id),preset=$('trendPeriod'),group=$('trendGrouping'),start=$('trendStart'),end=$('trendEnd'),custom=$('trendCustomDates'),status=$('trendStatus'),host=$('winrateTrendChart'),empty=$('winrateTrendEmpty');
 const main=options.main||{preset:$('statsDatePreset'),start:$('statsDateStart'),end:$('statsDateEnd')};
 for(const [value,label]of rankingPeriods){const option=document.createElement('option');option.value=value;option.textContent=label;preset.append(option)}
 function customDates(){custom.hidden=preset.value!=='custom'}
 function sync(){preset.value=main.preset.value;start.value=main.start.value;end.value=main.end.value;customDates()}
 let lastWidth=0,frame=0,epoch=0,disposed=false,observer;
 async function render(){
  const token=++epoch;let range;try{range=rankingRange(preset.value,start.value,end.value)}catch(error){host.replaceChildren();empty.hidden=true;status.textContent=error.message;host.removeAttribute('aria-busy');return}
  try{
   let games;if(options.loadGames){status.textContent='Loading graph…';host.setAttribute('aria-busy','true');games=await options.loadGames(range);if(token!==epoch||disposed)return}else games=filterTrendGames(getGames(),range);
   lastWidth=host.clientWidth;
   renderWinrateTrendChart(host,empty,games,{groupBy:group.value,maxPoints:Math.max(24,Math.min(90,Math.floor((lastWidth||560)/8))),width:Math.max(220,lastWidth||560),height:200,maxLabels:lastWidth&&lastWidth<400?3:5});
   empty.textContent='No games in this graph timeline.';
   const grouping={game:'Per game',day:'Daily',week:'Weekly',month:'Monthly'}[host.dataset.grouping]||'Per game';
   status.textContent=range.label+' · '+(host.dataset.games||0)+' games · '+grouping.toLowerCase()+' cumulative win rate';
  }catch(error){if(token===epoch&&!disposed){host.replaceChildren();empty.hidden=true;status.textContent='Could not load graph. '+error.message}}
  finally{if(token===epoch&&!disposed)host.removeAttribute('aria-busy')}
 }
 for(const input of [preset,group,start,end])input.addEventListener('change',()=>{customDates();render()});
 if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{const width=host.clientWidth;if(width>0&&width!==lastWidth){cancelAnimationFrame(frame);frame=requestAnimationFrame(render)}});observer.observe(host)}
 sync();const state=options.state;if(state){if(state.period&&rankingPeriods.some(([value])=>value===state.period))preset.value=state.period;if(state.start!==undefined)start.value=state.start;if(state.end!==undefined)end.value=state.end;if(state.group)group.value=state.group;customDates()}
 return {sync,render,state:()=>({period:preset.value,start:start.value,end:end.value,group:group.value}),destroy(){disposed=true;epoch++;observer?.disconnect();cancelAnimationFrame(frame)}};
}
