import {privacyGroups} from './profile-stat-privacy.js?v=1';
export const ledgerSettingGroups=privacyGroups;
export const ledgerVisibilityKeys=ledgerSettingGroups.flatMap(([,fields])=>fields.map(([key])=>key));
export function normalizeLedgerSettings(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const minimum=Number(source.best_deck_min_games);
 return {best_deck_min_games:Number.isInteger(minimum)&&minimum>=1&&minimum<=100000?minimum:1,...Object.fromEntries(ledgerVisibilityKeys.map(key=>[key,source[key]!==false]))};
}
export async function readLedgerSettings(client,user){
 if(!user?.id)return normalizeLedgerSettings();
 const {data,error}=await client.from('profiles').select('ledger_settings').eq('id',user.id).maybeSingle();
 if(error)throw error;
 if(!data)throw Error('Your Ledger settings could not be loaded.');
 return normalizeLedgerSettings(data.ledger_settings);
}
export async function saveLedgerSettings(client,user,value){
 if(!user?.id)throw Error('Sign in to save Ledger settings.');
 const settings=normalizeLedgerSettings(value);
 const {data,error}=await client.from('profiles').update({ledger_settings:settings}).eq('id',user.id).select('ledger_settings').single();
 if(error)throw error;
 return normalizeLedgerSettings(data.ledger_settings);
}
export function applyLedgerVisibility(root,value){
 const s=normalizeLedgerSettings(value),show=(selector,visible)=>{for(const e of root.querySelectorAll(selector))e.hidden=!visible};
 for(const [key,selector] of Object.entries({share_record:'.stats-games-total',share_win_chart:'.stats-donut,.stats-pie-legend>div:not(.stats-games-total)',share_win_trend:'.winrate-trend',share_best_deck:'#bestDeck',share_most_played_deck:'#mostPlayedDeck',share_most_played_color:'#statInsights>.insight-stat:first-child',share_best_color_combo:'#statInsights>.insight-stat:nth-child(2)',share_lost_to_commander:'#nemesisCommander',share_lost_to_player:'#rivalPlayerSlot',share_lost_to_color:'#rivalColorSlot',share_deck_stats:'.ledger-by-deck'}))show(selector,s[key]);
 show('#summary',s.share_record||s.share_win_chart);show('.ledger-chart-row',s.share_record||s.share_win_chart||s.share_win_trend);show('.featured-decks',s.share_best_deck||s.share_most_played_deck);show('#statInsights',s.share_most_played_color||s.share_best_color_combo);show('.ledger-rivalry',s.share_lost_to_commander||s.share_lost_to_player||s.share_lost_to_color);
 const panels={first:'share_first_player',rotation:'share_deck_rotation',together:'share_games_together',results:'share_friend_results'};
 for(const report of root.querySelectorAll('.ledger-report')){
  const tabs=[...report.querySelectorAll('[role=tab]')];for(const tab of tabs){tab.hidden=!s[panels[tab.dataset.view]];const panel=report.querySelector('#'+tab.getAttribute('aria-controls'));panel.toggleAttribute('data-ledger-disabled',tab.hidden)}
  const allowed=tabs.filter(tab=>!tab.hidden),selected=allowed.find(tab=>tab.getAttribute('aria-selected')==='true')||allowed[0];
  report.hidden=!allowed.length;report.querySelector('[role=tablist]').style.gridTemplateColumns='repeat('+Math.max(1,allowed.length)+',minmax(0,1fr))';if(selected)selected.click();
 }
 show('#ledgerAdditionalStats',s.share_first_player||s.share_deck_rotation||s.share_games_together||s.share_friend_results);
 for(const selector of ['.featured-decks','#statInsights','.ledger-chart-row','.ledger-additional-stats']){const row=root.querySelector(selector);if(row)row.style.gridTemplateColumns='repeat('+Math.max(1,[...row.children].filter(e=>!e.hidden).length)+',minmax(0,1fr))'}
 const rivals=root.querySelector('.ledger-rivalry-grid');if(rivals)rivals.style.gridTemplateColumns=[...rivals.children].filter(e=>!e.hidden).map(e=>e.id==='nemesisCommander'?'minmax(0,2fr)':'minmax(0,1fr)').join(' ');
}
export function mountLedgerSettings(client,getUser,onSave){
 const dialog=document.getElementById('ledgerSettingsDialog'),form=document.getElementById('ledgerSettingsForm'),status=document.getElementById('ledgerSettingsStatus'),fields=document.getElementById('ledgerSettingsFields');
 let current=normalizeLedgerSettings(),saving=false;
 for(const [title,choices]of ledgerSettingGroups){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);for(const [key,title]of choices){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=key;label.append(input,document.createTextNode(' '+title));group.append(label)}fields.append(group)}
 document.getElementById('openLedgerSettings').onclick=()=>{form.elements.best_deck_min_games.value=current.best_deck_min_games;for(const key of ledgerVisibilityKeys)form.elements[key].checked=current[key];status.textContent='';dialog.showModal()};
 document.getElementById('closeLedgerSettings').onclick=()=>{if(!saving)dialog.close()};dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault()});
 form.onsubmit=async e=>{e.preventDefault();if(saving)return;const actor=getUser();if(!actor)return;const draft={best_deck_min_games:Number(form.elements.best_deck_min_games.value),...Object.fromEntries(ledgerVisibilityKeys.map(key=>[key,form.elements[key].checked]))};saving=true;form.querySelector('button[type=submit]').disabled=true;status.textContent='Saving…';try{const saved=await saveLedgerSettings(client,actor,draft);if(getUser()?.id!==actor.id)return;current=saved;onSave(saved);dialog.close()}catch(error){status.textContent='Could not save settings: '+error.message}finally{saving=false;form.querySelector('button[type=submit]').disabled=false}};
 return value=>{current=normalizeLedgerSettings(value)};
}
