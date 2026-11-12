// One layout contract for every exported card. Empty sections never reserve space.
export const hasShareValue=value=>value!==null&&value!==undefined&&String(value).trim()!=='';
export const shareCount=(value,noun)=>{const suffix=/s$/i.test(noun)?'es':'s';return value+' '+noun+(value===1?'':noun===noun.toUpperCase()?suffix.toUpperCase():suffix)};
export const hasShareColor=value=>typeof value==='string'&&/^[WUBRG]*$/.test(value);
export function planShareLayout(heights,{top=320,bottom=1725,gap=22,hero=false,expand=false}={}){
 const available=bottom-top,space=Math.max(0,heights.length-1)*gap;
 const sum=heights.reduce((total,height)=>total+height,0);
 const heroHeight=hero?Math.max(0,available-sum-space-(heights.length?gap:0)):0;
 const scale=sum>0&&((expand&&!hero)||sum+space>available)?(available-space)/sum:1;
 let cursor=top;if(heroHeight)cursor+=heroHeight+(heights.length?gap:0);
 // Without artwork, center a compact stack; keep adjacent rows together.
 if(!heroHeight)cursor+=Math.max(0,(available-(sum*scale+space))/2);
 const panels=heights.map(height=>{const row={y:cursor,height:height*scale};cursor+=row.height+gap;return row});
 return {hero:{y:top,height:heroHeight},panels};
}
export function populatedLedgerShareCards(snapshot){
 const {settings:s,stats,ownColors,colors,showRivalPlayer,profile}=snapshot;
 const identity=hasShareValue(profile?.favorite_commander);
 const record=stats.games>0&&(s.share_record||s.share_win_chart||s.share_deck_rotation);
 const recap=identity||record||(s.share_best_deck&&stats.best?.games>0);
 const rivalry=(s.share_lost_to_commander&&hasShareValue(stats.rivalCommander?.name)&&stats.rivalCommander.count>0)||(s.share_lost_to_player&&showRivalPlayer&&hasShareValue(stats.rivalPlayer?.name)&&stats.rivalPlayer.count>0)||(s.share_lost_to_color&&hasShareColor(colors?.code)&&colors.losses>0);
 const decks=(s.share_deck_stats&&s.share_best_deck&&stats.top.some(row=>row.games>0&&hasShareValue(row.deck?.name)))||(s.share_most_played_deck&&stats.most?.games>0&&hasShareValue(stats.most.deck?.name))||(s.share_most_played_color&&ownColors?.most?.games>0&&hasShareColor(ownColors.most.code))||(s.share_best_color_combo&&ownColors?.best?.games>0&&hasShareColor(ownColors.best.code)&&Number.isFinite(ownColors.best.rate));
 return [...(recap?['ledger']:[]),...(rivalry?['rivalries']:[]),...(decks?['decks']:[])];
}
