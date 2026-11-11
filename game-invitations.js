const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el};
export function mountGameInvitations(host,{loadInvitations,loadDecks,respond}){
 host.className='game-invitations-panel';
 const heading=node('div');heading.className='friends-heading';heading.append(node('h2','Game invitations'));const refresh=node('button','Refresh');refresh.type='button';heading.append(refresh);
 const intro=node('p','A friend tagged you in a game. Add an independent copy to your Ledger or decline. Edits and deletions never sync between Ledgers; personal notes are not shared.');
 const status=node('p');status.setAttribute('role','status');const list=node('div');host.replaceChildren(heading,intro,status,list);let sequence=0;
 async function load(success=''){
  const current=++sequence;refresh.disabled=true;status.textContent=success||'Loading game invitations…';
  try{
   const [invitations,decks]=await Promise.all([loadInvitations(),loadDecks()]);if(current!==sequence||!host.isConnected)return;list.replaceChildren();
   if(!invitations?.length)list.append(node('p','No pending game invitations.'));
   for(const invitation of invitations||[]){
    const snapshot=invitation.snapshot||{},players=Array.isArray(snapshot.players)?snapshot.players:[],own=players[invitation.recipient_player_index]||{};
    const card=node('article');card.className='game-invitation';const title=node('h3');const sender=node('a',invitation.sender_name||invitation.sender_handle||'A friend');sender.href='./player.html?user='+encodeURIComponent(invitation.sender_handle||'');title.append(sender,document.createTextNode(' tagged you in a game'));card.append(title,node('p',snapshot.played_at+' · '+(snapshot.winner_player===invitation.recipient_player_index?'Win':'Loss')+' for you'),node('p','Your recorded commander: '+(own.commander||'Unknown commander')));
    const details=node('details');details.append(node('summary','View players and game details'));const pod=node('ul');for(const [i,player]of players.entries())pod.append(node('li',(i===invitation.recipient_player_index?'You':player.name?.trim()||player.commander?.trim()||'Player '+(i+1))+' — '+(player.commander||'Unknown commander')+(i===snapshot.winner_player?' · Winner':'')+(i===snapshot.first_player?' · Went first':'')));details.append(pod);card.append(details);
    const label=node('label','Add this game under your deck');const select=node('select');select.required=true;select.setAttribute('aria-label','Your deck for game from '+(invitation.sender_name||invitation.sender_handle));const empty=node('option','Choose your deck');empty.value='';select.append(empty);for(const deck of decks||[]){const option=node('option',deck.name+' — '+deck.commander+(deck.archived_at?' (Archived)':''));option.value=deck.id;select.append(option)}if((decks||[]).some(deck=>deck.id===invitation.suggested_deck_id))select.value=invitation.suggested_deck_id;label.append(select);card.append(label);
    if(!decks?.length){const hint=node('p','Add a deck to your account before accepting this game. ');const add=node('a','Add a deck');add.href='./import.html';hint.append(add);card.append(hint)}
    const actions=node('div');actions.className='game-invitation-actions';const accept=node('button','Add to My Ledger'),decline=node('button','Decline');accept.type=decline.type='button';accept.disabled=!decks?.length;actions.append(accept,decline);const feedback=node('p');feedback.setAttribute('role','status');card.append(actions,feedback);list.append(card);let busy=false;
    async function act(decision){if(busy)return;if(decision==='accept'&&!select.value){select.reportValidity();return}busy=true;accept.disabled=true;decline.disabled=true;feedback.textContent=decision==='accept'?'Adding your copy…':'Declining…';try{await respond(invitation.id,decision,decision==='accept'?select.value:null);document.dispatchEvent(new Event('game-invitations-changed'));await load(decision==='accept'?'Game added to your Ledger. Your copy is independent.':'Game invitation declined.')}catch(error){feedback.textContent='Could not update invitation: '+error.message}finally{busy=false;accept.disabled=!decks?.length;decline.disabled=false}}
    accept.onclick=()=>act('accept');decline.onclick=()=>act('decline');
   }status.textContent=success;
  }catch(error){if(current===sequence&&host.isConnected)status.textContent='Game invitations could not load: '+error.message+' Use Refresh to try again.'}finally{if(current===sequence)refresh.disabled=false}
 }
 refresh.onclick=()=>load();window.addEventListener('focus',()=>{if(host.isConnected&&!host.closest('[hidden]'))load()});load();return load;
}
