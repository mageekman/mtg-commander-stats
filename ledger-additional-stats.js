import {renderGamesTogether} from './ledger-together.js?v=passport-2';
import {firstPlayerStats,deckRotation,gamesTogether} from './player-game-stats.js?v=participants-2';
import {mostFacedFriendCommander} from './deck-performance-stats.js?v=participants-3';
import {node,pct,ring,rateBar,artPanel,pagedCards} from './deck-visuals.js?v=reports-2';
import {createLedgerReport} from './ledger-report-tabs.js?v=settings-2';

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
  const known=game=>Array.isArray(game.players)&&Number.isInteger(game.first_player)&&game.first_player>=0&&game.first_player<game.players.length&&(!select.value||game.deck_id===select.value);
  for(const [i,label]of [[0,'You went first'],[1,'Someone else went first']]){const predicate=game=>known(game)&&(i===0?game.first_player===0:game.first_player!==0);current.onGames?.(pair.children[i],label,predicate);current.onPie?.(pair.children[i].querySelector('.deck-rate-ring'),i===0?stats.first.rate:stats.other.rate,label,predicate)}
  const difference=node('div',stats.difference===null?'Log games in both groups to compare.':(stats.difference>0?'+':'')+stats.difference.toFixed(1)+' percentage points when you go first.');
  difference.className='deck-change-badge'+(stats.difference<0?' negative':'');current.onGames?.(difference,'Going first comparison',known);
  const excluded=node('small',stats.excluded+(stats.excluded===1?' game':' games')+' excluded because starting-player data is missing.');excluded.className='ledger-excluded-note';if(stats.excluded>0)current.onGames?.(excluded,'Games missing starting-player data',game=>(!select.value||game.deck_id===select.value)&&!known(game));
  firstBody.replaceChildren(pair,difference,excluded);
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
   copy.append(link,rateBar(row.share,row.games+' games', 'Last played: '+(row.last||'Never')));card.append(art,copy);data.onGames?.(card,row.name,game=>game.deck_id===row.id);return card;
  },{size:2,className:'ledger-rotation-list',label:'rotation decks'});
  rotation.append(node('small','Active decks · usage in the selected period. Last played reflects all time.'));

  const together=friends.get('together'),friendRows=gamesTogether(data.games,data.names).map(row=>({...row,handle:data.names.identities?.get(row.id)?.handle||'',commander:mostFacedFriendCommander(data.games,row.id)}));
  renderGamesTogether(together,friendRows,{artwork:(name,friend)=>data.passportArtwork?.(friend)||artPanel(name),onGames:(card,row)=>data.onGames?.(card,'Games with '+row.name,game=>Array.isArray(game.players)&&game.players.some((player,index)=>index>0&&(player.friend_id||player.participant_id)===row.id))});

  // A multi-friend game contributes once to the user's aggregate record.
  const shared=data.games.filter(game=>Array.isArray(game.players)&&game.players.some((player,index)=>index>0&&data.names.has(player?.friend_id||player?.participant_id)));
  const wins=shared.filter(game=>game.won).length,results=friends.get('results'),totals=node('div');totals.className='ledger-friend-totals';
  for(const [value,label]of [[shared.length,'Games'],[wins,'Wins'],[shared.length-wins,'Losses']]){const metric=node('div');metric.append(node('strong',value),node('small',label));totals.append(metric);data.onGames?.(metric,label+' with friends',game=>Array.isArray(game.players)&&game.players.some((player,index)=>index>0&&data.names.has(player.friend_id||player.participant_id))&&(label==='Games'||(label==='Wins'?game.won:!game.won)))}
  const sharedRing=ring(shared.length?100*wins/shared.length:null,'Your win rate with friends');data.onGames?.(sharedRing,'Games with friends',game=>Array.isArray(game.players)&&game.players.some((player,index)=>index>0&&data.names.has(player.friend_id||player.participant_id)));
  data.onPie?.(sharedRing.querySelector('.deck-rate-ring'),shared.length?100*wins/shared.length:null,'Games with friends',game=>Array.isArray(game.players)&&game.players.some((player,index)=>index>0&&data.names.has(player.friend_id||player.participant_id)));
  results.replaceChildren(sharedRing,totals,node('small','Based on your Ledger. Each tagged game counts once, even with multiple friends.'));
 };
}
export function renderAdditionalLedgerStats(host,data){if(!host)return;if(!dashboards.has(host))dashboards.set(host,mount(host));dashboards.get(host)(data)}
