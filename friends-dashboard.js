const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el};
const rate=value=>Number(value).toFixed(1)+'%';
const delta=(value,unit)=>value===0?'Same as you':(value>0?'+':'−')+Math.abs(value).toLocaleString(undefined,{maximumFractionDigits:1})+' '+unit;
export function renderFriendDashboard(host,data,{loadPassport,loadArtwork,applyArtwork}={}){
 const passportJobs=[],identities=new Map();
 function hydrate(link,row){
  if(!loadPassport||!row.handle)return;
  if(!identities.has(row.handle))identities.set(row.handle,(async()=>{const profile=await loadPassport(row.handle);let artwork=null;try{if(profile?.favorite_commander&&loadArtwork)artwork=await loadArtwork(profile.favorite_commander)}catch{}return {profile,artwork}})());
  identities.get(row.handle).then(({profile,artwork})=>{if(!link.isConnected)return;if(profile?.display_name)link.querySelector('.ranking-passport-name').textContent=profile.display_name;if(artwork){const image=node('img');image.src=artwork;image.alt='';image.loading='lazy';image.decoding='async';link.prepend(image);applyArtwork?.(image,profile)}}).catch(()=>{});
 }
 host.replaceChildren();host.className='friend-dashboard';
 const self=data?.self||{games:0,wins:0,win_rate:null},rates=data?.win_rates||[],games=data?.games_logged||[];
 const heading=node('div');heading.className='dashboard-heading';heading.append(node('h2','Friend Rankings'),node('p','All time · You and friends who share the relevant profile stats. Win-rate ties go to the player with more games played.'));
 const summary=node('div');summary.className='friend-comparison-summary';
 const myRate=rates.find(row=>row.is_you),myGames=games.find(row=>row.is_you);
 for(const [label,value,detail]of [
  ['Your win rate',Number(self.games)>0?rate(self.win_rate):'Unranked',Number(self.games)>0?self.wins+' wins in '+self.games+' games':'Log a game to join the win-rate ranking'],
  ['Your games logged',Number(self.games)||0,'All recorded games'],
  ['Your win-rate rank',myRate?'#'+myRate.rank:'—',rates.length+' ranked player'+(rates.length===1?'':'s')],
  ['Your games-logged rank',myGames?'#'+myGames.rank:'—',games.length+' ranked player'+(games.length===1?'':'s')]
 ]){const card=node('div');card.className='friend-summary-card';card.append(node('span',label),node('strong',value),node('small',detail));summary.append(card)}
 host.append(heading,summary);
 const boards=node('div');boards.className='friend-leaderboards';
 for(const [kind,title,description,rows]of [
  ['rate','Win Rate Rankings','Public win-rate stats only. At least one game is required.',rates],
  ['games','Games Logged Rankings','Friends who share Games Played on their profiles.',games]
 ]){
  const section=node('section');section.className='friend-leaderboard';section.dataset.ranking=kind;const titleEl=node('h3',title);titleEl.id='friend-ranking-'+kind;section.append(titleEl,node('p',description));
  if(!rows.length){section.append(node('p',kind==='rate'?'No eligible players yet. Record your first game or connect with friends who share their win rate.':'No eligible players yet.'));boards.append(section);continue}
  const wrap=node('div');wrap.className='friend-ranking-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-labelledby',titleEl.id);
  const table=node('table');const caption=node('caption',title+' — all time');caption.className='ranking-sr-only';table.append(caption);const head=node('thead'),header=node('tr');for(const label of ['Rank','Player',kind==='rate'?'Win rate':'Games','Compared with you']){const th=node('th',label);th.scope='col';if(label==='Compared with you'&&kind==='rate')th.title='Win-rate difference in percentage points';header.append(th)}head.append(header);table.append(head);const body=node('tbody');
  for(const row of rows){const tr=node('tr');if(row.is_you)tr.className='ranking-you';const position=node('td','#'+row.rank);const player=node('th');player.scope='row';const link=node('a');link.className='ranking-passport';link.href=row.is_you?'./profile.html':'./player.html?user='+encodeURIComponent(row.handle||'');link.setAttribute('aria-label',row.is_you?'View your player passport':'View '+(row.display_name||row.handle||'Player')+' player passport');link.title=(row.display_name||row.handle||'You')+(row.handle?' · @'+row.handle:'');const shade=node('span');shade.className='ranking-passport-shade';const copy=node('span');copy.className='ranking-passport-copy';const display=node('strong',row.display_name||row.handle||'You');display.className='ranking-passport-name';copy.append(display);if(row.handle){const handle=node('small','@'+row.handle);handle.className='ranking-passport-handle';copy.append(handle)}link.append(shade,copy);player.append(link);passportJobs.push(()=>hydrate(link,row));const metric=node('td',kind==='rate'?rate(row.win_rate):Number(row.games).toLocaleString());if(kind==='rate')metric.append(node('small',row.games+' games'));let comparison='';if(row.is_you)comparison='Your record';else if(kind==='rate')comparison=Number(self.games)>0?delta(Number(row.win_rate)-Number(self.win_rate),'pp'):'—';else comparison=delta(Number(row.games)-Number(self.games),'games');tr.append(position,player,metric,node('td',comparison));body.append(tr)}
  table.append(body);wrap.append(table);section.append(wrap);boards.append(section);
 }
 host.append(boards);
 for(const job of passportJobs)job();
}
