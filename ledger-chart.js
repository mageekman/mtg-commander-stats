export function renderWinrateTrendChart(host,empty,visibleGames,options={}){
 host.replaceChildren();
 const ordered=visibleGames.filter(g=>g.played_at||options.includeUndated).slice().sort((a,b)=>a.played_at&&b.played_at?(String(a.played_at).localeCompare(String(b.played_at))||String(a.id).localeCompare(String(b.id))):0);
 empty.hidden=ordered.length>0;if(!ordered.length)return;
 let wins=0;const points=ordered.map((g,i)=>{if(g.won)wins++;const value=wins/(i+1)*100;return {date:g.played_at,value,game:i+1}});
 const svgNS='http://www.w3.org/2000/svg',make=(tag,attrs={})=>{const n=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n};
 const width=900,height=260,left=48,right=18,top=20,bottom=44,plotW=width-left-right,plotH=height-top-bottom;
 const x=i=>left+(points.length===1?plotW/2:i*plotW/(points.length-1)),y=v=>top+(100-v)*plotH/100;
 const svg=make('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':'Cumulative win rate trend from '+points.length+' recorded games'});
 for(const v of [0,25,50,75,100]){const yy=y(v);svg.append(make('line',{x1:left,y1:yy,x2:width-right,y2:yy,class:'trend-grid'}));const label=make('text',{x:left-10,y:yy+4,'text-anchor':'end',class:'trend-axis'});label.textContent=v+'%';svg.append(label)}
 const coords=points.map((p,i)=>[x(i),y(p.value)]);
 const path=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
 const area=path+' L '+x(points.length-1)+' '+y(0)+' L '+x(0)+' '+y(0)+' Z';
 svg.append(make('path',{d:area,class:'trend-area'}),make('path',{d:path,class:'trend-line'}));
 const selected=new Set([0,points.length-1]);for(let i=0;i<points.length;i+=Math.max(1,Math.ceil(points.length/6)))selected.add(i);
 for(const i of selected){const p=points[i],date=new Date(String(p.date).slice(0,10)+'T12:00:00');const label=make('text',{x:x(i),y:height-13,'text-anchor':i===0?'start':i===points.length-1?'end':'middle',class:'trend-axis'});label.textContent=Number.isNaN(date.getTime())?'Game '+p.game:date.toLocaleDateString(undefined,{month:'short',day:'numeric'});svg.append(label)}
 for(const i of selected){const p=points[i],dot=make('circle',{cx:x(i),cy:y(p.value),r:4,class:'trend-point'}),tip=make('title');tip.textContent='Game '+p.game+' · '+p.value.toFixed(1)+'%'+(p.date?' · '+p.date:'');dot.append(tip);svg.append(dot)}
 host.append(svg);
}

