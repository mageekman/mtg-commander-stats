import {populatedLedgerShareCards} from './share-card-layout.js?v=1';
import {normalizeLedgerSettings} from './ledger-settings.js?v=by-deck-minimum-1';
import {createClient} from './vendor/supabase-js.mjs';
import {readPageUser,showAuthPrompt} from './auth-page-state.js?v=share-2';
import {rankingPeriods,rankingRange} from './friend-ranking-period.js?v=1';
import {loadShareLedger} from './share-ledger-data.js?v=2';
import {buildShareStats,resolveRivalColors,resolveOwnColors,availableShareCards,periodHeading} from './share-ledger-stats.js?v=by-deck-minimum-1';
import {loadShareAssets} from './share-ledger-assets.js?v=by-deck-minimum-1';
import {renderShareCard,shareCardTypes} from './share-ledger-renderer.js?v=by-deck-minimum-1';
const sb=createClient('https://enhzzsjccvthrwolxobr.supabase.co','sb_publishable_Vu_wsXslcziuawF7L8cfrw_p9QKmZMT'),$=id=>document.getElementById(id);
let user=null,epoch=0,busy=false,controller=null,urls=[],files=[],starting=false;
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const query=new URLSearchParams(location.search);
for(const[value,label]of rankingPeriods){const option=node('option',label);option.value=value;$('sharePeriod').append(option)}
$('sharePeriod').value=rankingPeriods.some(([value])=>value===query.get('period'))?query.get('period'):'all';$('shareStart').value=query.get('start')||'';$('shareEnd').value=query.get('end')||'';
function setDateFields(){const custom=$('sharePeriod').value==='custom';$('shareDates').hidden=!custom;$('shareStart').required=$('shareEnd').required=custom}
setDateFields();
function clearImages(){for(const url of urls)URL.revokeObjectURL(url);urls=[];files=[];$('shareCards').replaceChildren();$('shareAll').hidden=true;$('shareGenerated').textContent=''}
function invalidate(message='Settings changed. Generate snapshots to update your images.'){epoch++;controller?.abort();controller=null;busy=false;clearImages();$('generateSnapshots').disabled=false;$('shareForm').removeAttribute('aria-busy');$('shareStatus').textContent=message}
$('shareForm').addEventListener('change',()=>{setDateFields();invalidate()});
function canShare(items){try{return !!navigator.canShare?.({files:items})}catch{return false}}
async function share(items){try{await navigator.share({files:items,title:'My Command Ledger'});$('shareStatus').textContent='Images ready to share.'}catch(error){$('shareStatus').textContent=error.name==='AbortError'?'Sharing cancelled. Your images are still ready to download.':'Sharing is unavailable here. Use Download PNG to save your images.'}}
function alt(type,s){const v=s.settings,details=[s.heading];if(type==='ledger'){details.push(s.profile.display_name||s.profile.handle,s.profile.favorite_commander);if(v.share_record&&s.stats.games)details.push(s.stats.games+' games');if(v.share_win_chart&&s.stats.games)details.push(s.stats.wins+' wins, '+s.stats.losses+' losses, '+s.stats.rate.toFixed(1)+'% win rate');if(v.share_best_deck&&s.stats.best)details.push('Best deck: '+s.stats.best.deck.name);if(v.share_deck_rotation&&s.stats.games)details.push(s.stats.activeDecks+' decks in rotation')}else if(type==='rivalries'){if(v.share_lost_to_commander&&s.stats.rivalCommander)details.push('Rival Commander: '+s.stats.rivalCommander.name+', '+s.stats.rivalCommander.count+' losses');if(v.share_lost_to_player&&s.showRivalPlayer&&s.stats.rivalPlayer)details.push('Rival Player: '+s.stats.rivalPlayer.name);if(v.share_lost_to_color&&s.colors)details.push('Rival Color Combo: '+(s.colors.code||'Colorless')+', '+s.colors.losses+' losses')}else{if(v.share_deck_stats&&v.share_best_deck)details.push(...s.stats.top.map((d,i)=>(i+1)+'. '+d.deck.name+', '+(100*d.wins/d.games).toFixed(1)+'% win rate in '+d.games+' games'));if(v.share_most_played_deck&&s.stats.most)details.push('Most played: '+s.stats.most.deck.name);if(v.share_most_played_color&&s.ownColors.most)details.push('Most played color: '+(s.ownColors.most.code||'Colorless'));if(v.share_best_color_combo&&s.ownColors.best)details.push('Strongest Color: '+(s.ownColors.best.code||'Colorless')+', '+s.ownColors.best.rate.toFixed(1)+'%')}return details.filter(Boolean).join('. ')+'.'}

