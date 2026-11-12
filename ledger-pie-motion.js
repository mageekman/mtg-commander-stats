import {pieSegmentAt} from './ledger-stat-games.js?v=pie-3';

// SVG segments can move independently without moving the chart or its center label.
export function attachLedgerPie(chart,rate,{onSelect}={}){
 if(!chart||!Number.isFinite(rate))return ()=>{};
 const percent=Math.max(0,Math.min(100,rate)),inner=chart.classList.contains('stats-donut')?.72:.78,stroke=100*(1-inner),radius=100-stroke/2,length=2*Math.PI*radius,win=length*percent/100;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','-8 -8 216 216');svg.setAttribute('aria-hidden','true');svg.classList.add('ledger-pie-segments');
 for(const [result,size,offset]of [['wins',win,length/4],['losses',length-win,length/4-win]]){
  const circle=document.createElementNS(ns,'circle');circle.classList.add('ledger-pie-segment','ledger-pie-'+result);
  for(const [key,value]of Object.entries({cx:100,cy:100,r:radius,fill:'none','stroke-width':stroke,'stroke-dasharray':size+' '+(length-size),'stroke-dashoffset':offset}))circle.setAttribute(key,String(value));
  const angle=percent*Math.PI/100+(result==='wins'?-Math.PI/2:Math.PI/2),distance=percent===0||percent===100?0:4;
  circle.style.setProperty('--segment-x',Math.cos(angle)*distance+'px');circle.style.setProperty('--segment-y',Math.sin(angle)*distance+'px');svg.append(circle);
 }
 chart.prepend(svg);chart.classList.add('ledger-pie-chart');
 function resultAt(event){const rect=chart.getBoundingClientRect();return pieSegmentAt(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height,percent,inner)}
 function move(event){if(event.pointerType==='touch')return;const result=resultAt(event);if(result==='wins'||result==='losses'){chart.dataset.hoverResult=result;chart.title='View '+result}else{delete chart.dataset.hoverResult;chart.title='View all games'}}
 function leave(){delete chart.dataset.hoverResult;chart.removeAttribute('title')}
 function click(event){if(event.target.closest('button'))return;const result=resultAt(event);if(!result)return;event.stopPropagation();onSelect?.(result)}
 chart.addEventListener('pointermove',move);chart.addEventListener('pointerleave',leave);chart.addEventListener('click',click);
 return ()=>{chart.removeEventListener('pointermove',move);chart.removeEventListener('pointerleave',leave);chart.removeEventListener('click',click);svg.remove();chart.classList.remove('ledger-pie-chart');leave()};
}
