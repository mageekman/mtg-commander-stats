import {createClient} from './vendor/supabase-js.mjs';
import {readPageUser,showAuthPrompt} from './auth-page-state.js?v=share-2';
import {rankingPeriods,rankingRange} from './friend-ranking-period.js?v=1';
import {loadShareLedger} from './share-ledger-data.js?v=1';
import {buildShareStats,resolveRivalColors,periodHeading} from './share-ledger-stats.js?v=1';
import {loadShareAssets} from './share-ledger-assets.js?v=1';
import {renderShareCard,shareCardTypes} from './share-ledger-renderer.js?v=1';
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
function alt(type,s){const scope=s.heading+'. ';if(type==='ledger')return scope+s.stats.games+' games, '+s.stats.wins+' wins, '+s.stats.losses+' losses, '+s.stats.rate.toFixed(1)+'% win rate. Best deck: '+(s.stats.best?.deck.name||'No active deck played')+'.';if(type==='rivalries')return scope+'Rival Commander: '+(s.stats.rivalCommander?s.stats.rivalCommander.name+', '+s.stats.rivalCommander.count+' losses':'None recorded')+'.'+(s.showRivalPlayer?' Rival Player: '+(s.stats.rivalPlayer?.name||'None recorded')+'.':'')+' Rival Color Combo: '+(s.colors?(s.colors.code||'Colorless')+', '+s.colors.losses+' losses':'Unavailable')+'.';return scope+s.stats.top.map((d,i)=>(i+1)+'. '+d.deck.name+', '+(100*d.wins/d.games).toFixed(1)+'% win rate in '+d.games+' games.').join(' ')}
async function generate(){
 if(busy||!user)return;let range;try{range=rankingRange($('sharePeriod').value,$('shareStart').value,$('shareEnd').value)}catch(error){invalidate(error.message);return}
 const token=++epoch,actor=user.id;controller?.abort();const request=new AbortController();controller=request;const timer=setTimeout(()=>request.abort(),30000);busy=true;clearImages();$('generateSnapshots').disabled=true;$('shareForm').setAttribute('aria-busy','true');$('shareStatus').textContent='Reading your Ledger…';
 const showHandle=$('shareHandle').checked,showRivalPlayer=$('shareRivalPlayer').checked;
 try{
  const data=await loadShareLedger(sb,user,range,request.signal);clearTimeout(timer);if(token!==epoch||actor!==user?.id)return;
  const stats=buildShareStats(data.decks,data.games);if(!stats.games){$('shareStatus').textContent='No games in this timeframe. Choose another period or record a game in your Ledger.';return}
  $('shareStatus').textContent='Preparing commander artwork…';const assets=await loadShareAssets(stats,data.profile);if(token!==epoch||actor!==user?.id)return;
  const snapshot={...data,stats,colors:resolveRivalColors(stats.winners,assets.metadata),heading:periodHeading(range,stats),showHandle,showRivalPlayer};
  $('shareStatus').textContent='Creating your three snapshots…';const output=[];
  for(const type of shareCardTypes){const blob=await renderShareCard(type.id,snapshot,assets);if(token!==epoch||actor!==user?.id)return;const suffix=(range.range_start||stats.first)+'-to-'+(range.range_end||stats.last);output.push({type,blob,file:new File([blob],'command-ledger-'+type.id+'-'+suffix+'.png',{type:'image/png'})})}
  for(const item of output){const url=URL.createObjectURL(item.blob);urls.push(url);files.push(item.file);const figure=node('figure');figure.className='share-card';const heading=node('h2',item.type.title),preview=node('a');preview.className='share-preview';preview.href=url;preview.target='_blank';preview.rel='noopener';preview.setAttribute('aria-label','Open '+item.type.title+' image at full size');const image=node('img');image.src=url;image.alt=alt(item.type.id,snapshot);image.width=1080;image.height=1920;preview.append(image);const actions=node('div');actions.className='share-card-actions';const download=node('a','Download PNG');download.className='share-download';download.href=url;download.download=item.file.name;download.setAttribute('aria-label','Download '+item.type.title+' PNG');actions.append(download);if(canShare([item.file])){const button=node('button','Share image');button.type='button';button.onclick=()=>share([item.file]);actions.append(button)}figure.append(heading,preview,actions);$('shareCards').append(figure)}
  $('shareAll').hidden=!canShare(files);$('shareGenerated').textContent='Generated '+new Date().toLocaleString()+'. Each image is a fixed snapshot of this timeframe.';
  $('shareStatus').textContent=assets.missingArtwork?'Your snapshots are ready. Some artwork was unavailable; all recorded stats are included.':'Your three snapshots are ready. Open an image to see it full size, or download a PNG.';
 }catch(error){if(token===epoch){clearImages();$('shareStatus').textContent=request.signal.aborted?'Loading took too long. Please try generating again.':'Could not generate your snapshots: '+error.message}}
 finally{clearTimeout(timer);if(token===epoch){busy=false;controller=null;$('generateSnapshots').disabled=false;$('shareForm').removeAttribute('aria-busy')}}
}
$('shareForm').onsubmit=event=>{event.preventDefault();generate()};$('shareAll').onclick=()=>{if(files.length)share(files)};
async function start(){if(starting)return;starting=true;invalidate('Loading your account…');try{const result=await readPageUser(sb);user=result.user;$('shareControls').hidden=!user;if(!user){$('shareStatus').textContent='';showAuthPrompt($('shareAuth'),{message:'Sign in to generate snapshots of your Ledger.',error:result.error,onRetry:start});return}$('shareAuth').hidden=true;await generate()}finally{starting=false}}
sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){user=null;invalidate('');$('shareControls').hidden=true;showAuthPrompt($('shareAuth'),{message:'Sign in to generate snapshots of your Ledger.',onRetry:start})}else if(event==='SIGNED_IN'&&!starting&&user?.id!==session?.user?.id)setTimeout(start,0)});
start();
