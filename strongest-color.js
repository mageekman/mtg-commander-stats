// Exact color identities combine games across decks, within the selected period.
export function selectStrongestColor(combos,minGames=1){
 const value=Number(minGames),minimum=Number.isInteger(value)&&value>=1&&value<=100000?value:1;
 return [...combos].filter(([,row])=>row.games>=minimum).sort((a,b)=>b[1].wins/b[1].games-a[1].wins/a[1].games||b[1].games-a[1].games||a[0].localeCompare(b[0]))[0]||null;
}

export function selectMostPlayedColor(combos){return [...combos].filter(([,row])=>row.games>0).sort((a,b)=>b[1].games-a[1].games||a[0].localeCompare(b[0]))[0]||null;}
