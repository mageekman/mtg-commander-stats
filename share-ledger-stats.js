import {selectStrongestColor} from './strongest-color.js?v=1';
import {normalizeLedgerSettings} from './ledger-settings.js?v=strongest-2';
import {selectBestDeck} from './best-deck.js?v=2';
import {isGenericOpponentName} from './opponent-names.js?v=1';
export function mostCommon(values,{allowEmpty=false}={}){const counts=new Map();for(const value of values){if(value===null||value===undefined)continue;const key=String(value).trim();if(key||allowEmpty)counts.set(key,(counts.get(key)||0)+1)}const first=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];return first?{name:first[0],count:first[1]}:null}
export function buildShareStats(decks,games,settings){
 const preferences=normalizeLedgerSettings(settings);
 const wins=games.filter(g=>g.won).length,active=decks.filter(d=>!d.archived_at);let remaining=active;const top=[];
 for(let i=0;i<3;i++){const best=selectBestDeck(remaining,games,preferences.best_deck_min_games);if(!best)break;top.push(best);remaining=remaining.filter(d=>d.id!==best.deck.id)}
 const totals=new Map();for(const g of games){const row=totals.get(g.deck_id)||{games:0,wins:0};row.games++;if(g.won)row.wins++;totals.set(g.deck_id,row)}
 const played=active.filter(d=>totals.has(d.id)).map(deck=>({deck,...totals.get(deck.id)}));
 const most=[...played].sort((a,b)=>b.games-a.games||b.wins-a.wins||a.deck.name.localeCompare(b.deck.name))[0]||null;
 const winners=games.filter(g=>!g.won&&Array.isArray(g.players)&&Number.isInteger(g.winner_player)&&g.winner_player>0&&g.winner_player<g.players.length).map(g=>g.players[g.winner_player]).filter(Boolean);
 const dates=games.map(g=>g.played_at).filter(Boolean).sort();
 return {games:games.length,wins,losses:games.length-wins,rate:games.length?100*wins/games.length:null,activeDecks:played.length,best:top[0]||null,top,most,first:dates[0]||null,last:dates.at(-1)||null,winners,rivalCommander:mostCommon(winners.map(p=>p.commander)),rivalPlayer:mostCommon(winners.map(p=>p.name).filter(n=>!isGenericOpponentName(n)))};
}
export function resolveRivalColors(winners,metadata){let missing=0;const colors=[];for(const p of winners){const data=metadata.get(commanderKey(p.commander));if(data?.colors===null||!data){missing++;continue}colors.push(data.colors)}const top=mostCommon(colors,{allowEmpty:true});return top?{code:top.name,losses:top.count,partial:missing>0}:null}
export const commanderKey=name=>String(name||'').trim().normalize('NFKC').toLowerCase();
export function periodHeading(range,stats){
 const date=value=>{const[y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d)};
 const part=(value,year=false)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',...(year?{year:'numeric'}:{})}).format(date(value)).toUpperCase();
 const start=range.range_start||stats.first,end=range.range_end||stats.last;if(!start||!end)return 'ALL TIME';
 if(start===end)return (range.range_start?'':'ALL TIME · ')+part(start,true);
 const sameYear=start.slice(0,4)===end.slice(0,4),label=part(start,!sameYear)+' – '+part(end,true);
 return (range.range_start?'':'ALL TIME · ')+label;
}

export function resolveOwnColors(decks,games,metadata,settings){
 const byId=new Map(decks.map(d=>[d.id,d])),count=new Map(),combos=new Map();let missing=0;
 for(const game of games){const code=metadata.get(commanderKey(byId.get(game.deck_id)?.commander))?.colors;if(code===null||code===undefined){missing++;continue}for(const c of code)count.set(c,(count.get(c)||0)+1);const row=combos.get(code)||{games:0,wins:0};row.games++;if(game.won)row.wins++;combos.set(code,row)}
 const color=[...count].sort((a,b)=>b[1]-a[1]||'WUBRG'.indexOf(a[0])-'WUBRG'.indexOf(b[0]))[0],best=selectStrongestColor(combos,normalizeLedgerSettings(settings).best_deck_min_games);
 return {most:color?{code:color[0],games:color[1]}:null,best:best?{code:best[0],...best[1],rate:100*best[1].wins/best[1].games}:null,missing};
}
export function availableShareCards(settings){const s=normalizeLedgerSettings(settings);return ['ledger',...((s.share_lost_to_commander||s.share_lost_to_player||s.share_lost_to_color)?['rivalries']:[]),...(((s.share_deck_stats&&s.share_best_deck)||s.share_most_played_deck||s.share_most_played_color||s.share_best_color_combo)?['decks']:[])];}
