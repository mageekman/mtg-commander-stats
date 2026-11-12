import {rankingPeriods,rankingRange} from './friend-ranking-period.js?v=1';
import {filterTrendGames} from './ledger-trend-data.js?v=1';
import {renderWinrateTrendChart} from './ledger-chart.js?v=timeline-2';
export function mountLedgerTrend(getGames){
 const $=id=>document.getElementById(id),preset=$('trendPeriod'),group=$('trendGrouping'),start=$('trendStart'),end=$('trendEnd'),custom=$('trendCustomDates'),status=$('trendStatus'),host=$('winrateTrendChart'),empty=$('winrateTrendEmpty');
 for(const [value,label]of rankingPeriods){const option=document.createElement('option');option.value=value;option.textContent=label;preset.append(option)}
 function customDates(){custom.hidden=preset.value!=='custom'}
 function sync(){preset.value=$('statsDatePreset').value;start.value=$('statsDateStart').value;end.value=$('statsDateEnd').value;customDates()}
 let lastWidth=0,frame=0;
 function render(){
  let range;try{range=rankingRange(preset.value,start.value,end.value)}catch(error){host.replaceChildren();empty.hidden=true;status.textContent=error.message;return}
  const games=filterTrendGames(getGames(),range);lastWidth=host.clientWidth;
  renderWinrateTrendChart(host,empty,games,{groupBy:group.value,maxPoints:Math.max(24,Math.min(90,Math.floor((lastWidth||560)/8))),width:Math.max(220,lastWidth||560),height:200,maxLabels:lastWidth&&lastWidth<400?3:5});
  empty.textContent='No games in this graph timeline.';
  const grouping={game:'Per game',day:'Daily',week:'Weekly',month:'Monthly'}[host.dataset.grouping]||'Per game';
  status.textContent=range.label+' · '+(host.dataset.games||0)+' games · '+grouping.toLowerCase()+' cumulative win rate';
 }
 for(const input of [preset,group,start,end])input.addEventListener('change',()=>{customDates();render()});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{const width=host.clientWidth;if(width>0&&width!==lastWidth){cancelAnimationFrame(frame);frame=requestAnimationFrame(render)}}).observe(host);
 sync();return {sync,render};
}
