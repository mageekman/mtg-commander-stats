import {renderGamesTogether} from './ledger-together.js?v=1';
import {startStatLoading} from './stat-loading.js?v=1';
import {selectStrongestColor,selectMostPlayedColor} from './strongest-color.js?v=combo-2';
import {node,pct,ring,rateBar,artPanel,pagedCards} from './deck-visuals.js?v=prepared-perf-1';
import {createLedgerReport} from './ledger-report-tabs.js?v=mockup-1';
import {mountLedgerTrend} from './ledger-trend-controls.js?v=loading-3';
import {renderColorUsage} from './color-combo-usage.js?v=public-3';
import {commanderColors} from './ledger-commander-colors.js?v=1';
import {rankingPeriods,rankingRange} from './friend-ranking-period.js?v=1';
import {applyFrame} from './ledger-art-adjustment.js?v=history-2';

export async function mountSharedLedger(root,{client,handle}){
 root.hidden=false;root.replaceChildren();
 const shell=node('div');shell.id='statisticsSection';shell.className='public-ledger-statistics';
 const heading=node('div');heading.className='archive-section-heading';
 const titleRow=node('div');titleRow.className='statistics-title-row';
 const title=node('h2','Statistics'),label=node('label','View '),period=node('select');period.id='sharedStatsPeriod';
 for(const [value,text]of rankingPeriods){const option=node('option',text);option.value=value;period.append(option)}label.append(period);titleRow.append(title,label);
 const custom=node('div');custom.className='ledger-custom-dates';custom.hidden=true;
 const start=node('input'),end=node('input');start.type=end.type='date';start.id='sharedStatsStart';end.id='sharedStatsEnd';
 for(const [text,input]of [['From',start],['Through',end]]){const label=node('label',text);label.append(input);custom.append(label)}
 const status=node('p');status.className='muted';status.setAttribute('role','status');
 heading.append(titleRow,node('p','Performance, rivalries, and most memorable commanders.'),custom,status);
 const usage=node('section');usage.id='colorComboUsage';usage.hidden=true;usage.setAttribute('aria-labelledby','colorUsageTitle');const usageTitle=node('h3','Color combo usage');usageTitle.id='colorUsageTitle';const usageChart=node('div');usageChart.id='colorUsageChart';usage.append(usageTitle,usageChart);
 const totals=node('div'),featured=node('div'),colors=node('div'),rivalry=node('div'),reports=node('div'),decks=node('div');
 featured.className='featured-decks';colors.id='statInsights';colors.className='extra-stats';rivalry.className='ledger-rivalry';reports.id='ledgerAdditionalStats';reports.className='ledger-additional-stats';decks.className='ledger-by-deck';
 shell.append(heading,totals,featured,colors,usage,rivalry,reports,decks);root.append(shell);
 let sharedTrend=null;
 let epoch=0,current,reportSignature='',reportViews=null,firstSelect=null,deckSearch='',deckSort='winrate',deckDirection='desc';
 const artwork=(name,slot='',className='')=>artPanel(name,className,{onImage:(image)=>{const frame=current?.artwork?.find(a=>a.slot===slot&&a.commander===name);if(frame)applyFrame(image,frame)}});
 function featuredCard(host,deck,label,slot){
  if(!deck)return;const card=node('div');card.className='best-deck-card';const image=node('div');image.className='best-deck-art';
  const copy=node('div');copy.className='best-deck-content';const rival=slot==='rival-commander',most=slot==='most-played-deck';
  const rate=deck.games?100*deck.wins/deck.games:0;
  for(const [tag,text,cls]of [['span',label,'best-deck-label'],['strong',deck.name||deck.commander,'best-deck-name'],['span',rival?'':deck.commander,'best-deck-commander'],['strong',rival?deck.losses+' losses':most?deck.games+' games played':pct(rate)+' win rate','best-deck-rate'],['small',rival?'Against this commander':deck.wins+' wins · '+(deck.games-deck.wins)+' losses','best-deck-record']]){if(text){const item=node(tag,text);item.className=cls;copy.append(item)}}
  card.append(image,copy);host.append(card);
  Promise.resolve(window.commandLedgerCommanderArtwork?.(deck.commander)).then(url=>{if(!url||!card.isConnected)return;image.style.backgroundImage='url("'+url+'")';const frame=current?.artwork?.find(a=>a.slot===slot&&a.commander===deck.commander);if(frame)applyFrame(image,frame)}).catch(()=>{});
 }
 function stat(label,value,detail=''){const box=node('div');box.className='insight-stat';box.append(node('span',label),node('strong',value),node('small',detail));return box}
 function mana(box,code){const value=box.querySelector('strong');value.replaceChildren();if(!code){value.textContent='Colorless';return}for(const c of code){const img=node('img');img.src='https://svgs.scryfall.io/card-symbols/'+c+'.svg';img.alt=({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'})[c]+' mana';img.width=img.height=26;value.append(img)}}
 async function drawColors(data,token){
  const finishes=[];
  if(data.color_permissions?.most_played||data.color_permissions?.best_combo)finishes.push(startStatLoading(colors,'Loading color stats…'));
  if(data.color_usage)finishes.push(startStatLoading(usageChart,'Loading color combo usage…'));
  if(data.lost_color_enabled)finishes.push(startStatLoading(rivalry.querySelector('[data-rival=color]'),'Loading rival colors…'));
  try{
  const results=await Promise.all((data.color_decks||data.color_usage?.decks||[]).map(async deck=>({deck,code:await commanderColors(deck.commander)})));
  const lost=await Promise.all((data.lost_color_commanders||[]).map(commanderColors));if(token!==epoch)return;
  const combos=new Map();let missing=0;
  for(const {deck,code}of results){if(code===null){missing+=deck.games;continue}const row=combos.get(code)||{games:0,wins:0};row.games+=deck.games;row.wins+=deck.wins||0;combos.set(code,row)}
  if(data.color_usage)renderColorUsage(usageChart,combos,data.color_usage.total,missing,data.color_usage.combinations,data.color_usage.minimum_games,{readOnly:true});
  if(data.color_permissions?.most_played){const top=selectMostPlayedColor(combos),box=stat('Most played color',top?'':missing?'Color data unavailable':'No games yet',top?top[1].games+' games'+(missing?' · '+missing+' unavailable':''):'');if(top)mana(box,top[0]);colors.append(box)}
  if(data.color_permissions?.best_combo){const best=selectStrongestColor(combos,data.color_permissions.minimum_games),box=stat('Strongest Color',best?'':missing?'Color data unavailable':'No qualifying color combo',best?pct(100*best[1].wins/best[1].games)+' win rate · '+best[1].wins+' wins in '+best[1].games+' games':'');if(best)mana(box,best[0]);colors.append(box)}
  if(data.lost_color_enabled){const counts=new Map();for(const code of lost)if(code!==null)counts.set(code,(counts.get(code)||0)+1);const top=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0],box=stat('Rival Color Combo',top?'':lost.length?'Color data unavailable':'No recorded losses',top?top[1]+' losses':'');if(top)mana(box,top[0]);rivalry.querySelector('[data-rival=color]').append(box)}
  }finally{finishes.forEach(done=>done())}
 }
 function drawTotals(data,syncTrend){
  const previous=sharedTrend?.state();sharedTrend?.destroy();sharedTrend=null;
  totals.replaceChildren();if(!data.win_chart&&!data.record&&!data.winrate_history)return;
  const row=node('div');row.className='ledger-chart-row';
  if(data.win_chart||data.record){const host=node('div');host.id='summary';host.className='stats-overview';const card=node('div');card.className='stats-pie-card';const main=node('div');main.className='stats-pie-main';const legend=node('div');legend.className='stats-pie-legend';
   const count=data.win_chart?.games??data.record.games;
   const total=node('div');total.className='stats-games-total';total.append(node('strong',count),node('span','Total games played'));if(data.record)legend.append(total);
   if(data.win_chart){const rate=count?100*data.win_chart.wins/count:0;const donut=node('div');donut.className='stats-donut';donut.style.setProperty('--win-percent',rate+'%');donut.setAttribute('role','img');donut.setAttribute('aria-label',data.win_chart.wins+' wins and '+(count-data.win_chart.wins)+' losses');const inside=node('div');inside.className='stats-donut-inner';inside.append(node('strong',pct(rate)),node('span','Win rate'));donut.append(inside);main.append(donut);for(const [label,value]of [['Wins',data.win_chart.wins],['Losses',count-data.win_chart.wins]]){const line=node('div');line.append(node('strong',value),node('span',label));legend.append(line)}}
   main.append(legend);card.append(main);host.append(card);row.append(host);
  }
  if(data.winrate_history){
   const trend=node('section');trend.className='winrate-trend';trend.setAttribute('aria-labelledby','winrateTrendTitle');const heading=node('div');heading.className='winrate-trend-heading';const title=node('h3','Win rate over time');title.id='winrateTrendTitle';const controls=node('div');controls.className='ledger-trend-controls';
   for(const [id,label,choices]of [['trendPeriod','Timeline',[]],['trendGrouping','Group by',[['auto','Auto'],['game','Per game'],['day','Daily'],['week','Weekly'],['month','Monthly']]]]){const wrap=node('label',label+' '),select=node('select');select.id=id;select.setAttribute('aria-label','Win-rate graph '+(id==='trendPeriod'?'timeline':'grouping'));for(const [value,text]of choices){const option=node('option',text);option.value=value;select.append(option)}wrap.append(select);controls.append(wrap)}
   heading.append(title,controls);const dates=node('div');dates.id='trendCustomDates';dates.className='ledger-trend-dates';dates.hidden=true;for(const [id,label]of [['trendStart','From'],['trendEnd','Through']]){const wrap=node('label',label+' '),input=node('input');input.type='date';input.id=id;input.setAttribute('aria-label',id==='trendStart'?'Graph start date':'Graph end date');wrap.append(input);dates.append(wrap)}const graphStatus=node('p');graphStatus.id='trendStatus';graphStatus.setAttribute('role','status');const chart=node('div');chart.id='winrateTrendChart';chart.className='winrate-trend-chart';const empty=node('p','No games in this graph timeline.');empty.id='winrateTrendEmpty';empty.className='muted';trend.append(heading,dates,graphStatus,chart,empty);row.append(trend);
   // Only the privacy-filtered public endpoint supplies graph data.
   totals.append(row);const selected=rankingRange(period.value,start.value,end.value),cache=new Map([[JSON.stringify([selected.range_start,selected.range_end]),Promise.resolve(data.winrate_history)]]);
   sharedTrend=mountLedgerTrend(()=>[],{root:trend,main:{preset:period,start,end},state:syncTrend?(previous?{group:previous.group}:null):previous,loadGames:range=>{const key=JSON.stringify([range.range_start,range.range_end]);if(!cache.has(key))cache.set(key,(async()=>{const {data:result,error}=await client.rpc('get_shared_ledger_stats_v2',{target_handle:handle,date_start:range.range_start,date_end:range.range_end});if(error)throw error;if(!result?.winrate_history)throw Error('This player is not sharing win-rate history.');return result.winrate_history})().catch(error=>{cache.delete(key);throw error}));return cache.get(key)}});sharedTrend.render();
  }

  if(row.children.length===1)row.classList.add('public-single-chart');totals.append(row);
 }
 function drawFirst(data){
  if(!reportViews?.patterns?.has('first'))return;const panel=reportViews.patterns.get('first'),chosen=firstSelect?.value||'';panel.replaceChildren();const label=node('label','Deck ');label.className='ledger-report-select';firstSelect=node('select');firstSelect.setAttribute('aria-label','Going first advantage deck');const all=node('option','All decks');all.value='';firstSelect.append(all);for(const deck of data.decks||[]){const opt=node('option',deck.name);opt.value=deck.id;firstSelect.append(opt)}firstSelect.value=(data.decks||[]).some(d=>d.id===chosen)?chosen:'';label.append(firstSelect);const body=node('div');panel.append(label,body);
  function draw(){const stats=data.decks?.find(d=>d.id===firstSelect.value)||data,first=stats.first,other=stats.other,rate=group=>group.games?100*group.wins/group.games:null,fr=rate(first),or=rate(other);const pair=node('div');pair.className='deck-ring-pair';pair.append(ring(fr,'You went first',first.wins+' wins / '+first.games+' games'),ring(or,'Someone else went first',other.wins+' wins / '+other.games+' games'));const delta=fr===null||or===null?null:fr-or,badge=node('div',delta===null?'Log games in both groups to compare.':(delta>0?'+':'')+delta.toFixed(1)+' percentage points when you go first.');badge.className='deck-change-badge'+(delta<0?' negative':'');body.replaceChildren(pair,badge,node('small',stats.excluded+' games excluded because starting-player data is missing.'))}firstSelect.onchange=draw;draw();
 }
 function drawReports(data){
  const patternTabs=[...(data.first_player?[['first','Going First']]:[]),...(data.rotation?[['rotation','Rotation']]:[])],friendTabs=[...(data.games_together?[['together','Games Together']]:[]),...(data.friend_results?[['results','Your Results']]:[])];
  const sig=JSON.stringify([patternTabs,friendTabs]);if(sig!==reportSignature){reportSignature=sig;reports.replaceChildren();reportViews={};for(const [id,title,views]of [['patterns','Play Patterns',patternTabs],['friends','Friends',friendTabs]])if(views.length){const host=node('section');reports.append(host);reportViews[id]=createLedgerReport(host,id,title,views);host.querySelector('.ledger-report-tabs').style.gridTemplateColumns='repeat('+views.length+',minmax(0,1fr))'}}
  if(data.first_player)drawFirst(data.first_player);
  if(data.rotation){const panel=reportViews.patterns.get('rotation');panel.replaceChildren(node('p',data.rotation.filter(d=>!d.games).length+' active decks unused in this period'));if(data.rotation.length)pagedCards(panel,data.rotation,deck=>{const card=node('article');card.className='ledger-rotation-card';const copy=node('div');copy.append(node('strong',deck.name),rateBar(deck.share,deck.games+' games','Last played: '+(deck.last||'Never')));card.append(artwork(deck.commander,'deck:'+deck.id),copy);return card},{size:2,className:'ledger-rotation-list',label:'rotation decks'});else panel.append(node('p','No active decks.'));panel.append(node('small','Active decks · usage in the selected period. Last played reflects all time.'))}
  if(data.games_together)renderGamesTogether(reportViews.friends.get('together'),data.games_together,{artwork:name=>artwork(name)});
  if(data.friend_results){const stats=data.friend_results,panel=reportViews.friends.get('results'),tiles=node('div');tiles.className='ledger-friend-totals';for(const [value,label]of [[stats.games,'Games'],[stats.wins,'Wins'],[stats.games-stats.wins,'Losses']]){const tile=node('div');tile.append(node('strong',value),node('small',label));tiles.append(tile)}panel.replaceChildren(ring(stats.games?100*stats.wins/stats.games:null,'Your win rate with friends'),tiles,node('small',"Based on this player's Ledger. Each tagged game counts once, even with multiple friends."))}
  reports.hidden=!patternTabs.length&&!friendTabs.length;
 }
 function drawDecks(data){
  decks.replaceChildren();decks.hidden=!data.decks_enabled;if(!data.decks_enabled)return;decks.append(node('h3','By Deck'));const toolbar=node('div');toolbar.className='deck-carousel-heading';const controls=node('div');controls.className='deck-carousel-controls';toolbar.append(controls);const search=node('input');search.type='search';search.placeholder='Search decks or commanders…';search.setAttribute('aria-label','Search decks');search.value=deckSearch;controls.append(search);
  const sort=node('select'),direction=node('select');for(const [select,label,options,value]of [[sort,'Sort by',[['winrate','Win rate'],['games','Games played'],['last','Last played'],['name','Name']],deckSort],[direction,'Order',[['desc','Descending'],['asc','Ascending']],deckDirection]]){for(const [id,text]of options){const opt=node('option',text);opt.value=id;select.append(opt)}select.value=value;const wrap=node('label',label+' ');wrap.className='deck-sort-label';wrap.append(select);controls.append(wrap)}
  const back=node('button','‹'),next=node('button','›');back.type=next.type='button';back.setAttribute('aria-label','Previous decks');next.setAttribute('aria-label','Next decks');controls.append(back,next);const carousel=node('div');carousel.className='deck-stats-carousel';carousel.id='sharedDecks';carousel.tabIndex=0;carousel.setAttribute('aria-label','Shared decks carousel');const empty=node('p','No decks match your search.');empty.className='muted';decks.append(toolbar,carousel,empty);back.onclick=()=>carousel.scrollBy({left:-carousel.clientWidth*.85,behavior:'smooth'});next.onclick=()=>carousel.scrollBy({left:carousel.clientWidth*.85,behavior:'smooth'});
  function draw(){deckSearch=search.value;deckSort=sort.value;deckDirection=direction.value;carousel.replaceChildren();const rows=(data.decks||[]).filter(d=>d.games>0&&!d.archived_at&&(d.name+' '+d.commander).toLowerCase().includes(search.value.trim().toLowerCase()));rows.sort((a,b)=>{const comparison=sort.value==='winrate'?a.wins/a.games-b.wins/b.games:sort.value==='games'?a.games-b.games:sort.value==='last'?(a.last||'').localeCompare(b.last||''):a.name.localeCompare(b.name);return (direction.value==='asc'?1:-1)*comparison||a.name.localeCompare(b.name)});for(const deck of rows){const card=node('article');card.className='deck-stats-card';const art=node('div');art.className='deck-stats-art';const copy=node('div');copy.className='deck-stats-content';const name=node('strong',deck.name);name.className='deck-stats-name';const commander=node('span',deck.commander);commander.className='deck-stats-commander';const bottom=node('div');bottom.className='deck-stats-bottom';const rate=node('div',pct(100*deck.wins/deck.games));rate.className='deck-stats-rate';rate.append(node('small','Win rate'));const record=node('span',deck.wins+' wins · '+(deck.games-deck.wins)+' losses');record.className='deck-stats-record';bottom.append(rate,record);copy.append(name,commander,bottom);card.append(art,copy);carousel.append(card);Promise.resolve(window.commandLedgerCommanderArtwork?.(deck.commander)).then(url=>{if(!url||!card.isConnected)return;art.style.backgroundImage='url("'+url+'")';const frame=current?.artwork?.find(a=>a.slot==='deck:'+deck.id&&a.commander===deck.commander);if(frame)applyFrame(art,frame)}).catch(()=>{})}empty.hidden=!!rows.length}search.oninput=draw;sort.onchange=draw;direction.onchange=draw;draw();
 }
 async function load(syncTrend=false){
  const token=++epoch;custom.hidden=period.value!=='custom';let range;try{range=rankingRange(period.value,start.value,end.value)}catch(error){status.textContent=error.message;for(const host of [totals,featured,colors,usage,rivalry,reports,decks])host.hidden=true;return}
  status.textContent='';const done=startStatLoading(status);shell.setAttribute('aria-busy','true');
  try{const {data,error}=await client.rpc('get_shared_ledger_stats_v2',{target_handle:handle,date_start:range.range_start,date_end:range.range_end});if(token!==epoch)return;if(error)throw error;if(!data)throw Error('Player statistics are not available.');current=data;for(const host of [totals,featured,colors])host.hidden=false;
   usage.hidden=!data.color_usage;colors.hidden=!data.color_permissions?.most_played&&!data.color_permissions?.best_combo;usageChart.replaceChildren();drawTotals(data,syncTrend);featured.replaceChildren();colors.replaceChildren();rivalry.replaceChildren();featuredCard(featured,data.best_deck,'★ Best deck','best-deck');featuredCard(featured,data.most_played_deck,'★ Most played deck','most-played-deck');
   const rivalTitle=node('h3','Rivalry Summary'),grid=node('div');grid.className='ledger-rivalry-grid';const commander=node('div');commander.id='nemesisCommander';commander.className='best-deck nemesis-section';const player=node('div'),color=node('div');color.dataset.rival='color';grid.append(commander,player,color);rivalry.append(rivalTitle,grid);if(data.nemesis_commander)featuredCard(commander,data.nemesis_commander,'★ Rival Commander','rival-commander');else if(data.nemesis_commander_enabled)commander.append(node('p','No recorded losses to named commanders yet.'));if(data.nemesis_player_enabled||data.nemesis_player)player.append(stat('Rival Player',data.nemesis_player?.player||'No named opponents',data.nemesis_player?data.nemesis_player.losses+' losses':''));
   const slots=[data.nemesis_commander_enabled,!!(data.nemesis_player_enabled||data.nemesis_player),data.lost_color_enabled];[commander,player,color].forEach((slot,index)=>slot.hidden=!slots[index]);grid.classList.toggle('partial',slots.filter(Boolean).length<3);rivalry.hidden=!slots.some(Boolean);
   drawReports(data);drawDecks(data);await drawColors(data,token);if(token!==epoch)return;
   const any=!!(data.record||data.win_chart||data.winrate_history||data.best_deck||data.most_played_deck||data.color_permissions?.most_played||data.color_permissions?.best_combo||data.color_usage||slots.some(Boolean)||data.first_player||data.rotation||data.games_together||data.friend_results||data.decks_enabled);
   status.textContent=any?'':"This player hasn't shared any statistics.";
  }catch(error){if(token!==epoch)return;status.textContent='Could not load statistics. '+error.message;for(const host of [totals,featured,colors,usage,rivalry,reports,decks])host.hidden=true}
  finally{done();if(token===epoch)shell.removeAttribute('aria-busy')}
 }
 period.onchange=start.onchange=end.onchange=()=>load(true);
 const refresh=()=>{if(shell.isConnected&&!document.hidden)load()};window.addEventListener('focus',refresh);window.addEventListener('pageshow',event=>{if(event.persisted)refresh()});document.addEventListener('visibilitychange',refresh);await load();
}
