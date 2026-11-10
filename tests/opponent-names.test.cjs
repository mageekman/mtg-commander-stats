const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../opponent-names.js'),'utf8').replace(/export /g,'');
const context={};vm.runInNewContext(source+';globalThis.classify=isGenericOpponentName',context);
const cases=require('./opponent-name-cases.json');
test('generic placeholders and real names match the universal classification fixtures',()=>{
 for(const item of cases)assert.equal(context.classify(item.name),item.generic,JSON.stringify(item.name));
});
test('ranking skips every higher-count generic candidate and selects the next real player',()=>{
 const names=[...Array(12).fill('Opponent 1'),...Array(9).fill('ENEMY #2'),...Array(7).fill('Unknown Player'),...Array(4).fill('Sarah'),...Array(2).fill('Alex')];
 const counts=new Map();for(const name of names.filter(n=>!context.classify(n)))counts.set(name,(counts.get(name)||0)+1);
 assert.deepEqual([...counts].sort((a,b)=>b[1]-a[1])[0],['Sarah',4]);
 assert.equal(names.slice(0,28).filter(n=>!context.classify(n)).length,0);
});
