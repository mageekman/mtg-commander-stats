const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});try{const c=await b.newContext();await c.route('**/*',r=>{const u=new URL(r.request().url()),name=decodeURIComponent(u.pathname).slice(1);if(name==='vendor/supabase-js.mjs')return r.fulfill({contentType:'text/javascript',body:`const friends=[{id:'f1',handle:'alex',display_name:'Alex the Commander Collector'},{id:'f2',handle:'sam',display_name:'Sam'}],decks=[{id:'a',name:'My Active Deck',commander:'Captain America'},{id:'b',name:'My Other Deck',commander:'The Ur-Dragon'},{id:'c',name:'Unused Deck',commander:'Minsc & Boo'},{id:'d',name:'Archived Deck',commander:'Captain America',archived_at:'2026-01-01'}],p1=[{name:'You'},{friend_id:'f1',name:'@old_alex',commander:'Captain America'},{friend_id:'f2',name:'@sam',commander:'The Ur-Dragon'}],p2=[{name:'You'},{friend_id:'f1',name:'@old_alex',commander:'Captain America'},{name:'Third player',commander:'Minsc & Boo'}],p3=[{name:'You'},{friend_id:'f2',name:'@sam',commander:'The Ur-Dragon'}],games=[{id:'g1',deck_id:'a',played_at:'2026-11-10',won:true,first_player:0,winner_player:0,players:p1},{id:'g2',deck_id:'a',played_at:'2026-11-09',won:false,first_player:1,winner_player:1,players:p1},{id:'g3',deck_id:'a',played_at:'2026-10-10',won:false,first_player:1,winner_player:2,players:p2},{id:'g4',deck_id:'a',played_at:'2026-11-08',won:false,first_player:null,winner_player:null,players:p2},{id:'g5',deck_id:'b',played_at:'2026-11-07',won:true,first_player:0,winner_player:0,players:p3},{id:'g6',deck_id:'b',played_at:'2026-10-01',won:false,first_player:0,winner_player:1,players:p3}];export function createClient(){return{auth:{getUser:async()=>({data:{user:{id:'me',user_metadata:{}}}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}},from:table=>{let owner=null;const q={select:()=>q,eq:(k,v)=>{if(k==='owner_id')owner=v;return q},order:()=>q,range:()=>q,maybeSingle:async()=>({data:{handle:'myself',display_name:'Me'}}),upsert:async row=>{const frames=JSON.parse(localStorage.frames||'[]').filter(f=>f.slot!==row.slot||f.commander!==row.commander);frames.push(row);localStorage.frames=JSON.stringify(frames);return{}},then:resolve=>{(window.dataReads||=[]).push({table,owner});resolve(table==='personal_games'&&window.failRivalry?{error:{message:'Test unavailable'}}:{data:table==='personal_games'?games:table==='decks'?decks:table==='ledger_art_adjustments'?JSON.parse(localStorage.frames||'[]'):[]})}};return q},rpc:async(name,args)=>({data:name==='list_game_friends'?friends:name==='list_friend_connections'?friends.map(f=>({...f,relationship:'friends'})):name==='get_friend_rankings'?{self:{games:6,wins:2,win_rate:33.33},win_rates:[{rank:1,handle:'myself',display_name:'Me',is_you:true,games:6,win_rate:33.33}],games_logged:[{rank:1,handle:'myself',display_name:'Me',is_you:true,games:6}]}:name==='get_player_passport'?[{handle:args.target_handle,display_name:args.target_handle,favorite_commander:''}]:name==='friend_notification_count'?0:[]})}}`});if(u.hostname==='api.scryfall.com'){let card={name:u.searchParams.get('exact')||'Captain America',color_identity:['R','G'],image_uris:{art_crop:'https://preview.example/art.jpg'}};return r.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname==='/cards/collection'?{data:JSON.parse(r.request().postData()).identifiers.map(x=>({...card,name:x.name}))}:card)})}if(name==='art.jpg')return r.fulfill({contentType:'image/png',body:fs.readFileSync('cl-logo-final-transparent.png')});if(fs.existsSync(name)&&fs.statSync(name).isFile())return r.fulfill({body:fs.readFileSync(name),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/javascript'});return r.fulfill({status:404,body:''})});
const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('https://preview.example/ledger.html');
await p.waitForFunction(()=>document.querySelectorAll('.ledger-report').length===2);
assert.equal(await p.locator('#statisticsSection details').count(),0);
assert.equal(await p.locator('#summary .stats-games-total strong').textContent(),'6');
assert.equal(await p.locator('#statInsights .insight-stat').count(),2);
assert.equal(await p.locator('.ledger-rivalry .insight-stat').count(),2);
assert.ok((await p.locator('#rivalColorSlot').textContent()).includes('Rival Color Combo'));
assert.ok((await p.locator('#rivalPlayerSlot').textContent()).includes('Rival Player'));
assert.equal(await p.locator('#bestDeck .best-deck-card').count(),1);
assert.equal(await p.locator('#mostPlayedDeck .best-deck-card').count(),1);
assert.equal(await p.locator('#nemesisCommander .best-deck-card').count(),1);
assert.equal(await p.locator('#winrateTrendChart svg').count(),1);
assert.equal(await p.locator('#trendPeriod').inputValue(),'all');
await p.selectOption('#trendPeriod','custom');await p.fill('#trendStart','2026-10-01');await p.fill('#trendEnd','2026-10-31');await p.locator('#trendEnd').dispatchEvent('change');
assert.equal(await p.locator('#winrateTrendChart').getAttribute('data-games'),'2');assert.equal(await p.locator('#statsDatePreset').inputValue(),'all');assert.equal(await p.locator('#summary .stats-games-total strong').textContent(),'6');
await p.selectOption('#trendGrouping','week');assert.equal(await p.locator('#winrateTrendChart').getAttribute('data-grouping'),'week');
await p.selectOption('#statsDatePreset','custom');await p.fill('#statsDateStart','2026-11-01');await p.fill('#statsDateEnd','2026-11-30');await p.locator('#statsDateEnd').dispatchEvent('change');
assert.equal(await p.locator('#trendPeriod').inputValue(),'custom');assert.equal(await p.locator('#trendStart').inputValue(),'2026-11-01');assert.equal(await p.locator('#trendEnd').inputValue(),'2026-11-30');assert.equal(await p.locator('#winrateTrendChart').getAttribute('data-games'),'4');assert.equal(await p.locator('#summary .stats-games-total strong').textContent(),'4');
await p.selectOption('#trendPeriod','all');assert.equal(await p.locator('#winrateTrendChart').getAttribute('data-games'),'6');assert.equal(await p.locator('#summary .stats-games-total strong').textContent(),'4');
await p.selectOption('#trendPeriod','custom');await p.fill('#trendStart','2099-01-01');await p.fill('#trendEnd','2099-02-01');await p.locator('#trendEnd').dispatchEvent('change');assert.equal(await p.locator('#winrateTrendChart svg').count(),0);assert.equal(await p.locator('#winrateTrendEmpty').isVisible(),true);
await p.fill('#trendStart','2099-03-01');await p.locator('#trendStart').dispatchEvent('change');assert.ok((await p.locator('#trendStatus').textContent()).includes('start date'));assert.equal(await p.locator('#statsDatePreset').inputValue(),'custom');
await p.selectOption('#statsDatePreset','all');assert.equal(await p.locator('#trendPeriod').inputValue(),'all');assert.equal(await p.locator('#winrateTrendChart').getAttribute('data-games'),'6');await p.selectOption('#trendGrouping','auto');

assert.ok((await p.locator('[data-ledger-view=first]').textContent()).includes('66.7%'));
assert.ok((await p.locator('[data-ledger-view=together]').textContent()).includes('Alex the Commander Collector'));
assert.equal(await p.locator('.ledger-friend-passport:visible').count(),2);
await p.getByRole('tab',{name:'Your Results',exact:true}).click();
assert.deepEqual(await p.locator('.ledger-friend-totals strong').allTextContents(),['6','2','4']);
await p.getByRole('tab',{name:'Rotation',exact:true}).click();
assert.equal(await p.locator('[data-ledger-view=rotation] .ledger-rotation-card').count(),2);
await p.getByRole('button',{name:'Next rotation decks',exact:true}).click();
assert.ok((await p.locator('[data-ledger-view=rotation]').textContent()).includes('Unused Deck'));
assert.ok(!(await p.locator('[data-ledger-view=rotation]').textContent()).includes('Archived Deck'));
await p.getByRole('button',{name:'Previous rotation decks',exact:true}).click();
await p.getByRole('tab',{name:'Going First',exact:true}).click();
await p.selectOption('[data-first-deck]','b');
assert.ok((await p.locator('[data-ledger-view=first]').textContent()).includes('50.0%'));
for(const width of [1440,1100,1024,800,700,390,320]){
 await p.setViewportSize({width,height:1000});
 const pos=()=>p.locator('.ledger-report').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top+scrollY})));
 const base=await pos();if(width>1050)assert.ok(Math.abs(base[0].height-base[1].height)<1,'report row equal heights');
 for(const name of ['Rotation','Going First','Your Results','Games Together']){
  await p.getByRole('tab',{name,exact:true}).click();
  assert.ok((await pos()).every((r,i)=>Math.abs(r.height-base[i].height)<1&&Math.abs(r.top-base[i].top)<1),'tab layout jump '+width+' '+name);
 }
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);assert.ok(await p.locator('.winrate-trend').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1),'trend clipping '+width);await p.locator('.winrate-trend').screenshot({path:'/tmp/ledger-trend-'+width+'.png'});if(width===320){await p.selectOption('#trendPeriod','custom');await p.fill('#trendStart','2026-10-01');await p.fill('#trendEnd','2026-11-30');await p.locator('#trendEnd').dispatchEvent('change');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'custom graph controls overflow');await p.locator('.winrate-trend').screenshot({path:'/tmp/ledger-trend-custom-320.png'});await p.selectOption('#trendPeriod','all');}
 assert.ok(await p.locator('.ledger-report-tabs button').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'tab clipping '+width);
 assert.ok(await p.locator('.ledger-report, .ledger-report-panel, .ledger-rivalry').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1 && e.scrollHeight<=e.clientHeight+1)),'clipped report '+width);
 assert.equal(await p.locator('.ledger-by-deck [role=tablist]').count(),0);
 const rivalry=await p.locator('.ledger-rivalry-grid').evaluate(e=>({width:e.getBoundingClientRect().width,items:[...e.children].map(c=>({width:c.getBoundingClientRect().width,top:c.getBoundingClientRect().top}))}));
 if(width>800){assert.ok(Math.abs(rivalry.items[0].width/rivalry.width-.5)<.005,'commander half width');assert.ok(rivalry.items.slice(1).every(r=>Math.abs(r.width/rivalry.width-.25)<.005),'quarter width metrics')}else{assert.ok(Math.abs(rivalry.items[0].width-rivalry.width)<1,'mobile commander width');assert.ok(rivalry.items[1].top>rivalry.items[0].top,'mobile metrics below art')}

 const bottom=await p.locator('.ledger-by-deck').evaluate(e=>e.getBoundingClientRect().top+scrollY);
 assert.ok((await pos()).every(r=>r.top+r.height<=bottom),'By Deck is last '+width);
}
await p.getByRole('tab',{name:'Going First',exact:true}).focus();await p.keyboard.press('ArrowRight');
assert.equal(await p.getByRole('tab',{name:'Rotation',exact:true}).getAttribute('aria-selected'),'true');
await p.fill('#deckStatsSearch','Other');assert.equal(await p.locator('#deckStats .deck-stats-card').count(),1);
await p.fill('#deckStatsSearch','');assert.equal(await p.locator('#deckStats .deck-stats-card').count(),2);
await p.click('#ledgerDeckOrder');await p.click('#ledgerDeckFilters');await p.selectOption('#ledgerDeckSort','added');await p.click('#ledgerDeckFilters');
await p.locator('[data-ledger-view=rotation]').getByRole('button',{name:'Adjust artwork for My Active Deck',exact:true}).click();
await p.locator('dialog [data-frame=y]').fill('60');await p.click('dialog [data-action=save]');
await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
assert.equal(await p.locator('[data-ledger-view=rotation] img[alt="Captain America"]').evaluate(e=>e.style.objectPosition),'50% 60%');
await p.locator('#nemesisCommander').getByRole('button',{name:'Adjust artwork for Captain America',exact:true}).click();
await p.locator('dialog [data-frame=y]').fill('42');await p.click('dialog [data-action=save]');await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
assert.equal(await p.locator('#nemesisCommander .best-deck-art').evaluate(e=>e.style.backgroundPosition),'50% 42%');
await p.selectOption('#statsDatePreset','month');
assert.equal(await p.getByRole('tab',{name:'Rotation',exact:true}).getAttribute('aria-selected'),'true');
assert.deepEqual(await p.locator('.ledger-friend-totals strong').allTextContents(),['4','2','2']);
assert.equal(await p.locator('[data-first-deck]').inputValue(),'b');
await p.getByRole('tab',{name:'Going First',exact:true}).click();assert.ok((await p.locator('[data-ledger-view=first]').textContent()).includes('100.0%'));
await p.fill('#historySearch','Captain America');assert.ok(await p.locator('#history .compact-game').count());await p.fill('#historySearch','');
for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await p.screenshot({path:'/tmp/ledger-mockup-'+width+'.png',fullPage:true})}
await p.locator('#history .compact-game').first().getByRole('button',{name:/^Edit game from/}).click();
assert.ok((await p.locator('#formTitle').textContent()).includes('Edit'));await p.click('#cancelEdit');
await p.locator('#history .compact-game').first().getByRole('button',{name:/^Delete game from/}).click();
assert.ok((await p.locator('.game-delete-dialog').textContent()).includes('permanent'));await p.getByRole('button',{name:'Cancel',exact:true}).click();
await p.selectOption('#statsDatePreset','custom');await p.fill('#statsDateStart','2099-01-01');await p.locator('#statsDateStart').dispatchEvent('change');await p.fill('#statsDateEnd','2099-01-31');await p.locator('#statsDateEnd').dispatchEvent('change');
assert.equal(await p.locator('#summary .stats-games-total strong').textContent(),'0');assert.equal(await p.locator('.ledger-report').count(),2);
assert.deepEqual(errors,[]);
console.log('PASS approved Ledger layout at 320–1440px: no clipped/scrolling reports, stable tabs, independent carousel, original stats and filters, artwork save, history search/edit/delete and empty states');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
