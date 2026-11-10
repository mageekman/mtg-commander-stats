// Fictional sample data only; never persisted to an account.
export const demoDecks=[
 {id:'demo-1',name:'Heroes Assemble',commander:'Captain America, First Avenger',created_at:'2026-01-01',decklist:'',theme:'Equipment'},
 {id:'demo-2',name:'Forest Friends',commander:'Minsc & Boo, Timeless Heroes',created_at:'2026-02-01',decklist:'',theme:'Counters'},
 {id:'demo-3',name:'A Little Spellwork',commander:'Stella Lee, Wild Card',created_at:'2026-03-01',decklist:'',theme:'Spells'}
];
export const demoGames=Array.from({length:12},(_,i)=>{
 const deck=demoDecks[i%3],date=new Date();date.setDate(date.getDate()-i*3);
 const winner=i%3===0?0:1;
 return {id:'demo-game-'+i,deck_id:deck.id,played_at:date.toLocaleDateString('en-CA'),won:winner===0,first_player:i%4,winner_player:winner,notes:'Example game — fictional players and results.',players:[{name:'You (example)',commander:deck.commander},{name:'Alex',commander:"Atraxa, Praetors' Voice"},{name:'Jordan',commander:'The Ur-Dragon'},{name:'Sam',commander:'Edgar Markov'}]};
});
