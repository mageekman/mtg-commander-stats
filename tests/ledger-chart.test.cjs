const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.textContent=''}
 setAttribute(key,value){this.attrs[key]=value}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=nodes}
}
const helpers=fs.readFileSync(path.join(__dirname,'../ledger-trend-data.js'),'utf8').replaceAll('export ','');
const source=fs.readFileSync(path.join(__dirname,'../ledger-chart.js'),'utf8').replace(/^import .+?;\n/,'').replace('export function','function');
function chart(games,options){const context={document:{createElementNS:(_,tag)=>new Element(tag)}};vm.runInNewContext(helpers+source+';globalThis.render=renderWinrateTrendChart;',context);const host=new Element('div'),empty=new Element('p');context.render(host,empty,games,options);return {host,empty}}
const descendants=node=>[node,...node.children.flatMap(descendants)];
test('shared trend uses cumulative wins in chronological order',()=>{
 const {host,empty}=chart([{id:'c',played_at:'2026-11-03',won:true},{id:'a',played_at:'2026-11-01',won:true},{id:'b',played_at:'2026-11-02',won:false}]);
 assert.equal(empty.hidden,true);
 assert.deepEqual(descendants(host).filter(n=>n.tag==='title').map(n=>n.textContent).sort(),['Game 1 · 100.0% · 2026-11-01','Game 2 · 50.0% · 2026-11-02','Game 3 · 66.7% · 2026-11-03']);
 assert.equal(descendants(host).filter(n=>n.tag==='path').length,2);
});
test('public history without shared dates renders game labels in supplied order',()=>{
 const {host,empty}=chart([{won:true},{won:false}],{includeUndated:true});
 const nodes=descendants(host);assert.equal(empty.hidden,true);
 assert.deepEqual(nodes.filter(n=>n.tag==='title').map(n=>n.textContent),['Game 1 · 100.0%','Game 2 · 50.0%']);
 assert.ok(nodes.some(n=>n.tag==='text'&&n.textContent==='Game 1'));
});
test('empty or undated private history keeps the empty state',()=>{
 for(const games of [[],[{won:true}]]){const {host,empty}=chart(games);assert.equal(empty.hidden,false);assert.equal(host.children.length,0)}
});
