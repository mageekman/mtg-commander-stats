import {firstPlayerStats,deckRotation,gamesTogether} from './player-game-stats.js?v=1';
import {mostFacedFriendCommander} from './deck-performance-stats.js?v=visual-2';
import {node,pct,ring,rateBar,artPanel,pagedCards} from './deck-visuals.js?v=reports-2';
import {createLedgerReport} from './ledger-report-tabs.js?v=mockup-1';

// Keep the controls mounted: date changes refresh report data without resetting tabs.
const dashboards=new WeakMap();
function mount(host){
 host.replaceChildren();
 const patternHost=node('section'),friendHost=node('section');host.append(patternHost,friendHost);
 const patterns=createLedgerReport(patternHost,'patterns','Play Patterns',[['first','Going First'],['rotation','Rotation']]);
 const friends=createLedgerReport(friendHost,'friends','Friends',[['together','Games Together'],['results','Your Results']]);
 const label=node('label','Deck '),select=node('select'),firstBody=node('div');
 label.className='ledger-report-select';select.dataset.firstDeck='';select.setAttribute('aria-label','Going first advantage deck');label.append(select);patterns.get('first').append(label,firstBody);
 let current;
 function drawFirst(){
  const stats=firstPlayerStats(select.value?current.games.filter(g=>g.deck_id===select.value):current.games);
  const pair=node('div');pair.className='deck-ring-pair';
  pair.append(ring(stats.first.rate,'You went first',stats.first.wins+' wins / '+stats.first.games+' games'),ring(stats.other.rate,'Someone else went first',stats.other.wins+' wins / '+stats.other.games+' games'));
  const difference=node('div',stats.difference===null?'Log games in both groups to compare.':(stats.difference>0?'+':'')+stats.difference.toFixed(1)+' percentage points when you go first.');
  difference.className='deck-change-badge'+(stats.difference<0?' negative':'');
  firstBody.replaceChildren(pair,difference,node('small',stats.excluded+(stats.excluded===1?' game':' games')+' excluded because starting-player data is missing.'));
 }
 select.onchange=drawFirst;
 return data=>{
  current=data;const chosen=select.value;select.replaceChildren();const all=node('option','All decks');all.value='';select.append(all);
  for(const deck of data.decks){const option=node('option',deck.name+(deck.archived_at?' (archived)':''));option.value=deck.id;select.append(option)}
  select.value=data.decks.some(deck=>deck.id===chosen)?chosen:'';drawFirst();

  const rotation=patterns.get('rotation'),rows=deckRotation(data.decks,data.games,data.allGames),unused=rows.filter(row=>!row.games).length;
  rotation.replaceChildren(node('p',unused+' active deck'+(unused===1?'':'s')+' unused in this period'));
  if(!rows.length)rotation.append(node('p','Add a deck to see your rotation.'));
  else pagedCards(rotation,rows,row=>{
   const card=node('article');card.className='ledger-rotation-card';
   const art=artPanel(row.commander,'',{onImage:(image,box,url)=>data.onArtwork?.(image,box,url,row)});
   const copy=node('div'),link=node('a',row.name);link.href='./deck.html?id='+encodeURIComponent(row.id);
   copy.append(link,rateBar(row.share,row.games+' games', 'Last played: '+(row.last||'Never')));card.append(art,copy);return card;
  },{size:2,className:'ledger-rotation-list',label:'rotation decks'});
  rotation.append(node('small','Active decks · usage in the selected period. Last played reflects all time.'));

  const together=friends.get('together'),friendRows=gamesTogether(data.games,data.names);
  together.replaceChildren(node('p','Tagged current friends · selected period'));
  if(!friendRows.length)together.append(node('p','No tagged games with friends in this period. Use @ when recording a player to tag a friend.'));
  else pagedCards(together,friendRows,row=>{
   const card=node('article');card.className='ledger-friend-passport';
   card.append(artPanel(mostFacedFriendCommander(data.games,row.id),'ledger-friend-art'));
   const name=node('strong',row.name);name.className='ledger-friend-name';card.append(name);
   for(const [value,label]of [[row.games,'Games together'],[pct(row.your_rate),'Your win rate']]){const metric=node('div');metric.className='ledger-friend-metric';metric.append(node('strong',value),node('small',label));card.append(metric)}
   return card;
  },{size:2,className:'ledger-friend-list',label:'friends played with'});

  // A multi-friend game contributes once to the user's aggregate record.
  const shared=data.games.filter(game=>Array.isArray(game.players)&&game.players.some((player,index)=>index>0&&player?.friend_id&&data.names.has(player.friend_id)));
  const wins=shared.filter(game=>game.won).length,results=friends.get('results'),totals=node('div');totals.className='ledger-friend-totals';
  for(const [value,label]of [[shared.length,'Games'],[wins,'Wins'],[shared.length-wins,'Losses']]){const metric=node('div');metric.append(node('strong',value),node('small',label));totals.append(metric)}
  results.replaceChildren(ring(shared.length?100*wins/shared.length:null,'Your win rate with friends'),totals,node('small','Based on your Ledger. Each tagged game counts once, even with multiple friends.'));
 };
}
export function renderAdditionalLedgerStats(host,data){if(!host)return;if(!dashboards.has(host))dashboards.set(host,mount(host));dashboards.get(host)(data)}
