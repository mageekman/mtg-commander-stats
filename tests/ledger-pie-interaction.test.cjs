const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('ledger-stat-games.js','utf8')).toString('base64'));
test('pie hover and clicks use the same clockwise win/loss arcs',async()=>{const{pieSegmentAt:hit}=await api;assert.equal(hit(160,40,200,200,33.3),'wins');assert.equal(hit(40,160,200,200,33.3),'losses');assert.equal(hit(100,10,200,200,0),'losses');assert.equal(hit(100,190,200,200,100),'wins')});
test('the center opens all games and positions outside the circle select no segment',async()=>{const{pieSegmentAt:hit}=await api;assert.equal(hit(100,100,200,200,50),'all');assert.equal(hit(100,150,200,200,50),'all');assert.equal(hit(0,0,200,200,50),null);assert.equal(hit(0,0,0,200,50),null)});
test('hit testing scales to responsive charts without changing the selected result',async()=>{const{pieSegmentAt:hit}=await api;for(const size of [80,130,200,300]){assert.equal(hit(size*.8,size*.2,size,size,33.3),'wins');assert.equal(hit(size*.2,size*.8,size,size,33.3),'losses');assert.equal(hit(size/2,size/2,size,size,33.3),'all')}});

test('thin secondary rings treat their larger central hole as the all-games target',async()=>{const{pieSegmentAt:hit}=await api;assert.equal(hit(175,100,200,200,50,.78),'all');assert.equal(hit(180,100,200,200,50,.78),'wins')});
