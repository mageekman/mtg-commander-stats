const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../game-history-search.js'),'utf8');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('matches any player or commander, including partial and normalized names',async()=>{
 const {gameMatchesSearch:matches}=await modulePromise;
 const game={players:[{name:'José',commander:'Minsc & Boo, Timeless Heroes'},{name:'Sam',commander:'Captain America, First Avenger'}]};
 for(const term of ['captain america',' CAPTAIN   AMERICA ','sam','jose','timeless'])assert.equal(matches(game,null,term),true);
 assert.equal(matches(game,null,'Iron Man'),false);
 assert.equal(matches(game,null,''),true);
});
test('supports own deck commander, legacy games, and absent player data',async()=>{
 const {gameMatchesSearch:matches}=await modulePromise;
 assert.equal(matches({}, {commander:'Captain America, First Avenger'},'captain america'),true);
 assert.equal(matches({opponents:['Captain America','Alex']},null,'alex'),true);
 assert.equal(matches({players:[null],opponents:null},null,'alex'),false);
});

test('search supports deck names, dates, saved usernames and terms across multiple players/commanders',async()=>{const{gameMatchesSearch:matches}=await modulePromise;const game={played_at:'2026-11-10',won:true,players:[{name:'José',username:'new_handle',commander:'The Ur-Dragon'},{display_name:'Sam',handle:'sam_tester',commander:'Captain America'}]};for(const term of ['skybound','2026-11-10','@new_handle','NEW HANDLE','urdragon','sam captain','wins','jose'])assert.equal(matches(game,{name:'Skybound Alliance'},term),true,term);for(const term of ['losses','2026-10-01','unrelated'])assert.equal(matches(game,null,term),false,term)});