async function generate(){
 if(busy||!user)return;let range;try{range=rankingRange($('sharePeriod').value,$('shareStart').value,$('shareEnd').value)}catch(error){invalidate(error.message);return}
 const token=++epoch,actor=user.id;controller?.abort();const request=new AbortController();controller=request;const timer=setTimeout(()=>request.abort(),30000);busy=true;clearImages();$('generateSnapshots').disabled=true;$('shareForm').setAttribute('aria-busy','true');$('shareStatus').textContent='Reading your Ledger…';
 const showHandle=$('shareHandle').checked,showRivalPlayer=$('shareRivalPlayer').checked;
 try{
  const data=await loadShareLedger(sb,user,range,request.signal);clearTimeout(timer);if(token!==epoch||actor!==user?.id)return;
  const settings=normalizeLedgerSettings(data.profile.ledger_settings),stats=buildShareStats(data.decks,data.games,settings);
  $('shareRivalPlayer').disabled=!settings.share_lost_to_player;const types=availableShareCards(settings).filter(id=>id!=='rivalries'||settings.share_lost_to_commander||settings.share_lost_to_color||showRivalPlayer);if(!stats.games){$('shareStatus').textContent='No games in this timeframe. Choose another period or record a game in your Ledger.';return}
  $('shareStatus').textContent='Preparing commander artwork…';const assets=await loadShareAssets(stats,data.profile,data.decks);if(token!==epoch||actor!==user?.id)return;
  const snapshot={...data,stats,settings,ownColors:resolveOwnColors(data.decks,data.games,assets.metadata,settings),colors:resolveRivalColors(stats.winners,assets.metadata),heading:periodHeading(range,stats),showHandle,showRivalPlayer};
  $('shareStatus').textContent='Creating your snapshots…';const output=[];
  for(const type of shareCardTypes.filter(type=>types.includes(type.id)&&populatedLedgerShareCards(snapshot).includes(type.id))){const blob=await renderShareCard(type.id,snapshot,assets);if(token!==epoch||actor!==user?.id)return;const suffix=(range.range_start||stats.first)+'-to-'+(range.range_end||stats.last);output.push({type,blob,file:new File([blob],'command-ledger-'+type.id+'-'+suffix+'.png',{type:'image/png'})})}
  if(!output.length){$('shareStatus').textContent='No populated stats are enabled for this timeframe. Choose another period or update your Ledger settings.';return}
  for(const item of output){const url=URL.createObjectURL(item.blob);urls.push(url);files.push(item.file);const figure=node('figure');figure.className='share-card';const heading=node('h2',item.type.title),preview=node('a');preview.className='share-preview';preview.href=url;preview.target='_blank';preview.rel='noopener';preview.setAttribute('aria-label','Open '+item.type.title+' image at full size');const image=node('img');image.src=url;image.alt=alt(item.type.id,snapshot);image.width=1080;image.height=1920;preview.append(image);const actions=node('div');actions.className='share-card-actions';const download=node('a','Download PNG');download.className='share-download';download.href=url;download.download=item.file.name;download.setAttribute('aria-label','Download '+item.type.title+' PNG');actions.append(download);if(canShare([item.file])){const button=node('button','Share image');button.type='button';button.onclick=()=>share([item.file]);actions.append(button)}figure.append(heading,preview,actions);$('shareCards').append(figure)}
  $('shareAll').hidden=files.length<2||!canShare(files);$('shareGenerated').textContent='Generated '+new Date().toLocaleString()+'. Each image is a fixed snapshot of this timeframe.';
  $('shareStatus').textContent=assets.missingArtwork?'Your snapshots are ready. Some artwork was unavailable; your visible Ledger stats are included.':'Your snapshots are ready. Ledger display settings have been applied. Open an image to see it full size, or download a PNG.';
 }catch(error){if(token===epoch){clearImages();$('shareStatus').textContent=request.signal.aborted?'Loading took too long. Please try generating again.':'Could not generate your snapshots: '+error.message}}
 finally{clearTimeout(timer);if(token===epoch){busy=false;controller=null;$('generateSnapshots').disabled=false;$('shareForm').removeAttribute('aria-busy')}}
}
$('shareForm').onsubmit=event=>{event.preventDefault();generate()};$('shareAll').onclick=()=>{if(files.length)share(files)};
async function start(){if(starting)return;starting=true;invalidate('Loading your account…');try{const result=await readPageUser(sb);user=result.user;$('shareControls').hidden=!user;if(!user){$('shareStatus').textContent='';showAuthPrompt($('shareAuth'),{message:'Sign in to generate snapshots of your Ledger.',error:result.error,onRetry:start});return}$('shareAuth').hidden=true;await generate()}finally{starting=false}}
sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){user=null;invalidate('');$('shareControls').hidden=true;showAuthPrompt($('shareAuth'),{message:'Sign in to generate snapshots of your Ledger.',onRetry:start})}else if(event==='SIGNED_IN'&&!starting&&user?.id!==session?.user?.id)setTimeout(start,0)});
start();
