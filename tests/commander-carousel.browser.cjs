const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});try{
 const page=await browser.newPage({reducedMotion:'reduce'});const styles=fs.readFileSync('deck.html','utf8').match(/<style[\s\S]*?<\/style>|<link[^>]+rel="stylesheet"[^>]*>/g).join('');const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://stats.test/**',route=>{const file=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
 if(file==='fixture.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'<aside id="deckSummary" class="deck-hero-performance"></aside><main id="deckContent"></main><script type="module" src="/fixture.js"></script>'});
 if(file==='fixture.js')return route.fulfill({contentType:'text/javascript',body:"import {mountDeckPerformance} from './deck-performance.js';window.commandLedgerCommanderArtwork=async()=>'/cl-logo-final-transparent.png';window.commandLedgerPrefetchCommanders=async()=>{};const games=[{id:'1',deck_id:'deck',played_at:'2026-11-10',won:true,first_player:0,winner_player:0,players:[{}, {name:'Alex',friend_id:'f',commander:'Captain America'}]},{id:'2',deck_id:'deck',played_at:'2026-11-09',won:false,first_player:1,winner_player:1,players:[{}, {name:'Alex',friend_id:'f',commander:'The Ur-Dragon'}]},{id:'3',deck_id:'deck',played_at:'2026-10-01',won:false,first_player:null,winner_player:null,players:null,opponents:['The Ur-Dragon']}];for(let i=0;i<14;i++)for(let n=0;n<6;n++)games.push({id:'extra-'+i+'-'+n,deck_id:'deck',played_at:'2026-11-10',won:i%2===0,first_player:0,winner_player:i%2===0?0:1,players:[{}, {commander:'Commander '+i+' of the Very Long and Complicated Legendary Title Across the Multiverse'}]});const client={rpc:async()=>({data:[{id:'f',display_name:'Alex the Commander Collector',handle:'alex'}]}),from:table=>{const q={select:()=>q,single:()=>q,eq:()=>q,order:()=>q,range:()=>q,upsert:async row=>{const frames=JSON.parse(localStorage.frames||'[]').filter(f=>f.slot!==row.slot||f.commander!==row.commander);frames.push(row);localStorage.frames=JSON.stringify(frames);return{}},then:resolve=>resolve({data:table==='ledger_art_adjustments'?JSON.parse(localStorage.frames||'[]'):games})};return q}};await mountDeckPerformance(document.getElementById('deckContent'),{id:'deck'},{id:'me'},client,document.getElementById('deckSummary'));"});
 const local=path.resolve(file);if(!local.startsWith(process.cwd()+path.sep)||!fs.existsSync(local)||!fs.statSync(local).isFile())return route.fulfill({status:404,body:''});
 return route.fulfill({body:fs.readFileSync(local),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/plain'});
 });
 await page.goto('https://stats.test/fixture.html');await page.waitForFunction(()=>document.querySelectorAll('.deck-commander-carousel .deck-commander-matchup').length===16);
 assert.equal(await page.locator('[data-insight=matchups] .deck-stat-pagination').count(),0);
 assert.equal(await page.locator('[data-insight=matchups] .deck-insight-body>p').count(),0);
 assert.ok(await page.locator('.deck-commander-carousel .deck-matchup-badge').count()>=2);
 for(const width of [1440,1024,768,700,390,320]){
  await page.setViewportSize({width,height:1000});
  const body=page.locator('[data-insight=matchups] .deck-insight-body'),carousel=page.locator('.deck-commander-carousel');
  assert.ok(await body.evaluate(e=>e.scrollHeight<=e.clientHeight+1),'vertical body overflow '+width);
  assert.ok(await page.locator('[data-insight=matchups]').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'vertical panel overflow '+width);
  assert.ok(await page.locator('.deck-commander-carousel .deck-rate-row').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().bottom<=e.closest('.deck-commander-carousel').getBoundingClientRect().bottom+1)),'stats cut off '+width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
  assert.equal(await carousel.locator('.deck-commander-matchup').count(),16);
  await carousel.evaluate(e=>e.scrollLeft=0);await page.waitForFunction(()=>document.querySelector('.deck-commander-carousel').scrollLeft<2);
  await page.getByRole('button',{name:'Next commander matchups',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.deck-commander-carousel').scrollLeft>5);
  await carousel.focus();const previous=await carousel.evaluate(e=>e.scrollLeft);await page.keyboard.press('ArrowRight');await page.waitForFunction(previous=>document.querySelector('.deck-commander-carousel').scrollLeft>previous+5,previous);
  await carousel.evaluate(e=>e.scrollLeft=e.scrollWidth);await page.waitForFunction(()=>document.querySelector('.deck-commander-carousel-controls button:last-child').disabled);
  assert.equal(await carousel.locator('.deck-commander-matchup').last().isVisible(),true);assert.equal(await page.getByRole('button',{name:'Next commander matchups',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Previous commander matchups',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.deck-commander-carousel-controls button:last-child').disabled);
 }
 await page.locator('.deck-commander-carousel').evaluate(e=>e.scrollLeft=0);await page.locator('.deck-commander-carousel .ledger-adjust-art').first().click();await page.locator('dialog [data-frame=y]').fill('60');await page.click('dialog [data-action=save]');await page.waitForFunction(()=>!document.querySelector('dialog'));
 assert.equal(await page.locator('.deck-commander-carousel .has-art>img:not(.deck-stat-art-fallback)').first().evaluate(e=>e.style.objectPosition),'50% 60%');
 await page.selectOption('#deckStatsPeriod','month');assert.equal(await page.locator('.deck-commander-carousel .deck-commander-matchup').count(),16);assert.equal(await page.getByRole('tab',{name:'Commanders',exact:true}).getAttribute('aria-selected'),'true');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('[data-group=matchups]').screenshot({path:'/tmp/commander-carousel-'+width+'.png'})}
 assert.deepEqual(errors,[]);console.log('PASS continuous 16-card carousel, arrow/keyboard navigation, end states, no vertical overflow/clipped stats at 320–1440px, long names/badges, saved artwork and period changes');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
