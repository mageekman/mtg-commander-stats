export const rankingPeriods=[['all','All time'],['month','This month'],['lastMonth','Last month'],['30','Last 30 days'],['90','Last 90 days'],['year','This year'],['lastYear','Last year'],['custom','Custom dates']];
export function dateString(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d}
export function rankingRange(mode,startValue,endValue,now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());let start,end=today;
 if(mode==='all')return {range_start:null,range_end:null,label:'All time'};
 if(mode==='custom'){
  if(!validDate(startValue)||!validDate(endValue))throw Error('Choose both a start and end date.');
  if(startValue>endValue)throw Error('The start date must be on or before the end date.');
  return {range_start:startValue,range_end:endValue,label:startValue+' through '+endValue};
 }
 if(mode==='month')start=new Date(today.getFullYear(),today.getMonth(),1);
 else if(mode==='lastMonth'){start=new Date(today.getFullYear(),today.getMonth()-1,1);end=new Date(today.getFullYear(),today.getMonth(),0)}
 else if(mode==='year')start=new Date(today.getFullYear(),0,1);
 else if(mode==='lastYear'){start=new Date(today.getFullYear()-1,0,1);end=new Date(today.getFullYear()-1,11,31)}
 else if(mode==='30'||mode==='90'){start=new Date(today);start.setDate(start.getDate()-(Number(mode)-1))}
 else throw Error('Choose a valid time period.');
 return {range_start:dateString(start),range_end:dateString(end),label:rankingPeriods.find(([value])=>value===mode)[1]};
}
