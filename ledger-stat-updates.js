// New optional stats need a unique permanent ID and must default off for existing accounts.
export const ledgerStatUpdates=Object.freeze([
 {id:'color-combo-usage',key:'show_color_usage',label:'Color combo usage',description:'A bar chart of games played with each exact color combination.'},
 {id:'interactive-ledger-stats',key:'enable_stat_games',kind:'feature',label:'Interactive Ledger stats',description:'Select a stat to view its matching games in a compact popup.'}
]);
export function pendingLedgerUpdates(ids,catalog=ledgerStatUpdates){const pending=new Set(Array.isArray(ids)?ids:[]);return catalog.filter(stat=>pending.has(stat.id))}
export function mountLedgerUpdates(host,client,getUser,openSettings){
 let generation=0;
 function render(ids){
  const token=++generation,updates=pendingLedgerUpdates(ids);host.replaceChildren();host.hidden=!updates.length;if(!updates.length)return;
  const heading=document.createElement('h2');heading.id='ledgerUpdatesTitle';heading.textContent=updates.some(item=>item.kind==='feature')?'New in your Ledger':'New Ledger stats';
  const copy=document.createElement('p');copy.append(document.createTextNode(updates.some(item=>item.kind==='feature')?"We've added new features to your Ledger. Go to your ":updates.length===1?"We're tracking a new stat in your Ledger. Go to your ":"We're tracking new stats in your Ledger. Go to your "));
  const link=document.createElement('a');link.href='./ledger.html?settings=1#statisticsSection';link.textContent='Ledger Settings';link.onclick=e=>{e.preventDefault();openSettings()};copy.append(link,document.createTextNode(updates.length===1?' to enable it!':' to enable them!'));
  const list=document.createElement('ul');for(const stat of updates){const item=document.createElement('li');item.textContent=stat.label+' — '+stat.description;list.append(item)}
  const button=document.createElement('button');button.type='button';button.textContent='Dismiss';const status=document.createElement('p');status.setAttribute('role','status');status.className='ledger-updates-status';
  button.onclick=async()=>{const actor=getUser();if(!actor)return;button.disabled=true;status.textContent='';try{const {data,error}=await client.rpc('dismiss_ledger_stat_updates',{update_ids:updates.map(stat=>stat.id)});if(error)throw error;if(token!==generation||getUser()?.id!==actor.id)return;if(!Array.isArray(data))throw Error('Could not confirm dismissal. Please try again.');render(data)}catch(error){if(token===generation)status.textContent='Could not dismiss: '+error.message}finally{if(token===generation)button.disabled=false}};
  host.append(heading,copy,list,button,status);
 }
 return render;
}
